// Visual comparison of the joins. Each build/variant is driven through the entrance in headed Chromium while
// a CDP screencast records every composited frame with its timestamp. Frames are then aligned on each join and
// composed side by side (in the browser, onto a canvas) and encoded to WebM with Playwright's ffmpeg.
//
//   node diagnostics/capture-edits.mjs capture <name> <base-url> [query]   → out/capture/<name>.json (+ frames)
//   node diagnostics/capture-edits.mjs compose <out.webm> <join> <name> [name ...]
//        join: eg (exterior → gateway, aligned on the Enter click) | gc (gateway → courtyard, aligned on the edit)
//   node diagnostics/capture-edits.mjs journey <name> <out.webm>           → the whole captured journey at 30 fps
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { homedir } from 'node:os';
import { launch } from '../scripts/lib/browser.mjs';

const OUT = new URL('./out/capture/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const [cmd, ...args] = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// any ffmpeg with libvpx-vp9 and an mjpeg image2pipe input (Playwright's own build qualifies)
const FFMPEG = process.env.FFMPEG ?? (existsSync(`${homedir()}/Library/Caches/ms-playwright/ffmpeg-1013/ffmpeg-mac`) ? `${homedir()}/Library/Caches/ms-playwright/ffmpeg-1013/ffmpeg-mac` : 'ffmpeg');

// phase changes and edits, timed on the page clock (works for V1 builds, which have no __ue in production)
const PROBE = `(() => { const log = (window.__probe = []);
  new MutationObserver(() => { const a = document.querySelector('.app'); const p = a && (/phase-(\\w+)/.exec(a.className) || [])[1];
    if (p && p !== log.at(-1)?.phase) log.push({ t: performance.now(), phase: p }); }).observe(document, { subtree: true, attributes: true, attributeFilter: ['class'], childList: true });
  addEventListener('click', (e) => log.push({ t: e.timeStamp, click: (e.target.closest('button')?.textContent || '').trim() }), true); })();`;

async function capture(name, base, query = '') {
  const browser = await launch({ headless: false, args: ['--window-size=1440,990', '--window-position=0,0'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(PROBE);
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  const frames = [];
  cdp.on('Page.screencastFrame', (f) => { frames.push({ wall: f.metadata.timestamp * 1000, data: f.data }); cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {}); });
  await page.goto(base + '/' + query);
  await page.waitForFunction(() => document.querySelector('.app')?.className.includes('phase-home'), null, { timeout: 30000 });
  await sleep(1500);
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 80, maxWidth: 960, maxHeight: 600, everyNthFrame: 1 });
  await sleep(600);
  await page.getByRole('button', { name: /Enter the Empire/ }).click();
  await page.waitForFunction(() => document.querySelector('.app')?.className.includes('phase-arrived'), null, { timeout: 40000 });
  await sleep(3500);
  await cdp.send('Page.stopScreencast');
  const info = await page.evaluate(() => ({ timeOrigin: performance.timeOrigin, probe: window.__probe, edits: window.__ue?.stats?.edits ?? null }));
  await browser.close();
  const toWall = (t) => info.timeOrigin + t;
  const click = info.probe.find((p) => /Enter/.test(p.click ?? ''));
  const gcEdit = info.edits?.find((e) => e.join === 'gateway→courtyard');
  const courtyardPhase = info.probe.find((p) => p.phase === 'courtyard');
  const marks = { eg: toWall(click.t), gc: toWall(gcEdit ? gcEdit.at : courtyardPhase.t), start: frames[0]?.wall, end: frames.at(-1)?.wall };
  writeFileSync(`${OUT}${name}.json`, JSON.stringify({ name, base, query, marks, edits: info.edits, probe: info.probe, frames: frames.length }));
  writeFileSync(`${OUT}${name}.frames.json`, JSON.stringify(frames));
  console.log(name, 'frames', frames.length, 'marks', JSON.stringify({ eg: marks.eg - marks.start, gc: marks.gc - marks.start }));
}

/** Compose frames (nearest earlier captured frame for each output tick) and pipe JPEGs into ffmpeg → VP9 WebM. */
async function encode(outPath, ticks, renderTick, size) {
  const ff = spawn(FFMPEG, ['-loglevel', 'error', '-f', 'image2pipe', '-framerate', '30', '-c:v', 'mjpeg', '-i', 'pipe:0', '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '30', '-deadline', 'good', '-cpu-used', '4', '-row-mt', '1', '-pix_fmt', 'yuv420p', '-y', outPath]);
  let err = ''; ff.stderr.on('data', (d) => (err += d));
  const done = new Promise((ok, bad) => ff.on('close', (c) => (c === 0 ? ok() : bad(new Error('ffmpeg ' + c + ' ' + err)))));
  const browser = await launch();
  const page = await browser.newPage();
  await page.setContent(`<canvas id=c width=${size.w} height=${size.h}></canvas>`);
  for (let i = 0; i < ticks; i++) {
    const jpeg = await renderTick(page, i);
    if (!ff.stdin.write(Buffer.from(jpeg, 'base64'))) await new Promise((r) => ff.stdin.once('drain', r));
  }
  ff.stdin.end(); await done; await browser.close();
}

const pick = (frames, wall) => { let lo = 0, hi = frames.length - 1, best = 0; while (lo <= hi) { const m = (lo + hi) >> 1; if (frames[m].wall <= wall) { best = m; lo = m + 1; } else hi = m - 1; } return frames[best]; };
const LABELS = { 'v1': 'V1 (before)', 'v11-default': 'V1.1 (after) · default edits', 'v11-cut': 'V1.1 · cut', 'v11-dissolve': 'V1.1 · held-frame dissolve', 'v11-threshold': 'V1.1 · dark-first threshold' };

async function compose(outPath, join, names) {
  const runs = names.map((n) => ({ n, meta: JSON.parse(readFileSync(`${OUT}${n}.json`, 'utf8')), frames: JSON.parse(readFileSync(`${OUT}${n}.frames.json`, 'utf8')) }));
  const [pre, post] = join === 'eg' ? [700, 2600] : [1500, 2200];          // ms around the alignment mark
  const ticks = Math.round(((pre + post) / 1000) * 30);
  const cols = names.length <= 2 ? names.length : 2, rows = Math.ceil(names.length / cols);
  const W = 960, H = 600, LH = 34;
  await encode(outPath, ticks, async (page, i) => {
    const t = -pre + (i * 1000) / 30;
    const tiles = runs.map((r) => pick(r.frames, r.meta.marks[join] + t).data);
    return page.evaluate(async ({ tiles, labels, t, cols, W, H, LH, join }) => {
      const c = document.getElementById('c'), g = c.getContext('2d');
      g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height);
      for (let k = 0; k < tiles.length; k++) {
        const im = new Image(); im.src = 'data:image/jpeg;base64,' + tiles[k]; await im.decode();
        const x = (k % cols) * W, y = Math.floor(k / cols) * (H + LH);
        g.drawImage(im, x, y + LH, W, H);
        g.fillStyle = '#111'; g.fillRect(x, y, W, LH); g.fillStyle = '#f4ede1'; g.font = '500 18px -apple-system, sans-serif';
        g.fillText(labels[k], x + 14, y + 23);
        g.fillStyle = '#cfa96b'; g.font = '16px ui-monospace, monospace';
        g.fillText(`${join === 'eg' ? 'from Enter' : 'from edit'} ${t >= 0 ? '+' : ''}${(t / 1000).toFixed(2)} s`, x + W - 200, y + 23);
      }
      return c.toDataURL('image/jpeg', 0.88).split(',')[1];
    }, { tiles, labels: runs.map((r) => LABELS[r.n] ?? r.n), t, cols, W, H, LH, join });
  }, { w: cols * W, h: rows * (H + LH) });
  console.log('wrote', outPath, ticks, 'frames');
}

async function journey(name, outPath) {
  const meta = JSON.parse(readFileSync(`${OUT}${name}.json`, 'utf8')), frames = JSON.parse(readFileSync(`${OUT}${name}.frames.json`, 'utf8'));
  const ticks = Math.floor(((meta.marks.end - meta.marks.start) / 1000) * 30);
  await encode(outPath, ticks, async (page, i) => {
    const f = pick(frames, meta.marks.start + (i * 1000) / 30);
    return page.evaluate(async (d) => { const c = document.getElementById('c'), g = c.getContext('2d'); const im = new Image(); im.src = 'data:image/jpeg;base64,' + d; await im.decode(); g.drawImage(im, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', 0.9).split(',')[1]; }, f.data);
  }, { w: 960, h: 600 });
  console.log('wrote', outPath, ticks, 'frames');
}

/** A still contact sheet: rows = captures, columns = times (ms) relative to the join's mark. */
async function sheet(outPath, join, times, names) {
  const runs = names.map((n) => ({ n, meta: JSON.parse(readFileSync(`${OUT}${n}.json`, 'utf8')), frames: JSON.parse(readFileSync(`${OUT}${n}.frames.json`, 'utf8')) }));
  const W = 384, H = 240, LH = 22;
  const browser = await launch(); const page = await browser.newPage();
  const tiles = runs.map((r) => times.map((t) => pick(r.frames, r.meta.marks[join] + t).data));
  const data = await page.evaluate(async ({ tiles, times, labels, W, H, LH }) => {
    const c = document.createElement('canvas'); c.width = W * times.length; c.height = (H + LH) * tiles.length; const g = c.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height); g.font = '14px sans-serif';
    for (let r = 0; r < tiles.length; r++) for (let k = 0; k < times.length; k++) {
      const im = new Image(); im.src = 'data:image/jpeg;base64,' + tiles[r][k]; await im.decode();
      g.drawImage(im, k * W, r * (H + LH) + LH, W, H); g.fillStyle = '#ff0'; g.fillText(`${labels[r]}  ${times[k] >= 0 ? '+' : ''}${times[k]} ms`, k * W + 6, r * (H + LH) + 16);
    }
    return c.toDataURL('image/jpeg', 0.85);
  }, { tiles, times, labels: runs.map((r) => LABELS[r.n] ?? r.n), W, H, LH });
  writeFileSync(outPath, Buffer.from(data.split(',')[1], 'base64')); await browser.close();
}

/** Click → first composited frame that differs from the last frame before the click (screencast pixels). */
async function latency(names) {
  const browser = await launch(); const page = await browser.newPage(); const out = {};
  for (const n of names) {
    const meta = JSON.parse(readFileSync(`${OUT}${n}.json`, 'utf8')), frames = JSON.parse(readFileSync(`${OUT}${n}.frames.json`, 'utf8'));
    const base = pick(frames, meta.marks.eg); const after = frames.filter((f) => f.wall > meta.marks.eg).slice(0, 40);
    const diffs = await page.evaluate(async ({ base, after }) => {
      const load = async (d) => { const im = new Image(); im.src = 'data:image/jpeg;base64,' + d; await im.decode(); return im; };
      const c = document.createElement('canvas'); c.width = 240; c.height = 150; const g = c.getContext('2d', { willReadFrequently: true });
      const px = (im) => { g.drawImage(im, 0, 0, 240, 150); return g.getImageData(0, 0, 240, 150).data; };
      const b = px(await load(base)); const res = [];
      for (const f of after) { let d; try { d = px(await load(f)); } catch { res.push(null); continue; } let s = 0; for (let i = 0; i < d.length; i += 4) s += (Math.abs(d[i] - b[i]) + Math.abs(d[i + 1] - b[i + 1]) + Math.abs(d[i + 2] - b[i + 2])) / 3; res.push(s / (d.length / 4)); }
      return res;
    }, { base: base.data, after: after.map((f) => f.data) });
    const first = (thr) => { const k = diffs.findIndex((d) => d != null && d > thr); return k < 0 ? null : Math.round(after[k].wall - meta.marks.eg); };
    out[n] = { firstVisibleChange_ms: first(0.4), firstLargeChange_ms: first(8), undecodableFrames: diffs.filter((d) => d == null).length, frameInterval_ms: Math.round((after.at(-1).wall - after[0].wall) / (after.length - 1)) };
  }
  await browser.close(); console.log(JSON.stringify(out, null, 1)); writeFileSync(`${OUT}latency.json`, JSON.stringify(out, null, 2));
}

if (cmd === 'latency') await latency(args);
else if (cmd === 'sheet') await sheet(args[0], args[1], args[2].split(',').map(Number), args.slice(3));
else if (cmd === 'capture') await capture(args[0], args[1], args[2] ?? '');
else if (cmd === 'compose') await compose(args[0], args[1], args.slice(2));
else if (cmd === 'journey') await journey(args[0], args[1]);
else { console.log('capture | compose | journey'); process.exit(1); }
