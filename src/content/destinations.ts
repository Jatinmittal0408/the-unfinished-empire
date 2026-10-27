// The five courtyard destinations. Positions are anchored to architecture visible in the final frame of
// the courtyard clip (source pixels, 1920×1080). Copy is deliberately descriptive of the rooms, not of
// achievements: nothing here is published yet, and each panel says so.
import type { Point } from '../media/scenes';

export type DestinationId = 'durbar' | 'music' | 'library' | 'workshop' | 'unfinished';

export interface Destination {
  id: DestinationId;
  name: string;
  theme: string;
  /** Where the marker sits, and what it sits on. */
  anchor: Point;
  feature: string;
  /** Label to the left or right of the marker, chosen so it lies on quiet architecture. */
  labelSide: 'left' | 'right';
  body: string[];
  status: string;
}

export const destinations: Destination[] = [
  {
    id: 'music',
    name: 'Music Chamber',
    theme: 'Music',
    anchor: { x: 960, y: 196 },
    feature: 'the pavilion above the central iwan, where a palace kept its musicians',
    labelSide: 'right',
    body: ['A gallery set above the court, made for sound rather than display.'],
    status: 'Future destination — this room has not been opened yet.',
  },
  {
    id: 'durbar',
    name: 'Durbar',
    theme: 'Engineering',
    anchor: { x: 958, y: 452 },
    feature: 'the great cusped arch on the main axis',
    labelSide: 'left',
    body: ['The hall of audience on the main axis of the palace. Engineering work will be shown here as working instruments, not screenshots.'],
    status: 'In preparation — the Durbar is being built as its own scene.',
  },
  {
    id: 'library',
    name: 'Library',
    theme: 'Ideas',
    anchor: { x: 468, y: 446 },
    feature: 'the shaded upper gallery of the west range',
    labelSide: 'right',
    body: ['A quiet upper gallery for long-form notes, reading and ideas that need room to develop.'],
    status: 'Future destination — this room has not been opened yet.',
  },
  {
    id: 'workshop',
    name: 'Workshop',
    theme: 'Experiments',
    anchor: { x: 1462, y: 712 },
    feature: 'the ground-floor arcade of the east range, where palace workshops stood',
    labelSide: 'left',
    body: ['Arcaded rooms at court level for prototypes, tests and experiments — including the ones that fail.'],
    status: 'Future destination — this room has not been opened yet.',
  },
  {
    id: 'unfinished',
    name: 'The Unfinished Wing',
    theme: 'Future',
    anchor: { x: 1712, y: 200 },
    feature: 'the corner pavilion where the east range turns out of view',
    labelSide: 'left',
    body: ['Past the corner pavilion the palace is still being built.', 'Not inherited. Still becoming.'],
    status: 'Under construction by design.',
  },
];

export const destinationById = Object.fromEntries(destinations.map((d) => [d.id, d])) as Record<DestinationId, Destination>;
export const isDestination = (s: string | undefined): s is DestinationId => !!s && s in destinationById;
