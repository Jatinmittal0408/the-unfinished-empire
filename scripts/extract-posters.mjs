// Poster-frame extraction: decode every clip in Chromium (the engine that plays it on the site) and save
// its first and last frames as the stills the site swaps to, so a held frame is pixel-for-pixel what the
// video showed. Also writes review frames and clip-to-clip continuity numbers.
//   node scripts/extract-posters.mjs
// Outputs (generated, git-ignored):
//   public/posters/{id}-first.jpg, {id}-last.jpg     stills used by the site
//   public/posters/posters.json                      frame times actually decoded, image sizes
//   .generated/frames/{id}-f{NNN}.jpg                review frames (0, 48, 96, 144, last)
//   .generated/continuity.json                       last frame of clip N vs first frame of clip N+1
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { serve } from './lib/serve.mjs';
import { launch } from './lib/browser.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const manifest = JSON.parse(readFileSync(ROOT + 'src/media/manifest.json', 'utf8'));
const probe = JSON.parse(readFileSync(ROOT + '.generated/probe.json', 'utf8'));   // run `npm run probe` first
mkdirSync(ROOT + 'public/posters', { recursive: true });
mkdirSync(ROOT + '.generated/frames', { recursive: true });

const { server, url } = await serve(ROOT + 'public/media');
const browser = await launch();
const page = await browser.newPage();
await page.goto(url + '/');   // same origin as the media, so the canvas is not tainted

// In the page: decode frame k of a clip (seek to the frame's centre) and return it as JPEG plus a small
// linear-light thumbnail for comparisons.
async function grab(file, frames, fps, wanted) {
  return page.evaluate(async ({ src, frames, fps, wanted }) => {
    const v = document.createElement('video');
    v.muted = true; v.preload = 'auto'; v.src = src;
    await new Promise((ok, bad) => { v.onloadeddata = ok; v.onerror = () => bad(new Error('load ' + src)); });
    const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight;
    const g = c.getContext('2d');
    const t = document.createElement('canvas'); t.width = 480; t.height = 270;
    const tg = t.getContext('2d', { willReadFrequently: true });
    const out = [];
    for (const k of wanted) {
      const presented = new Promise((ok) => {
        v.requestVideoFrameCallback((_, meta) => ok(meta.mediaTime));
        setTimeout(() => ok(null), 3000);
      });
      v.currentTime = Math.min((k + 0.5) / fps, v.duration - 1e-3);
      await new Promise((ok) => (v.onseeked = ok));
      const mediaTime = await presented;
      g.drawImage(v, 0, 0);
      tg.drawImage(c, 0, 0, 480, 270);
      out.push({
        k, mediaTime,
        decodedFrame: mediaTime == null ? null : Math.round(mediaTime * fps),
        jpeg: c.toDataURL('image/jpeg', 0.92),
        thumb: Array.from(tg.getImageData(0, 0, 480, 270).data),
      });
    }
    return { width: v.videoWidth, height: v.videoHeight, duration: v.duration, frames: out };
  }, { src: url + '/' + file, frames, fps, wanted });
}

const save = (path, dataUrl) => { const b = Buffer.from(dataUrl.split(',')[1], 'base64'); writeFileSync(path, b); return b.length; };
const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
function compare(a, b) {   // 8-bit RGBA thumbnails → PSNR (display values), mean RGB, mean |Δ luminance| in linear light
  let se = 0, n = 0; const ma = [0, 0, 0], mb = [0, 0, 0]; let dl = 0;
  for (let i = 0; i < a.length; i += 4) {
    for (let c = 0; c < 3; c++) { const d = (a[i + c] - b[i + c]) / 255; se += d * d; n++; ma[c] += a[i + c]; mb[c] += b[i + c]; }
    const la = 0.2126 * lin(a[i]) + 0.7152 * lin(a[i + 1]) + 0.0722 * lin(a[i + 2]);
    const lb = 0.2126 * lin(b[i]) + 0.7152 * lin(b[i + 1]) + 0.0722 * lin(b[i + 2]);
    dl += Math.abs(la - lb);
  }
  const px = a.length / 4;
  return { psnr_db: +(10 * Math.log10(1 / (se / n))).toFixed(2), mean_rgb: [ma.map((x) => +(x / px).toFixed(1)), mb.map((x) => +(x / px).toFixed(1))], mean_abs_dlum_linear: +(dl / px).toFixed(4) };
}

const posters = {}, edges = {};
for (const clip of manifest.clips) {
  const p = probe[clip.id];
  const last = p.frames - 1;
  const wanted = [0, 48, 96, 144, last - 1, last];
  const r = await grab(clip.file, p.frames, p.fps, wanted);
  const byK = Object.fromEntries(r.frames.map((f) => [f.k, f]));
  for (const f of r.frames) save(`${ROOT}.generated/frames/${clip.id}-f${String(f.k).padStart(3, '0')}.jpg`, f.jpeg);
  posters[clip.id] = {
    first: { file: `posters/${clip.id}-first.jpg`, bytes: save(`${ROOT}public/posters/${clip.id}-first.jpg`, byK[0].jpeg), decodedFrame: byK[0].decodedFrame },
    last: { file: `posters/${clip.id}-last.jpg`, bytes: save(`${ROOT}public/posters/${clip.id}-last.jpg`, byK[last].jpeg), decodedFrame: byK[last].decodedFrame },
    width: r.width, height: r.height, duration: r.duration,
    // how much the picture still moves on the final frame (is the last frame a stable hold?)
    finalFrameMotion: compare(byK[last - 1].thumb, byK[last].thumb),
  };
  edges[clip.id] = { first: byK[0].thumb, last: byK[last].thumb };
  console.log(clip.id, 'decoded', byK[0].decodedFrame, '…', byK[last].decodedFrame, 'last-frame motion', posters[clip.id].finalFrameMotion);
}

const continuity = {};
const ids = manifest.clips.map((c) => c.id);
for (let i = 0; i + 1 < ids.length; i++) {
  continuity[`${ids[i]}.last → ${ids[i + 1]}.first`] = compare(edges[ids[i]].last, edges[ids[i + 1]].first);
}
writeFileSync(ROOT + 'public/posters/posters.json', JSON.stringify(posters, null, 2));
writeFileSync(ROOT + '.generated/continuity.json', JSON.stringify(continuity, null, 2));
console.log('continuity', continuity);
await browser.close(); server.close();
