// Playback/transition instrumentation, injected before the app loads (Playwright addInitScript).
// It does not change app behaviour: it only observes. Everything lands in window.__diag:
//   events   timestamped video events, play() calls, inputs, navigation, phase changes
//   vfc      every presented video frame (requestVideoFrameCallback metadata)
//   raf      one sample per animation frame: phase, layer opacity/scale/z, title opacity, panel
//   quality  getVideoPlaybackQuality() samples
//   loaf     long animation frames / long tasks
// All times are performance.now() ms (same clock as event.timeStamp and rVFC `now`).
(() => {
  if (window.__diag) return;
  const D = (window.__diag = { events: [], vfc: [], raf: [], quality: [], loaf: [], videos: [] });
  const now = () => performance.now();
  const r2 = (x) => Math.round(x * 100) / 100;
  const ranges = (tr) => { const a = []; try { for (let i = 0; i < tr.length; i++) a.push([+tr.start(i).toFixed(3), +tr.end(i).toFixed(3)]); } catch { /* detached */ } return a; };
  const clipOf = (v) => v.dataset.clip || (v.currentSrc || v.src || '').split('/').pop() || '?';
  const snap = (v) => ({ clip: clipOf(v), readyState: v.readyState, networkState: v.networkState, currentTime: +v.currentTime.toFixed(4), paused: v.paused, ended: v.ended, buffered: ranges(v.buffered), inDOM: v.isConnected, src: !!v.getAttribute('src') });
  const log = (type, data = {}) => {
    const e = { t: r2(now()), type, ...data };
    D.events.push(e);
    try { performance.mark('diag:' + type + (data.clip ? ':' + data.clip : '')); } catch { /* ignore */ }
    return e;
  };
  D.log = log;

  // ── videos ──
  const EVENTS = ['loadstart', 'durationchange', 'loadedmetadata', 'loadeddata', 'progress', 'canplay', 'canplaythrough', 'play', 'playing',
    'waiting', 'stalled', 'suspend', 'seeking', 'seeked', 'pause', 'ended', 'emptied', 'abort', 'error', 'ratechange'];
  function watch(v) {
    if (v.__diagWatched) return; v.__diagWatched = true;
    D.videos.push(v);
    for (const ev of EVENTS) v.addEventListener(ev, () => log('video:' + ev, snap(v)));
    if ('requestVideoFrameCallback' in HTMLVideoElement.prototype) {
      const loop = (ts, m) => {
        v.__diagPresented = (v.__diagPresented || 0) + 1; v.__diagMediaTime = m.mediaTime;
        D.vfc.push({ t: r2(ts), clip: clipOf(v), mediaTime: +m.mediaTime.toFixed(4), presented: m.presentedFrames,
          expected: r2(m.expectedDisplayTime), proc: m.processingDuration != null ? r2(m.processingDuration * 1000) : null, inDOM: v.isConnected });
        v.requestVideoFrameCallback(loop);
      };
      v.requestVideoFrameCallback(loop);
    }
  }
  const ce = Document.prototype.createElement;
  Document.prototype.createElement = function (tag, ...rest) {
    const el = ce.call(this, tag, ...rest);
    if (String(tag).toLowerCase() === 'video') queueMicrotask(() => watch(el));
    return el;
  };
  new MutationObserver((ms) => { for (const m of ms) m.addedNodes.forEach((n) => { if (n instanceof HTMLVideoElement) { watch(n); log('dom:video-attached', snap(n)); } }); m_removed(ms); })
    .observe(document, { childList: true, subtree: true });
  function m_removed(ms) { for (const m of ms) m.removedNodes.forEach((n) => { if (n instanceof HTMLVideoElement) log('dom:video-detached', snap(n)); }); }
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () {
    log('call:play', snap(this));
    const p = play.call(this);
    p.then(() => log('call:play:resolved', snap(this)), (err) => log('call:play:rejected', { ...snap(this), error: err && err.name }));
    return p;
  };
  const ctDesc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'currentTime');
  Object.defineProperty(HTMLMediaElement.prototype, 'currentTime', {
    configurable: true, get() { return ctDesc.get.call(this); },
    set(t) { log('call:seek', { ...snap(this), to: +(+t).toFixed(4) }); ctDesc.set.call(this, t); },
  });
  const load = HTMLMediaElement.prototype.load;
  HTMLMediaElement.prototype.load = function () { log('call:load', snap(this)); return load.call(this); };

  setInterval(() => {
    for (const v of D.videos) {
      if (!v.getVideoPlaybackQuality || (!v.isConnected && v.paused)) continue;
      const q = v.getVideoPlaybackQuality();
      D.quality.push({ t: r2(now()), clip: clipOf(v), total: q.totalVideoFrames, dropped: q.droppedVideoFrames, corrupted: q.corruptedVideoFrames, ct: +v.currentTime.toFixed(3), paused: v.paused });
    }
  }, 250);

  // ── input and navigation ──
  const label = (el) => (el?.closest?.('button')?.getAttribute('aria-label') || el?.closest?.('button')?.textContent || el?.tagName || '').trim().slice(0, 40);
  for (const type of ['pointerdown', 'click']) addEventListener(type, (e) => log('input:' + type, { target: label(e.target), eventTs: r2(e.timeStamp) }), true);
  addEventListener('keydown', (e) => log('input:keydown', { key: e.key, eventTs: r2(e.timeStamp) }), true);
  addEventListener('popstate', () => log('nav:popstate', { hash: location.hash }), true);
  for (const fn of ['pushState', 'replaceState']) {
    const orig = history[fn];
    history[fn] = function (...a) { const r = orig.apply(this, a); log('nav:' + fn, { hash: location.hash }); return r; };
  }
  document.addEventListener('visibilitychange', () => log('doc:visibility', { hidden: document.hidden }));

  // ── long frames ──
  try { new PerformanceObserver((l) => l.getEntries().forEach((e) => D.loaf.push({ t: r2(e.startTime), dur: r2(e.duration), type: e.entryType, blocking: e.blockingDuration != null ? r2(e.blockingDuration) : null }))).observe({ type: 'long-animation-frame', buffered: true }); }
  catch { try { new PerformanceObserver((l) => l.getEntries().forEach((e) => D.loaf.push({ t: r2(e.startTime), dur: r2(e.duration), type: e.entryType }))).observe({ type: 'longtask', buffered: true }); } catch { /* unsupported */ } }

  // ── per-frame state sampler ──
  let lastPhase = null;
  const scaleOf = (el) => { if (!el) return null; const t = getComputedStyle(el).transform; if (!t || t === 'none') return 1; const m = new DOMMatrixReadOnly(t); return +m.a.toFixed(5); };
  const frame = (ts) => {
    const app = document.querySelector('.app');
    const phase = app ? (/phase-(\w+)/.exec(app.className) || [])[1] : null;
    if (phase !== lastPhase) { log('phase', { phase, from: lastPhase }); lastPhase = phase; }
    const layers = [...document.querySelectorAll('[data-layer]')].map((l) => {
      const cs = getComputedStyle(l), v = l.querySelector('video');
      return {
        id: l.dataset.layer, o: +(+cs.opacity).toFixed(4), z: +cs.zIndex || 0, vis: cs.visibility !== 'hidden',
        s: scaleOf(l.querySelector('.plate-inner')), lean: scaleOf(l.querySelector('.plate-lean')),
        video: !!v, playing: !!v && !v.paused && !v.ended, presented: v ? (v.__diagPresented || 0) : null, rs: v ? v.readyState : null,
        mt: v && v.__diagMediaTime != null ? +v.__diagMediaTime.toFixed(4) : null,
        threshold: [...l.querySelectorAll('.plate-held, .plate-threshold')].some((c) => c.style.visibility !== 'hidden'),
        img: (l.querySelector('img.plate-media')?.getAttribute('src') || '').split('/').pop(),
      };
    });
    // what is actually on screen: walk the layers top-down, accumulating coverage
    let remaining = 1, visiblePlaying = 0, poster = false;
    for (const l of [...layers].sort((a, b) => b.z - a.z)) {
      const shown = l.vis && l.o > 0.002;
      l.onScreen = shown && remaining > 0.002;
      if (!l.onScreen) continue;
      if (l.playing) visiblePlaying++;
      if (l.video && (!l.presented || l.rs < 2)) poster = true;          // the layer shows its <img> underlay, not video
      remaining *= l.threshold ? 1 : 1 - l.o;                             // a clearing threshold canvas is partly transparent
    }
    const title = document.querySelector('.title'), h1 = title?.querySelector('h1');
    const titleO = title ? +(getComputedStyle(title).opacity * (h1 ? getComputedStyle(h1).opacity : 1)).toFixed(3) : null;
    D.raf.push({ t: r2(ts), phase, layers, visiblePlaying, poster, uncovered: +remaining.toFixed(4), title: titleO, panel: !!document.querySelector('.panel') });
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
})();
