// Persistent chrome: kept to the frame's edges, text-only, quiet until needed.
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { destinations, type DestinationId } from '../content/destinations';
import type { Phase } from '../engine/Director';

interface Props {
  phase: Phase;
  sound: boolean;
  hasAudio: boolean;
  loading: boolean;
  onSound: () => void;
  onSkip: () => void;
  onBack: () => void;
  onReplay: () => void;
  onRoom: (id: DestinationId) => void;
}

export function Controls({ phase, sound, hasAudio, loading, onSound, onSkip, onBack, onReplay, onRoom }: Props) {
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const cinematic = phase === 'gateway' || phase === 'courtyard' || phase === 'replay';
  const inside = phase === 'arrived';

  useEffect(() => {
    if (!menu) return;
    const close = (e: PointerEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenu(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setMenu(false); } };
    addEventListener('pointerdown', close); addEventListener('keydown', esc, true);
    return () => { removeEventListener('pointerdown', close); removeEventListener('keydown', esc, true); };
  }, [menu]);

  return (
    <>
      <header className="chrome chrome-top">
        <span className="wordmark" aria-hidden={phase === 'home' || phase === 'intro'}>{phase === 'home' || phase === 'intro' || phase === 'boot' ? '' : 'The Unfinished Empire'}</span>
        <nav className="chrome-actions" aria-label="Site">
          <div className="menu" ref={menuRef}>
            <button type="button" className="chrome-btn" aria-expanded={menu} aria-controls="rooms-menu" onClick={() => setMenu((m) => !m)}>Rooms</button>
            <AnimatePresence>
              {menu && (
                <motion.ul id="rooms-menu" className="menu-list" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
                  {destinations.map((d, i) => (
                    <li key={d.id}>
                      <button type="button" autoFocus={i === 0} onClick={() => { setMenu(false); onRoom(d.id); }}>
                        <span className="menu-name">{d.name}</span><span className="menu-theme">{d.theme}</span>
                      </button>
                    </li>
                  ))}
                </motion.ul>
              )}
            </AnimatePresence>
          </div>
          <button type="button" className="chrome-btn" role="switch" aria-checked={sound} onClick={onSound}
            title={hasAudio ? undefined : 'The current films have no soundtrack yet'}>
            Sound <span className="state">{sound ? 'on' : 'off'}</span>
          </button>
        </nav>
      </header>

      <footer className="chrome chrome-bottom">
        <div className="chrome-left">
          {inside && <button type="button" className="chrome-btn" onClick={onBack} aria-label="Back to exterior">← <span className="wide-only">Back to </span>exterior</button>}
        </div>
        <div className="chrome-right">
          {cinematic && <button type="button" className="chrome-btn" onClick={onSkip} aria-label="Skip cinematic">Skip<span className="wide-only"> cinematic</span> <kbd>Esc</kbd></button>}
          {inside && <button type="button" className="chrome-btn" onClick={onReplay} aria-label="Replay the entrance">Replay<span className="wide-only"> the entrance</span></button>}
        </div>
      </footer>
      <div className={`loading-rule${loading ? ' is-loading' : ''}`} aria-hidden="true" />
    </>
  );
}
