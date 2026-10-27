// One clip on screen: the plate (the full source frame under cover framing), holding the clip's video
// while it plays and the identical decoded still when it holds, plus anything anchored to the picture.
import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { motion } from 'motion/react';
import type { Director, LayerState } from '../engine/Director';
import type { Plate } from '../engine/cover';
import { clips, type ClipId } from '../media/scenes';

interface Props {
  id: ClipId; director: Director; state: LayerState; plate: Plate; z: number;
  /** Lean in towards a point of the picture (a destination being opened). */
  lean?: { x: number; y: number } | null; reduced?: boolean; panning?: boolean; children?: ReactNode;
}

export function Layer({ id, director, state, plate, z, lean = null, reduced = false, panning = false, children }: Props) {
  const mount = useRef<HTMLDivElement>(null);
  const m = director.motion[id];
  // the director shows/hides layers directly inside frame callbacks (frame-accurate edits)
  const register = useCallback((el: HTMLDivElement | null) => director.registerLayer(id, el), [director, id]);
  const clip = clips[id];

  useEffect(() => {
    const el = mount.current;
    if (state.mode !== 'video' || !el) return;
    const v = director.media.video(id);
    v.className = 'plate-media';
    el.appendChild(v);
    return () => { if (v.parentNode === el) el.removeChild(v); };
  }, [state.mode, id, director]);

  if (state.mode === 'hidden') return null;
  return (
    <motion.div className="layer" data-layer={id} ref={register} style={{ opacity: m.opacity, zIndex: z }} aria-hidden={children ? undefined : true}>
      <div className={`plate${panning ? ' is-panning' : ''}`} style={{ width: plate.width, height: plate.height, transform: `translate3d(${plate.left}px, ${plate.top}px, 0)` }}>
        <motion.div className="plate-lean" initial={false}
          style={{ originX: (lean?.x ?? clip.width / 2) / clip.width, originY: (lean?.y ?? clip.height / 2) / clip.height }}
          animate={{ scale: lean && !reduced ? 1.035 : 1 }} transition={{ duration: 1.2, ease: [0.2, 0, 0, 1] }}>
          <motion.div className="plate-inner" style={{ scale: m.scale, originX: m.ox, originY: m.oy }}>
            <img className="plate-media" src={state.still === 'last' ? clip.stills.last : clip.stills.first} alt="" decoding="async" draggable={false} />
            <div ref={mount} className="plate-video" />
            {children}
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  );
}
