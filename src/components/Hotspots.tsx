// Destination markers, anchored to architecture in the courtyard's final frame. They live inside the
// courtyard plate, so they follow its framing, the settle-to-rest and panning exactly.
import { forwardRef } from 'react';
import { motion } from 'motion/react';
import { destinations, type DestinationId } from '../content/destinations';
import { clips } from '../media/scenes';

interface Props {
  visible: boolean;
  active: DestinationId | null;
  reduced: boolean;
  onOpen: (id: DestinationId) => void;
  onFocusMarker: (id: DestinationId) => void;
}

export const Hotspots = forwardRef<HTMLDivElement, Props>(function Hotspots({ visible, active, reduced, onOpen, onFocusMarker }, ref) {
  const { width, height } = clips.courtyard;
  return (
    <div ref={ref} className="hotspots" role="group" aria-label="Destinations in the courtyard" hidden={!visible}>
      {destinations.map((d, i) => (
        <motion.button
          key={d.id}
          type="button"
          className={`hotspot label-${d.labelSide}${active === d.id ? ' is-active' : ''}`}
          data-dest={d.id}
          style={{ left: `${(d.anchor.x / width) * 100}%`, top: `${(d.anchor.y / height) * 100}%` }}
          initial={false}
          animate={visible ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: reduced ? 0 : 0.7, delay: reduced || !visible ? 0 : 0.5 + i * 0.12, ease: [0.2, 0, 0.2, 1] }}
          aria-label={`${d.name} — ${d.theme}. ${d.feature}.`}
          aria-expanded={active === d.id}
          aria-controls="destination-panel"
          onClick={() => onOpen(d.id)}
          onFocus={() => onFocusMarker(d.id)}
        >
          <span className="hotspot-mark" aria-hidden="true" />
          <span className="hotspot-label" aria-hidden="true">
            <span className="hotspot-name">{d.name}</span>
            <span className="hotspot-theme">{d.theme}</span>
          </span>
        </motion.button>
      ))}
    </div>
  );
});
