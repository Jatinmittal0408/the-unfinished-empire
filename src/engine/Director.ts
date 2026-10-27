// The director runs the cinematic sequences: which clip plays on which layer, the edits between clips, holds,
// skips and fallbacks.
//
// Playback rules (V1.1):
//  - At most one moving video is ever visible. An incoming clip is parked, paused on a decoded frame, *under* the
//    outgoing layer; it is started while still covered and exposed in the frame callback of its first advancing
//    frame, in the same rendering update in which the outgoing layer is hidden (cut) or frozen (dissolve /
//    threshold, which then clear a true still, never a zoomed one).
//  - Every command runs as a cancellable Seq. A new command cancels the running one; every await inside a
//    sequence rejects as soon as it is cancelled (nothing is left pending), animations are stopped, and the
//    clips the new scene does not use are released, so no orphaned playback survives a navigation.
//  - Entrance-seen policy: the entrance counts as seen as soon as Enter starts it. Later Enters in the session
//    cross-fade straight in; only "Replay the entrance" plays it again.
import { animate, motionValue, type MotionValue } from 'motion';
import { clips, joins, scenes, type ClipId, type Join } from '../media/scenes';
import { SceneManager, hasFrameCallback } from './SceneManager';
import { HeldFrame } from './threshold';

export type Phase = 'boot' | 'intro' | 'home' | 'replay' | 'gateway' | 'courtyard' | 'arrived';
export type LayerMode = 'hidden' | 'video' | 'still';

export interface LayerState { mode: LayerMode; still: 'first' | 'last' }
export interface DirectorView {
  phase: Phase;
  layers: Record<ClipId, LayerState>;
  order: ClipId[];               // back to front
  loading: boolean;              // waiting on media longer than a moment
  notice: string | null;         // polite status (autoplay blocked, load failure)
}

export interface LayerMotion { opacity: MotionValue<number>; scale: MotionValue<number>; ox: MotionValue<number>; oy: MotionValue<number> }

const IDS: ClipId[] = ['exterior', 'gateway', 'courtyard'];
const decode = (src: string) => { const im = new Image(); im.src = src; return im.decode().catch(() => undefined); };
/** Exponential approach to rest, normalised to [0,1] over the animation; initial slope k/(1-e^-k). */
const settle = (k: number) => (t: number) => (1 - Math.exp(-k * t)) / (1 - Math.exp(-k));
const SETTLE_K = 4, SETTLE_T = 1.6;

class Cancelled extends Error { constructor() { super('cancelled'); this.name = 'AbortError'; } }

/** One cancellable sequence. `step` wraps every await so cancellation settles the sequence immediately. */
class Seq {
  private ctrl = new AbortController();
  private cleanups: (() => void)[] = [];
  constructor(readonly name: string) {}
  get signal() { return this.ctrl.signal; }
  get aborted() { return this.ctrl.signal.aborted; }
  step<T>(p: PromiseLike<T>): Promise<T> {
    if (this.aborted) return Promise.reject(new Cancelled());
    return new Promise<T>((ok, bad) => {
      const onAbort = () => bad(new Cancelled());
      this.signal.addEventListener('abort', onAbort, { once: true });
      Promise.resolve(p).then(
        (v) => { this.signal.removeEventListener('abort', onAbort); if (this.aborted) bad(new Cancelled()); else ok(v); },
        (e) => { this.signal.removeEventListener('abort', onAbort); bad(this.aborted ? new Cancelled() : e); });
    });
  }
  anim(c: { stop: () => void; finished: Promise<unknown> }) { this.cleanups.push(() => c.stop()); return this.step(c.finished); }
  sleep(ms: number) { return this.step(new Promise<void>((r) => { const t = setTimeout(r, ms); this.cleanups.push(() => clearTimeout(t)); })); }
  onCancel(fn: () => void) { this.cleanups.push(fn); }
  cancel() { if (this.aborted) return; this.ctrl.abort(); for (const f of this.cleanups.splice(0)) { try { f(); } catch { /* ignore */ } } }
}

export interface EditRecord { join: string; style: string; trigger: 'incoming-frame' | 'outgoing-backstop' | 'timeout'; at: number; playAt: number; outgoingAtPlay: number | null; incomingMediaTime: number | null; outgoingMediaTime: number | null; frameConfirmed: boolean }

export class Director {
  readonly media = new SceneManager(clips);
  readonly motion: Record<ClipId, LayerMotion>;
  private view: DirectorView;
  private seq: Seq | null = null;
  private bg: Seq | null = null;
  private listeners = new Set<(v: DirectorView) => void>();
  private layerEls: Partial<Record<ClipId, HTMLElement>> = {};
  private visible: Record<ClipId, boolean> = { exterior: true, gateway: true, courtyard: true };
  reducedMotion = false;
  /** Diagnostics: sequences started/settled, and the edits as performed. */
  readonly stats = { started: 0, settled: 0, edits: [] as EditRecord[] };

  constructor() {
    this.motion = Object.fromEntries(IDS.map((id) => [id, { opacity: motionValue(0), scale: motionValue(1), ox: motionValue(0.5), oy: motionValue(0.5) }])) as Record<ClipId, LayerMotion>;
    this.view = { phase: 'boot', layers: { exterior: { mode: 'hidden', still: 'first' }, gateway: { mode: 'hidden', still: 'first' }, courtyard: { mode: 'hidden', still: 'last' } }, order: [...IDS], loading: false, notice: null };
  }

  subscribe(fn: (v: DirectorView) => void) { this.listeners.add(fn); fn(this.view); return () => { this.listeners.delete(fn); }; }
  get state() { return this.view; }
  /** A sequence that leads into the palace (Enter or Replay) is under way. */
  get journeying() { return !!this.seq && (this.seq.name === 'enter' || this.seq.name === 'replay'); }
  get cinematic() { return this.journeying || this.view.phase === 'intro'; }
  get activeSequence() { return this.seq?.name ?? null; }

  /** Layers hand over their root element so edits can show/hide them inside a frame callback. */
  registerLayer(id: ClipId, el: HTMLElement | null) {
    if (el) { this.layerEls[id] = el; el.style.visibility = this.visible[id] ? '' : 'hidden'; }
    else if (this.layerEls[id]) delete this.layerEls[id];
  }
  private setVisible(id: ClipId, v: boolean) { this.visible[id] = v; const el = this.layerEls[id]; if (el) el.style.visibility = v ? '' : 'hidden'; }

  private set(patch: Partial<DirectorView>) { this.view = { ...this.view, ...patch }; this.listeners.forEach((f) => f(this.view)); }
  private layer(id: ClipId, s: Partial<LayerState>) { this.set({ layers: { ...this.view.layers, [id]: { ...this.view.layers[id], ...s } } }); }
  private toFront(id: ClipId) { this.set({ order: [...this.view.order.filter((x) => x !== id), id] }); }
  private below(id: ClipId, above: ClipId) { const o = this.view.order.filter((x) => x !== id); o.splice(o.indexOf(above), 0, id); this.set({ order: o }); }
  private origin(id: ClipId, p: { x: number; y: number }) { this.motion[id].ox.set(p.x / clips[id].width); this.motion[id].oy.set(p.y / clips[id].height); }
  private reset(id: ClipId) { const m = this.motion[id]; m.scale.stop(); m.opacity.stop(); m.scale.set(1); }
  /** Take a layer off screen at once (visibility first, so it can never flash its poster while unmounting). */
  private hide(id: ClipId) {
    this.setVisible(id, false); this.reset(id); this.motion[id].opacity.set(0); this.media.release(id);
    if (this.view.layers[id].mode !== 'hidden') this.layer(id, { mode: 'hidden' });
  }

  /** Start a command: cancel the running sequence and any background preparation. */
  private begin(name: string) {
    this.seq?.cancel(); this.bg?.cancel(); this.bg = null;
    const s = new Seq(name); this.seq = s; this.stats.started++;
    this.set({ loading: false });
    return s;
  }
  private async run(s: Seq, body: () => Promise<void>, fallback: () => Promise<void> | void) {
    try { await body(); }
    catch (e) {
      if (!(e instanceof Cancelled) && !s.aborted) { console.warn('[director]', e); await fallback(); }
    } finally {
      this.stats.settled++;
      if (this.seq === s) this.seq = null;
    }
  }

  /** Wait until a clip's <video> is in the DOM (its layer has rendered). */
  private mounted(id: ClipId, s: Seq) {
    return s.step(new Promise<boolean>((ok) => {
      const t0 = performance.now();
      const check = () => { if (s.aborted) return ok(false); if (this.media.video(id).isConnected) return ok(true); if (performance.now() - t0 > 2000) return ok(false); requestAnimationFrame(check); };
      check();
    }));
  }

  /**
   * Put a clip under `above`, paused on `frame`, and resolve once that frame has been presented. Shows the
   * loading hairline if this takes more than a moment.
   */
  private async prepare(id: ClipId, frame: number, above: ClipId | null, s: Seq) {
    if (this.view.layers[id].mode !== 'video' || !this.media.has(id)) {
      this.reset(id); this.motion[id].opacity.set(1); this.setVisible(id, true);
      this.layer(id, { mode: 'video', still: 'first' });
    }
    if (above) this.below(id, above);
    const t = setTimeout(() => { if (this.seq === s) this.set({ loading: true }); }, 350);
    try {
      if (!(await this.mounted(id, s))) return false;
      return await s.step(this.media.park(id, frame, s.signal));
    } finally { clearTimeout(t); if (this.seq === s) this.set({ loading: false }); }
  }

  /** Background preparation of the gateway (for a first Enter or a Replay), cancelled by any command. */
  private warmGateway(above: ClipId) {
    if (this.reducedMotion) return;
    this.bg?.cancel();
    const b = (this.bg = new Seq('warm'));
    this.prepare('gateway', joins.exteriorToGateway.parkFrame, above, b).catch(() => {});
  }

  /** The held-frame canvas for dissolve/threshold edits, created and compiled at idle, reused for each join. */
  private held: HeldFrame | null = null;
  private prewarm() {
    if (this.held || this.reducedMotion || !Object.values(joins).some((j) => j.style !== 'cut') || !HeldFrame.supported()) return;
    const make = () => { if (!this.held) this.held = new HeldFrame(clips.exterior.width, clips.exterior.height); };
    if ('requestIdleCallback' in window) requestIdleCallback(make, { timeout: 2000 }); else setTimeout(make, 500);
  }

  /**
   * The edit between two clips. The incoming clip is parked (covered) on join.parkFrame and started; in the
   * frame callback of its first *steady* presented frame the outgoing layer is either hidden (cut) or replaced
   * by a held copy of the frame now on screen (dissolve / threshold), in the same rendering update. Only that
   * static held frame then clears, over the one playing clip: never a zoom, never a second moving video.
   */
  private async edit(s: Seq, out: ClipId, inc: ClipId, j: Join, name: string) {
    const fps = clips[inc].fps;
    const start = j.parkFrame / fps;
    const outVideo = this.view.layers[out].mode === 'video' && this.media.has(out) ? this.media.video(out) : null;
    const wantsHeld = !this.reducedMotion && j.style !== 'cut' && HeldFrame.supported();
    const style = wantsHeld ? j.style : 'cut';
    const inner = this.layerEls[out]?.querySelector('.plate-inner');
    const held = wantsHeld ? (this.held ??= new HeldFrame(clips[out].width, clips[out].height)) : null;
    if (held && inner) inner.appendChild(held.canvas);       // hidden until capture
    s.onCancel(() => held?.release());
    let done = false;
    const doEdit = (f: { mediaTime: number } | null, trigger: EditRecord['trigger']) => {
      if (s.aborted || done) return;
      done = true;
      const outTime = outVideo ? (this.media.lastFrame(out)?.mediaTime ?? outVideo.currentTime) : null;
      outVideo?.pause();
      if (style === 'cut' || !held) this.setVisible(out, false);
      else {
        const src = outVideo ?? (this.layerEls[out]?.querySelector('img.plate-media') as HTMLImageElement | null);
        if (src) {
          held.capture(src, style);
          // the held frame is now the outgoing layer's only picture: hide the video and the still/poster under it,
          // so clearing the held frame reveals the incoming clip, not the layer's own underlay
          inner?.querySelectorAll<HTMLElement>('.plate-media').forEach((el) => { if (el !== held.canvas) el.style.visibility = 'hidden'; });
        }
        else this.setVisible(out, false);
      }
      this.stats.edits.push({ join: name, style, trigger, at: performance.now(), playAt, outgoingAtPlay, incomingMediaTime: f?.mediaTime ?? null, outgoingMediaTime: outTime, frameConfirmed: !!f && hasFrameCallback });
    };
    // exposed only once the incoming clip is moving steadily: two consecutive source frames presented back to
    // back after the parked one. (A clip started under another playing clip takes ≈250 ms to deliver its first
    // frames while its clock runs on, then catches up; exposing it on its first frame would show that jump.)
    let prev: { mediaTime: number } | null = null;
    const steady = (f: { mediaTime: number }) => {
      const ok = !!prev && prev.mediaTime > start + 0.25 / fps && f.mediaTime - prev.mediaTime > 0.5 / fps && f.mediaTime - prev.mediaTime < 1.5 / fps;
      prev = f; return ok;
    };
    const exposed = this.media.whenFrame(inc, steady, (f) => doEdit(f, f ? 'incoming-frame' : 'timeout'), 1200, s.signal);
    // backstop: if the outgoing clip passes its last intended frame first, edit anyway (the incoming clip is
    // playing from a decoded frame), so the outgoing clip can never run out and freeze on screen
    const outFps = clips[out].fps;
    const backstop = outVideo && j.outgoingFrame != null
      ? this.media.whenFrame(out, (f) => f.mediaTime >= (j.outgoingFrame! + 1) / outFps - 1e-3, (f) => { if (f) doEdit(null, 'outgoing-backstop'); }, 2000, s.signal)
      : null;
    const playAt = performance.now();
    const outgoingAtPlay = outVideo ? (this.media.lastFrame(out)?.mediaTime ?? outVideo.currentTime) : null;
    const res = await s.step(this.media.play(inc));
    if (res !== 'playing') throw new Error(`${inc} ${res}`);
    await s.step(backstop ? Promise.race([exposed, backstop]) : exposed);
    if (!done) doEdit(null, 'timeout');
    if (held && style !== 'cut') {
      const d = style === 'dissolve' ? j.dissolve : j.threshold;
      await s.anim(animate(0, 1, { duration: d, ease: style === 'dissolve' ? [0.4, 0, 0.6, 1] : [0.35, 0, 0.65, 1], onUpdate: (p) => held.draw(p) }));
    }
    this.hide(out);
    held?.release();
  }

  /** Hold a clip on its last frame: swap the video for the identical still and ease the camera to rest. */
  private async hold(id: ClipId, s: Seq) {
    await s.step(decode(clips[id].stills.last));
    this.layer(id, { mode: 'still', still: 'last' });
    this.media.release(id);
    if (this.reducedMotion) return;
    const sc = scenes[id];
    this.origin(id, sc.endOrigin);
    const rest = 1 + sc.endZoomPerSecond * SETTLE_T * (1 - Math.exp(-SETTLE_K)) / SETTLE_K;   // keeps the initial velocity
    await s.anim(animate(this.motion[id].scale, rest, { duration: SETTLE_T, ease: settle(SETTLE_K) }));
  }

  /** Show a clip's held last frame directly (no film), fading over whatever is on screen. */
  private async showStill(id: ClipId, s: Seq, fade: number, keep: ClipId[] = []) {
    await s.step(decode(clips[id].stills.last));
    const m = this.motion[id];
    // already the picture on screen (topmost and opaque)? A clip parked under another layer is not.
    const wasOnScreen = this.view.order.at(-1) === id && this.view.layers[id].mode !== 'hidden' && this.visible[id] && m.opacity.get() > 0.999;
    this.reset(id);
    if (fade > 0 && !wasOnScreen) m.opacity.set(0);
    this.layer(id, { mode: 'still', still: 'last' });
    this.toFront(id);
    this.setVisible(id, true);
    if (fade > 0 && !wasOnScreen) await s.anim(animate(m.opacity, 1, { duration: fade, ease: [0.4, 0, 0.2, 1] }));
    else m.opacity.set(1);
    for (const other of IDS) if (other !== id && !keep.includes(other)) this.hide(other);
  }

  // ───────────────────────── commands ─────────────────────────

  /** Homepage: play the exterior once, then hold its final frame as the backdrop. */
  intro() {
    if (this.reducedMotion) return this.home(0);
    const s = this.begin('intro');
    this.set({ notice: null });
    this.prewarm();
    return this.run(s, async () => {
      this.set({ phase: 'intro' });
      const id: ClipId = 'exterior';
      for (const other of IDS) if (other !== id) this.hide(other);
      this.reset(id); this.setVisible(id, true); this.layer(id, { mode: 'video', still: 'first' }); this.toFront(id);
      this.motion[id].opacity.set(1);
      const result = await s.step(this.media.play(id, 0));
      if (result === 'blocked') {      // autoplay refused: the homepage still works, the film is one tap away
        this.set({ notice: 'autoplay-blocked', phase: 'home' }); await this.hold(id, s); this.warmGateway(id); return;
      }
      if (result === 'error') throw new Error('exterior failed');
      // the next scene is fetched and parked only once this one is safely playing
      s.sleep(1500).then(() => { if (!seen()) this.warmGateway(id); }, () => {});
      await s.step(this.media.until(id, clips[id].duration, s.signal));
      await this.hold(id, s);
      this.set({ phase: 'home' });
    }, () => { this.set({ notice: 'media-failed' }); return this.home(0); });
  }

  /** The homepage as a still (Back to exterior, reduced motion, deep links). */
  home(fade = 0.9) {
    const s = this.begin('home');
    this.set({ phase: 'home' });
    this.prewarm();
    return this.run(s, async () => {
      await this.showStill('exterior', s, this.reducedMotion ? Math.min(fade, 0.3) : fade);
      if (!seen()) this.warmGateway('exterior');
    }, () => {});
  }

  /** "Enter the Empire". Ignored while an entrance is already under way (double clicks). */
  enter() {
    if (this.journeying) return Promise.resolve();
    if (seen() || this.reducedMotion) return this.arrive(this.reducedMotion ? 0.4 : 0.9);
    markSeen();
    const s = this.begin('enter');
    this.set({ notice: null, phase: 'gateway' });     // the title starts clearing at once
    return this.run(s, () => this.journey(s), () => { this.set({ notice: 'media-failed' }); return this.arrive(0.8); });
  }

  /** "Replay the entrance": back to the exterior, then the whole entrance, as one cancellable sequence. */
  replay() {
    if (this.reducedMotion) return this.arrive(0.4);
    const s = this.begin('replay');
    this.set({ notice: null, phase: 'replay' });
    return this.run(s, async () => {
      // the gateway is parked under the exterior while the exterior fades back in
      const top = this.view.order.filter((x) => x !== 'gateway').at(-1)!;
      const gw = this.prepare('gateway', joins.exteriorToGateway.parkFrame, top, s);
      await this.showStill('exterior', s, 0.6, ['gateway']);
      if (!(await gw)) throw new Error('gateway not ready');
      this.set({ phase: 'gateway' });
      await this.journey(s);
    }, () => { this.set({ notice: 'media-failed' }); return this.arrive(0.8); });
  }

  private async journey(s: Seq) {
    const J1 = joins.exteriorToGateway, J2 = joins.gatewayToCourtyard;
    const t0 = performance.now();
    if (this.view.layers.exterior.mode === 'hidden') await this.showStill('exterior', s, 0);
    // gateway parked under the exterior (usually done already while the visitor looked at the homepage)
    if (!(await this.prepare('gateway', J1.parkFrame, 'exterior', s))) throw new Error('gateway not ready');
    const wait = J1.leadIn * 1000 - (performance.now() - t0);
    if (wait > 0) await s.sleep(wait);
    await this.edit(s, 'exterior', 'gateway', J1, 'exterior→gateway');

    // courtyard parked under the gateway while the gateway plays; started `preroll` frames before the cut
    const parked = this.prepare('courtyard', J2.parkFrame, 'gateway', s);
    const gfps = clips.gateway.fps;
    const cue = J2.outgoingFrame != null ? (J2.outgoingFrame - J2.preroll + 0.5) / gfps : clips.gateway.duration - 0.5;
    await s.step(this.media.until('gateway', cue, s.signal));
    if (!(await parked)) throw new Error('courtyard not ready');
    await this.edit(s, 'gateway', 'courtyard', J2, 'gateway→courtyard');
    this.set({ phase: 'courtyard' });

    await s.step(this.media.until('courtyard', clips.courtyard.duration, s.signal));
    this.set({ phase: 'arrived' });
    await this.hold('courtyard', s);
  }

  /** Straight to the courtyard's held frame (Skip, rooms, deep links, reduced motion, failures). */
  arrive(fade = 0.7) {
    const s = this.begin('arrive');
    this.set({ phase: 'arrived' });
    this.prewarm();
    markSeen();
    return this.run(s, () => this.showStill('courtyard', s, fade), () => {});
  }

  /** Pause/resume the running film when the page is hidden (a cinematic should not finish unseen). */
  private hiddenPaused: string[] = [];
  visibility(hidden: boolean) {
    if (hidden) { this.hiddenPaused = this.media.playing(); this.hiddenPaused.forEach((id) => this.media.pause(id)); return; }
    for (const id of this.hiddenPaused.splice(0)) {
      if (!this.media.has(id)) continue;
      this.media.video(id).play().catch(() => (this.view.phase === 'intro' ? this.home(0.3) : this.arrive(0.5)));
    }
  }

  setMuted(m: boolean) { this.media.setMuted(m); }
}

const SEEN = 'ue.entered';
export function markSeen() { try { sessionStorage.setItem(SEEN, '1'); } catch { /* storage unavailable */ } }
export function seen() { try { return sessionStorage.getItem(SEEN) === '1'; } catch { return false; } }
