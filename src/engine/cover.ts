// "Cover" framing done explicitly (rather than with CSS object-fit) so that video, held still and hotspots
// share one coordinate system: the plate is the whole 1920×1080 source frame, scaled and positioned so that
// its picture area covers the viewport, the focal point is as central as the crop allows, and any pan
// offset stays inside the picture.
import type { Point, Rect } from '../media/scenes';

export interface Plate { scale: number; left: number; top: number; width: number; height: number;
  /** How far the plate can be panned horizontally from its focal position (px), each way. */
  panMin: number; panMax: number }

export function coverPlate(vw: number, vh: number, src: { width: number; height: number }, content: Rect, focal: Point, panX = 0): Plate {
  const cw = content.x1 - content.x0, ch = content.y1 - content.y0;
  const scale = Math.max(vw / cw, vh / ch);
  const clampX = (l: number) => Math.min(-content.x0 * scale, Math.max(vw - content.x1 * scale, l));
  const clampY = (t: number) => Math.min(-content.y0 * scale, Math.max(vh - content.y1 * scale, t));
  const base = clampX(vw / 2 - focal.x * scale);
  const left = clampX(base + panX);
  const top = clampY(vh / 2 - focal.y * scale);
  return { scale, left, top, width: src.width * scale, height: src.height * scale,
    panMin: vw - content.x1 * scale - base, panMax: -content.x0 * scale - base };
}

/** Pan offset that brings source point `p` to the horizontal centre of the viewport (before clamping). */
export const panToward = (vw: number, plate: Plate, p: Point, currentPan: number) =>
  Math.min(plate.panMax, Math.max(plate.panMin, currentPan + (vw / 2 - (plate.left + p.x * plate.scale))));
