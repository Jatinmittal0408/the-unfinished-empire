// One table of the headline numbers across runs: node diagnostics/summarise.mjs → diagnostics/out/summary.json
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const OUT = new URL('./out/', import.meta.url).pathname;
const runs = [['dev-clean', 'cold'], ['dev-clean', 'warm'], ['dev-gpu-contended', 'cold'], ['dev-gpu-contended', 'warm']];
const summary = {};
for (const [label, page] of runs) {
  const f = `${OUT}${label}/${page}.analysis.json`; if (!existsSync(f)) continue;
  const A = JSON.parse(readFileSync(f, 'utf8'));
  const meta = JSON.parse(readFileSync(`${OUT}${label}/meta.json`, 'utf8'));
  const D = JSON.parse(readFileSync(`${OUT}${label}/${page}.diag.json`, 'utf8'));
  const clicks = D.events.filter((e) => e.type === 'input:click');
  const latency = A.latency.map((l, i) => {
    const t = clicks[i]?.eventTs ?? l.at;
    const firstRamp = A.ramps.find((r) => r.start >= t - 1);
    return { target: l.target, stateChange_ms: l.firstStateChange_ms, animationStart_ms: firstRamp ? Math.round((firstRamp.start - t) * 10) / 10 : null, animation: firstRamp ? `${firstRamp.layer} ${firstRamp.prop} ${firstRamp.from}→${firstRamp.to} in ${firstRamp.duration_ms} ms` : null, perceptibleMotion_ms: l.firstPictureMotion_ms };
  });
  const g = meta.gpu.map((x) => x.device).filter((x) => !Number.isNaN(x));
  summary[`${label}/${page}`] = {
    gpuWatch: meta.gpuWatch ?? meta.blender ?? null, gpuDeviceUtilisation: { mean: Math.round(g.reduce((a, b) => a + b, 0) / g.length), max: Math.max(...g) },
    refreshHz: A.refreshHz, raf: { p50: A.raf.p50_ms, p99: A.raf.p99_ms, max: A.raf.max_ms, over50ms: A.raf.over50ms.length }, longAnimationFrames: A.longAnimationFrames.length,
    phases: A.phases.map((p) => `${p.phase}@${Math.round(p.t)}`).join(' '),
    clips: A.sessions.filter((s) => s.callbacks > 0).map((s) => ({ clip: s.clip, readyStateAtPlay: s.readyStateAtCall, firstFrame_ms: s.firstFrame_ms, firstSourceFrame: s.firstFrameSourceIndex, presented: s.callbacks, skippedSourceFrames: s.skippedSourceFrames, gapMax_ms: s.gapMax_ms, gapsOver2Frames: s.gapsOver2Frames, waiting: s.waitingEvents, stalled: s.stalledEvents, dropped: s.droppedFrames, decoded: s.decodedFrames, end: s.end?.type })),
    joins: A.joins.map((j) => ({ join: j.join, fade_ms: j.fade_ms, scale: j.scale, incomingFirstFrameRelativeToFadeStart_ms: j.incomingFirstFrameBeforeFade_ms == null ? null : -j.incomingFirstFrameBeforeFade_ms, incomingFirstSourceFrame: j.incomingFirstSourceFrameShown, outgoingFramesDuringFade: j.outgoingFramesDuringFade, incomingFramesDuringFade: j.incomingFramesDuringFade, maxRafInterval_ms: j.maxRafIntervalDuringFade_ms })),
    holds: A.holds, seeks: A.seeks.length, latency, visibleLatencyFromTraceScreenshots: A.visibleLatency?.map((v) => ({ target: v.target, firstVisibleChange_ms: v.firstVisibleChange_ms })) ?? null,
  };
}
const dec = JSON.parse(readFileSync(`${OUT}decode-clean/decode.json`, 'utf8'));
summary.decodeBenchmark = { capabilities: dec.capabilities, runs: dec.runs.map((r) => ({ name: r.name, rafMax_ms: r.raf.maxInterval_ms, videos: r.videos.map((v) => v.playing === false ? `${v.clip}: paused` : `${v.clip}: ${v.presentedPerSec} fps presented, max gap ${v.maxGap_ms} ms, ${v.skippedSourceFrames} source frames skipped, decoder dropped ${v.dropped}/${v.total}`) })) };
summary.navigation = JSON.parse(readFileSync(`${OUT}nav-clean/nav.analysis.json`, 'utf8')).map((n) => ({ case: n.case, phases: n.phases.map((p) => p.phase).join(' → '), plays: n.calls.filter((c) => c.call === 'play').map((c) => `${c.clip}@${c.t}`).join(', '), simultaneousFilmFrames: n.simultaneousFilmFrames, anomalies: n.anomalies }));
writeFileSync(OUT + 'summary.json', JSON.stringify(summary, null, 2));
for (const [k, v] of Object.entries(summary)) if (v.latency) { console.log(`\n${k}  (watched ${JSON.stringify(v.gpuWatch)}, GPU mean ${v.gpuDeviceUtilisation.mean}% max ${v.gpuDeviceUtilisation.max}%)  rAF p99 ${v.raf.p99} max ${v.raf.max} >50ms ${v.raf.over50ms}`); for (const l of v.latency) console.log('   ', JSON.stringify(l)); console.log('    trace-visible:', JSON.stringify(v.visibleLatencyFromTraceScreenshots)); }
