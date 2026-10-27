# Fresh-clone verification

The repository was cloned into an empty directory and checked from scratch, with no files from the development
environment. Environment: macOS on Apple Silicon, Node.js 20.20, npm 10, Chrome for Testing 147.

| step | result |
|---|---|
| `git clone` | one commit; 56 tracked files |
| `npm ci` | installed from `package-lock.json` (public npm registry only); **0 vulnerabilities** reported |
| `npm run build` (`tsc --noEmit && vite build`) | passes; `dist/` contains `index.html`, `harness.html`, the three clips and the six stills; main JS 307.8 kB (101.5 kB gzip) |
| `npm run dev` | serves on `127.0.0.1` |
| `npm run preview` | serves the production build; videos served as `video/mp4` with HTTP Range support |
| `npm test` against the production build | **65 / 65** checks passed |
| `npm test` against the dev server | **65 / 65** checks passed |
| network | a full visit (intro, Enter, entrance to the courtyard) plus the harness made 32 requests, all to `127.0.0.1`; nothing external |

## All three scenes, with the web encodes

From `node diagnostics/run.mjs journey` + `node diagnostics/analyse-transitions.mjs` on the production build,
cold and warm load:

| join | edit | first frames | visible moving videos | skipped source frames | rAF max | poster / uncovered frames |
|---|---|---|---|---|---|---|
| exterior → gateway | 0.5 s held-frame dissolve | gateway from frame 2 | 1 | 0 | 9.4 ms | 0 / 0 |
| gateway → courtyard | cut | gateway 189 → courtyard 8 (as designed) | 1 | 0 | 9.4 ms | 0 / 0 |

- **Every edit** was triggered by a presented incoming frame (`requestVideoFrameCallback`).
- **Holds:** the held stills match the decoded last frames of the served clips at 42.5–42.7 dB PSNR, with mean level within 0.4/255.
- **Clicks:** click → first change on screen took 5–7 ms for every control.

The 65 checks cover:
- the full journey;
- hotspot alignment on desktop, phone portrait and phone landscape;
- keyboard and touch input;
- Back/Forward and deep links;
- reduced motion;
- refused autoplay, a missing clip and a hidden tab;
- the navigation races R1–R10 described in `V1.1-PLAYBACK-REPAIR.md`.

## Not verified

- Browsers other than Chromium: Safari and Firefox (the `requestVideoFrameCallback` fallback path is implemented but unmeasured).
- Real phones (only emulated viewports with touch).
- Windows and Linux hosts (the browser lookup in `scripts/lib/browser.mjs` supports them, but they were not run).
