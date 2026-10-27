// Local comparison harness: recorded side-by-side clips of each join, and live links that open the real app with
// any combination of edit styles (?edit=eg:…,gc:…). Recordings come from `node diagnostics/capture-edits.mjs`
// and live in public/review/ (local, git-ignored); missing ones are listed with the command that makes them.
import '@fontsource/cormorant-garamond/300.css';
import '@fontsource/jost/400.css';
import '@fontsource/jost/500.css';
import './harness.css';
import { EDIT_STYLES, joins } from '../media/scenes';

const clips = [
  { file: 'before-after-exterior-gateway.webm', title: 'Exterior → Gateway', note: 'V1 (frozen 14 % push + dissolve) vs V1.1 default. Aligned on the Enter click.' },
  { file: 'before-after-gateway-courtyard.webm', title: 'Gateway → Courtyard', note: 'V1 (zoom + double-video dissolve) vs V1.1 default. Aligned on the edit.' },
  { file: 'variants-exterior-gateway.webm', title: 'Exterior → Gateway · all candidates', note: 'V1 · cut · held-frame dissolve · dark-first threshold.' },
  { file: 'variants-gateway-courtyard.webm', title: 'Gateway → Courtyard · all candidates', note: 'V1 · cut · held-frame dissolve · dark-first threshold.' },
  { file: 'journey-v1.1.webm', title: 'Full journey · V1.1', note: 'Enter → arrival, clean GPU, production build.' },
  { file: 'journey-v1.webm', title: 'Full journey · V1', note: 'The same journey on the V1 build, for reference.' },
];
const label = { cut: 'Cut', dissolve: 'Held-frame dissolve', threshold: 'Dark-first threshold' } as const;
const root = document.getElementById('harness')!;
const def = { eg: joins.exteriorToGateway.style, gc: joins.gatewayToCourtyard.style };

root.innerHTML = `
  <header><p class="kicker">AI Cinematic Edition · V1.1</p><h1>Edit comparison</h1>
  <p class="lede">Never more than one moving video on screen in any candidate. Watch the recordings, then open any combination live
  (each link starts a fresh entrance). Defaults: exterior → gateway <b>${label[def.eg]}</b>, gateway → courtyard <b>${label[def.gc]}</b>.</p></header>
  <section class="live"><h2>Open live</h2>
    <table><thead><tr><th>Exterior → Gateway ↓ · Gateway → Courtyard →</th>${EDIT_STYLES.map((g) => `<th>${label[g]}</th>`).join('')}</tr></thead>
    <tbody>${EDIT_STYLES.map((e) => `<tr><th>${label[e]}</th>${EDIT_STYLES.map((g) => `<td><a href="/?edit=eg:${e},gc:${g}#/"${e === def.eg && g === def.gc ? ' class="default"' : ''}>${e} · ${g}</a></td>`).join('')}</tr>`).join('')}</tbody></table>
  </section>
  <section class="clips">${clips.map((c) => `<figure data-file="${c.file}"><figcaption><h2>${c.title}</h2><p>${c.note}</p></figcaption>
    <video src="/review/${c.file}" controls muted playsinline preload="metadata" loop></video><p class="missing" hidden>Not recorded yet: run <code>node diagnostics/capture-edits.mjs</code> (see README).</p></figure>`).join('')}</section>`;

// one recording plays at a time (several decoding videos at once is exactly what this release avoids)
const videos = [...root.querySelectorAll('video')];
for (const v of videos) {
  v.addEventListener('play', () => videos.forEach((o) => { if (o !== v) o.pause(); }));
  v.addEventListener('error', () => { v.hidden = true; (v.nextElementSibling as HTMLElement).hidden = false; });
}
