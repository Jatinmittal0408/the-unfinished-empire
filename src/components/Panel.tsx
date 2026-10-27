// A destination's content: set into the edge of the frame on a soft graded shadow rather than in a card,
// so the courtyard stays visible. Bottom sheet on narrow screens.
import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { destinationById, type DestinationId } from '../content/destinations';

interface Props { id: DestinationId | null; reduced: boolean; onClose: () => void }

export function Panel({ id, reduced, onClose }: Props) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (id) heading.current?.focus({ preventScroll: true }); }, [id]);
  const d = id ? destinationById[id] : null;
  const t = reduced ? { duration: 0.15 } : { duration: 0.6, ease: [0.2, 0, 0, 1] as const };
  return (
    <AnimatePresence>
      {d && (
        <motion.aside
          key={d.id}
          id="destination-panel"
          className="panel"
          role="dialog"
          aria-modal="false"
          aria-labelledby="panel-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: reduced ? 0.1 : 0.35 } }}
          transition={t}
        >
          <motion.div className="panel-body" initial={reduced ? false : { y: 14 }} animate={{ y: 0 }} transition={{ ...t, delay: reduced ? 0 : 0.08 }}>
            <p className="panel-theme">{d.theme}</p>
            <h2 id="panel-title" className="panel-title" tabIndex={-1} ref={heading}>{d.name}</h2>
            {d.body.map((p, i) => <p key={i} className="panel-text">{p}</p>)}
            <p className="panel-status">{d.status}</p>
            <button type="button" className="text-action" onClick={onClose}>Return to courtyard</button>
          </motion.div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
