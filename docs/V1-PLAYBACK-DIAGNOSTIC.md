# AI Cinematic Edition V1: playback and transition diagnostic

> Historical engineering report, kept as written during development. Commit and branch references point to the
> original development repository; paths under `diagnostics/out/` refer to locally generated (git-ignored) data.
> The fixes it led to are described in [`V1.1-PLAYBACK-REPAIR.md`](V1.1-PLAYBACK-REPAIR.md).

**Scope:** measurement only. No application code, styling or media was changed. The diagnostic tooling observes the running app from outside, using an init script injected by the test harness.

- **Build under test:** branch `ai-cinematic-edition`, commit `0e9fab4`, dev server `http://127.0.0.1:5180`.
- **Date:** 2026-10-27.
- **Machine:** Apple M5 Pro, built-in 120 Hz Liquid Retina XDR display. The window was 1440×900 CSS px at DPR 2.
- **Browser:** Chrome for Testing 147.0.7727.15, headed, so it used the real GPU and VideoToolbox hardware decode. `mediaCapabilities` reports the clips as `smooth` and `powerEfficient`.

## 1. Bottom line

The "stuck, not fluid" feel has three distinct causes. Two are real playback stalls; the third is in the edits themselves.

| # | Cause | Kind | Evidence | Where it bites |
|---|---|---|---|---|
| **A** | **GPU contention from the Blender Cycles render** that was running on the same GPU | Real stall (environmental) | With Blender running: the exterior's first frame took 948 ms (152 ms without); Enter took **334–354 ms** to change anything on screen (**30 ms** without); there were 15–17 main-thread frames over 50 ms, up to 533 ms (0 without); one courtyard frame gap was 950 ms | Everywhere, randomly |
| **B** | **Two playing videos blended on screen at the same time** collapse Chrome's compositor | Real stall (architectural) | Each clip alone plays at 24.2 fps with 0 skipped frames and rAF at 120 Hz. Gateway and courtyard cross-fading drops to **12–15 fps presented each**, skips **31–45 source frames in 4 s**, and rAF falls to **~30 Hz**. The decoders still decode every frame | Every gateway → courtyard join (the 0.95 s dissolve); also the exterior → gateway join when Enter is pressed during the intro |
| **C** | **The joins are edits between unrelated shots**, built from still-frame zooms and freeze frames | Visual edit, not a stall | Exterior → gateway pushes in on a *frozen* held frame (0 exterior frames during the 1.24 s fade). In the gateway → courtyard join the gateway **ends 0.6 s into a 0.95 s dissolve**, so its last frame sits frozen under the zoom for ~0.35–0.4 s. Skies, time of day and gate architecture differ across the cut | Both joins, every time |

No network or buffering stalls were found. These are local files with no `stalled` events and no `waiting` beyond start-up. There are also no seeks, final-frame holds that freeze, or out-of-order scene playback in normal use. Two navigation edge cases misbehave (§7).

## 2. How it was measured

| What | How |
|---|---|
| Video state | Every `<video>` the app creates is wrapped at creation (`document.createElement` hook). Logged with `performance.now()` timestamps: all media events (`loadstart` … `waiting` / `stalled` / `playing` / `ended` / `emptied`), plus `readyState`, `networkState`, `currentTime` and `buffered` ranges on every event, every `play()` call and its resolution, and every `currentTime` seek |
| Presented frames | `requestVideoFrameCallback` on every video: wall time, `mediaTime`, `presentedFrames`, `expectedDisplayTime`, `processingDuration`. Skipped source frames come from gaps in `mediaTime` (> 1.5 frames at 24 fps) |
| Decoder drops | `getVideoPlaybackQuality()` every 250 ms |
| What was on screen | One sample per animation frame: phase, and each layer's opacity, z-order, inner scale, lean scale, whether it holds a `<video>`, and which still it shows; plus title opacity and panel |
| Main-thread health | rAF intervals; Long Animation Frames (`long-animation-frame` PerformanceObserver) |
| Input latency | Capture-phase `click` timestamps. "State change" is the first rAF sample whose layer, title or phase state differs. "Animation start" is the first frame a transition ramp moves. "Visible" is the first trace **screenshot** that differs from the pre-click frame (the composited output) |
| Network | CDP `Network.*` events for `/media/` and `/posters/`: requests, ranges, status, cache |
| GPU load | `ioreg IOAccelerator` "Device Utilization %", sampled once a second |
| Artefacts | Playwright screen recording of the viewport for every page; Chromium performance trace with screenshots for each journey |

Runs:

| Run | Description |
|---|---|
| `dev-gpu-contended` | The scripted journey with an unrelated Blender Cycles render running on the GPU (the state the machine was in before the priority change). Cold page, then warm page |
| `dev-clean` | The same journey after all Blender processes were stopped. Cold, then warm |
| `decode-clean` | Microbenchmark: the clips played alone and in combinations, varying opacity, transform and play state |
| `nav-clean` | Eight navigation stress cases (double-click, Back/Forward mid-film, Skip mid-join, room during the film, replay races, Enter mid-intro) |

Each journey goes:
1. Load `/`.
2. Watch the intro until the homepage holds.
3. Click Enter for the full cinematic, through to arriving inside.
4. Back to exterior.
5. Enter again (seen, so a cross-fade).
6. Replay the entrance.
7. Skip mid-gateway.
8. Back to exterior.

**Cold** is a fresh tab in a fresh browser context (empty HTTP cache). **Warm** is a second tab in the same context: HTTP cache kept, sessionStorage fresh, so the full cinematic plays again.

**Cold vs warm.** On localhost they are effectively identical. The dev server sends `Cache-Control: no-cache`, so media is revalidated each time, and all media is served as `206` byte ranges from local disk. The only cold/warm difference was the exterior's first frame: 152 ms cold vs 50 ms warm. Network transfer is not a factor on localhost. It would be on a real network, with 21–41 Mb/s files that aren't faststart.

## 3. Timeline of one clean journey (cold)

| t (ms) | Event |
|---|---|
| 108 | `intro`: exterior `play()`. First presented frame at +152 ms (one `waiting` at start-up) |
| 8 237 | exterior `ended`. Last frame shown is 7.958 s (frame 191). The held still swaps in 16 ms later; settle zoom 1.26 s to ×1.0023 |
| 9 862 | `home` |
| 11 397 | **click Enter**. The title starts fading at +5 ms (first visible change in screenshots at +30 ms) |
| 11 402 | gateway `play()`, `readyState 4` (preloaded since 1.5 s into the intro). First frame +42 ms, source frame #1 |
| 11 420 – 12 662 | exterior **push** ×1.0024→×1.1427 (1 242 ms) and **fade** (1 209 ms). The exterior is a frozen still during this time |
| 11 436 | courtyard preload begins (it decodes one frame while still detached) |
| 18 803 | gateway reaches 7.4 s → courtyard `play()` (`readyState 4`), first frame +50 ms, source frame #1 |
| 18 811 – 19 761 | gateway **push** ×1→×1.1985 (950 ms) and **fade** (908 ms). **rAF drops to 30 Hz; both clips present at ~10–15 fps** |
| 19 345 | gateway `ended`, **0.53 s into the 0.95 s dissolve**. Its last frame is frozen under the zoom for the remaining ~0.4 s |
| 26 805 | courtyard `ended`. The still swaps in 14 ms; settle 1.61 s to ×1.0083 |
| 26 812 | `arrived`. The markers fade in from +0.5 s, staggered, all in by about +1.7 s |

So from clicking Enter to being able to interact took **15.4 s** of non-interactive film, plus ~1.7 s for the markers. Skip is available the whole time.

## 4. Input latency (click → response)

| Action | State change (rAF) | Animation starts | Visible change (trace screenshots) | GPU-contended equivalents |
|---|---|---|---|---|
| Enter (first visit) | 5–6 ms | 22 ms (exterior push; ease-in, so perceptible at ~114 ms) | **30 ms** | state 1–173 ms, animation 67–181 ms, **visible 334–354 ms** |
| Enter (seen, cross-fade) | 7 ms | 24–40 ms (courtyard fade-in, 842 ms) | — | 2–7 ms / 23–53 ms |
| Skip cinematic | 7–8 ms | 31–32 ms (courtyard fade-in, 667 ms) | — | 2–6 ms / 31–44 ms |
| Back to exterior | 6–7 ms | 22–40 ms (exterior fade-in, 841–850 ms) | — | 3–6 ms / 31–71 ms |
| Replay the entrance | 6 ms | 14–15 ms (exterior fade-in, 583 ms), then the gateway starts | — | 1–6 ms / 15–35 ms |

Without contention every control responds within one or two display frames, and the animation begins within 15–40 ms. With Blender on the GPU, Enter took a third of a second to show anything. That's consistent with a recording in which clicking Enter "does nothing" for a moment.

The trace screenshot buffer caps at about 450 frames, so only the first click per page has a screenshot measurement. The rAF columns cover the rest.

## 5. Playback per clip (rVFC, `getVideoPlaybackQuality`)

Two runs, two `play()` sessions each; "first frame" is measured from the `play()` call.

| Clip | Clean cold | Clean warm | GPU-contended cold | GPU-contended warm |
|---|---|---|---|---|
| **Exterior** (intro) | first frame 152 ms; 192/192 source frames; 0 skipped; max gap 50 ms | 50 ms; 192/192; 0; 50 ms | **948 ms**; 192; 0; **458 ms gap** | 187 ms; 191; 1; **891 ms gap** |
| **Gateway** | 42 ms; 185 shown; **5 skipped**; max gap 100 ms, all inside the join | 50 ms; 186; 5; 100 ms | 126 ms, **starts at source #3**; **10 skipped**, 10 dropped; 250 ms gap; 2 `waiting` | 156 ms, #3; 10 skipped; 158 ms |
| **Courtyard** | 50 ms; 184 shown; **7 skipped**; 100 ms, all inside the join | 50 ms; 184; 7; 100 ms | 176 ms, #4; 7 skipped, 8 dropped; 183 ms | 89 ms; **11 skipped**; **950 ms gap** |
| Decoder `droppedVideoFrames` | 0 everywhere | 0 | 1–10 per clip | 1–3 |
| `stalled` events | 0 | 0 | 0 | 0 |

In the clean runs, every skipped frame and every gap over two frames falls inside the 0.95 s gateway → courtyard dissolve. Outside the joins, each clip plays at a steady 41.7 ms cadence (p95 ≤ 42.7 ms).

## 6. Simultaneous decoding: is it decode contention?

**No, it isn't decode. It's compositing two playing, blended video layers.** Here is the 4 s microbenchmark (`decode-clean`, clean GPU, full-viewport videos with `object-fit: cover`):

| Configuration | rAF max | Presented fps per clip | Skipped source frames (4 s) | Decoder dropped |
|---|---|---|---|---|
| gateway alone | 10 ms | 24.2 | 0 | 0/124 |
| courtyard alone | 10 ms | 24.2 | 0 | 0/124 |
| gateway alone at opacity 0.5 | 10 ms | 24.3 | 0 | 0 |
| gateway alone, scaled ×1.1 | 10 ms | 24.3 | 0 | 0 |
| gateway + courtyard, **both playing, top fully opaque** | 10 ms | 24.3 / 24.3 | 0 / 0 | 94/124 (hidden layer, as expected) |
| gateway playing + courtyard playing at **opacity 0** | 10 ms | 24.3 / 24.2 | 0 / 0 | — |
| gateway playing + courtyard **paused** on top at 0.5 | 10 ms | 24.2 | 0 | 0 |
| **gateway + courtyard both playing, top at 0.5 (a cross-fade)** | **34 ms** | **14.7 / 12.3** | **35 / 44** | 0 / 0 |
| **exterior + gateway cross-fade** | **35 ms** | **13.8 / 15.4** | **39 / 33** | 0 / 0 |
| all three stacked | 35 ms | 14.1 / 12.3 / 12.3 | 38 / 45 / 45 | 0 |

The pattern:
- **Fine:** two decoders running, one video with partial opacity, and one video under a transform.
- **Collapses:** two *playing* videos *both visibly composited* at once. The frame loop drops to ~30 Hz and each video only gets about every second source frame onto the screen.
- **Not the cause:** the decoders. They keep up (`dropped 0`, `totalVideoFrames` complete), and hardware decode is confirmed.

The likely mechanism, not proven here, is that with a single visible video Chrome on macOS can present it through a CoreAnimation overlay. Two blended, independently updating video layers force full GPU composition of two 2880×1800-device-pixel surfaces on every video frame, and the frame loop falls back to 30 Hz.

**In the app** this condition occurs:
- In **every gateway → courtyard join.** The gateway keeps playing for 0.53 s of the 0.95 s dissolve while the courtyard plays underneath. Measured: rAF max 34 ms, gateway 8 frames and courtyard 15 frames during the dissolve, 5–7 source frames skipped each.
- In the **exterior → gateway join only when Enter is pressed during the intro**, because the exterior is still playing (nav-7: 53 interleaved frame pairs; rAF at ~60 Hz with 30% of frames over 20 ms).
- **Not** in the normal exterior → gateway join after the intro has ended, because the exterior is a held still image by then. Measured: rAF max 9.4 ms; the gateway presents 29 frames in 1.2 s, a clean 24 fps.

## 7. Scene order, interruptions and holds

**Was the destination's first frame decoded before the transition began?**

| Join | Clean | GPU-contended |
|---|---|---|
| Exterior → gateway | Yes in effect. The gateway was at `readyState 4` (fully preloaded); its first frame was presented 8–17 ms after the fade began, while it was still underneath the opaque exterior | Not quite: first frame 58–108 ms after the fade began, starting at **source frame #3**. For ~0.1 s the dissolve reveals the gateway's poster still, then jumps to frame 3 (a small visible hitch) |
| Gateway → courtyard | Yes in effect. `readyState 4` at `play()` (preloaded since the gateway started); first frame 17 ms into the fade, at source #1. Frame 0 is never presented, but the identical frame-0 poster sits beneath | Up to 101 ms late, starting at source #4 |

In both joins the fade waits for `play()` to resolve, not for the first presented frame (`requestVideoFrameCallback`).

**Fades and transforms as actually executed** (measured from the per-frame samples; the configured values are in `src/media/scenes.ts` and `Director.ts`):

| Transition | Configured | Measured (clean) | Notes |
|---|---|---|---|
| Exterior push | ×1.14 over 1.25 s, ease [0.45, 0, 0.7, 1] | ×1.0024→1.1427 over 1 242 ms | Applied to a **still**; no parallax |
| Exterior fade | 1.25 s | 1 209 ms (ease tails below threshold) | |
| Gateway push | ×1.2 over 0.95 s, initial slope matched to the clip's measured 7.2 %/s | ×1→1.1985 over 950 ms | rAF at 30 Hz throughout (§6) |
| Gateway fade | 0.95 s, starting 0.6 s before the clip ends | 908 ms | Clip `ended` at +534 ms into the fade |
| Exterior settle (hold) | to ×1.0024 over 1.6 s | 1 258 ms visible | |
| Courtyard settle (hold) | to ×1.0083 over 1.6 s | 1 608 ms | |
| Back / Skip / seen-Enter fades | 0.9 / 0.7 / 0.9 s | 841–850 / 667 / 842 ms | |

**Timing dependencies:**
- The gateway → courtyard join is triggered by polling `currentTime ≥ 7.4 s` on rAF.
- The pushes and fades run on wall-clock time (motion), while the films run on the media clock. Nothing re-synchronises them: if a clip stalls, the animation carries on regardless, and in the gateway join the clip simply runs out before the dissolve does.

**Final-frame holding and seeking:**
- **No seeks occur in the journey at all.**
- At each clip's end the video's `ended` event fires 25–67 ms after its last presented frame. The identical decoded still (41 dB PSNR) replaces it **14–16 ms later**, and the settle zoom starts in the same frame.
- **The hold mechanism introduces no freeze.** Under GPU contention the swap took 60–152 ms, which is invisible because the still is identical, but the settle starts later.
- The perceived freezes are elsewhere: the gateway's last frame frozen under the dissolve (above), and the exterior push zooming a still.

**Order under navigation** (`nav-clean`; the scene sequence was never reordered):

| Case | Result |
|---|---|
| Double-click Enter | The second `enter()` restarts the sequence 5 ms later (`play(gateway)` at 0.005 s). No visible restart, but redundant |
| Back at 0.6 s mid-dissolve, then Forward | Correct: home, then courtyard still, with no film on Forward. The gateway keeps playing underneath for ~0.9 s while the exterior fades back in |
| Back at 4 s, then Enter again | **The gateway restarts from 0 s.** The entrance is only marked "seen" when the full journey completes, so leaving mid-film means the next Enter replays it from the start |
| Esc during the gateway → courtyard join | Correct: the phase switches 19 ms after Esc, then a 0.7 s fade to the courtyard still |
| Rooms → Library during the gateway | Correct: the film stops and the room opens |
| **Replay the entrance, then Esc during its 0.6 s fade home** | **Esc is ignored and the cinematic plays anyway.** Skip only applies in the `gateway`/`courtyard` phases, and the replay is in `home` for those 0.6 s. This is a real input-handling bug |
| Enter during the intro (t = 3 s) | Order correct. Exterior and gateway play blended for 1.26 s, which is the §6 condition |
| Replay, then Rooms → Library within 0.3 s | Correct by accident. `replayEntrance()` is `await home(); enter()`. When `home()` is cancelled, motion's stopped animation never resolves `finished`, so the promise hangs and `enter()` never runs. If the cancel lands on a different await, the cinematic would start over the open room (latent race; not reproduced) |

**Development-mode note:** React StrictMode runs the boot effect twice in dev, so the exterior gets two `play()` calls 1 ms apart. It's harmless here (one `waiting` at start-up), and it doesn't happen in a production build.

## 8. Root cause: stalls vs edits

**Real playback stalls (the frame loop or video presentation actually stops):**
1. **GPU contention (A).** The Blender Cycles render shared the GPU. This produced the worst stalls: frames held 0.46–0.95 s, ~1 s exterior start-up, 1/3 s Enter latency, and late first frames at the joins. It was the state of the machine before the priority change, and it's the most likely explanation for the recording's "stuck" moments. **It is now removed:** all Blender processes have been stopped.
2. **Dual-video cross-fade (B).** This is reproducible with a clean GPU. For the ~0.95 s gateway → courtyard dissolve, both clips drop to 10–15 fps presented and the UI frame loop to 30 Hz. It also happens on the exterior → gateway join if Enter is pressed mid-intro. It's a property of compositing two playing, blended `<video>` layers in Chrome on macOS, not of decoding, file size or the network.

**Visually awkward edits (playback is smooth, but the cut reads as a stop):**

3. **The exterior → gateway push is a 2D zoom on a frozen frame.** The exterior has ended and is held when Enter is pressed, so its 1.24 s push has no parallax, and it dissolves into moving footage with a different sky (amber dusk to blue midday), viewpoint (aerial to ground) and gate.
4. **The gateway freezes under the gateway → courtyard dissolve.** The join starts 0.6 s before the gateway ends but lasts 0.95 s, so the gateway shows a frozen last frame for the final ~0.35–0.4 s while being zoomed. Combined with cause 2, the join reads as a stutter, then a freeze, then a new shot.
5. **Velocity discontinuities.** The exterior's own motion at its end is ~0.6 %/s zoom, and the push accelerates it to ~11 %/s. The courtyard's door-opening move begins inside the dissolve. Neither join carries continuous camera speed.
6. **Long non-interactive stretches.** Exterior film (8.2 s), then a still homepage. After Enter: 7.4 s gateway, 8.0 s courtyard, and ~1.7 s for the markers. Skip is available throughout, but nothing else changes while the films run.

**Not causes (ruled out):**
- network or buffering (0 `stalled` events; `readyState 4` before every join);
- seeking (none);
- the final-frame hold swap (14–16 ms; identical still);
- main-thread JavaScript (0 long animation frames on a clean GPU; rAF p99 9.4 ms);
- scene ordering in normal use.

## 9. What a fix would need to address (for review; not implemented)

1. **Never composite two playing videos at once.** Options for review:
   - pause the outgoing clip on its last frame (or swap it to its identical still) before the incoming clip becomes visible, and dissolve still-over-video;
   - start the incoming clip only after the outgoing one has been replaced by its still;
   - or pre-render the joins into the footage so the browser only ever plays one stream.
2. **Gate each dissolve on the incoming clip's first presented frame** (`requestVideoFrameCallback`), not on `play()` resolving.
3. **Make the gateway join end with the clip,** or hold its final frame deliberately, instead of letting it run out mid-dissolve.
4. **Re-think the two joins as edits.** Choose motion-matched cut points, or use regenerated or continuation footage that shares light and camera direction (see the README's continuity list), rather than zooming stills.
5. **Fix the input bugs:**
   - Esc should skip during the replay's fade home;
   - `replayEntrance` should not call `enter()` after its `home()` was superseded, and sequences should resolve on cancellation instead of hanging;
   - decide whether leaving mid-film should count as "seen".
6. **Re-measure in a production build** (no StrictMode, minified), and on a throttled network profile once delivery encodes exist.

## 10. Contents of the review package

| Path | What |
|---|---|
| `source/` | Application source at `0e9fab4` plus the diagnostic tooling (this commit). Media and extracted stills are not included (local only); place the approved MP4s in `media/` and run `npm run posters` |
| `diagnostics/out/dev-clean/` | The clean journey: `cold.*` and `warm.*`. `*.diag.json` is the raw event log; `*.analysis.json` holds the derived numbers; `*.trace.json` is a Chromium performance trace with screenshots (open it in Chrome DevTools → Performance, or ui.perfetto.dev); `*.webm` is the screen recording |
| `diagnostics/out/dev-gpu-contended/` | The same journey while the Blender render was using the GPU (traces include the extra compositor categories) |
| `diagnostics/out/decode-clean/` | `decode.json` (the §6 table) and `decode.webm` |
| `diagnostics/out/nav-clean/` | Eight navigation cases: `nav-N.diag.json`, `nav-N.webm`, and `nav.analysis.json` |
| `diagnostics/out/summary.json` | All headline numbers in one file |
| `diagnostics/*.mjs`, `instrument.js` | To reproduce: start `npm run dev`, then `node diagnostics/run.mjs journey --label X`, `analyse.mjs X`, `run.mjs decode`, `run.mjs nav`, `analyse-nav.mjs`, `summarise.mjs` |
