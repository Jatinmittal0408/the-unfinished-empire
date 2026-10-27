// Join-by-join metrics from what was actually on screen (works for V1 and V1.1 alike: it reads the DOM
// state sampled every animation frame and the presented video frames, not the app's own bookkeeping).
//   node diagnostics/analyse-transitions.mjs <label> [page ...]      → <label>/<page>.transitions.json
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

const [label, ...names] = process.argv.slice(2);
const DIR = new URL(`./out/${label}/`, import.meta.url).pathname;
const pages = names.length ? names : readdirSync(DIR).filter((f) => f.endsWith('.diag.json')).map((f) => f.replace('.diag.json', ''));
const FPS = 24, FRAME = 1000 / FPS;
const r1 = (x) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 10) / 10);
const all = {};

for (const name of pages) {
  const D = JSON.parse(readFileSync(`${DIR}${name}.diag.json`, 'utf8'));
  const raf = D.raf, vfc = D.vfc, ev = D.events;
  const on = (r, id) => r.layers.find((l) => l.id === id)?.onScreen ?? false;
  const res = { page: name, joins: [], clicks: [] };

  // every occurrence of a join: the outgoing clip is on screen, then the incoming clip takes over
  for (const [out, inc] of [['exterior', 'gateway'], ['gateway', 'courtyard']]) {
    for (let i = 1; i < raf.length; i++) {
      if (!(on(raf[i], inc) && !on(raf[i - 1], inc) && raf.slice(Math.max(0, i - 3), i).some((r) => on(r, out)))) continue;
      const tIn = raf[i].t;
      let k = i; while (k < raf.length - 1 && on(raf[k], out)) k++;
      const tOutGone = raf[k].t;
      const from = tIn - 600, to = tOutGone + 600;
      const win = raf.filter((r) => r.t >= from && r.t <= to);
      const ints = win.slice(1).map((r, j) => r.t - win[j].t);
      // count only frames presented while that clip is on screen (a covered clip's pre-roll is not seen)
      const onAt = (id, t) => { const r = raf.find((x) => x.t >= t); return r ? on(r, id) : false; };
      const clip = (id) => {
        const f = vfc.filter((x) => x.clip === id && x.t >= from && x.t <= to && onAt(id, x.t));
        const g = f.slice(1).map((x, j) => x.t - f[j].t), d = f.slice(1).map((x, j) => x.mediaTime - f[j].mediaTime);
        return { presented: f.length, skippedSourceFrames: d.filter((x) => x > 1.5 / FPS).reduce((a, x) => a + Math.round(x * FPS) - 1, 0),
          maxGap_ms: r1(g.length ? Math.max(...g) : null), gapsOver2Frames: g.filter((x) => x > 2 * FRAME + 4).length };
      };
      // the outgoing clip on screen without moving footage: paused/ended video or a still
      const outFrozen = win.filter((r) => { const l = r.layers.find((x) => x.id === out); return l?.onScreen && !(l.video && l.playing); });
      const outScaleMoving = win.filter((r, j) => { if (!j) return false; const a = r.layers.find((x) => x.id === out), b = win[j - 1].layers.find((x) => x.id === out); return a?.onScreen && b && !(a.video && a.playing) && Math.abs((a.s ?? 1) - (b.s ?? 1)) > 1e-5; });
      const firstIn = raf[i].layers.find((l) => l.id === inc);
      const ended = ev.filter((e) => e.clip === out && e.type === 'video:ended' && e.t >= tIn - 600 && e.t <= tOutGone);
      res.joins.push({
        join: `${out} → ${inc}`, incomingOnScreenAt: r1(tIn), outgoingGoneAt: r1(tOutGone), overlap_ms: r1(tOutGone - tIn),
        maxVisiblePlayingVideos: Math.max(...win.map((r) => r.visiblePlaying ?? 0)),
        framesWithTwoPlayingVisible: win.filter((r) => (r.visiblePlaying ?? 0) >= 2).length,
        posterFrames: win.filter((r) => r.poster).length, maxUncovered: Math.max(...win.map((r) => r.uncovered ?? 0)),
        incomingFirstShown: firstIn ? { mediaTime: firstIn.mt, sourceFrame: firstIn.mt != null ? Math.round(firstIn.mt * FPS) : null, presented: firstIn.presented, playing: firstIn.playing } : null,
        outgoingFrozenOnScreen_ms: r1(outFrozen.length ? outFrozen.at(-1).t - outFrozen[0].t + (ints[0] ?? 8.3) : 0),
        outgoingFrozenWhileScaled_frames: outScaleMoving.length,
        outgoingEndedWhileOnScreen: ended.length > 0,
        raf: { maxInterval_ms: r1(Math.max(...ints)), over20ms: ints.filter((x) => x > 20).length, samples: win.length },
        outgoing: clip(out), incoming: clip(inc),
      });
      i = k;
    }
  }

  // click → first change of what is on screen (layers, title, phase) and → first picture motion
  const sig = (r) => JSON.stringify([r.phase, r.title, r.panel, r.layers.map((l) => [l.id, l.onScreen, Math.round(l.o * 250), l.vis])]);
  for (const c of ev.filter((e) => e.type === 'input:click')) {
    const before = raf.filter((r) => r.t <= c.eventTs).at(-1), after = raf.filter((r) => r.t > c.eventTs);
    const first = before ? after.find((r) => sig(r) !== sig(before)) : null;
    const pic = before ? after.find((r) => r.layers.some((l) => { const b = before.layers.find((x) => x.id === l.id); return l.onScreen !== (b?.onScreen ?? false) || Math.abs(l.o - (b?.o ?? 0)) > 0.01; })) : null;
    res.clicks.push({ target: c.target, at: r1(c.eventTs), firstScreenChange_ms: first ? r1(first.t - c.eventTs) : null, firstPictureChange_ms: pic ? r1(pic.t - c.eventTs) : null });
  }
  res.edits = D.ue?.stats?.edits?.map((e) => ({ join: e.join, style: e.style, trigger: e.trigger, playToReveal_ms: r1(e.at - e.playAt),
    outgoingLastFrame: e.outgoingMediaTime != null ? Math.round(e.outgoingMediaTime * FPS) : null, incomingFirstFrame: e.incomingMediaTime != null ? Math.round(e.incomingMediaTime * FPS) : null, frameConfirmed: e.frameConfirmed })) ?? null;
  res.unconfirmedParks = D.ue?.unconfirmedParks ?? null;
  res.sequences = D.ue?.stats ? { started: D.ue.stats.started, settled: D.ue.stats.settled } : null;
  res.maxVisiblePlayingOverall = Math.max(...raf.map((r) => r.visiblePlaying ?? 0));
  writeFileSync(`${DIR}${name}.transitions.json`, JSON.stringify(res, null, 2));
  all[name] = res;
  console.log(`\n═══ ${label}/${name}`);
  for (const j of res.joins) console.log(' ', j.join.padEnd(22), `overlap ${j.overlap_ms}ms | visible playing max ${j.maxVisiblePlayingVideos} (${j.framesWithTwoPlayingVisible} frames ≥2) | poster ${j.posterFrames} | uncovered ${j.maxUncovered} | in#${j.incomingFirstShown?.sourceFrame} | out frozen ${j.outgoingFrozenOnScreen_ms}ms scaled ${j.outgoingFrozenWhileScaled_frames} ended ${j.outgoingEndedWhileOnScreen} | rAF max ${j.raf.maxInterval_ms} >20ms ${j.raf.over20ms} | out skip ${j.outgoing.skippedSourceFrames} gap ${j.outgoing.maxGap_ms} | in skip ${j.incoming.skippedSourceFrames} gap ${j.incoming.maxGap_ms}`);
  for (const c of res.clicks) console.log('  click', c.target.padEnd(22), `screen ${c.firstScreenChange_ms}ms picture ${c.firstPictureChange_ms}ms`);
  if (res.edits) for (const e of res.edits) console.log('  edit', JSON.stringify(e));
}
writeFileSync(`${DIR}transitions.json`, JSON.stringify(all, null, 2));
