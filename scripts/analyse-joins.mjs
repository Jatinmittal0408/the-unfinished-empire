// Choose edit points from the decoded footage (Chromium decode, the same frames the site shows).
//   node scripts/analyse-joins.mjs        → .generated/joins.json, .generated/joins/*.jpg
// Per frame: mean luminance, dark fraction, forward-motion rate (zoom per frame from aligning the next frame).
// Gateway → courtyard pairs: how well the gateway frame's silhouette lands on the courtyard frame after the
// best scale/shift (a doorway match cut), together with brightness and motion-speed differences.
import { mkdirSync, writeFileSync } from 'node:fs';
import { serve } from './lib/serve.mjs';
import { launch } from './lib/browser.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
mkdirSync(ROOT + '.generated/joins', { recursive: true });
const { server, url } = await serve(ROOT + 'public/media');
const browser = await launch();
const page = await browser.newPage();
await page.goto(url + '/');

const result = await page.evaluate(async (base) => {
  const W = 192, H = 108, FPS = 24;
  const load = async (clip) => { const v = document.createElement('video'); v.muted = true; v.src = `${base}/${clip}.mp4`; await new Promise((ok) => (v.onloadeddata = ok)); return v; };
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d', { willReadFrequently: true });
  const big = document.createElement('canvas'); big.width = 480; big.height = 270; const bg = big.getContext('2d');
  async function frames(clip, list) {
    const v = await load(clip); const out = {};
    for (const k of list) {
      v.currentTime = (k + 0.5) / FPS; await new Promise((ok) => (v.onseeked = ok));
      g.drawImage(v, 0, 0, W, H); const d = g.getImageData(0, 0, W, H).data;
      const L = new Float32Array(W * H); for (let i = 0; i < L.length; i++) L[i] = (0.2126 * d[4 * i] + 0.7152 * d[4 * i + 1] + 0.0722 * d[4 * i + 2]) / 255;
      bg.drawImage(v, 0, 0, 480, 270);
      out[k] = { L, jpeg: big.toDataURL('image/jpeg', 0.8) };
    }
    v.removeAttribute('src'); v.load();
    return out;
  }
  const grad = (L) => { const G = new Float32Array(W * H); for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const i = y * W + x; G[i] = Math.hypot(L[i + 1] - L[i - 1], L[i + W] - L[i - W]); } return G; };
  // error of B(x) ≈ A((x - c - d)/s + c) over the overlap; c = frame centre
  function err(A, B, s, dx, dy) {
    let e = 0, n = 0;
    for (let y = 6; y < H - 6; y += 2) for (let x = 6; x < W - 6; x += 2) {
      const ax = Math.round((x - W / 2 - dx) / s + W / 2), ay = Math.round((y - H / 2 - dy) / s + H / 2);
      if (ax < 1 || ay < 1 || ax >= W - 1 || ay >= H - 1) continue;
      const d = A[ay * W + ax] - B[y * W + x]; e += d * d; n++;
    }
    return n > (W * H) / 16 ? e / n : Infinity;
  }
  function fit(A, B, scales) {
    let best = { s: 1, dx: 0, dy: 0, e: Infinity };
    for (const s of scales) for (let dy = -18; dy <= 18; dy += 3) for (let dx = -18; dx <= 18; dx += 3) { const e = err(A, B, s, dx, dy); if (e < best.e) best = { s, dx, dy, e }; }
    for (const step of [1]) for (let dy = best.dy - 2; dy <= best.dy + 2; dy += step) for (let dx = best.dx - 2; dx <= best.dx + 2; dx += step) for (const s of [best.s - 0.01, best.s, best.s + 0.01]) { const e = err(A, B, s, dx, dy); if (e < best.e) best = { s, dx, dy, e }; }
    return best;
  }
  const stats = (L) => { let m = 0, dark = 0; for (const v of L) { m += v; if (v < 0.12) dark++; } return { mean: m / L.length, dark: dark / L.length }; };
  const zoomRate = (A, B) => fit(A, B, Array.from({ length: 21 }, (_, i) => 0.99 + i * 0.002)).s;   // forward motion per frame

  const gList = Array.from({ length: 31 }, (_, i) => 131 + i * 2).concat([191]);   // gateway 131…191
  const cList = Array.from({ length: 49 }, (_, i) => i * 2);                        // courtyard 0…96
  const eList = [0, 96, 180, 191];
  const G = await frames('gateway', [...new Set([...gList, ...gList.map((k) => Math.min(191, k + 1))])]);
  const C = await frames('courtyard', [...new Set([...cList, ...cList.map((k) => k + 1)])]);
  const E = await frames('exterior', eList);
  const per = (F, list) => list.map((k) => ({ k, ...stats(F[k].L), zoomPerFrame: F[k + 1] ? +zoomRate(F[k].L, F[k + 1].L).toFixed(4) : null }));
  const gStats = per(G, gList), cStats = per(C, cList);
  const pairs = [];
  const scales = Array.from({ length: 25 }, (_, i) => 0.7 + i * 0.05);
  for (const gk of gList.filter((k) => k >= 151)) {
    const Ag = grad(G[gk].L);
    for (const ck of cList) {
      const f = fit(Ag, grad(C[ck].L), scales);
      const gs = gStats.find((x) => x.k === gk), cs = cStats.find((x) => x.k === ck);
      pairs.push({ g: gk, c: ck, scale: +f.s.toFixed(3), dx: f.dx, dy: f.dy, structure: +f.e.toFixed(5), dMean: +(cs.mean - gs.mean).toFixed(3), gZoom: gs.zoomPerFrame, cZoom: cs.zoomPerFrame });
    }
  }
  const sheets = {};
  for (const k of gList) sheets['gateway-' + k] = G[k].jpeg;
  for (const k of cList) sheets['courtyard-' + k] = C[k].jpeg;
  for (const k of eList) sheets['exterior-' + k] = E[k].jpeg;
  return { gStats, cStats, exterior: eList.map((k) => ({ k, ...stats(E[k].L) })), pairs, sheets };
}, url);

for (const [k, d] of Object.entries(result.sheets)) writeFileSync(`${ROOT}.generated/joins/${k}.jpg`, Buffer.from(d.split(',')[1], 'base64'));
delete result.sheets;
// rank: structure (silhouette landing), brightness step, and forward-motion continuity
const sMin = Math.min(...result.pairs.map((p) => p.structure)), sMax = Math.max(...result.pairs.map((p) => p.structure));
for (const p of result.pairs) {
  const motionGap = p.gZoom != null && p.cZoom != null ? Math.abs((p.gZoom - 1) - (p.cZoom - 1)) : 0.01;
  p.score = +((p.structure - sMin) / (sMax - sMin) + Math.abs(p.dMean) * 2 + motionGap * 60).toFixed(4);
}
result.pairs.sort((a, b) => a.score - b.score);
writeFileSync(ROOT + '.generated/joins.json', JSON.stringify(result, null, 2));
console.log('gateway   k  mean  dark  zoom/frame'); for (const s of result.gStats) console.log(`  ${s.k}  ${s.mean.toFixed(3)}  ${s.dark.toFixed(2)}  ${s.zoomPerFrame}`);
console.log('courtyard k  mean  dark  zoom/frame'); for (const s of result.cStats) console.log(`  ${s.k}  ${s.mean.toFixed(3)}  ${s.dark.toFixed(2)}  ${s.zoomPerFrame}`);
console.log('exterior', JSON.stringify(result.exterior));
console.log('best gateway→courtyard pairs:'); for (const p of result.pairs.slice(0, 15)) console.log('  ' + JSON.stringify(p));
await browser.close(); server.close();
