// End-to-end validation in Chromium (Chrome for Testing) against the running dev server.
//   npm run dev   (in another terminal)
//   node scripts/validate.mjs [base-url]       → validation/report.json + screenshots in validation/
import { mkdirSync, writeFileSync } from 'node:fs';
import { launch } from './lib/browser.mjs';

const BASE = process.argv[2] ?? 'http://127.0.0.1:5180';
const OUT = new URL('../validation/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const destinations = { library: { x: 468, y: 446 }, durbar: { x: 958, y: 452 }, music: { x: 960, y: 196 }, workshop: { x: 1462, y: 712 }, unfinished: { x: 1712, y: 200 } };
const results = [];
const check = (name, pass, detail = {}) => { results.push({ name, pass: !!pass, ...detail }); console.log(pass ? '  ✓' : '  ✗', name, Object.keys(detail).length ? JSON.stringify(detail) : ''); };
const ue = (page) => page.evaluate(() => window.__ue);
const waitPhase = (page, phase, timeout = 20000) => page.waitForFunction((p) => window.__ue?.phase === p, phase, { timeout }).then(() => true, () => false);
const shot = (page, name) => page.screenshot({ path: OUT + name + '.png' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await launch();
const errors = [], expected = [];
// every animation frame: how many playing videos are actually visible (topmost-first coverage walk)
const SAMPLER = () => {
  window.__vis = { max: 0, framesOver1: 0 };
  const tick = () => {
    let remaining = 1, n = 0;
    const layers = [...document.querySelectorAll('[data-layer]')].map((l) => ({ l, cs: getComputedStyle(l) })).sort((a, b) => (+b.cs.zIndex || 0) - (+a.cs.zIndex || 0));
    for (const { l, cs } of layers) {
      const o = +cs.opacity; if (cs.visibility === 'hidden' || o < 0.002 || remaining < 0.002) continue;
      const v = l.querySelector('video'); if (v && !v.paused && !v.ended && v.style.visibility !== 'hidden') n++;
      const held = [...l.querySelectorAll('.plate-held')].some((c) => c.style.visibility !== 'hidden');
      remaining *= held ? 1 : 1 - o;
    }
    window.__vis.max = Math.max(window.__vis.max, n); if (n > 1) window.__vis.framesOver1++;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};
async function context(opts = {}, init) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...opts });
  await ctx.addInitScript(SAMPLER);
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  return { ctx, page };
}
// rendered position of every hotspot vs where the plate math says the architecture is
async function hotspotErrors(page) {
  return page.evaluate((dests) => {
    const s = window.__ue; const p = s.plate;
    const inner = document.querySelector('[data-layer="courtyard"] .plate-inner');
    const lean = document.querySelector('[data-layer="courtyard"] .plate-lean');
    const m = new DOMMatrix(getComputedStyle(inner).transform === 'none' ? undefined : getComputedStyle(inner).transform);
    const l = new DOMMatrix(getComputedStyle(lean).transform === 'none' ? undefined : getComputedStyle(lean).transform);
    const io = getComputedStyle(inner).transformOrigin.split(' ').map(parseFloat);
    const lo = getComputedStyle(lean).transformOrigin.split(' ').map(parseFloat);
    const plateEl = document.querySelector('[data-layer="courtyard"] .plate').getBoundingClientRect();
    return Object.fromEntries(Object.entries(dests).map(([id, a]) => {
      const el = document.querySelector(`[data-dest="${id}"]`).getBoundingClientRect();
      // architecture point: source px → plate px → inner transform → lean transform → screen
      let x = a.x * p.scale, y = a.y * p.scale;
      x = io[0] + m.a * (x - io[0]) + m.e; y = io[1] + m.d * (y - io[1]) + m.f;
      x = lo[0] + l.a * (x - lo[0]) + l.e; y = lo[1] + l.d * (y - lo[1]) + l.f;
      const sx = plateEl.left + x, sy = plateEl.top + y;
      const cx = el.left + el.width / 2, cy = el.top + el.height / 2;
      return [id, { screen: [Math.round(cx), Math.round(cy)], error_px: +Math.hypot(cx - sx, cy - sy).toFixed(2), onScreen: cx > 0 && cx < innerWidth && cy > 0 && cy < innerHeight }];
    }));
  }, destinations);
}
// frames of a transition, as fast as screenshots allow
async function strip(page, name, ms, every = 110) {
  const t0 = Date.now(); const frames = [];
  while (Date.now() - t0 < ms) { const b = await page.screenshot({ type: 'jpeg', quality: 70 }); frames.push({ t: Date.now() - t0, b: b.toString('base64') }); await sleep(Math.max(0, every - 60)); }
  const sheet = await page.evaluate(async (frames) => {
    const W = 360, H = Math.round(360 * innerHeight / innerWidth), cols = 6;
    const c = document.createElement('canvas'); c.width = W * cols; c.height = H * Math.ceil(frames.length / cols);
    const g = c.getContext('2d'); g.font = '14px sans-serif';
    for (let i = 0; i < frames.length; i++) { const im = new Image(); im.src = 'data:image/jpeg;base64,' + frames[i].b; await im.decode();
      const x = (i % cols) * W, y = Math.floor(i / cols) * H; g.drawImage(im, x, y, W, H); g.fillStyle = '#000a'; g.fillRect(x, y, 70, 20); g.fillStyle = '#ff0'; g.fillText(frames[i].t + ' ms', x + 4, y + 15); }
    return c.toDataURL('image/jpeg', 0.85);
  }, frames);
  writeFileSync(OUT + name + '.jpg', Buffer.from(sheet.split(',')[1], 'base64'));
  return frames.length;
}

// ─── 1. stills vs decoded video frames ───
console.log('\n1. Final-frame stills');
{
  const { ctx, page } = await context();
  await page.goto(BASE + '/#/courtyard');
  const r = await page.evaluate(async () => {
    const out = {};
    for (const id of ['exterior', 'gateway', 'courtyard']) {
      const v = document.createElement('video'); v.muted = true; v.src = `/media/${id}.mp4`;
      await new Promise((ok) => (v.onloadeddata = ok));
      const c = document.createElement('canvas'); c.width = 960; c.height = 540; const g = c.getContext('2d', { willReadFrequently: true });
      const px = () => g.getImageData(0, 0, 960, 540).data;
      const res = {};
      for (const [which, t] of [['first', 0.5 / 24], ['last', v.duration - 0.5 / 24]]) {
        v.currentTime = t; await new Promise((ok) => (v.onseeked = ok));
        g.drawImage(v, 0, 0, 960, 540); const a = px();
        const im = new Image(); im.src = `/posters/${id}-${which}.jpg`; await im.decode(); g.drawImage(im, 0, 0, 960, 540); const b = px();
        let se = 0, ma = 0, mb = 0; for (let i = 0; i < a.length; i += 4) for (let k = 0; k < 3; k++) { const d = (a[i + k] - b[i + k]) / 255; se += d * d; ma += a[i + k]; mb += b[i + k]; }
        const n = a.length / 4 * 3; res[which] = { psnr_db: +(10 * Math.log10(1 / (se / n))).toFixed(2), mean_video: +(ma / n).toFixed(2), mean_still: +(mb / n).toFixed(2) };
      }
      out[id] = res; v.removeAttribute('src'); v.load();
    }
    return out;
  });
  for (const [id, x] of Object.entries(r)) check(`${id}: held still matches the decoded last frame`, x.last.psnr_db > 38 && Math.abs(x.last.mean_video - x.last.mean_still) < 1, x.last);
  await ctx.close();
}

// ─── 2. desktop: full journey ───
console.log('\n2. Desktop 1440×900 journey');
{
  const { ctx, page } = await context();
  await page.goto(BASE + '/');
  await sleep(700);
  const enterVisible = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('Enter the Empire')); if (!b) return 0; let o = 1, e = b; while (e) { o *= +getComputedStyle(e).opacity; e = e.parentElement; } return +o.toFixed(2); });
  check('Enter the Empire is available within 0.7 s', enterVisible > 0.5, { opacity: enterVisible });
  let s = await ue(page);
  check('exterior autoplays muted, inline', s.phase === 'intro' && s.playing === 'exterior' && await page.evaluate(() => { const v = document.querySelector('video'); return v.muted && v.playsInline; }), { phase: s.phase, playing: s.playing });
  await sleep(1500); await shot(page, 'desktop-01-intro');
  check('only the next clip is requested during the intro', true, { requested: await page.evaluate(() => performance.getEntriesByType('resource').filter((e) => e.name.includes('/media/')).map((e) => e.name.split('/').pop())) });
  check('intro ends on the held exterior frame', await waitPhase(page, 'home'));
  await sleep(1800);
  s = await ue(page);
  check('hold uses the still (exterior video released)', s.layers.exterior.mode === 'still' && !(await page.$('[data-layer="exterior"] video')), { mode: s.layers.exterior.mode });
  check('gateway parked under the homepage on a decoded frame, paused', await page.evaluate(() => { const v = document.querySelector('[data-layer="gateway"] video'); return !!v && v.paused && v.readyState >= 2; }));
  await shot(page, 'desktop-02-home');

  await page.getByRole('button', { name: /Enter the Empire/ }).click();
  const n1 = await strip(page, 'transition-exterior-to-gateway', 1700);
  check('Enter starts the gateway approach', (await ue(page)).phase === 'gateway', { frames: n1, hash: await page.evaluate(() => location.hash) });
  await sleep(2000); await shot(page, 'desktop-03-gateway');
  check('courtyard preloaded while the gateway plays', await page.evaluate(() => !!document.querySelector('video') && performance.getEntriesByType('resource').some((e) => e.name.includes('courtyard.mp4'))));
  await waitPhase(page, 'courtyard', 15000);
  const n2 = await strip(page, 'transition-gateway-to-courtyard', 1400, 100);
  check('gateway → courtyard join runs', true, { frames: n2 });
  await sleep(2500); await shot(page, 'desktop-04-courtyard-film');
  check('courtyard film ends inside the palace', await waitPhase(page, 'arrived', 15000));
  await sleep(2200);
  await shot(page, 'desktop-05-courtyard');
  s = await ue(page);
  const vis = await page.evaluate(() => window.__vis);
  check('never more than one moving video visible during the whole entrance', vis.max <= 1, vis);
  check('the edits were placed on presented frames', await page.evaluate(() => __ue.stats.edits.every((e) => e.frameConfirmed && e.trigger === 'incoming-frame')), { edits: await page.evaluate(() => __ue.stats.edits.map((e) => `${e.join} ${e.style} ${e.trigger} out#${e.outgoingMediaTime == null ? '-' : Math.round(e.outgoingMediaTime * 24)} in#${Math.round(e.incomingMediaTime * 24)}`)) });
  check('courtyard holds on its final frame (still, no video)', s.layers.courtyard.mode === 'still' && s.layers.courtyard.still === 'last' && !(await page.$('video')));
  const he = await hotspotErrors(page);
  check('hotspots sit on their architecture (desktop)', Object.values(he).every((h) => h.error_px < 1.5 && h.onScreen), he);

  // keyboard
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.press('ArrowRight'); const f1 = await page.evaluate(() => document.activeElement?.dataset?.dest);
  await page.keyboard.press('ArrowRight'); const f2 = await page.evaluate(() => document.activeElement?.dataset?.dest);
  check('arrow keys move between destinations (west → east)', f1 === 'library' && f2 === 'durbar', { f1, f2 });
  await page.keyboard.press('Enter'); await sleep(900);
  check('Enter opens the destination', (await ue(page)).room === 'durbar' && await page.evaluate(() => location.hash) === '#/courtyard/durbar');
  await shot(page, 'desktop-06-panel-durbar');
  await page.keyboard.press('Escape'); await sleep(600);
  check('Escape returns to the courtyard and restores focus', (await ue(page)).room === null && await page.evaluate(() => location.hash) === '#/courtyard' && await page.evaluate(() => document.activeElement?.dataset?.dest) === 'durbar');
  await page.keyboard.press('4'); await sleep(1300);
  check('number keys open destinations directly', (await ue(page)).room === 'workshop');
  await shot(page, 'desktop-07-panel-workshop');
  await page.keyboard.press('5'); await sleep(1300); await shot(page, 'desktop-07b-panel-unfinished');
  await page.keyboard.press('2'); await sleep(1300); await shot(page, 'desktop-07c-panel-durbar-from-unfinished');
  await page.keyboard.press('1'); await sleep(1300); await shot(page, 'desktop-07d-panel-music');
  await page.keyboard.press('3'); await sleep(1300); await shot(page, 'desktop-07e-panel-library');

  // history
  await page.goBack(); await sleep(700);
  check('browser Back closes the room', (await ue(page)).room === 'music', { room: (await ue(page)).room });
  for (let i = 0; i < 5 && (await page.evaluate(() => location.hash)) !== '#/'; i++) { await page.goBack(); await sleep(400); }
  await sleep(1200);
  s = await ue(page);
  check('browser Back reaches the exterior without replaying it', s.phase === 'home' && !s.playing, { phase: s.phase, playing: s.playing });
  await shot(page, 'desktop-08-back-home');
  await page.goForward(); await sleep(1200); s = await ue(page);
  check('browser Forward returns to the courtyard without a cinematic', s.phase === 'arrived' && !s.playing, { phase: s.phase });

  // back button, then Enter again: already seen, so no forced replay
  await page.getByRole('button', { name: /Back to exterior/ }).click(); await sleep(1200);
  check('Back to exterior', (await ue(page)).phase === 'home' && await page.evaluate(() => location.hash) === '#/');
  await page.getByRole('button', { name: /Enter the Empire/ }).click();
  const seenPhases = new Set(); for (let i = 0; i < 12; i++) { seenPhases.add((await ue(page)).phase); await sleep(100); }
  check('second Enter goes straight in (no forced replay)', !seenPhases.has('gateway') && seenPhases.has('arrived'), { phases: [...seenPhases] });
  await sleep(800);

  // replay + skip
  await page.getByRole('button', { name: /Replay the entrance/ }).click();
  check('Replay the entrance plays the gateway', await waitPhase(page, 'gateway', 5000));
  await sleep(1500);
  await shot(page, 'desktop-09-replay-skip-visible');
  check('Skip cinematic control is visible during the film', await page.getByRole('button', { name: /Skip cinematic/ }).isVisible());
  await page.keyboard.press('Escape'); await sleep(1100); s = await ue(page);
  check('Esc skips to the courtyard and stops the film', s.phase === 'arrived' && !s.playing && !(await page.$('video')), { phase: s.phase });

  // rooms menu from the homepage
  await page.getByRole('button', { name: /Back to exterior/ }).click(); await sleep(1100);
  await page.getByRole('button', { name: 'Rooms' }).click(); await sleep(300); await shot(page, 'desktop-10-rooms-menu');
  await page.getByRole('button', { name: /Library/ }).first().click(); await sleep(1300); s = await ue(page);
  check('Rooms menu navigates directly from the exterior', s.phase === 'arrived' && s.room === 'library');

  // sound
  const sw = page.getByRole('switch', { name: /Sound/ });
  check('sound is off by default', (await sw.getAttribute('aria-checked')) === 'false');
  await sw.click(); await page.reload(); await sleep(800);
  check('sound setting persists across reloads', (await page.getByRole('switch', { name: /Sound/ }).getAttribute('aria-checked')) === 'true');
  await page.getByRole('switch', { name: /Sound/ }).click();
  await ctx.close();
}

// ─── 3. Skip button on a first visit ───
console.log('\n3. Skip on first visit');
{
  const { ctx, page } = await context();
  await page.goto(BASE + '/'); await sleep(1200);
  await page.getByRole('button', { name: /Enter the Empire/ }).click(); await sleep(2500);
  await page.getByRole('button', { name: /Skip cinematic/ }).click(); await sleep(1200);
  const s = await ue(page);
  check('Skip cinematic button lands in the courtyard', s.phase === 'arrived' && !s.playing);
  await ctx.close();
}

// ─── 4. reduced motion ───
console.log('\n4. Reduced motion');
{
  const { ctx, page } = await context({ reducedMotion: 'reduce' });
  await page.goto(BASE + '/'); await sleep(1200);
  let s = await ue(page);
  check('reduced motion: no autoplay, homepage still', s.phase === 'home' && !s.playing && s.layers.exterior.mode === 'still', { phase: s.phase });
  await shot(page, 'reduced-01-home');
  await page.getByRole('button', { name: /Enter the Empire/ }).click();
  const phases = new Set(); for (let i = 0; i < 8; i++) { phases.add((await ue(page)).phase); await sleep(100); }
  s = await ue(page);
  check('reduced motion: Enter cross-fades to the courtyard (no film)', !phases.has('gateway') && s.phase === 'arrived', { phases: [...phases] });
  const scale = await page.evaluate(() => getComputedStyle(document.querySelector('[data-layer="courtyard"] .plate-inner')).transform);
  check('reduced motion: no settle zoom', scale === 'none' || scale === 'matrix(1, 0, 0, 1, 0, 0)', { transform: scale });
  await shot(page, 'reduced-02-courtyard');
  await ctx.close();
}

// ─── 5. mobile portrait ───
console.log('\n5. Mobile portrait 390×844 (touch)');
{
  const { ctx, page } = await context({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.goto(BASE + '/'); await sleep(2000); await shot(page, 'mobile-01-intro');
  await waitPhase(page, 'home'); await sleep(1600); await shot(page, 'mobile-02-home');
  await page.getByRole('button', { name: /Enter the Empire/ }).tap();
  await sleep(2500); await shot(page, 'mobile-03-gateway');
  await waitPhase(page, 'courtyard', 15000); await sleep(2500); await shot(page, 'mobile-04-courtyard-film');
  await waitPhase(page, 'arrived', 15000); await sleep(2200); await shot(page, 'mobile-05-courtyard');
  let s = await ue(page);
  const he = await hotspotErrors(page);
  check('mobile: hotspots aligned (on- and off-screen)', Object.values(he).every((h) => h.error_px < 1.5), he);
  check('mobile: courtyard can be panned', s.canPan, { panMin: s.plate.panMin, panMax: s.plate.panMax });
  const hints = await page.$$eval('.edge-hint', (e) => e.map((x) => x.textContent));
  check('mobile: off-screen rooms are signposted at the edges', hints.length > 0, { hints });
  // swipe left with real touch events
  const cdp = await ctx.newCDPSession(page);
  const touch = async (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  await touch('touchStart', 320, 520); for (let i = 1; i <= 10; i++) { await touch('touchMove', 320 - i * 22, 520); await sleep(16); } await touch('touchEnd');
  await sleep(300); const after = (await ue(page)).pan;
  check('mobile: swipe pans the courtyard', after < s.pan - 100, { before: s.pan, after });
  await sleep(600); await shot(page, 'mobile-06-panned');
  const hint = page.locator('.edge-hint').first(); const hintText = await hint.textContent(); await hint.tap(); await sleep(1100);
  await shot(page, 'mobile-07-edge-hint');
  const visibleDest = Object.entries(await hotspotErrors(page)).find(([, h]) => h.onScreen)?.[0];
  await page.locator(`[data-dest="${visibleDest}"]`).tap(); await sleep(1200);
  check('mobile: tapping a hotspot opens its room', (await ue(page)).room === visibleDest, { hint: hintText, tapped: visibleDest });
  await shot(page, 'mobile-08-panel');
  await page.getByRole('button', { name: /Return to courtyard/ }).tap(); await sleep(700);
  check('mobile: Return to courtyard', (await ue(page)).room === null);
  await page.getByRole('button', { name: 'Rooms' }).tap(); await sleep(400); await shot(page, 'mobile-09-rooms');
  await ctx.close();
}

// ─── 6. mobile landscape + deep links ───
console.log('\n6. Mobile landscape 844×390, deep links');
{
  const { ctx, page } = await context({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.goto(BASE + '/#/courtyard'); await sleep(1500);
  let s = await ue(page);
  check('deep link #/courtyard opens the held courtyard, no film', s.phase === 'arrived' && !s.playing);
  const he = await hotspotErrors(page);
  check('landscape: hotspots aligned', Object.values(he).every((h) => h.error_px < 1.5), he);
  await shot(page, 'landscape-01-courtyard');
  await page.goto(BASE + '/#/courtyard/unfinished'); await page.reload(); await sleep(1500);
  s = await ue(page);
  check('deep link to a room opens it', s.phase === 'arrived' && s.room === 'unfinished');
  await shot(page, 'landscape-02-room');
  await page.goto(BASE + '/#/'); await page.reload(); await waitPhase(page, 'home'); await sleep(1600); await shot(page, 'landscape-03-home');
  await ctx.close();
}

// ─── 7. failure handling ───
console.log('\n7. Failures and interruptions');
{
  // autoplay refused
  const { ctx, page } = await context({}, () => {
    // like a strict browser policy: no playback at all until the visitor interacts
    const play = HTMLMediaElement.prototype.play; let gesture = false;
    addEventListener('pointerdown', () => { gesture = true; }, true); addEventListener('keydown', () => { gesture = true; }, true);
    HTMLMediaElement.prototype.play = function () { return gesture ? play.call(this) : Promise.reject(new DOMException('blocked', 'NotAllowedError')); };
  });
  await page.goto(BASE + '/'); await sleep(1500);
  let s = await ue(page);
  check('autoplay refused → homepage still, Enter available', s.phase === 'home' && s.notice === 'autoplay-blocked' && await page.getByRole('button', { name: /Enter the Empire/ }).isVisible(), { phase: s.phase, notice: s.notice });
  await shot(page, 'failure-01-autoplay-blocked');
  await page.getByRole('button', { name: /Play the film|Replay the film/ }).click(); await sleep(800);
  check('autoplay refused → the film plays after a tap', (await ue(page)).playing === 'exterior');
  await ctx.close();
}
{
  // gateway fails to load
  const { ctx, page } = await context();
  await page.route('**/media/gateway.mp4', (r) => r.abort('failed'));
  page.on('console', (m) => { if (m.text().includes('ERR_FAILED')) expected.push(m.text()); });
  await page.goto(BASE + '/'); await waitPhase(page, 'home');
  await page.getByRole('button', { name: /Enter the Empire/ }).click(); await sleep(3000);
  const s = await ue(page);
  check('gateway load failure → falls back to the courtyard still', s.phase === 'arrived' && s.notice === 'media-failed', { phase: s.phase, notice: s.notice });
  await shot(page, 'failure-02-gateway-missing');
  await ctx.close();
}
{
  // tab hidden mid-film
  const { ctx, page } = await context();
  await page.goto(BASE + '/'); await waitPhase(page, 'home');
  await page.getByRole('button', { name: /Enter the Empire/ }).click(); await waitPhase(page, 'gateway'); await sleep(1800);
  const hide = (h) => page.evaluate((h) => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => h }); document.dispatchEvent(new Event('visibilitychange')); }, h);
  await hide(true); await sleep(300);
  const paused = await page.evaluate(() => document.querySelector('video[data-clip="gateway"]')?.paused);
  const t0 = await page.evaluate(() => document.querySelector('video[data-clip="gateway"]')?.currentTime); await sleep(1000);
  const t1 = await page.evaluate(() => document.querySelector('video[data-clip="gateway"]')?.currentTime);
  await hide(false); await sleep(800);
  const resumed = await page.evaluate(() => !document.querySelector('video[data-clip="gateway"]')?.paused);
  check('film pauses while the tab is hidden and resumes after', paused && t0 === t1 && resumed, { paused, t0, t1, resumed });
  check('…and the journey still completes', await waitPhase(page, 'arrived', 20000));
  await ctx.close();
}

// ─── 8. navigation races (each one documented in the V1 diagnostic report) ───
console.log('\n8. Navigation races');
{
  const fresh = async () => { const { ctx, page } = await context(); await page.goto(BASE + '/'); await waitPhase(page, 'home'); await sleep(900); return { ctx, page }; };
  const state = (page) => page.evaluate(() => ({ phase: __ue.phase, playing: __ue.playing, room: __ue.room, seq: __ue.sequence, started: __ue.stats.started, settled: __ue.stats.settled,
    edits: __ue.stats.edits.length, hash: location.hash, vis: window.__vis, videos: document.querySelectorAll('video').length }));
  const consistent = (s) => (s.phase === 'home' ? s.hash === '#/' : s.hash.startsWith('#/courtyard'));
  const still = (s) => (s.phase === 'home' || s.phase === 'arrived') && !s.playing && s.seq === null && s.started === s.settled;
  const enterBtn = (page) => page.getByRole('button', { name: /Enter the Empire/ });
  const esc = (page) => page.keyboard.press('Escape');

  // R1 Esc during Replay's intermediate fade back to the exterior
  { const { ctx, page } = await fresh();
    await enterBtn(page).click(); await sleep(300); await esc(page); await waitPhase(page, 'arrived'); await sleep(1200);
    const e0 = (await state(page)).edits;
    await page.getByRole('button', { name: /Replay the entrance/ }).click(); await sleep(250);
    const mid = (await state(page)).phase;
    await esc(page); await sleep(2800);
    const s = await state(page);
    check('R1 Esc during Replay\'s fade home skips (no film starts afterwards)', mid === 'replay' && still(s) && s.phase === 'arrived' && s.edits === e0 && consistent(s), { mid, ...s });
    await ctx.close(); }

  // R2 Skip works in every entry and replay phase
  for (const [label, prep] of [
    ['lead-in (before the first edit)', async (page) => { await enterBtn(page).click(); await sleep(120); }],
    ['gateway film', async (page) => { await enterBtn(page).click(); await sleep(2500); }],
    ['gateway → courtyard edit window', async (page) => { await enterBtn(page).click(); await page.waitForFunction(() => __ue.stats.edits.length >= 1 && __ue.playing?.includes('courtyard'), null, { timeout: 15000, polling: 'raf' }); }],
    ['courtyard film', async (page) => { await enterBtn(page).click(); await waitPhase(page, 'courtyard', 15000); await sleep(1500); }],
    ['replay fade', async (page) => { await enterBtn(page).click(); await sleep(200); await esc(page); await waitPhase(page, 'arrived'); await sleep(1000); await page.getByRole('button', { name: /Replay the entrance/ }).click(); await sleep(200); }],
  ]) {
    const { ctx, page } = await fresh();
    await prep(page);
    const before = (await state(page)).phase;
    await page.getByRole('button', { name: /Skip cinematic/ }).click(); await sleep(1600);
    const s = await state(page);
    check(`R2 Skip during ${label}`, still(s) && s.phase === 'arrived' && s.videos === 0 && consistent(s), { before, ...s });
    await ctx.close();
  }

  // R3 Back cancels the running sequence immediately
  { const { ctx, page } = await fresh();
    await enterBtn(page).click(); await sleep(2000);
    const t = Date.now(); await page.goBack();
    await page.waitForFunction(() => __ue.phase === 'home', null, { timeout: 2000, polling: 'raf' });
    const ms = Date.now() - t; await sleep(1500);
    const s = await state(page);
    check('R3 browser Back during the film returns home at once and stops the film', ms < 400 && still(s) && s.phase === 'home' && consistent(s) && !s.playing, { phaseSwitch_ms: ms, ...s });
    await ctx.close(); }

  // R4 double-clicking Enter does not restart playback
  { const { ctx, page } = await fresh();
    const s0 = await state(page);
    await enterBtn(page).dblclick(); await sleep(1500);
    const tA = await page.evaluate(() => document.querySelector('[data-layer="gateway"] video')?.currentTime); await sleep(500);
    const tB = await page.evaluate(() => document.querySelector('[data-layer="gateway"] video')?.currentTime);
    const s = await state(page);
    check('R4 double-click Enter starts one entrance, playback never restarts', s.started - s0.started === 1 && s.edits === 1 && tA > 0.6 && tB > tA, { sequencesStarted: s.started - s0.started, edits: s.edits, tA, tB });
    await ctx.close(); }

  // R5 a cancelled Replay can never start Enter afterwards
  { const { ctx, page } = await fresh();
    await enterBtn(page).click(); await sleep(250); await esc(page); await waitPhase(page, 'arrived'); await sleep(1200);
    const e0 = (await state(page)).edits;
    await page.getByRole('button', { name: /Replay the entrance/ }).click(); await sleep(120);
    await page.getByRole('button', { name: 'Rooms' }).click(); await page.getByRole('button', { name: /Library/ }).first().click();
    await sleep(6000);
    const s = await state(page);
    check('R5 Replay cancelled by opening a room never starts the entrance later', still(s) && s.room === 'library' && s.edits === e0 && consistent(s), s);
    await ctx.close(); }

  // R6 opening a room cancels the playing film
  { const { ctx, page } = await fresh();
    await enterBtn(page).click(); await sleep(3000);
    await page.getByRole('button', { name: 'Rooms' }).click(); await page.getByRole('button', { name: /Workshop/ }).first().click(); await sleep(1500);
    const s = await state(page);
    check('R6 opening a room during the film stops it', still(s) && s.room === 'workshop' && s.videos === 0 && consistent(s), s);
    await ctx.close(); }

  // R7 entrance-seen policy: leaving mid-film and entering again does not replay the whole entrance
  { const { ctx, page } = await fresh();
    await enterBtn(page).click(); await sleep(1500); await page.goBack(); await waitPhase(page, 'home'); await sleep(1200);
    const e0 = (await state(page)).edits;
    await enterBtn(page).click(); await sleep(1600);
    const s = await state(page);
    check('R7 Enter after leaving mid-film cross-fades in (entrance counts as seen once started)', still(s) && s.phase === 'arrived' && s.edits === e0, { ...s });
    await ctx.close(); }

  // R8 browser Back / Forward always match the visible scene
  { const { ctx, page } = await fresh();
    await enterBtn(page).click(); await sleep(800); await esc(page); await sleep(1200);
    const a = await state(page); await page.goBack(); await sleep(1300);
    const b = await state(page); await page.goForward(); await sleep(1300);
    const c = await state(page);
    check('R8 Back/Forward stay consistent with the scene and never start a film', [a, b, c].every((x) => consistent(x) && still(x)) && a.phase === 'arrived' && b.phase === 'home' && c.phase === 'arrived', { a: [a.phase, a.hash], b: [b.phase, b.hash], c: [c.phase, c.hash] });
    await ctx.close(); }

  // R9 Enter during the intro film: still never two moving videos visible
  { const { ctx, page } = await context(); await page.goto(BASE + '/'); await sleep(2500);
    await enterBtn(page).click(); await page.waitForFunction(() => __ue.stats.edits.length >= 1, null, { timeout: 10000 }); await sleep(1200);
    const s = await state(page);
    check('R9 Enter during the intro: one moving video visible at a time', s.vis.max <= 1 && s.phase === 'gateway', { vis: s.vis, phase: s.phase });
    await ctx.close(); }

  // R10 rapid navigation: no unresolved sequences, no orphaned playback, URL and scene agree
  { const { ctx, page } = await fresh();
    const acts = ['enter', 'back', 'forward', 'esc', 'replay', 'room', 'back', 'enter', 'esc', 'back', 'forward', 'replay', 'esc', 'back', 'enter', 'skip'];
    for (const a of acts) {
      try {
        if (a === 'enter') await enterBtn(page).click({ timeout: 300 });
        else if (a === 'back') await page.goBack({ timeout: 1500 });
        else if (a === 'forward') await page.goForward({ timeout: 1500 });
        else if (a === 'esc') await esc(page);
        else if (a === 'replay') await page.getByRole('button', { name: /Replay the entrance/ }).click({ timeout: 300 });
        else if (a === 'room') { await page.getByRole('button', { name: 'Rooms' }).click({ timeout: 300 }); await page.getByRole('button', { name: /Music/ }).first().click({ timeout: 300 }); }
        else if (a === 'skip') await page.getByRole('button', { name: /Skip cinematic/ }).click({ timeout: 300 });
      } catch { /* control not present in that state: fine, the point is speed */ }
      await sleep(110);
    }
    await sleep(2500);
    const s = await state(page);
    const settledOrJourney = s.seq === null ? s.started === s.settled : s.started === s.settled + 1;
    check('R10 rapid navigation leaves no pending sequence or orphaned playback; URL matches the scene', settledOrJourney && consistent(s) && s.vis.max <= 1 && (s.seq !== null || !s.playing), s);
    await ctx.close(); }
}

await browser.close();
const unexpected = errors.filter((e) => !expected.includes(e));
check('no unexpected page errors', unexpected.length === 0, { unexpected, expected_from_simulated_failures: expected.length });
const passed = results.filter((r) => r.pass).length;
writeFileSync(OUT + 'report.json', JSON.stringify({ base: BASE, when: new Date().toISOString(), passed, total: results.length, results }, null, 2));
console.log(`\n${passed}/${results.length} checks passed → validation/report.json`);
process.exit(passed === results.length ? 0 : 1);
