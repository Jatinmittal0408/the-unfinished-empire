// Measurements that drive the scene config (src/media/scenes.ts), from the decoded video in Chromium:
//  - letterbox: rows that stay black across the clip (so the site can crop bars off with cover framing)
//  - end motion: the camera's scale/shift per frame over the last frames, so the hold can ease the
//    motion to rest instead of freezing mid-move
//    node scripts/analyse-clips.mjs   → .generated/analysis.json
import { readFileSync, writeFileSync } from 'node:fs';
import { serve } from './lib/serve.mjs';
import { launch } from './lib/browser.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const manifest = JSON.parse(readFileSync(ROOT + 'src/media/manifest.json', 'utf8'));
const probe = JSON.parse(readFileSync(ROOT + '.generated/probe.json', 'utf8'));
const { server, url } = await serve(ROOT + 'public/media');
const browser = await launch();
const page = await browser.newPage();
await page.goto(url + '/');

const result = {};
for (const clip of manifest.clips) {
  const p = probe[clip.id];
  result[clip.id] = await page.evaluate(async ({ src, frames, fps }) => {
    const v = document.createElement('video'); v.muted = true; v.src = src;
    await new Promise((ok) => (v.onloadeddata = ok));
    const W = 480, H = 270;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d', { willReadFrequently: true });
    const at = async (k) => { v.currentTime = Math.min((k + 0.5) / fps, v.duration - 1e-3); await new Promise((ok) => (v.onseeked = ok)); };
    const lum = () => { const d = g.getImageData(0, 0, W, H).data; const L = new Float32Array(W * H); for (let i = 0; i < L.length; i++) L[i] = (0.2126 * d[4 * i] + 0.7152 * d[4 * i + 1] + 0.0722 * d[4 * i + 2]) / 255; return L; };

    // letterbox: per-row max luminance over 8 frames spread through the clip
    const rowMax = new Float32Array(H);
    for (let j = 0; j < 8; j++) {
      await at(Math.round((j / 7) * (frames - 1))); g.drawImage(v, 0, 0, W, H); const L = lum();
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) rowMax[y] = Math.max(rowMax[y], L[y * W + x]);
    }
    let top = 0; while (top < H && rowMax[top] < 0.06) top++;
    let bot = 0; while (bot < H && rowMax[H - 1 - bot] < 0.06) bot++;

    // end motion: best zoom-about-point + shift mapping frame k-1 onto frame k, for the last 3 steps
    const frame = async (k) => { await at(k); g.drawImage(v, 0, 0, W, H); return lum(); };
    function err(A, B, s, dx, dy) {   // B(x) ≈ A((x - cx - dx)/s + cx)
      let e = 0, n = 0; const cx = W / 2, cy = H / 2;
      for (let y = top + 20; y < H - bot - 20; y += 2) for (let x = 20; x < W - 20; x += 2) {
        const ax = (x - cx - dx) / s + cx, ay = (y - cy - dy) / s + cy;
        const x0 = Math.floor(ax), y0 = Math.floor(ay), fx = ax - x0, fy = ay - y0;
        if (x0 < 0 || y0 < 0 || x0 >= W - 1 || y0 >= H - 1) continue;
        const a = A[y0 * W + x0] * (1 - fx) * (1 - fy) + A[y0 * W + x0 + 1] * fx * (1 - fy) + A[(y0 + 1) * W + x0] * (1 - fx) * fy + A[(y0 + 1) * W + x0 + 1] * fx * fy;
        const d = a - B[y * W + x]; e += d * d; n++;
      }
      return e / n;
    }
    function fit(A, B) {
      let best = { s: 1, dx: 0, dy: 0, e: err(A, B, 1, 0, 0) };
      for (const [ss, sd] of [[0.004, 1], [0.001, 0.25], [0.00025, 0.0625]]) {
        let improved = true;
        while (improved) {
          improved = false;
          for (const [s, dx, dy] of [[best.s + ss, best.dx, best.dy], [best.s - ss, best.dx, best.dy], [best.s, best.dx + sd, best.dy], [best.s, best.dx - sd, best.dy], [best.s, best.dx, best.dy + sd], [best.s, best.dx, best.dy - sd]]) {
            const e = err(A, B, s, dx, dy);
            if (e < best.e) { best = { s, dx, dy, e }; improved = true; }
          }
        }
      }
      return best;
    }
    const steps = [];
    let prev = await frame(frames - 4);
    for (let k = frames - 3; k < frames; k++) {
      const cur = await frame(k); const f = fit(prev, cur);
      steps.push({ k, scale: +f.s.toFixed(5), dx_frac: +(f.dx / W).toFixed(5), dy_frac: +(f.dy / H).toFixed(5), residual: +f.e.toFixed(6) });
      prev = cur;
    }
    return { letterbox: { top_frac: +(top / H).toFixed(4), bottom_frac: +(bot / H).toFixed(4) }, endMotionPerFrame: steps };
  }, { src: url + '/' + clip.file, frames: p.frames, fps: p.fps });
  console.log(clip.id, JSON.stringify(result[clip.id]));
}
writeFileSync(ROOT + '.generated/analysis.json', JSON.stringify(result, null, 2));
await browser.close(); server.close();
