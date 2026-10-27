// Hash routes. Cinematics are journeys between routes, never routes themselves, so Back/Forward and deep
// links always land on a still scene and never force a replay.
//   #/                      exterior (homepage)
//   #/courtyard             inside the palace
//   #/courtyard/<room>      a destination open over the courtyard
import { isDestination, type DestinationId } from '../content/destinations';

export type Route = { scene: 'home' } | { scene: 'courtyard'; room: DestinationId | null };

export function parseRoute(hash = location.hash): Route {
  const [, scene, room] = hash.replace(/^#/, '').split('/');
  if (scene === 'courtyard') return { scene: 'courtyard', room: isDestination(room) ? room : null };
  return { scene: 'home' };
}

export const routeHash = (r: Route) => (r.scene === 'home' ? '#/' : r.room ? `#/courtyard/${r.room}` : '#/courtyard');

export function pushRoute(r: Route) { if (location.hash !== routeHash(r)) history.pushState({ ue: true }, '', routeHash(r)); }
export function replaceRoute(r: Route) { history.replaceState({ ue: true }, '', routeHash(r)); }
