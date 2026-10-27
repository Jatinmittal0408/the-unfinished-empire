// Scene-order analysis of the navigation stress cases: node diagnostics/analyse-nav.mjs <label>
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
const label = process.argv[2] ?? 'nav-clean';
const DIR = new URL(`./out/${label}/`, import.meta.url).pathname;
const r1 = (x) => Math.round(x * 10) / 10;
const out = []; let res_pairs = {};
for (const f of readdirSync(DIR).filter((x) => /^nav-\d+\.diag\.json$/.test(x)).sort()) {
  const D = JSON.parse(readFileSync(DIR + f, 'utf8'));
  const ev = D.events;
  const t0 = D.steps[0]?.pageT ?? 0;
  const rel = (t) => r1(t - t0);
  const segs = []; for (const v of D.vfc) { const l = segs.at(-1); if (l && l.clip === v.clip && v.t - l.to < 400 && v.mediaTime >= l.mtTo - 1e-4) { l.to = v.t; l.mtTo = v.mediaTime; } else segs.push({ clip: v.clip, from: v.t, to: v.t, mtFrom: v.mediaTime, mtTo: v.mediaTime }); }
  const actions = ev.filter((e) => e.type === 'input:click' || e.type === 'input:keydown' || e.type === 'nav:popstate').map((e) => ({ t: rel(e.t), what: e.type === 'input:click' ? `click ${e.target}` : e.type === 'input:keydown' ? `key ${e.key}` : `popstate ${e.hash}` }));
  const phases = ev.filter((e) => e.type === 'phase').map((e) => ({ t: rel(e.t), phase: e.phase }));
  const calls = ev.filter((e) => e.type === 'call:play' || e.type === 'call:seek').map((e) => ({ t: rel(e.t), call: e.type.slice(5), clip: e.clip, at: e.currentTime, to: e.to }));
  const visible = segs.filter((s) => s.to - s.from > 60).map((s) => ({ clip: s.clip, from: rel(s.from), to: rel(s.to), media: [s.mtFrom, s.mtTo] }));
  // anomalies
  const anomalies = [];
  for (const c of calls) if (c.call === 'seek' && c.at > 0.2 && c.to < 0.05) anomalies.push(`${c.clip} restarted from ${c.at}s to 0 at t=${c.t}`);
  const lastAction = actions.at(-1);
  const finalPhase = phases.at(-1)?.phase;
  const lastRaf = D.raf.at(-1);
  // once a still scene (home / arrived) has been reached for good, no film should keep presenting frames
  const settled = phases.at(-1);
  if (settled && (settled.phase === 'home' || settled.phase === 'arrived')) {
    for (const v of D.vfc) if (rel(v.t) > settled.t + 1200) { anomalies.push(`${v.clip} presenting frames at ${rel(v.t)}ms, after settling on ${settled.phase} at ${settled.t}ms`); break; }
  }
  // a film started after the visitor's last navigation chose a still scene
  const lastNav = [...actions].reverse().find((a) => /Library|Skip|Escape|Back|popstate/.test(a.what));
  const lateCalls = lastNav ? calls.filter((c) => c.call === 'play' && c.t > lastNav.t + 50) : [];
  for (const c of lateCalls) if (settled && settled.phase !== 'arrived' && settled.phase !== 'home') anomalies.push(`play(${c.clip}) at ${c.t}ms after "${lastNav.what}" at ${lastNav.t}ms`);
  // two films blended on screen at the same time (the stutter case)
  const pairs = {}; const vf = D.vfc.filter((v) => v.inDOM);
  for (let k = 1; k < vf.length; k++) if (vf[k].clip !== vf[k - 1].clip && vf[k].t - vf[k - 1].t < 60) { const key = [vf[k].clip, vf[k - 1].clip].sort().join('+'); pairs[key] = (pairs[key] ?? 0) + 1; }
  res_pairs = pairs;
  // order: clip sequence of long visible segments must follow exterior → gateway → courtyard within each journey
  const seq = visible.filter((s) => s.to - s.from > 300).map((s) => s.clip);
  const rank = { exterior: 0, gateway: 1, courtyard: 2 };
  for (let i = 1; i < seq.length; i++) if (rank[seq[i]] < rank[seq[i - 1]] && !actions.some((a) => /Back|popstate #\/$|Replay/.test(a.what))) anomalies.push(`order ${seq[i - 1]} → ${seq[i]} without a back/replay action`);
  const res = { case: D.case, actions, phases, calls, visibleSegments: visible, simultaneousFilmFrames: res_pairs, finalPhase, finalLayers: lastRaf?.layers.map((l) => `${l.id}:${l.o}${l.video ? '+video' : ''}`), anomalies };
  out.push(res);
  console.log(`\n── ${f.replace('.diag.json', '')}: ${D.case}`);
  console.log('  actions :', actions.map((a) => `${a.t}ms ${a.what}`).join(' | '));
  console.log('  phases  :', phases.map((p) => `${p.phase}@${p.t}`).join(' '));
  console.log('  calls   :', calls.map((c) => `${c.call}(${c.clip}${c.call === 'seek' ? ` ${c.at}→${c.to}` : ` @${c.at}`})@${c.t}`).join(' '));
  console.log('  shown   :', visible.map((s) => `${s.clip}[${s.media[0]}→${s.media[1]}] ${s.from}–${s.to}`).join(' | '));
  console.log('  final   :', finalPhase, res.finalLayers?.join(' '));
  console.log('  two films interleaving (frame pairs < 60 ms apart):', JSON.stringify(res_pairs));
  console.log('  ANOMALIES:', anomalies.length ? anomalies : 'none');
}
writeFileSync(DIR + 'nav.analysis.json', JSON.stringify(out, null, 2));
