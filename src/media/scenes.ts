// Scene configuration: how each approved clip is framed, held and joined to the next.
// All positions are in source pixels of the 1920×1080 frame, measured on the actual footage
// (`npm run analyse`, plus gridded stills of the decoded frames).
import manifest from './manifest.json';

export type ClipId = 'exterior' | 'gateway' | 'courtyard';
export type Clip = (typeof manifest.clips)[number] & { id: ClipId };
export const clips = Object.fromEntries(manifest.clips.map((c) => [c.id, c])) as Record<ClipId, Clip>;

export interface Rect { x0: number; y0: number; x1: number; y1: number }
export interface Point { x: number; y: number }

export interface SceneFrame {
  clip: ClipId;
  /** Picture area inside the frame (the exterior has burned-in letterbox bars); cover framing fills the viewport with this. */
  content: Rect;
  /** What stays centred when the viewport crops the frame (phones show only ~26% of the width). */
  focal: Point;
  /** Optional focal point for portrait viewports, where the crop is far tighter. */
  focalPortrait?: Point;
  /**
   * The camera is still moving on the last frame. To hold without a visible freeze, the held frame keeps
   * that motion and eases it to rest: zoom velocity (per second) about `origin`. Measured from the last frames.
   */
  endZoomPerSecond: number;
  endOrigin: Point;
}

export const scenes: Record<ClipId, SceneFrame> = {
  exterior: {
    clip: 'exterior',
    content: { x0: 0, y0: 118, x1: 1920, y1: 962 },        // bars: 10.7% top and bottom
    focal: { x: 1060, y: 520 },                           // keeps the scaffolded east wing in frame on 16:10
    focalPortrait: { x: 930, y: 520 },                     // the façade's central crown
    endZoomPerSecond: 0.006,                               // 1.00025 per frame
    endOrigin: { x: 960, y: 540 },
  },
  gateway: {
    clip: 'gateway',
    content: { x0: 0, y0: 0, x1: 1920, y1: 1080 },
    focal: { x: 960, y: 600 },
    endZoomPerSecond: 0.072,                               // 1.003 per frame: still pushing in at the end
    endOrigin: { x: 960, y: 640 },
  },
  courtyard: {
    clip: 'courtyard',
    content: { x0: 0, y0: 0, x1: 1920, y1: 1080 },
    focal: { x: 960, y: 520 },
    endZoomPerSecond: 0.021,                               // ≈1.0009 per frame
    endOrigin: { x: 960, y: 540 },
  },
};

/**
 * How one clip hands over to the next. Never two moving videos on screen at once:
 *  - cut        the incoming clip is parked on a decoded frame under the outgoing one and exposed on its first
 *               advancing frame; the outgoing layer disappears in that same frame.
 *  - dissolve   as a cut, but the outgoing clip is paused on its last shown frame (a true still, never zoomed)
 *               and fades out over the incoming clip, which is already moving.
 *  - threshold  as a dissolve, but the outgoing still clears darkest-first (shadows, doorways), so the incoming
 *               clip appears through the architecture's own dark openings.
 */
export type EditStyle = 'cut' | 'dissolve' | 'threshold';
export const EDIT_STYLES: EditStyle[] = ['cut', 'dissolve', 'threshold'];

export interface Join {
  style: EditStyle;
  /** Source frame of the incoming clip that should be the first one seen. */
  incomingFrame: number;
  /**
   * Frame the incoming clip is parked on (covered). It is started `preroll` outgoing frames before the cut and
   * exposed on its first *steady* frame (two consecutive frames presented back to back). Measured start-up:
   * ≈75 ms to steady under a still; under a playing clip ≈300 ms, the first frames arriving late and catching
   * up (1 → 4 → 7 → 8), so it steadies around parkFrame + 7.
   */
  parkFrame: number;
  /** Last source frame of the outgoing clip to be shown (null: whatever is on screen when the edit is called). */
  outgoingFrame: number | null;
  /** Outgoing frames before outgoingFrame at which the incoming clip is started (still covered). */
  preroll: number;
  /** Delay between the visitor's action and the edit, while the type clears (seconds). */
  leadIn: number;
  dissolve: number;
  threshold: number;
}

/**
 * Default styles, chosen by eye from the side-by-side captures (all three remain selectable with ?edit=):
 *  - exterior → gateway: a 0.5 s dissolve from the held aerial frame into the gateway approach, already moving.
 *    A straight cut jumps from the still homepage straight into motion; the dissolve lets the movement emerge.
 *    The dark-first threshold reads as a glitchy luma key across the sky here.
 *  - gateway → courtyard: a straight cut. Door to larger door, which then opens: the clearest of the three.
 *    A dissolve superimposes two different arches; the threshold breaks the door up.
 *
 * Edit points chosen from decoded frames (`npm run analyse:joins`, contact sheets in .generated/joins):
 *  - Exterior → gateway is visitor-triggered from an aerial establishing shot to a ground-level arrival: a new
 *    shot, so it starts on the gateway's first frame (already moving forward) as soon as the title clears.
 *    Exposure of the two pictures is close (mean luminance ≈96 vs 104 within the picture area); the change
 *    is colour temperature (amber dusk sky → blue sky), which is left as shot.
 *  - Gateway → courtyard is an axial doorway match cut. The gateway ends on a slow push (≈0.3 %/frame) towards
 *    closed doors, centred; courtyard frames 0–8 face a closed door, centred and slightly larger, also on a slow
 *    push (≈0.6 %/frame), before its doors open (8–24) and the camera passes through (24–62). Cutting from
 *    gateway frame 189 to courtyard frame 8 reads as stepping closer to the door just as it begins to open, as the
 *    visitor moves through. The gateway never reaches its last frame, so nothing is left frozen.
 */
export const joins: Record<'exteriorToGateway' | 'gatewayToCourtyard', Join> = {
  exteriorToGateway: { style: 'dissolve', incomingFrame: 2, parkFrame: 0, outgoingFrame: null, preroll: 0, leadIn: 0.3, dissolve: 0.5, threshold: 0.7 },
  gatewayToCourtyard: { style: 'cut', incomingFrame: 8, parkFrame: 1, outgoingFrame: 189, preroll: 7, leadIn: 0, dissolve: 0.33, threshold: 0.5 },
};

/** Comparison harness: ?edit=eg:dissolve,gc:threshold overrides the edit style of each join. */
export function applyEditOverride(search: string) {
  const v = new URLSearchParams(search).get('edit'); if (!v) return null;
  const applied: Record<string, EditStyle> = {};
  for (const part of v.split(',')) {
    const [k, style] = part.split(':') as [string, EditStyle];
    const key = k === 'eg' ? 'exteriorToGateway' : k === 'gc' ? 'gatewayToCourtyard' : null;
    if (key && EDIT_STYLES.includes(style)) { joins[key].style = style; applied[k] = style; }
  }
  // a harness link always starts a fresh entrance (the seen flag would otherwise cross-fade straight in)
  try { sessionStorage.removeItem('ue.entered'); } catch { /* storage unavailable */ }
  return applied;
}
