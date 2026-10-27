// Homepage typography, set low over the dark cliff so the palace stays clear.
import { AnimatePresence, motion } from 'motion/react';

interface Props { visible: boolean; reduced: boolean; delay: number; onEnter: () => void; onReplay: (() => void) | null; replayLabel?: string }

export function Title({ visible, reduced, delay, onEnter, onReplay, replayLabel = 'Replay the film' }: Props) {
  const ease = [0.2, 0, 0, 1] as const;
  const t = (d: number) => (reduced ? { duration: 0.2 } : { duration: 1.4, delay: delay + d, ease });
  return (
    <AnimatePresence>
      {visible && (
        <motion.section className="title" aria-labelledby="site-title" exit={{ opacity: 0, transition: { duration: reduced ? 0.15 : 0.5 } }}>
          <motion.h1 id="site-title" initial={{ opacity: 0, y: reduced ? 0 : 10 }} animate={{ opacity: 1, y: 0 }} transition={t(0)}>
            The Unfinished Empire
          </motion.h1>
          <motion.p className="tagline" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={t(0.5)}>
            Not inherited. Still becoming.
          </motion.p>
          {/* The way in is there from the first moment, ahead of the type. */}
          <motion.div className="title-actions" initial={{ opacity: reduced ? 1 : 0 }} animate={{ opacity: 1 }} transition={reduced ? { duration: 0 } : { duration: 0.8, delay: 0.2, ease }}>
            <button type="button" className="enter" onClick={onEnter}>
              Enter the Empire<span aria-hidden="true" className="enter-rule" />
            </button>
            {onReplay && <button type="button" className="text-action subtle" onClick={onReplay}>{replayLabel}</button>}
          </motion.div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
