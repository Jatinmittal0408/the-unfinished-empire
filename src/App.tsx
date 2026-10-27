import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { Director, type DirectorView } from './engine/Director';
import { coverPlate, panToward } from './engine/cover';
import { parseRoute, pushRoute, replaceRoute } from './engine/route';
import { clips, scenes, type ClipId } from './media/scenes';
import { destinationById, destinations, type DestinationId } from './content/destinations';
import { Layer } from './components/Layer';
import { Hotspots } from './components/Hotspots';
import { Panel } from './components/Panel';
import { Title } from './components/Title';
import { Controls } from './components/Controls';

const reducedQuery = matchMedia('(prefers-reduced-motion: reduce)');
const SOUND_KEY = 'ue.sound';
const readSound = () => { try { return localStorage.getItem(SOUND_KEY) === '1'; } catch { return false; } };
const hasAudio = Object.values(clips).some((c) => c.audio);
const byX = [...destinations].sort((a, b) => a.anchor.x - b.anchor.x);

function useViewport() {
  const [vp, setVp] = useState({ w: innerWidth, h: innerHeight });
  useEffect(() => {
    const on = () => setVp({ w: innerWidth, h: innerHeight });
    addEventListener('resize', on); visualViewport?.addEventListener('resize', on);
    return () => { removeEventListener('resize', on); visualViewport?.removeEventListener('resize', on); };
  }, []);
  return vp;
}

export function App() {
  const director = useMemo(() => new Director(), []);
  const [view, setView] = useState<DirectorView>(director.state);
  const [reduced, setReduced] = useState(reducedQuery.matches);
  const [room, setRoom] = useState<DestinationId | null>(null);
  const [sound, setSound] = useState(readSound);
  const [pan, setPan] = useState(0);
  const [dragging, setDragging] = useState(false);
  const vp = useViewport();
  const hotspotsRef = useRef<HTMLDivElement>(null);
  const pushedRoom = useRef(false);

  useEffect(() => director.subscribe(setView), [director]);
  useEffect(() => { director.setMuted(!sound); try { localStorage.setItem(SOUND_KEY, sound ? '1' : '0'); } catch { /* ignore */ } }, [sound, director]);
  useEffect(() => {
    director.reducedMotion = reduced;
    const on = () => { director.reducedMotion = reducedQuery.matches; setReduced(reducedQuery.matches); };
    reducedQuery.addEventListener('change', on); return () => reducedQuery.removeEventListener('change', on);
  }, [director, reduced]);
  useEffect(() => {
    const on = () => director.visibility(document.hidden);
    document.addEventListener('visibilitychange', on); return () => document.removeEventListener('visibilitychange', on);
  }, [director]);

  // ── framing ──
  const plates = useMemo(() => Object.fromEntries((Object.keys(scenes) as ClipId[]).map((id) =>
    [id, coverPlate(vp.w, vp.h, clips[id], scenes[id].content, (vp.w < vp.h && scenes[id].focalPortrait) || scenes[id].focal, id === 'courtyard' ? pan : 0)])) as Record<ClipId, ReturnType<typeof coverPlate>>, [vp, pan]);
  const court = plates.courtyard;
  const canPan = court.panMax - court.panMin > 8;
  useEffect(() => { setPan((p) => Math.min(court.panMax, Math.max(court.panMin, p))); }, [court.panMin, court.panMax]);
  const bringIntoView = useCallback((id: DestinationId) => {
    if (canPan) setPan((p) => panToward(vp.w, court, destinationById[id].anchor, p));
  }, [canPan, vp.w, court]);

  // ── navigation ──
  const openRoom = useCallback((id: DestinationId, push = true) => {
    if (director.state.phase !== 'arrived') director.arrive(0.7);   // cancels any film under way
    if (push) { pushRoute({ scene: 'courtyard', room: id }); pushedRoom.current = true; }
    setRoom(id); bringIntoView(id);
  }, [director, bringIntoView]);
  const closeRoom = useCallback(() => {
    const id = room;
    if (pushedRoom.current) { pushedRoom.current = false; history.back(); }
    else { replaceRoute({ scene: 'courtyard', room: null }); setRoom(null); }
    if (id) requestAnimationFrame(() => hotspotsRef.current?.querySelector<HTMLElement>(`[data-dest="${id}"]`)?.focus({ preventScroll: true }));
  }, [room]);
  const enter = useCallback(() => {
    if (director.journeying) return;                       // double clicks: the entrance is already under way
    pushRoute({ scene: 'courtyard', room: null });
    director.enter();                                      // seen policy and reduced motion live in the director
  }, [director]);
  const skip = useCallback(() => director.arrive(0.7), [director]);
  const back = useCallback(() => { setRoom(null); pushedRoom.current = false; pushRoute({ scene: 'home' }); director.home(0.9); }, [director]);
  const replayEntrance = useCallback(() => { setRoom(null); pushedRoom.current = false; director.replay(); }, [director]);
  const replayFilm = useCallback(() => director.intro(), [director]);

  // boot from the URL; afterwards follow Back/Forward without ever starting a film
  useEffect(() => {
    const r = parseRoute();
    replaceRoute(r);
    if (r.scene === 'home') director.intro();
    else { director.arrive(0); if (r.room) openRoom(r.room, false); }
    const onPop = () => {
      const p = parseRoute();
      pushedRoom.current = false;
      if (p.scene === 'home') { setRoom(null); if (director.state.phase !== 'home' && director.state.phase !== 'intro') director.home(0.9); return; }
      if (director.journeying && !p.room) return;        // Forward into the journey already under way
      if (director.state.phase !== 'arrived' || director.journeying) director.arrive(0.7);
      setRoom(p.room); if (p.room) bringIntoView(p.room);
    };
    addEventListener('popstate', onPop);
    return () => removeEventListener('popstate', onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [director]);

  // ── keyboard ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const phase = director.state.phase;
      if (e.key === 'Escape') {
        if (room) { e.preventDefault(); closeRoom(); }
        else if (director.journeying) { e.preventDefault(); skip(); }   // any entry or replay phase
        return;
      }
      if ((e.target as HTMLElement)?.closest?.('input, textarea')) return;
      if (e.key === 'm' || e.key === 'M') { setSound((s) => !s); return; }
      if (/^[1-5]$/.test(e.key)) { openRoom(destinations[+e.key - 1].id); return; }
      if (phase === 'arrived' && !room && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault();
        const current = (document.activeElement as HTMLElement)?.dataset?.dest;
        const i = byX.findIndex((d) => d.id === current);
        const next = i < 0 ? (e.key === 'ArrowRight' ? 0 : byX.length - 1) : Math.max(0, Math.min(byX.length - 1, i + (e.key === 'ArrowRight' ? 1 : -1)));
        hotspotsRef.current?.querySelector<HTMLElement>(`[data-dest="${byX[next].id}"]`)?.focus({ preventScroll: true });
      }
    };
    addEventListener('keydown', onKey); return () => removeEventListener('keydown', onKey);
  }, [director, room, closeRoom, skip, openRoom]);

  // ── touch / mouse panning (only when the viewport crops the courtyard) ──
  const drag = useRef<{ x: number; pan: number; moved: boolean; id: number } | null>(null);
  const onPointerDown = (e: RPointerEvent) => {
    if (!canPan || view.phase !== 'arrived' || e.button !== 0) return;
    drag.current = { x: e.clientX, pan, moved: false, id: e.pointerId };
  };
  const onPointerMove = (e: RPointerEvent) => {
    const d = drag.current; if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x;
    if (!d.moved && Math.abs(dx) > 6) { d.moved = true; setDragging(true); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); }
    if (d.moved) setPan(Math.min(court.panMax, Math.max(court.panMin, d.pan + dx)));
  };
  const onPointerUp = (e: RPointerEvent) => {
    const d = drag.current; drag.current = null; setDragging(false);
    if (d?.moved) { e.preventDefault(); const stop = (ev: Event) => { ev.stopPropagation(); ev.preventDefault(); }; addEventListener('click', stop, { capture: true, once: true }); setTimeout(() => removeEventListener('click', stop, { capture: true }), 0); }
  };

  // rooms that the current crop leaves off-screen, nearest first, for the edge hints
  const offscreen = useMemo(() => {
    if (!canPan || view.phase !== 'arrived') return { left: null, right: null };
    const sx = (id: DestinationId) => court.left + destinationById[id].anchor.x * court.scale;
    const left = byX.filter((d) => sx(d.id) < 24).pop() ?? null;
    const right = byX.find((d) => sx(d.id) > vp.w - 24) ?? null;
    return { left, right };
  }, [canPan, view.phase, court, vp.w]);

  // read-only, live state for the Chromium validation and diagnostic scripts (a getter, so it is never stale)
  const ui = useRef({ room, pan, canPan, plate: court });
  ui.current = { room, pan, canPan, plate: court };
  useEffect(() => {
    Object.defineProperty(window, '__ue', { configurable: true, get: () => {
      const v = director.state;
      return { phase: v.phase, layers: v.layers, order: v.order, notice: v.notice, ...ui.current,
        playing: director.media.playing().join('+') || null, sequence: director.activeSequence, journeying: director.journeying,
        stats: director.stats, unconfirmedParks: director.media.unconfirmedParks };
    } });
  }, [director]);

  const phase = view.phase;
  const titleVisible = phase === 'intro' || phase === 'home';
  const lean = room ? destinationById[room].anchor : null;
  const panelSide = room && destinationById[room].anchor.x > clips.courtyard.width / 2 ? 'left' : 'right';
  const notice = view.notice === 'media-failed' ? 'A film could not be played, so you have been taken to the still view.' : null;

  return (
    <div className={`app phase-${phase}${reduced ? ' reduced' : ''}${room ? ` has-room panel-${panelSide}` : ''}`}>
      <main className="stage" aria-label={phase === 'arrived' ? 'The courtyard, inside the palace' : 'The Unfinished Empire'}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
        {view.order.map((id, z) => (
          <Layer key={id} id={id} director={director} state={view.layers[id]} plate={plates[id]} z={z + 1}
            lean={id === 'courtyard' ? lean : null} reduced={reduced} panning={dragging || !canPan}>
            {id === 'courtyard' && (
              <Hotspots ref={hotspotsRef} visible={phase === 'arrived' && view.layers.courtyard.still === 'last'} active={room} reduced={reduced}
                onOpen={(d) => (room === d ? closeRoom() : openRoom(d))} onFocusMarker={bringIntoView} />
            )}
          </Layer>
        ))}
        <div className="grade" aria-hidden="true" />
        {offscreen.left && <button type="button" className="edge-hint edge-left" onClick={() => bringIntoView(offscreen.left!.id)}>‹ {offscreen.left.name}</button>}
        {offscreen.right && <button type="button" className="edge-hint edge-right" onClick={() => bringIntoView(offscreen.right!.id)}>{offscreen.right.name} ›</button>}
      </main>

      <Title visible={titleVisible} reduced={reduced} delay={phase === 'intro' ? 1.2 : 0} onEnter={enter}
        onReplay={phase === 'home' && !reduced ? replayFilm : null}
        replayLabel={view.notice === 'autoplay-blocked' ? 'Play the film' : 'Replay the film'} />
      <Controls phase={phase} sound={sound} hasAudio={hasAudio} loading={view.loading} onSound={() => setSound((s) => !s)}
        onSkip={skip} onBack={back} onReplay={replayEntrance} onRoom={(id) => openRoom(id)} />
      <Panel id={room} reduced={reduced} onClose={closeRoom} />
      <p className="status" role="status" aria-live="polite">{notice ?? ''}</p>
    </div>
  );
}
