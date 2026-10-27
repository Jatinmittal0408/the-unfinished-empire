// Playback and transition diagnostic: drives the real app in headed Chrome for Testing, with
// instrumentation injected (diagnostics/instrument.js), a Chromium performance trace with screenshots,
// a screen recording of the viewport, CDP network events for the media, and GPU utilisation samples.
//
//   node diagnostics/run.mjs <scenario> [--base URL] [--label NAME] [--no-trace]
//     scenario: journey   full scripted experience, cold page then warm page in the same browser context
//               nav       navigation-order stress cases
//               decode    simultaneous-decode microbenchmark (1, 2 and 3 clips at once)
// Output: diagnostics/out/<label>/...
import { mkdirSync, writeFileSync, readFileSync, renameSync, readdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { launch } from '../scripts/lib/browser.mjs';

const argv = process.argv.slice(2);
const scenario = argv[0];
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const BASE = opt('base', 'http://127.0.0.1:5180');
const LABEL = opt('label', scenario);
const QUERY = opt('query', '');   // e.g. ?edit=eg:dissolve,gc:threshold (comparison harness)
const TRACE = !argv.includes('--no-trace');
const OUT = new URL(`./out/${LABEL}/`, import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const INSTRUMENT = readFileSync(new URL('./instrument.js', import.meta.url), 'utf8');
const VIEW = { width: 1440, height: 900 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const wall = () => Date.now();

// GPU utilisation (IOAccelerator PerformanceStatistics), sampled once a second for the whole run
const gpu = [];
const gpuTimer = setInterval(() => {
  try {
    const s = execFileSync('ioreg', ['-r', '-d', '1', '-w', '0', '-c', 'IOAccelerator'], { encoding: 'utf8' });
    const g = (k) => +(new RegExp(`"${k}"=(\\d+)`).exec(s)?.[1] ?? NaN);
    gpu.push({ wall: wall(), device: g('Device Utilization %'), renderer: g('Renderer Utilization %') });
  } catch { /* ignore */ }
}, 1000);
// Other GPU-heavy processes falsify playback measurements; name the ones to watch with GPU_WATCH=Name1,Name2
const watched = () => { const names = (process.env.GPU_WATCH ?? '').split(',').filter(Boolean); if (!names.length) return null; try { const o = execFileSync('ps', ['-axo', 'stat=,comm='], { encoding: 'utf8' }).split('\n'); return Object.fromEntries(names.map((n) => { const l = o.find((x) => x.trim().endsWith(n)); return [n, l ? (l.trim()[0] === 'T' ? 'stopped' : 'running') : 'absent']; })); } catch { return 'unknown'; } };

const browser = await launch({ headless: false, args: [`--window-size=${VIEW.width},${VIEW.height + 90}`, '--window-position=0,0'] });
const meta = { scenario, label: LABEL, base: BASE, query: QUERY, browser: browser.version(), viewport: VIEW, started: new Date().toISOString(), gpuWatch: watched(), headless: false };

async function newContext(name) {
  const dir = OUT + 'recording-' + name;
  const ctx = await browser.newContext({ viewport: VIEW, recordVideo: { dir, size: VIEW } });
  await ctx.addInitScript(INSTRUMENT);
  return { ctx, dir };
}

/** One page with network capture; returns helpers. */
async function openPage(ctx, name) {
  const page = await ctx.newPage();
  const net = [];
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  const want = (u) => /\/media\/|\/posters\//.test(u);
  const reqs = new Map();
  cdp.on('Network.requestWillBeSent', (e) => { if (want(e.request.url)) { reqs.set(e.requestId, e.request.url); net.push({ ev: 'request', id: e.requestId, url: e.request.url.split('/').pop(), range: e.request.headers.Range || e.request.headers.range || null, ts: e.timestamp, wall: e.wallTime }); } });
  cdp.on('Network.responseReceived', (e) => { if (reqs.has(e.requestId)) net.push({ ev: 'response', id: e.requestId, url: reqs.get(e.requestId).split('/').pop(), status: e.response.status, fromDiskCache: e.response.fromDiskCache, fromMemory: e.response.fromPrefetchCache, cacheControl: e.response.headers['Cache-Control'] || e.response.headers['cache-control'], contentRange: e.response.headers['Content-Range'] || e.response.headers['content-range'] || null, ts: e.timestamp }); });
  cdp.on('Network.loadingFinished', (e) => { if (reqs.has(e.requestId)) net.push({ ev: 'finished', id: e.requestId, url: reqs.get(e.requestId).split('/').pop(), bytes: e.encodedDataLength, ts: e.timestamp }); });
  cdp.on('Network.loadingFailed', (e) => { if (reqs.has(e.requestId)) net.push({ ev: 'failed', id: e.requestId, url: reqs.get(e.requestId).split('/').pop(), error: e.errorText, canceled: e.canceled, ts: e.timestamp }); });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`); });
  const steps = [];
  const step = async (what, fn) => { const t = await page.evaluate(() => performance.now()).catch(() => null); steps.push({ what, pageT: t, wall: wall() }); console.log(`  [${name}] ${what}`); return fn ? fn() : undefined; };
  const phase = () => page.evaluate(() => (/phase-(\w+)/.exec(document.querySelector('.app')?.className || '') || [])[1]);
  const waitPhase = (p, timeout = 30000) => page.waitForFunction((p) => document.querySelector('.app')?.className.includes('phase-' + p), p, { timeout, polling: 'raf' }).then(() => true, () => false);
  const dump = async (extra = {}) => {
    const diag = await page.evaluate(() => ({ ue: window.__ue ? { stats: window.__ue.stats, unconfirmedParks: window.__ue.unconfirmedParks } : null, events: __diag.events, vfc: __diag.vfc, raf: __diag.raf, quality: __diag.quality, loaf: __diag.loaf, timeOrigin: performance.timeOrigin, ua: navigator.userAgent, dpr: devicePixelRatio, refresh: null }));
    // display refresh estimate from rAF
    const dts = diag.raf.slice(1).map((r, i) => r.t - diag.raf[i].t).sort((a, b) => a - b);
    diag.refresh = dts.length ? +(1000 / dts[Math.floor(dts.length / 2)]).toFixed(1) : null;
    writeFileSync(`${OUT}${name}.diag.json`, JSON.stringify({ ...diag, net, steps, errors, ...extra }));
    return diag;
  };
  return { page, step, phase, waitPhase, dump, net, steps };
}

// each page records its own file; save it under the page's name once the page is closed
const recordings = [];
async function closeRecorded(page, name) { await page.close(); const v = page.video(); if (v) { await v.saveAs(`${OUT}${name}.webm`); await v.delete(); recordings.push(name); } }
async function finishRecording(ctx, dir) {
  await ctx.close();
  try { for (const f of readdirSync(dir)) renameSync(`${dir}/${f}`, `${OUT}unnamed-${f}`); rmSync(dir, { recursive: true, force: true }); } catch { /* none left */ }
}

async function traced(page, name, fn) {
  if (!TRACE) return fn();
  await browser.startTracing(page, { path: `${OUT}${name}.trace.json`, screenshots: true,
    categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline.frame', 'disabled-by-default-devtools.screenshot',
      'blink.user_timing', 'media', 'latencyInfo', 'input', 'loading'] });
  try { return await fn(); } finally { await browser.stopTracing(); }
}

// ───────────────────────── scenarios ─────────────────────────

/** The complete experience as a visitor would click through it. */
async function journey(h) {
  const { page, step, waitPhase } = h;
  const click = (name) => page.getByRole('button', { name }).first().click();
  await step('goto /', () => page.goto(BASE + '/' + QUERY, { waitUntil: 'domcontentloaded' }));
  await step('wait: intro → home', () => waitPhase('home', 30000));
  await sleep(1500);
  await step('click Enter (first visit: full cinematic)', () => click(/Enter the Empire/));
  await step('wait: arrived', () => waitPhase('arrived', 40000));
  await sleep(3000);
  await step('click Back to exterior', () => click(/Back to exterior/));
  await sleep(2500);
  await step('click Enter (already seen: cross-fade)', () => click(/Enter the Empire/));
  await sleep(2500);
  await step('click Replay the entrance', () => click(/Replay the entrance/));
  await step('wait: gateway', () => waitPhase('gateway', 10000));
  await sleep(2500);
  await step('click Skip cinematic', () => click(/Skip cinematic/));
  await sleep(2500);
  await step('click Back to exterior', () => click(/Back to exterior/));
  await sleep(2500);
}

async function runJourney() {
  const { ctx, dir } = await newContext('journey');
  const results = {};
  for (const name of ['cold', 'warm']) {
    console.log(`journey ${name}`);
    const h = await openPage(ctx, name);
    const t0 = wall();
    await traced(h.page, name, () => journey(h));
    await h.dump({ wallStart: t0, wallEnd: wall(), cache: name });
    results[name] = true;
    await closeRecorded(h.page, name);   // warm: next tab in the same browser context → HTTP cache kept, sessionStorage fresh
  }
  await finishRecording(ctx, dir);
  return results;
}

/** Navigation that could make scenes play out of order. Each case starts from a fresh tab. */
async function runNav() {
  const cases = {
    'double-click Enter': async ({ page }) => { await page.getByRole('button', { name: /Enter the Empire/ }).dblclick(); await sleep(9000); },
    'Enter, browser Back at 0.6 s (mid-dissolve), Forward': async ({ page }) => { await page.getByRole('button', { name: /Enter the Empire/ }).click(); await sleep(600); await page.goBack(); await sleep(1500); await page.goForward(); await sleep(2500); },
    'Enter, browser Back at 4 s (gateway), Enter again': async ({ page }) => { await page.getByRole('button', { name: /Enter the Empire/ }).click(); await sleep(4000); await page.goBack(); await sleep(1500); await page.getByRole('button', { name: /Enter the Empire/ }).click(); await sleep(3000); },
    'Skip during the gateway → courtyard join': async ({ page, waitPhase }) => { await page.getByRole('button', { name: /Enter the Empire/ }).click(); await waitPhase('courtyard', 20000); await sleep(250); await page.keyboard.press('Escape'); await sleep(3000); },
    'Rooms → Library during the gateway': async ({ page }) => { await page.getByRole('button', { name: /Enter the Empire/ }).click(); await sleep(3000); await page.getByRole('button', { name: 'Rooms' }).click(); await sleep(300); await page.getByRole('button', { name: /Library/ }).first().click(); await sleep(3000); },
    'Replay the entrance, Esc during its fade home': async ({ page, waitPhase }) => { await page.getByRole('button', { name: /Enter the Empire/ }).click(); await sleep(400); await page.keyboard.press('Escape'); await waitPhase('arrived'); await sleep(1200); await page.getByRole('button', { name: /Replay the entrance/ }).click(); await sleep(300); await page.keyboard.press('Escape'); await sleep(3000); },
    'Enter during the intro film (t = 3 s)': async ({ page }) => { await page.getByRole('button', { name: /Enter the Empire/ }).click(); await sleep(18000); },
    'Replay the entrance, then Rooms → Library within 0.3 s': async ({ page, waitPhase }) => { await page.getByRole('button', { name: /Enter the Empire/ }).click(); await sleep(400); await page.keyboard.press('Escape'); await waitPhase('arrived'); await sleep(1200); await page.getByRole('button', { name: /Replay the entrance/ }).click(); await sleep(150); await page.getByRole('button', { name: 'Rooms' }).click(); await page.getByRole('button', { name: /Library/ }).first().click(); await sleep(5000); },
  };
  const only = opt('only', null);
  const { ctx, dir } = await newContext('nav');
  let i = 0;
  for (const [name, fn] of Object.entries(cases)) {
    const id = `nav-${++i}`;
    if (only && !only.split(',').includes(String(i))) continue;
    console.log(`${id}: ${name}`);
    const h = await openPage(ctx, id);
    await h.page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
    if (name.startsWith('Enter during the intro')) await sleep(3000); else await h.waitPhase('home', 30000);
    await h.step(name, () => fn(h));
    await h.dump({ case: name });
    await closeRecorded(h.page, id);
  }
  await finishRecording(ctx, dir);
}

/** Decode contention: the same clips played alone and simultaneously (as during a cross-fade). */
async function runDecode() {
  const { ctx, dir } = await newContext('decode');
  const h = await openPage(ctx, 'decode');
  await h.page.goto(BASE + '/#/courtyard', { waitUntil: 'domcontentloaded' });
  await sleep(1500);
  const result = await h.page.evaluate(async () => {
    const caps = {};
    for (const br of [21.5e6, 41.1e6]) {
      try { caps[br] = await navigator.mediaCapabilities.decodingInfo({ type: 'file', video: { contentType: 'video/mp4; codecs="avc1.640028"', width: 1920, height: 1080, bitrate: br, framerate: 24 } }); } catch (e) { caps[br] = String(e); }
    }
    // spec: 'clip' or { clip, opacity, transform, play }
    const make = (spec, z) => { const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = `/media/${spec.clip}.mp4`; v.dataset.clip = 'bench-' + spec.clip;
      Object.assign(v.style, { position: 'fixed', inset: '0', width: '100vw', height: '100vh', objectFit: 'cover', zIndex: 1000 + z, opacity: spec.opacity, transform: spec.transform || 'none' }); document.body.appendChild(v); return v; };
    const measure = async (set, name) => {
      const specs = set.map((x, i) => (typeof x === 'string' ? { clip: x, opacity: i === 0 ? 1 : 0.5, play: true } : { play: true, opacity: 1, ...x }));
      const clips = specs.map((x) => x.clip);
      const vs = specs.map((x, i) => make(x, i));
      await Promise.all(vs.map((v) => new Promise((ok) => { if (v.readyState >= 4) ok(); else v.addEventListener('canplaythrough', ok, { once: true }); })));
      const frames = vs.map(() => []);
      vs.forEach((v, i) => { const loop = (t, m) => { frames[i].push([t, m.mediaTime]); v.requestVideoFrameCallback(loop); }; v.requestVideoFrameCallback(loop); });
      const raf = []; let on = true; const tick = (t) => { raf.push(t); if (on) requestAnimationFrame(tick); }; requestAnimationFrame(tick);
      const q0 = vs.map((v) => v.getVideoPlaybackQuality());
      const tPlay = performance.now();
      await Promise.all(vs.map((v, i) => { v.currentTime = 1; return specs[i].play ? v.play() : Promise.resolve(); }));
      await new Promise((r) => setTimeout(r, 4000));
      on = false; vs.forEach((v) => v.pause());
      const out = vs.map((v, i) => {
        if (!specs[i].play) return { clip: clips[i], playing: false, opacity: specs[i].opacity };
        const f = frames[i].filter(([t]) => t > tPlay + 300);   // skip start-up
        const gaps = f.slice(1).map(([t], k) => t - f[k][0]);
        const mt = f.slice(1).map(([, m], k) => m - f[k][1]);
        const q = v.getVideoPlaybackQuality();
        return { clip: clips[i], firstFrameAfterPlay_ms: frames[i].length ? +(frames[i][0][0] - tPlay).toFixed(1) : null,
          presentedPerSec: +(f.length / ((f.at(-1)[0] - f[0][0]) / 1000)).toFixed(2),
          maxGap_ms: +Math.max(...gaps).toFixed(1), gapsOver60ms: gaps.filter((g) => g > 60).length,
          skippedSourceFrames: mt.filter((d) => d > 1.5 / 24).reduce((a, d) => a + Math.round(d * 24) - 1, 0),
          dropped: q.droppedVideoFrames - q0[i].droppedVideoFrames, total: q.totalVideoFrames - q0[i].totalVideoFrames };
      });
      const rd = raf.slice(1).map((t, k) => t - raf[k]);
      vs.forEach((v) => { v.removeAttribute('src'); v.load(); v.remove(); });
      return { name, clips, specs, videos: out, raf: { frames: raf.length, maxInterval_ms: +Math.max(...rd).toFixed(1), over50ms: rd.filter((d) => d > 50).length } };
    };
    const runs = [];
    const sets = {
      'gateway alone': ['gateway'],
      'courtyard alone': ['courtyard'],
      'gateway alone at opacity 0.5': [{ clip: 'gateway', opacity: 0.5 }],
      'gateway alone scaled 1.1': [{ clip: 'gateway', transform: 'scale(1.1)' }],
      'gateway + courtyard, both playing, top at opacity 0.5 (a cross-fade)': ['gateway', 'courtyard'],
      'gateway + courtyard, both playing, top fully opaque': [{ clip: 'gateway' }, { clip: 'courtyard', opacity: 1 }],
      'gateway playing + courtyard paused on top at opacity 0.5': [{ clip: 'gateway' }, { clip: 'courtyard', opacity: 0.5, play: false }],
      'gateway playing + courtyard playing but opacity 0 on top': [{ clip: 'gateway' }, { clip: 'courtyard', opacity: 0 }],
      'exterior + gateway (cross-fade)': ['exterior', 'gateway'],
      'all three (cross-fade stack)': ['exterior', 'gateway', 'courtyard'],
    };
    for (const [name, set] of Object.entries(sets)) runs.push(await measure(set, name));
    return { capabilities: caps, runs };
  });
  writeFileSync(`${OUT}decode.json`, JSON.stringify(result, null, 2));
  for (const r of result.runs) console.log(r.name.padEnd(72), `rAF max ${r.raf.maxInterval_ms}ms`, r.videos.map((v) => v.playing === false ? `${v.clip}: paused` : `${v.clip}: ${v.presentedPerSec}/s gap≤${v.maxGap_ms} skip ${v.skippedSourceFrames} drop ${v.dropped}/${v.total}`).join(' | '));
  await closeRecorded(h.page, 'decode');
  await finishRecording(ctx, dir);
}

try {
  if (scenario === 'journey') await runJourney();
  else if (scenario === 'nav') await runNav();
  else if (scenario === 'decode') await runDecode();
  else throw new Error('scenario: journey | nav | decode');
} finally {
  clearInterval(gpuTimer);
  meta.finished = new Date().toISOString(); meta.gpuWatchAtEnd = watched();
  writeFileSync(OUT + 'meta.json', JSON.stringify({ ...meta, gpu }, null, 2));
  await browser.close();
}
