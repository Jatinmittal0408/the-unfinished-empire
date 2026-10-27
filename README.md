# The Unfinished Empire

*Not inherited. Still becoming.*

An interactive cinematic arrival. Three AI-generated clips (an aerial of the palace, the approach to its gateway,
and the passage into its courtyard) are joined into one continuous entrance that ends inside the courtyard, where
five destinations are anchored to the architecture.

Version 1.1. Design and engineering notes: [`docs/V1.1-PLAYBACK-REPAIR.md`](docs/V1.1-PLAYBACK-REPAIR.md) (how the
edits work and how they were measured) and [`docs/V1-PLAYBACK-DIAGNOSTIC.md`](docs/V1-PLAYBACK-DIAGNOSTIC.md) (the
diagnosis that led to them). Media storage, encoding and bandwidth: [`docs/MEDIA.md`](docs/MEDIA.md). Fresh-clone results:
[`docs/VERIFICATION.md`](docs/VERIFICATION.md).

## Quick start

Requires Node.js 20.19+ (or 22.12+).

```sh
npm ci
npm run dev        # http://127.0.0.1:5180   · comparison harness: /harness.html
```

Production build:

```sh
npm run build
npm run preview    # http://127.0.0.1:5181
```

Everything the site needs is in the repository: the three clips (`public/media/`), their poster stills
(`public/posters/`), self-hosted fonts (`@fontsource`, OFL-1.1) and the code. There are no external requests,
analytics, CDNs or API keys. The servers bind to `127.0.0.1` only.

## Tests and tooling

The validation and measurement scripts drive a real browser. It must decode H.264, so it is Playwright's
*Chrome for Testing* build (plain Chromium cannot) or an installed Google Chrome.

```sh
npm run browsers                         # once: download Chrome for Testing for playwright-core
npm test                                 # 65 end-to-end checks against http://127.0.0.1:5180
node scripts/validate.mjs http://127.0.0.1:5181    # … or against the production preview
```

`CHROME_PATH` selects another browser. Outputs (`validation/`, `.generated/`, `diagnostics/out/`,
`public/review/`) are git-ignored.

| script | what it does |
|---|---|
| `npm run probe` | container metadata of the clips (frames, fps, bitrate, faststart, sha256) → `.generated/probe.json` |
| `npm run posters` | re-extract the first/last-frame stills in Chromium (run after replacing a clip) → `public/posters/` |
| `npm run analyse` | letterbox and end-of-clip motion |
| `npm run analyse:joins` | edit-point analysis on decoded frames → `.generated/joins*` |
| `node diagnostics/run.mjs journey --base URL --label X` | instrumented journey (cold and warm load) → `diagnostics/out/X/` |
| `node diagnostics/analyse-transitions.mjs X` | per-join frame timing, visible playing videos, skipped frames, click latency |
| `node diagnostics/capture-edits.mjs …` | timestamped screencast captures, side-by-side comparison videos (needs an ffmpeg with libvpx-vp9) |

## The media

| clip | resolution | codec | frames @ fps | duration | bitrate | size | faststart |
|---|---|---|---|---|---|---|---|
| exterior | 1920×1080 | H.264 High (avc1.640028) | 192 @ 24 | 8.000 s | 9.6 Mb/s | 9.6 MB | yes |
| gateway | 1920×1080 | H.264 High | 192 @ 24 | 8.000 s | 9.7 Mb/s | 9.7 MB | yes |
| courtyard | 1920×1080 | H.264 High | 192 @ 24 | 8.000 s | 9.6 Mb/s | 9.6 MB | yes |

These are web encodes of the approved masters (21–41 Mb/s, 96 MB, not faststart). They keep the masters' exact frame
structure, so every edit point is unchanged, and their tone and colour (mean within 0.5/255). See
[`docs/MEDIA.md`](docs/MEDIA.md) for how they were made, what was checked, and the storage and bandwidth implications.
The clips have no audio.

Findings from the frames themselves (`scripts/analyse-clips.mjs`, plus gridded stills):

- **Exterior** has burned-in letterbox bars covering 10.7% of the height at both top and bottom, so the picture
  itself is about 2.26:1. The site frames the picture area, not the bars.
- **None of the clips ends on a still frame.** At the end the camera is still moving: the exterior zooms 0.025%
  per frame, the gateway 0.3% per frame (still pushing in), and the courtyard about 0.09% per frame. A plain
  freeze on the last frame would show as a jolt.
- **Clip-to-clip continuity:** comparing the last frame of one clip with the first frame of the next gives
  9.2 dB (exterior → gateway) and 9.1 dB (gateway → courtyard). In other words they are different shots, not
  continuations.

## How it plays

| step | what happens |
|---|---|
| Exterior (home) | The exterior plays once, muted and inline. *Enter the Empire* is visible within about 0.2 s. When the film ends, it swaps to the identical decoded last frame and the camera's remaining zoom eases to rest. That still is the homepage backdrop. |
| Enter → gateway | The gateway has been parked, paused on its first decoded frame, under the homepage since 1.5 s into the intro. On Enter the title starts clearing at once. After a 0.3 s lead-in the gateway is started (still covered) and, on its first steady presented frame, the held aerial frame dissolves away over 0.5 s with no zoom. The courtyard is fetched and parked under the gateway from then on. |
| Gateway → courtyard | A doorway match cut chosen from decoded frames: gateway frame 189 → courtyard frame 8, door to larger door just as it starts to open. The courtyard is started seven frames early, still covered, and exposed in the frame callback of its first steady frame, in the same rendering update that hides the gateway. A backstop cuts anyway if the gateway passes frame 189 first. |
| Courtyard → inside | The courtyard swaps to its decoded last frame and eases to rest. The five destination markers then fade in one by one. |

Routes (hash):

- `#/` is the exterior.
- `#/courtyard` is inside the palace.
- `#/courtyard/<durbar|music|library|workshop|unfinished>` is a room open over the courtyard.

The films are journeys *between* routes, never routes themselves. Back, Forward, deep links and reloads therefore always land on a still scene and never replay a film.

### Destinations: anchored to the architecture

Each anchor is a point in the source frame (1920×1080):

| room | anchor | feature |
|---|---|---|
| Music Chamber | (960, 196) | the pavilion above the central iwan, where a palace traditionally kept its musicians |
| Durbar · Engineering | (958, 452) | the great cusped arch on the main axis |
| Library · Ideas | (468, 446) | the shaded upper gallery of the west range |
| Workshop · Experiments | (1462, 712) | the ground-floor arcade of the east range |
| Unfinished Wing · Future | (1712, 200) | the corner pavilion where the east range turns out of view |

The room copy describes the rooms only. It claims no achievements and contains no employer information. Each panel says the room is not open yet.

### Controls

- **Skip cinematic:** a button, or Esc.
- **Back to exterior.**
- **Return to courtyard:** a button, Esc, or browser Back.
- **Replay:** *Replay the entrance* inside the palace, *Replay the film* on the homepage.
- **Rooms menu:** direct navigation from anywhere.
- **Number keys 1–5:** open a room.
- **← / →:** move between the markers, west to east. Tab order works too.
- **Sound toggle:** off by default, remembered across visits, M toggles it.
- **No forced replays:** the entrance counts as seen as soon as Enter starts it. *Enter* again in the same session (even after leaving mid-film) cross-fades straight in; only *Replay the entrance* plays it again, as one cancellable sequence that Esc/Skip/Back/rooms interrupt cleanly.

### Narrow screens and reduced motion

- **Phone portrait** shows only the central ~26% of the courtyard. Drag or swipe pans across it within the picture. The edge hints (‹ Library, Workshop ›) name the nearest room off each side, and focusing or opening a room pans it into view. Rooms open as a bottom sheet.
- **Short landscape screens** get a compact side panel, with the labels placed under the markers.
- **Reduced motion:** the films don't autoplay. The homepage and courtyard are the held stills, Enter is a 0.4 s cross-fade, and there is no settle zoom, lean-in, breathing markers or loading sweep.

### Failure handling

| situation | behaviour |
|---|---|
| Autoplay refused | The homepage still is shown at once, with Enter available and a *Play the film* action. |
| A clip fails to load or stalls for more than 6 s | A polite notice appears and the visitor lands on the courtyard still. |
| Tab hidden mid-film | The film pauses and resumes when the tab is visible again. |
| Any new command (Skip, Back, a room) | Cancels the running sequence cleanly. Every await in a sequence is guarded, so a cancelled sequence can't act afterwards. |

## Architecture

```
src/media/manifest.json   media manifest (measured numbers, still paths)
src/media/scenes.ts       per-clip framing; the joins: edit style, park/cut frames, preroll (+ ?edit= override)
src/engine/SceneManager.ts  reusable video pool: lazy elements, preload-next, presented-frame tracking
                            (requestVideoFrameCallback, rAF fallback), park-on-frame, whenFrame, release
src/engine/Director.ts    cancellable Seq sequences (intro, enter, replay, arrive, home); edits that expose the
                            incoming clip on its first steady frame; holds; seen policy
src/engine/threshold.ts   HeldFrame: pre-compiled WebGL canvas holding the outgoing frame for dissolve/threshold
src/harness/, harness.html  comparison harness (recordings + live links for every edit combination)
src/engine/cover.ts       explicit cover framing shared by video, still and hotspots (+ clamped panning)
src/engine/route.ts       hash routes and history
src/components/           Layer (plate: video + identical still + anchored children), Hotspots, Panel,
                          Title, Controls
src/content/destinations.ts  the five rooms, their anchors and copy
scripts/probe-media.mjs   container metadata (frames, fps, bitrate, audio, faststart, sha256)
scripts/extract-posters.mjs  poster-frame extraction in Chromium + continuity numbers
scripts/analyse-clips.mjs letterbox and end-of-clip motion measurement
scripts/analyse-joins.mjs edit-point analysis on decoded frames (brightness, darkness, motion, silhouette match)
scripts/validate.mjs      end-to-end Chromium validation (65 checks, incl. navigation races R1–R10)
diagnostics/              measurement tooling (instrumented journeys, transition analysis, captures)
scripts/media/            colour-tag tool used to make the web encodes (see docs/MEDIA.md)
docs/                     engineering reports and media notes
```

- Each clip is shown on a *plate*: the whole 1920×1080 frame, sized and positioned by `coverPlate`. The video, its identical still and the hotspots all sit inside the plate, so a hotspot cannot drift from its architecture. The validation measures 0.00–0.03 px of error at every viewport.
- Adding a clip means adding an entry to the manifest and a frame config, then running `npm run probe && npm run posters && node scripts/analyse-clips.mjs`.
- Animation uses [`motion`](https://motion.dev) (`motion/react` for UI, `animate()` for the director).
- The build is about 99 kB of gzipped JS.

## Validation (Chromium 147, Chrome for Testing)

`npm test` passes **65/65** checks against both the production build and the dev server. Highlights:

- **Held stills vs the decoded last frames:** 41.4–41.6 dB PSNR, mean level within 0.4/255. The swap from video to still can't be seen.
- **Hotspot alignment error:** 0.00–0.03 px on desktop 1440×900, phone portrait 390×844 and phone landscape 844×390.
- **Loading:** during the intro only `exterior.mp4` and `gateway.mp4` are requested. `courtyard.mp4` is requested only once the gateway is playing.
- **Navigation:** keyboard, touch swipe, Back/Forward/deep links, Skip (button and Esc), Replay, Rooms menu, persistent sound setting.
- **Resilience:** reduced motion, refused autoplay, missing gateway clip, and a hidden tab mid-film.
- **Playback:** never more than one moving video visible (per-frame sampler); edits placed on presented frames; navigation races R1–R10 (see `docs/V1.1-PLAYBACK-REPAIR.md`).

Screenshots and transition contact sheets are in `validation/`:

| what | files |
|---|---|
| Desktop journey | `desktop-01` … `desktop-10` |
| Phone portrait | `mobile-01` … `mobile-09` |
| Phone landscape | `landscape-*` |
| Reduced motion | `reduced-*` |
| Failure handling | `failure-*` |
| Transition sheets | `transition-exterior-to-gateway.jpg`, `transition-gateway-to-courtyard.jpg` |

## Known issues (honest list)

1. **Exterior → gateway is a dissolve between different worlds.** The exterior is a golden-hour aerial with a warm haze sky. The gateway is at ground level under a saturated blue midday sky, and its gate is not the gate visible on the exterior palace. In V1.1 the 0.5 s held-frame dissolve still briefly overlaps the two skies; only new footage can make this a true continuation.
2. **Gateway → courtyard changes the gate.** The gateway's sandstone gate, with its tower and multi-tier pavilion, is a different building from the red-sandstone gate with twin chhatris that opens the courtyard clip. The V1.1 doorway match cut (gateway 189 → courtyard 8) reads as a cut-in, but frame by frame it is a different door.
3. **The courtyard has no visible "unfinished" architecture.** The exterior and gateway both show scaffolding on the east wing, but the courtyard doesn't. The Unfinished Wing marker therefore sits on the corner pavilion where the range turns out of view.
4. **Colour and time-of-day drift between clips.** Mean level rises from about 74 to 90 to 110 (8-bit) across the three clips, and the sky goes from amber to blue to pale haze.
5. **Exterior letterbox.** The bars are burned into the file, so 21% of its pixels are discarded, and on 16:9 screens the picture is cropped further to fill the frame.
6. **Phone portrait is a tight crop.** It shows about 26% of each frame's width, so the films lose their composition on phones (this is inherent to cover framing of 16:9 footage).
7. **The clips have no soundtrack.** The sound toggle works and persists, but there is nothing to hear yet.
8. **Delivery weight.** One full visit downloads about 29 MB of video (three 1080p clips at about 9.7 Mb/s). That is fine on broadband but heavy on mobile data; see `docs/MEDIA.md`.
9. **AI-generation artefacts are visible on close inspection:** smeared carving, some inconsistent detail on the façades, and a softly painted texture at full size.

## Recommended improvements

1. **Regenerate the gateway at golden hour, with the exterior's gate,** or regenerate the exterior to end on that gate. A first frame that continues the previous last frame would turn both dissolves into true continuations. If regeneration is possible, condition each clip on the previous clip's last frame (image-to-video).
2. **Unify the grade.** Apply one colour grade across the three clips (warm, lower-key highlights) as part of the encode, so the light reads as one evening.
3. **Add lighter delivery variants:** 720p at about 4 Mb/s and an AV1 or HEVC ladder, plus a dedicated portrait crop per clip, chosen per device. (The 1080p H.264 web encodes in this repository are the first step.)
4. **Generate or film a courtyard ending that holds still** for about 1 s, plus a visible scaffolded wing for the Unfinished Wing.
5. **Add a licensed or original ambient soundtrack,** then make the sound toggle cross-fade it.
6. **Swap the poster JPEGs for AVIF/WebP and preload them per route.** Measure on a throttled mobile profile once the delivery encodes exist.
