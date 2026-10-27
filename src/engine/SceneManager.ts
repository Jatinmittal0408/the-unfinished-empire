// Reusable video scene manager: one <video> per clip, created on demand and attached to whichever plate
// shows it. It owns loading policy (nothing downloads until a scene asks for it or for its successor),
// playback with autoplay/stall/error handling, presented-frame tracking and releasing decoders.
//
// Frame tracking: with requestVideoFrameCallback (Chromium, Safari, Firefox 132+) every frame the compositor
// actually presents is reported with its mediaTime, so callers can act on "frame N is on screen" rather than
// on play() resolving. Without it, a requestAnimationFrame poll of currentTime stands in, one display frame late.
export type PlayResult = 'playing' | 'blocked' | 'error';

interface ClipSource { id: string; src: string; duration: number; fps: number }
export interface FrameInfo { mediaTime: number; presented: number; at: number }
type FrameListener = (f: FrameInfo) => boolean | void;   // return true to unsubscribe

export const hasFrameCallback = typeof HTMLVideoElement !== 'undefined' && 'requestVideoFrameCallback' in HTMLVideoElement.prototype;

export class SceneManager {
  private videos = new Map<string, HTMLVideoElement>();
  private failed = new Set<string>();
  private frames = new Map<string, FrameInfo>();
  private listeners = new Map<string, Set<FrameListener>>();
  private muted = true;
  /** Parks that fell back to seeked + readyState because no presented frame was reported (diagnostics). */
  unconfirmedParks = 0;
  constructor(private clips: Record<string, ClipSource>) {}

  /** The element for a clip (created lazily, nothing fetched until preload/play). */
  video(id: string): HTMLVideoElement {
    let v = this.videos.get(id);
    if (!v) {
      v = document.createElement('video');
      v.muted = this.muted; v.defaultMuted = true; v.playsInline = true; v.preload = 'none';
      v.setAttribute('playsinline', ''); v.setAttribute('aria-hidden', 'true'); v.disablePictureInPicture = true;
      v.dataset.clip = id;
      v.addEventListener('error', () => this.failed.add(id));
      this.videos.set(id, v);
      this.track(id, v);
    }
    return v;
  }

  has(id: string) { return this.videos.has(id); }

  private emit(id: string, f: FrameInfo) {
    this.frames.set(id, f);
    const set = this.listeners.get(id); if (!set) return;
    for (const fn of [...set]) if (fn(f) === true) set.delete(fn);
  }

  private track(id: string, v: HTMLVideoElement) {
    if (hasFrameCallback) {
      const loop = (now: number, m: VideoFrameCallbackMetadata) => {
        if (this.videos.get(id) !== v) return;           // released
        this.emit(id, { mediaTime: m.mediaTime, presented: m.presentedFrames, at: now });
        v.requestVideoFrameCallback(loop);
      };
      v.requestVideoFrameCallback(loop);
    } else {
      let last = -1, n = 0;
      const poll = (now: number) => {
        if (this.videos.get(id) !== v) return;
        if (v.readyState >= 2 && v.currentTime !== last && !v.seeking) { last = v.currentTime; this.emit(id, { mediaTime: last, presented: ++n, at: now }); }
        requestAnimationFrame(poll);
      };
      requestAnimationFrame(poll);
    }
  }

  /** The last frame presented for a clip (null before its first). */
  lastFrame(id: string): FrameInfo | null { return this.frames.get(id) ?? null; }

  /**
   * Call `fn` synchronously in the frame callback of the first presented frame that satisfies `pred`, so DOM
   * changes made in `fn` land in the same rendering update as that frame. Resolves true when it happened, or
   * false (after calling `fn` anyway) on timeout or when cancelled through `signal`.
   */
  whenFrame(id: string, pred: (f: FrameInfo) => boolean, fn: (f: FrameInfo | null) => void, timeoutMs: number, signal?: AbortSignal): Promise<boolean> {
    return new Promise((resolve) => {
      let set = this.listeners.get(id); if (!set) this.listeners.set(id, (set = new Set()));
      let done = false;
      const finish = (f: FrameInfo | null, ok: boolean, run = true) => {
        if (done) return; done = true; clearTimeout(timer); set!.delete(listener); signal?.removeEventListener('abort', abort);
        if (run) fn(f);
        resolve(ok);
      };
      const listener: FrameListener = (f) => { if (pred(f)) { finish(f, true); return true; } };
      const timer = setTimeout(() => finish(null, false), timeoutMs);
      const abort = () => finish(null, false, false);
      signal?.addEventListener('abort', abort);
      set.add(listener);
    });
  }

  /** Start fetching a clip so it can play without waiting (used for "the next scene" only). */
  preload(id: string) {
    const v = this.video(id);
    if (!v.getAttribute('src')) { v.preload = 'auto'; v.src = this.clips[id].src; v.load(); }
    else if (v.preload !== 'auto') v.preload = 'auto';
  }

  hasFailed(id: string) { return this.failed.has(id); }

  /** Wait until the clip can play through its first frames, or fails, or times out. */
  ready(id: string, timeoutMs = 8000): Promise<boolean> {
    const v = this.video(id); this.preload(id);
    if (this.failed.has(id) || v.error) return Promise.resolve(false);   // failed while preloading
    if (v.readyState >= 3) return Promise.resolve(true);
    return new Promise((ok) => {
      const done = (r: boolean) => { clearTimeout(t); v.removeEventListener('canplay', yes); v.removeEventListener('error', no); ok(r); };
      const yes = () => done(true), no = () => done(false);
      const t = setTimeout(() => done(v.readyState >= 2), timeoutMs);
      v.addEventListener('canplay', yes); v.addEventListener('error', no);
    });
  }

  /**
   * Park a clip, paused, on source frame `frame` and resolve once that frame has actually been presented
   * (decoded and handed to the compositor). The element must be in the DOM (it may be covered).
   */
  async park(id: string, frame: number, signal?: AbortSignal, timeoutMs = 4000): Promise<boolean> {
    const v = this.video(id); this.preload(id);
    const fps = this.clips[id].fps, t = (frame + 0.5) / fps;
    if (!(await this.ready(id, timeoutMs))) return false;
    if (signal?.aborted) return false;
    if (!v.paused) v.pause();
    const near = (f: FrameInfo) => Math.abs(f.mediaTime - frame / fps) < 0.75 / fps;
    const last = this.lastFrame(id);
    if (last && near(last) && Math.abs(v.currentTime - t) < 0.5 / fps) return true;
    const shown = this.whenFrame(id, near, () => {}, hasFrameCallback ? 700 : 400, signal);
    v.currentTime = t;
    if (await shown) return true;
    if (signal?.aborted) return false;
    // No new frame was reported: either the API is missing, or the seek landed on the frame already decoded
    // (no new presentation), or the element is fully covered. A decoded current frame at the right time is
    // what matters: seeked + HAVE_CURRENT_DATA, then two display frames for it to reach the compositor.
    if (v.seeking) await new Promise((r) => v.addEventListener('seeked', r, { once: true }));
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    this.unconfirmedParks++;
    return !signal?.aborted && v.readyState >= 2 && Math.abs(v.currentTime - t) < 0.5 / fps;
  }

  async play(id: string, from?: number): Promise<PlayResult> {
    const v = this.video(id); this.preload(id);
    if (this.failed.has(id)) return 'error';
    try {
      if (from != null && Math.abs(v.currentTime - from) > 0.01) v.currentTime = from;
      await v.play();
      return 'playing';
    } catch (e) {
      if (this.failed.has(id) || v.error) return 'error';
      return (e as DOMException)?.name === 'NotAllowedError' ? 'blocked' : 'error';
    }
  }

  /**
   * Resolve when playback reaches `t` seconds (or the end), checked every display frame.
   * Rejects with 'stalled' if no progress is made for `stallMs` while playing, so the caller can recover.
   */
  until(id: string, t: number, signal: AbortSignal, stallMs = 6000): Promise<void> {
    const v = this.video(id);
    return new Promise((ok, bad) => {
      let last = v.currentTime, lastProgress = performance.now(), raf = 0;
      const stop = () => { cancelAnimationFrame(raf); v.removeEventListener('ended', end); signal.removeEventListener('abort', abort); };
      const end = () => { stop(); ok(); };
      const abort = () => { stop(); bad(new DOMException('aborted', 'AbortError')); };
      if (signal.aborted) { abort(); return; }
      const tick = () => {
        if (v.currentTime >= t - 1e-3 || v.ended) { stop(); ok(); return; }
        const now = performance.now();
        if (v.currentTime !== last) { last = v.currentTime; lastProgress = now; }
        else if (!v.paused && now - lastProgress > stallMs) { stop(); bad(new Error('stalled')); return; }
        else if (v.paused && !document.hidden) lastProgress = now;   // paused deliberately: not a stall
        if (v.error) { stop(); bad(new Error('error')); return; }
        raf = requestAnimationFrame(tick);
      };
      v.addEventListener('ended', end); signal.addEventListener('abort', abort);
      tick();
    });
  }

  pause(id: string) { this.videos.get(id)?.pause(); }
  pauseAll() { this.videos.forEach((v) => v.pause()); }

  /** Free the decoder and buffered data for a clip that is no longer on screen. */
  release(id: string) {
    const v = this.videos.get(id); if (!v) return;
    this.videos.delete(id); this.failed.delete(id); this.frames.delete(id); this.listeners.delete(id);
    v.pause(); v.removeAttribute('src'); v.preload = 'none'; v.load(); v.remove();
  }

  /** Release every clip except those listed (no orphaned decoders or playback after a navigation). */
  releaseExcept(keep: string[]) { for (const id of [...this.videos.keys()]) if (!keep.includes(id)) this.release(id); }

  setMuted(m: boolean) { this.muted = m; this.videos.forEach((v) => { v.muted = m; }); }
  playing(): string[] { const out: string[] = []; for (const [id, v] of this.videos) if (!v.paused && !v.ended) out.push(id); return out; }
}
