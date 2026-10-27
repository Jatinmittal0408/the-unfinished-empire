// Turn a run's logs into numbers.
//   node diagnostics/analyse.mjs <out-label> [page-name ...]   (default pages: cold warm)
// Writes diagnostics/out/<label>/<page>.analysis.json and prints a summary.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { launch } from '../scripts/lib/browser.mjs';

const [label, ...names] = process.argv.slice(2);
const DIR = new URL(`./out/${label}/`, import.meta.url).pathname;
const pages = names.length ? names : ['cold', 'warm'];
const FRAME = 1000 / 24;
const r1 = (x) => (x == null || Number.isNaN(x) ? null : Math.round(x * 10) / 10);
const pct = (a, p) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };

let browser = null;
const decoder = async () => { if (!browser) { browser = await launch(); const pg = await browser.newPage(); browser.__page = pg; } return browser.__page; };

for (const name of pages) {
  const D = JSON.parse(readFileSync(`${DIR}${name}.diag.json`, 'utf8'));
  const ev = D.events, vfc = D.vfc, raf = D.raf;
  const A = { page: name, refreshHz: D.refresh, steps: D.steps.map((s) => ({ what: s.what, t: r1(s.pageT) })) };

  // ── phases ──
  A.phases = ev.filter((e) => e.type === 'phase').map((e) => ({ t: r1(e.t), phase: e.phase }));

  // ── play sessions: from a play() call to the next pause/ended/detach of that element ──
  const sessions = [];
  ev.forEach((e, i) => {
    if (e.type !== 'call:play') return;
    const clip = e.clip;
    // a session ends at pause/ended/detach, or at the next play() call on the same clip (React StrictMode calls intro() twice in dev)
    const end = ev.slice(i + 1).find((x) => x.clip === clip && ['video:pause', 'video:ended', 'dom:video-detached', 'call:play'].includes(x.type));
    const tEnd = end ? end.t : Infinity;
    const resolved = ev.slice(i + 1).find((x) => x.clip === clip && x.type.startsWith('call:play:'));
    const playing = ev.slice(i + 1).find((x) => x.clip === clip && x.type === 'video:playing' && x.t <= tEnd);
    const frames = vfc.filter((f) => f.clip === clip && f.t >= e.t && f.t <= tEnd + 1);
    const waits = ev.filter((x) => x.clip === clip && x.t >= e.t && x.t <= tEnd && (x.type === 'video:waiting' || x.type === 'video:stalled'));
    const waitSpans = waits.filter((w) => w.type === 'video:waiting').map((w) => { const p = ev.find((x) => x.clip === clip && x.type === 'video:playing' && x.t > w.t); return r1((p ? p.t : tEnd) - w.t); });
    // frame cadence while playing (after the first frame)
    const gaps = frames.slice(1).map((f, k) => f.t - frames[k].t);
    const dmt = frames.slice(1).map((f, k) => f.mediaTime - frames[k].mediaTime);
    const skipped = dmt.filter((d) => d > 1.5 / 24).reduce((a, d) => a + Math.round(d * 24) - 1, 0);
    const repeats = dmt.filter((d) => Math.abs(d) < 1e-4).length;
    const backwards = dmt.filter((d) => d < -1e-4).length;
    const presentedDelta = frames.length ? frames.at(-1).presented - frames[0].presented + 1 : 0;
    const q = D.quality.filter((x) => x.clip === clip && x.t >= e.t && x.t <= tEnd + 300);
    const firstSrcFrame = frames.length ? Math.round(frames[0].mediaTime * 24) : null;
    sessions.push({
      clip, call: r1(e.t), readyStateAtCall: e.readyState, networkStateAtCall: e.networkState, currentTimeAtCall: e.currentTime, bufferedAtCall: e.buffered,
      resolved_ms: resolved ? r1(resolved.t - e.t) : null, result: resolved?.type, playingEvent_ms: playing ? r1(playing.t - e.t) : null,
      firstFrame_ms: frames.length ? r1(frames[0].t - e.t) : null, firstFrameSourceIndex: firstSrcFrame,
      end: end ? { type: end.type, t: r1(end.t), currentTime: end.currentTime } : null, duration_ms: end ? r1(end.t - e.t) : null,
      callbacks: frames.length, presentedFramesDelta: presentedDelta, uniqueSourceFrames: new Set(frames.map((f) => f.mediaTime)).size,
      skippedSourceFrames: skipped, repeatedFrames: repeats, mediaTimeBackwards: backwards,
      gapP50_ms: r1(pct(gaps, 0.5)), gapP95_ms: r1(pct(gaps, 0.95)), gapMax_ms: r1(gaps.length ? Math.max(...gaps) : null),
      gapsOver2Frames: gaps.filter((g) => g > 2 * FRAME + 4).length,
      worstGaps: gaps.map((g, k) => ({ at: r1(frames[k + 1].t), gap: r1(g), mediaTime: frames[k + 1].mediaTime })).filter((g) => g.gap > 2 * FRAME + 4).slice(0, 8),
      lastMediaTime: frames.length ? frames.at(-1).mediaTime : null,
      waitingEvents: waits.filter((w) => w.type === 'video:waiting').length, stalledEvents: waits.filter((w) => w.type === 'video:stalled').length, waitingSpans_ms: waitSpans,
      droppedFrames: q.length ? q.at(-1).dropped - q[0].dropped : null, decodedFrames: q.length ? q.at(-1).total - q[0].total : null,
    });
  });
  A.sessions = sessions;

  // ── seeks ──
  A.seeks = ev.filter((e) => e.type === 'call:seek').map((e) => {
    const done = ev.find((x) => x.clip === e.clip && x.type === 'video:seeked' && x.t >= e.t);
    return { clip: e.clip, t: r1(e.t), from: e.currentTime, to: e.to, readyState: e.readyState, seekToSeeked_ms: done ? r1(done.t - e.t) : null };
  });

  // ── what overlapped: how many clips were presenting frames at the same time ──
  const activeAt = (t) => new Set(vfc.filter((f) => Math.abs(f.t - t) < 2 * FRAME).map((f) => f.clip));
  const overlaps = []; let cur = null;
  for (const r of raf) { const set = [...activeAt(r.t)].sort().join('+'); if (set.includes('+')) { if (!cur || cur.set !== set) { cur = { set, from: r.t, to: r.t }; overlaps.push(cur); } else cur.to = r.t; } else cur = null; }
  A.simultaneousDecode = overlaps.map((o) => ({ clips: o.set, from: r1(o.from), duration_ms: r1(o.to - o.from) }));

  // ── layer animations actually executed (from per-frame samples) ──
  const series = {};
  for (const r of raf) for (const l of r.layers) (series[l.id] ??= []).push({ t: r.t, o: l.o, s: l.s, video: l.video, img: l.img, z: l.z });
  const ramps = [];
  for (const [id, sr] of Object.entries(series)) {
    for (const key of ['o', 's']) {
      let i = 0;
      while (i < sr.length - 1) {
        const eps = key === 'o' ? 0.0005 : 0.000005;
        const moving = (k) => sr[k + 1][key] != null && sr[k][key] != null && Math.abs(sr[k + 1][key] - sr[k][key]) > eps && sr[k + 1].t - sr[k].t < 200;
        if (!moving(i)) { i++; continue; }
        // extend while the value keeps changing, tolerating up to 3 unchanged samples (slow ease tails)
        let j = i + 1, still = 0;
        while (j < sr.length - 1 && still <= 3) { if (moving(j)) still = 0; else still++; j++; }
        j -= still;
        const dts = sr.slice(i + 1, j + 1).map((x, k) => x.t - sr[i + k].t);
        ramps.push({ layer: id, prop: key === 'o' ? 'opacity' : 'scale', start: r1(sr[i].t), end: r1(sr[j].t), duration_ms: r1(sr[j].t - sr[i].t), from: sr[i][key], to: sr[j][key], samples: j - i, maxFrameInterval_ms: r1(Math.max(...dts)) });
        i = j;
      }
    }
  }
  A.ramps = ramps.filter((r) => r.duration_ms > 30).sort((a, b) => a.start - b.start);
  A.titleFades = (() => { const out = []; let prev = null; for (const r of raf) { if (prev && r.title !== prev.title && (r.title === null || prev.title === null)) out.push({ t: r1(r.t), from: prev.title, to: r.title }); prev = r; } return out; })();

  // ── joins: was the incoming clip's first frame on screen before the outgoing layer started to move? ──
  const joins = [];
  for (const [out_, in_] of [['exterior', 'gateway'], ['gateway', 'courtyard']]) {
    for (const ramp of A.ramps.filter((r) => r.layer === out_ && r.prop === 'opacity' && r.from > 0.9 && r.to < 0.1)) {
      const s = sessions.filter((x) => x.clip === in_ && x.call <= ramp.start + 50).at(-1);
      const firstFrame = s && s.firstFrame_ms != null ? s.call + s.firstFrame_ms : null;
      const outSession = sessions.filter((x) => x.clip === out_ && x.call <= ramp.start).at(-1);
      const outFrames = vfc.filter((f) => f.clip === out_ && f.t >= ramp.start && f.t <= ramp.end);
      const inFrames = vfc.filter((f) => f.clip === in_ && f.t >= ramp.start && f.t <= ramp.end);
      const scaleRamp = A.ramps.find((r) => r.layer === out_ && r.prop === 'scale' && Math.abs(r.start - ramp.start) < 120);
      joins.push({
        join: `${out_} → ${in_}`, fadeStart: ramp.start, fade_ms: ramp.duration_ms, scale: scaleRamp ? { from: scaleRamp.from, to: scaleRamp.to, ms: scaleRamp.duration_ms } : null,
        incomingPlayCall: s?.call ?? null, incomingFirstFrame: r1(firstFrame), incomingFirstFrameBeforeFade_ms: firstFrame != null ? r1(ramp.start - firstFrame) : null,
        incomingFirstSourceFrameShown: s?.firstFrameSourceIndex ?? null,
        outgoingStillMovingDuringFade: outFrames.length > 1, outgoingFramesDuringFade: outFrames.length, incomingFramesDuringFade: inFrames.length,
        outgoingVideoEnded: outSession?.end?.type === 'video:ended' ? outSession.end.t : null,
        maxRafIntervalDuringFade_ms: r1(Math.max(...raf.filter((r) => r.t >= ramp.start && r.t <= ramp.end).slice(1).map((r, k, arr) => r.t - (k ? arr[k - 1].t : ramp.start)))),
      });
    }
  }
  A.joins = joins;

  // ── holds: ended → still swap, and whether the picture paused ──
  A.holds = ev.filter((e) => e.type === 'video:ended').map((e) => {
    const sr = series[e.clip] ?? [];
    const swap = sr.find((x) => x.t > e.t && !x.video);
    const lastFrame = vfc.filter((f) => f.clip === e.clip && f.t <= e.t + 5).at(-1);
    const settle = A.ramps.find((r) => r.layer === e.clip && r.prop === 'scale' && r.start >= e.t - 20 && r.start - e.t < 1500);
    return { clip: e.clip, ended: r1(e.t), lastPresentedMediaTime: lastFrame?.mediaTime ?? null, lastPresentedAt: r1(lastFrame?.t), endedAfterLastFrame_ms: lastFrame ? r1(e.t - lastFrame.t) : null,
      stillSwap_ms: swap ? r1(swap.t - e.t) : null, settleZoom: settle ? { startAfterEnded_ms: r1(settle.start - e.t), ms: settle.duration_ms, to: settle.to } : null };
  });

  // ── main-thread health ──
  const ints = raf.slice(1).map((r, k) => r.t - raf[k].t);
  A.raf = { samples: raf.length, p50_ms: r1(pct(ints, 0.5)), p95_ms: r1(pct(ints, 0.95)), p99_ms: r1(pct(ints, 0.99)), max_ms: r1(Math.max(...ints)),
    over50ms: ints.map((d, k) => ({ at: r1(raf[k + 1].t), d: r1(d), phase: raf[k + 1].phase })).filter((x) => x.d > 50) };
  A.longAnimationFrames = D.loaf.filter((l) => l.dur > 50).map((l) => ({ at: l.t, ms: l.dur, blocking: l.blocking }));

  // ── input → first visible response (rAF-sampled state) ──
  const sig = (r) => JSON.stringify([r.phase, r.title, r.panel, r.layers.map((l) => [l.id, Math.round(l.o * 250), Math.round((l.s ?? 1) * 4000), l.img, l.z])]);
  const clicks = ev.filter((e) => e.type === 'input:click');
  A.latency = clicks.map((c) => {
    const t0 = c.eventTs;
    const before = raf.filter((r) => r.t <= t0).at(-1);
    const after = raf.filter((r) => r.t > t0);
    const first = before ? after.find((r) => sig(r) !== sig(before)) : null;
    // first frame of real picture motion: any layer opacity/scale moving, or a new video frame from a clip that was not playing
    const motion = after.find((r, k) => { const p = k ? after[k - 1] : before; if (!p) return false; return r.layers.some((l) => { const q = p.layers.find((x) => x.id === l.id); return q && (Math.abs(l.o - q.o) > 0.004 || Math.abs((l.s ?? 1) - (q.s ?? 1)) > 0.0002); }); });
    return { target: c.target, at: r1(t0), firstStateChange_ms: first ? r1(first.t - t0) : null, firstPictureMotion_ms: motion ? r1(motion.t - t0) : null };
  });

  // ── order: clip presentation segments in time ──
  const segs = []; for (const f of vfc) { const l = segs.at(-1); if (l && l.clip === f.clip && f.t - l.to < 400) { l.to = f.t; l.mtTo = f.mediaTime; } else segs.push({ clip: f.clip, from: f.t, to: f.t, mtFrom: f.mediaTime, mtTo: f.mediaTime }); }
  A.presentationOrder = segs.map((s) => ({ clip: s.clip, from: r1(s.from), to: r1(s.to), mediaTime: [s.mtFrom, s.mtTo] }));

  // ── network ──
  const byFile = {};
  for (const n of D.net) { const b = (byFile[n.url] ??= { requests: 0, responses: [], bytes: 0, failed: 0, cache: new Set() }); if (n.ev === 'request') b.requests++; if (n.ev === 'response') { b.responses.push(n.status); if (n.fromDiskCache) b.cache.add('disk'); if (n.cacheControl) b.cache.add('cc:' + n.cacheControl); } if (n.ev === 'finished') b.bytes += n.bytes; if (n.ev === 'failed') b.failed++; }
  A.network = Object.fromEntries(Object.entries(byFile).map(([k, v]) => [k, { requests: v.requests, statuses: [...new Set(v.responses)], MB: r1(v.bytes / 1e6), failedOrCancelled: v.failed, cache: [...v.cache] }]));
  A.errors = D.errors;

  // ── screenshot-based visible latency from the trace (actual composited output) ──
  const tracePath = `${DIR}${name}.trace.json`;
  if (existsSync(tracePath)) {
    const T = JSON.parse(readFileSync(tracePath, 'utf8'));
    const events = T.traceEvents ?? T;
    const shots = events.filter((e) => e.name === 'Screenshot' && e.args?.snapshot).map((e) => ({ ts: e.ts, img: e.args.snapshot })).sort((a, b) => a.ts - b.ts);
    const marks = events.filter((e) => e.cat?.includes('blink.user_timing') && /^diag:input:click/.test(e.name) && (e.ph === 'R' || e.ph === 'I' || e.ph === 'b' || e.ph === 'n' || e.ph === 'X' || e.ph === 'i')).sort((a, b) => a.ts - b.ts);
    // dedupe marks (some trace versions emit begin+end)
    const clickTs = []; for (const m of marks) if (!clickTs.length || m.ts - clickTs.at(-1) > 5000) clickTs.push(m.ts);
    const shotGaps = shots.slice(1).map((s, k) => (s.ts - shots[k].ts) / 1000);
    A.traceScreenshots = { count: shots.length, intervalP50_ms: r1(pct(shotGaps, 0.5)), intervalMax_ms: r1(Math.max(...shotGaps)) };
    const pg = await decoder();
    A.visibleLatency = [];
    for (const [k, ts] of clickTs.entries()) {
      const base = shots.filter((s) => s.ts <= ts).at(-1);
      const next = shots.filter((s) => s.ts > ts).slice(0, 60);
      if (!base || !next.length) continue;
      const diffs = await pg.evaluate(async ({ base, next }) => {
        const load = async (b64) => { const im = new Image(); im.src = 'data:image/jpeg;base64,' + b64; await im.decode(); return im; };
        const c = document.createElement('canvas'); c.width = 240; c.height = 150; const g = c.getContext('2d', { willReadFrequently: true });
        const px = (im) => { g.drawImage(im, 0, 0, 240, 150); return g.getImageData(0, 0, 240, 150).data; };
        const b = px(await load(base)); const out = [];
        for (const n of next) { const d = px(await load(n)); let s = 0, mx = 0; for (let i = 0; i < d.length; i += 4) { const v = (Math.abs(d[i] - b[i]) + Math.abs(d[i + 1] - b[i + 1]) + Math.abs(d[i + 2] - b[i + 2])) / 3; s += v; if (v > mx) mx = v; } out.push({ mean: s / (d.length / 4) }); }
        return out;
      }, { base: base.img, next: next.map((n) => n.img) });
      const firstVisible = diffs.findIndex((d) => d.mean > 0.6);
      A.visibleLatency.push({ click: k, target: A.latency[k]?.target ?? null, firstVisibleChange_ms: firstVisible >= 0 ? r1((next[firstVisible].ts - ts) / 1000) : null,
        screenshotCadence_ms: r1((next[Math.min(5, next.length - 1)].ts - next[0].ts) / 1000 / Math.min(5, next.length - 1)), meanDiffs: diffs.slice(0, 12).map((d) => r1(d.mean)) });
    }
  }

  writeFileSync(`${DIR}${name}.analysis.json`, JSON.stringify(A, null, 2));
  console.log(`\n═══ ${label} / ${name} ═══  refresh ≈ ${A.refreshHz} Hz`);
  console.log('phases:', A.phases.map((p) => `${p.phase}@${p.t}`).join('  '));
  console.log('sessions:'); for (const s of sessions) console.log(`  ${s.clip.padEnd(9)} call@${s.call} rs=${s.readyStateAtCall} → resolved ${s.resolved_ms}ms, first frame ${s.firstFrame_ms}ms (src#${s.firstFrameSourceIndex}); ${s.callbacks} cb, ${s.uniqueSourceFrames} src frames, skipped ${s.skippedSourceFrames}, gaps p50 ${s.gapP50_ms} p95 ${s.gapP95_ms} max ${s.gapMax_ms} (>2f: ${s.gapsOver2Frames}); waiting ${s.waitingEvents} stalled ${s.stalledEvents}; dropped ${s.droppedFrames}/${s.decodedFrames}; end ${s.end?.type}`);
  console.log('joins:'); for (const j of joins) console.log('  ' + JSON.stringify(j));
  console.log('holds:'); for (const h of A.holds) console.log('  ' + JSON.stringify(h));
  console.log('simultaneous decode:', JSON.stringify(A.simultaneousDecode));
  console.log('latency (rAF):'); for (const l of A.latency) console.log('  ' + JSON.stringify(l));
  if (A.visibleLatency) { console.log('latency (trace screenshots):', JSON.stringify(A.traceScreenshots)); for (const l of A.visibleLatency) console.log('  ' + JSON.stringify({ ...l, meanDiffs: undefined })); }
  console.log('rAF:', JSON.stringify({ ...A.raf, over50ms: A.raf.over50ms.length }), 'LoAF>50ms:', A.longAnimationFrames.length);
  console.log('network:', JSON.stringify(A.network));
  console.log('seeks:', JSON.stringify(A.seeks));
  console.log('order:', A.presentationOrder.map((s) => `${s.clip}[${s.mediaTime[0]}→${s.mediaTime[1]}]@${s.from}`).join(' | '));
}
if (browser) await browser.close();
