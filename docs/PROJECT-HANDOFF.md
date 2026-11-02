# The Unfinished Empire: master project handoff

> **Read this first.** It is the single source of truth for continuing the project in a new conversation, with
> GPT/ChatGPT or with Claude. It records what is being built, why, what exists, what is approved, what is not, what
> must not change, and what comes next.
>
> - **Written:** 3 November 2026, by Claude, from an audit of this repository, the local development repositories, the old portfolio repository and the project's conversation history.
> - **Audited commit:** `main` = `cee4eefd7d3686444eb065fe5d7253a9575725f9`, which is V1.1.
>
> **Labels used throughout:**
>
> | label | meaning |
> |---|---|
> | **[verified]** | checked against code, files, git or measurements |
> | **[historical]** | from earlier briefs and discussions; it cannot be verified from this repository alone |
> | **[stated by Jatin]** | Jatin's own statement; not independently checked |
> | **[needs approval]** | proposed, not yet decided |
> | **[local only]** | exists on the development machine, not on GitHub |

---

## Contents

1. [Project identity and vision](#1-project-identity-and-vision)
2. [Why The Unfinished Empire exists](#2-why-the-unfinished-empire-exists)
3. [The Rajasthan palace metaphor and Jatin's real life](#3-the-rajasthan-palace-metaphor-and-jatins-real-life)
4. [Visual direction and approved creative decisions](#4-visual-direction-and-approved-creative-decisions)
5. [Homepage introduction and portrait reveal](#5-homepage-introduction-and-portrait-reveal)
6. [The five approved destinations](#6-the-five-approved-destinations)
7. [Development history (Phase 1 → V1 → V1.1 → V1.2)](#7-development-history)
8. [Current application architecture](#8-current-application-architecture)
9. [Cinematic sequence and transition implementation](#9-cinematic-sequence-and-transition-implementation)
10. [Media inventory](#10-media-inventory)
11. [Playback diagnostics and fixes](#11-playback-diagnostics-and-fixes)
12. [Automated tests and verification evidence](#12-automated-tests-and-verification-evidence)
13. [Known continuity problems and technical limitations](#13-known-continuity-problems-and-technical-limitations)
14. [V1.2 media-quality investigation (unmerged, unapproved)](#14-v12-media-quality-investigation-unmerged-unapproved)
15. [Personal photography and asset requirements](#15-personal-photography-and-asset-requirements)
16. [Durbar Veo generation plan](#16-durbar-veo-generation-plan)
17. [Professional timeline and engineering content](#17-professional-timeline-and-engineering-content)
18. [Privacy, confidentiality and public-repository rules](#18-privacy-confidentiality-and-public-repository-rules)
19. [Approved decisions vs decisions awaiting approval](#19-approved-decisions-vs-decisions-awaiting-approval)
20. [Latest agreed direction: preproduction before V1.3](#20-latest-agreed-direction-preproduction-before-v13)
21. [Next steps and development phases](#21-next-steps-and-development-phases)
22. [Responsibilities: GPT vs Claude](#22-responsibilities-gpt-vs-claude)
23. [Copy-paste prompt for a new GPT conversation](#23-copy-paste-prompt-for-a-new-gpt-conversation)
24. [Appendix: where everything lives](#24-appendix-where-everything-lives)

---

## 1. Project identity and vision

| | |
|---|---|
| Name | **The Unfinished Empire** |
| Domain (intended) | jatinmittal.com. It has not been deployed; nothing is live. |
| Signature line | ***Not inherited. Still becoming.*** |
| Owner | Jatin Mittal: DevOps / SRE / platform engineer, musician, traveller |
| Public repository | https://github.com/Jatinmittal0408/the-unfinished-empire (this one) |
| Current state | AI Cinematic Edition **V1.1**: a localhost-only interactive cinematic arrival, built from three AI-generated clips (exterior → gateway → courtyard). It ends in an interactive courtyard with five destinations. None of the destination rooms is built yet. |

**Vision** [historical, from Jatin's Phase 1 brief, 26 Oct 2026]:
- The site is an evolving, interactive representation of Jatin's world.
- It is inspired by an **unfinished royal complex that grows as Jatin develops**: professionally, creatively, financially and personally.
- The palace stands for ambition, curiosity, freedom, exploration and *becoming*.
- It is **not a chronological autobiography**. Visitors discover the person through the environment, the work, the music, the ideas and the interactions.
- The site should make people curious about Jatin and want to follow what he builds next.

The target feel, from Jatin's creative-direction revision: "premium, mysterious, playful, intelligent, and deeply
personal". The site should feel like "entering an original, living digital world — not browsing a stylized personal
blog". It should be "unmistakably like Jatin Mittal", and **not** a generic 3D portfolio.

## 2. Why The Unfinished Empire exists

[historical] Jatin's previous site, the [old portfolio](https://github.com/Jatinmittal0408/portfolio), last updated 13 Mar 2026, was a conventional dark, neon-accented React/GSAP DevOps portfolio:
- hero statistics and a typing effect;
- a project carousel and an experience timeline;
- a physics "tech stack" of logo spheres;
- an "Offline Layer" with guitar, trekking and cooking cards.

It presented skills, but not the person.

The project began on 14 Oct 2026 as *"The Unfinished Universe"*: an immersive, sound-driven personal experience.

**First concept: "Between Stations"** (a wandering-mind, frequency-dial concept). Jatin rejected it as too dependent on typography, frequency scales and scrolling. He kept these principles:
- Jatin's mind wanders between unrelated ideas.
- Music and sound should carry meaning.
- Ideas can be unfinished, tested, abandoned or realised.
- Interactions should reveal a connection or a piece of personality.
- **Real achievements must be distinguished from aspirations.**
- Visitors must be able to navigate normally without completing a journey.

**Second round.** Three cinematic 3D directions were developed, and the **Rajasthan palace, The Unfinished Empire**, was approved.

The identities the site must carry, from the creative-direction revision:

| identity | what it covers |
|---|---|
| **Engineer** | systems, architecture, building, experimentation |
| **Musician** | instruments, guitar, sound, creativity |
| **Explorer** | travel, places, photographs, memories |
| **Thinker** | wandering thoughts, questions, unconventional connections |
| **Future founder** | actual experiments, progress, failures and lessons; never invented companies or successes |

## 3. The Rajasthan palace metaphor and Jatin's real life

[historical; Jatin's own framing from the briefs]

- **A palace that is still being built.** The *unfinished* wing is the point. Jatin did not inherit an empire; he is building one: "Not inherited. Still becoming." Growth is shown as **intentional ongoing construction** (scaffolding, centering, fresh stone), never as ruin or abandonment.
- **The palace is metaphorical.** It must never read as a claim of wealth, property, royalty or lineage:
  - no throne;
  - no name on a seat;
  - no invented insignia;
  - the Durbar's royal niche stays **empty**.
- **Each room is one side of a real life:**
  - the Durbar is engineering responsibility and decision-making;
  - the Music Chamber is his actual playing;
  - the Library is ideas and writing;
  - the Workshop is experiments, including the failures;
  - the Unfinished Wing is the future.
- **Rajasthan.** Jaipur City Palace and the Rajasthan forts are the architectural references. One factual link: Jatin studied in Jaipur (B.Tech, SKIT, 2019–2023, per his résumé). Whether the story uses that connection is Jatin's decision [needs approval].
- **What is excluded.** The story is told through work, music, ideas and places. It does **not** narrate childhood trauma, family finances, personal loss or other private events (Phase 1 brief, §1).

## 4. Visual direction and approved creative decisions

### 4.1 Architectural language [historical, approved]

The palace is a fictional but architecturally coherent royal complex. It combines:
- the **monumental exterior** character of **Amber Fort** and **Mehrangarh**;
- the refined courtyards, halls, painted detail and craftsmanship of **Jaipur City Palace**;
- Rajasthani stone carving, **jaalis, jharokhas, chhatris** and gateway design;
- an **unfinished extension** that stands for future progress.

It must not recreate any real palace exactly. It must not look like a cartoon castle, a fantasy environment, a sandcastle or a collection of primitives. **Architectural credibility is mandatory.**

**Scale reference.** The benchmark for cinematic scale is Baahubali's Mahishmati, used *only* as a lesson in scale and staging. Copyrighted film environments must not be reproduced.

### 4.2 Production approach: how it got here [verified from git and docs]

| stage | approach | outcome |
|---|---|---|
| Phase 1 (26 Oct) | real-time Three.js: procedural architecture, Blender-scripted kit, CC0 textures, synthesized audio | Technically good. **Visual quality rejected** after independent review. Preserved at tag `phase1-realtime` [local only] |
| Durbar proof (26–27 Oct) | one canonical **Blender/Cycles** master scene, rendered stills and camera paths | Architecture and composition **approved over three review rounds**. Final production render was authorised, then **stopped by Jatin's priority change** [local only, branch `durbar-visual-proof`] |
| **AI Cinematic Edition (27 Oct →)** | three **AI-generated video clips** (Google; the masters carry Google C2PA manifests) joined into one interactive entrance in React | **Current direction.** V1 visuals and typography approved; V1.1 playback repair delivered and published |

**Priority change (27 Oct 2026, still in force):**
- AI video generation is the priority.
- No Blender rendering.
- No procedural 3D development.
- No new room implementations without approval.
- No deployments.

### 4.3 Approved visual decisions

| decision | status |
|---|---|
| Exterior, gateway and courtyard clips (the masters listed in §10) | **approved** [verified: docs, manifests] |
| Homepage typography: *The Unfinished Empire* / *Not inherited. Still becoming.* / **Enter the Empire**, in Cormorant Garamond and Jost, set low over the dark cliff | **approved** (Jatin, V1 review: "The typography and visuals are approved") |
| Minimal editorial UI: no giant cards, glowing buttons, random particles or SaaS styling | **approved** (V1 brief) |
| Courtyard as the navigational hub; destinations anchored to visible architecture rather than floating cards | **approved** (V1 brief) |
| One moving video at a time; edits chosen from decoded frames (§9) | delivered in V1.1. Jatin has not objected; the edits were chosen by eye and documented |
| Durbar: monumental hall, ceremonial axis, empty niche, no throne, brass **yantra** as the engineering artefact, controlled camera with a **maximum pitch of about 8.5°** | approved in the Blender rounds [historical]. These preferences carry over to the Veo Durbar (§16) |
| Cinematic 3D realism, not cartoon; natural, controlled light; rich craftsmanship without excess gold, bloom or clutter | approved across all rounds |

### 4.4 Things explicitly rejected [historical]

- **Visual clichés:** floating planets, neon galaxies, endless particle fields, purple gradients, glassmorphism, generic floating 3D cards, "a developer sitting at a computer", a Bruno-Simon-style miniature world, and unrelated 3D rooms.
- **Durbar failures:** looking like an ordinary museum, a corridor, a copied film throne room, or an office dressed up as a palace.
- **Forced experiences:** forced walkthroughs, forced replays and mandatory game controls.

## 5. Homepage introduction and portrait reveal

### 5.1 What is implemented (V1.1) [verified: `src/App.tsx`, `src/components/Title.tsx`, `src/engine/Director.ts`]

1. **The film.** The exterior aerial plays once, muted and inline. *Enter the Empire* is visible within about 0.2 s.
2. **The held frame.** When the film ends, it hands over to the identical decoded last frame (41–42 dB match), and the remaining zoom eases to rest. That still is the homepage backdrop.
3. **Enter.** Enter plays the gateway, then the courtyard, then arrives inside, where the five markers fade in.
4. **Never forced.** Skip (button or Esc), Back, the Rooms menu, deep links and reduced motion all work, and visitors are never forced to replay.

### 5.2 The portrait reveal: planned, **not designed or implemented** [needs approval]

Agreed intent (latest planning discussion, §20):
- After entering the palace, the site reveals **Jatin's real portrait in full**, using the strongest authentic photograph chosen from 3–5 candidates.
- **Jatin's facial identity must never be replaced or materially altered by AI generation.** The reveal uses a real photograph, not a generated likeness.
- Undecided: where exactly the reveal happens (courtyard arrival, Durbar, or a dedicated moment), how it is staged, and what copy accompanies it. These are V1.3 design questions; they wait for the photographs (§15, §21).

## 6. The five approved destinations

[verified: `src/content/destinations.ts`]

Anchors are source-pixel points (1920×1080) on the courtyard's final frame. In V1.1 every room opens an HTML panel that says it is not open yet. **No room content exists.**

| # | id / route | name · theme | anchor (px) | architecture it sits on | current panel status | intended content [historical / stated] |
|---|---|---|---|---|---|---|
| 1 | `durbar` · `#/courtyard/durbar` | **Durbar · Engineering** | (958, 452) | the great cusped arch on the main axis | "In preparation — the Durbar is being built as its own scene." | Engineering responsibility, important projects, architecture and decision-making. Work is shown "as working instruments, not screenshots", around a central technical artefact (the yantra concept). Uses sanitised architecture diagrams and work photographs (§15C, §17). **Next Veo scene** (§16) |
| 2 | `music` · `#/courtyard/music` | **Music Chamber · Music** | (960, 196) | the pavilion above the central iwan | "Future destination" | A Phool Mahal–inspired mehfil and contemporary music space with guitar, keyboard and drums/cajón (the Phase 1 brief's "kahoot" was read as cajón). **Real recordings** and photographs of Jatin, with Dastaan rehearsals as real exhibits. Placeholder audio must never be presented as Jatin's playing |
| 3 | `library` · `#/courtyard/library` | **Library · Ideas** | (468, 446) | the shaded upper gallery of the west range | "Future destination" | A royal manuscript room: original writing, ideas, reading and business experiments |
| 4 | `workshop` · `#/courtyard/workshop` | **Workshop · Experiments** | (1462, 712) | the ground-floor arcade of the east range | "Future destination" | A royal karkhana: technical projects, prototypes and tests, "including the ones that fail" |
| 5 | `unfinished` · `#/courtyard/unfinished` | **The Unfinished Wing · Future** | (1712, 200) | the corner pavilion where the east range turns out of view | "Under construction by design." | The future, and what is still being built. Copy: "Past the corner pavilion the palace is still being built. Not inherited. Still becoming." |

**Planned order** (§21):
1. the **Durbar** first;
2. then the **Music Chamber**;
3. then the Library, Workshop and Unfinished Wing, later.

**Earlier ideas, not part of the approved five** [historical]: the Phase 1 brief also planned a Travel Courtyard, a Reflection Terrace and a Temple Courtyard. They are not in V1.1. Travel and personal-life photographs (§15D) still need a home; that is an open design question for V1.3.

## 7. Development history

Dates are 2026.

| when | what | where | status |
|---|---|---|---|
| 14 Oct | Capability check; first brief *"The Unfinished Universe"*; research; concept "Between Stations" | local conversation | superseded |
| ~25–26 Oct | Creative-direction revision: three cinematic 3D concepts; **Rajasthan palace approved** | local conversation | approved direction |
| 26 Oct | **Phase 1** real-time Three.js vertical slice: exterior, gate, courtyard, Durbar with yantra, unfinished wing; synthesized audio; HTML fallbacks | `/Users/rex/jatinmittal-universe`, `main` `341bb7e`, tag `phase1-realtime` | [local only] preserved; visuals rejected |
| 26 Oct | **Phase 1 visual rebuild**: new strategy of one canonical Blender scene, rendered stills and transitions | branch `durbar-visual-proof`, `fe3b95e` | [local only] |
| 26 Oct | Durbar **round 2**: column craft, five-step dais, canopy, camera preview, benchmark | `924e661` | [local only] approved |
| 27 Oct | Durbar **round 3**: finished opening, dome reveal (pitch ≤ 8.5°), arrival, panorama handoff prototype; "approved for controlled cinematic production" | `852518f` (+ uncommitted final-render work in that working tree) | [local only] **stopped** by the priority change |
| 27 Oct | **AI Cinematic Edition V1**: React site from the three approved clips | worktree `/Users/rex/jatinmittal-universe-ai`, branch `ai-cinematic-edition`, `0e9fab4` | [local only] |
| 27 Oct | Jatin reviewed a 37 s recording: **"typography and visuals are approved, but the experience feels stuck… transitions … not fluid"** | — | — |
| 27 Oct | **V1 playback diagnostic** (measurement only) | `925fbd4`, tag `v1-checkpoint`; report `docs/V1-PLAYBACK-DIAGNOSTIC.md` | in this repo |
| 27 Oct | **Priority change**: stop Blender; AI Cinematic Edition only | — | in force |
| 27 Oct | **V1.1 cinematic playback repair** | `3607a90`, tag `v1.1`; report `docs/V1.1-PLAYBACK-REPAIR.md` | in this repo |
| 27–28 Oct | Independent copy prepared: web encodes, security audit, fresh-clone verification. **Published** as this public repo under Jatin's noreply identity | **`main` `cee4eef`** (single commit) | **on GitHub** |
| 28 Oct | **V1.2 cinematic quality pass**: clarity investigation, encode candidates, comparison page | branch `v1.2-quality`, `b8d7236`; report `docs/V1.2-QUALITY-REPORT.md` on that branch | [local only] **not pushed, not approved** (§14) |
| 2–3 Nov | This handoff; preproduction plan agreed (§20) | `main` | this commit |

**Note on references.** Older reports in `docs/` cite commits such as `0e9fab4`, `925fbd4`, `3607a90` and tags `v1-checkpoint` / `v1.1`. Those belong to the *development* repository, not to this one. This repository's history starts at `cee4eef`, which equals V1.1 with web-encoded media.

## 8. Current application architecture

[verified: source on `main`]

**Stack:**
- React 18 + TypeScript 5.9 + Vite 7;
- [`motion`](https://motion.dev) 12 for animation;
- self-hosted fonts through `@fontsource` (Cormorant Garamond, Jost; OFL-1.1);
- no backend, analytics, CDN or external requests;
- servers bind to `127.0.0.1`;
- Node ≥ 20.19.

```
index.html, src/main.tsx      entry; applies the ?edit= override (scenes.ts)
src/App.tsx                   phases (home → entering → arrived), routes, controls, rooms, failure notices
src/media/manifest.json       the clip manifest (paths, 1920×1080, 24 fps, 192 frames, stills)
src/media/scenes.ts           per-clip framing (focal points, letterbox), the joins (edit style, park/cut frames,
                              pre-roll), the ?edit= override
src/engine/SceneManager.ts    pool of <video> elements: lazy creation, preload-next, park on a decoded frame,
                              presented-frame tracking (requestVideoFrameCallback, rAF fallback), whenFrame, release
src/engine/Director.ts        cancellable Seq sequences: intro, enter, replay, arrive, home; edits; holds; seen policy
src/engine/threshold.ts       HeldFrame: pre-compiled WebGL canvas holding the outgoing frame for dissolve/threshold
src/engine/cover.ts           coverPlate(): explicit cover framing shared by video, still and hotspots (+ clamped pan)
src/engine/route.ts           hash routes and history
src/components/               Layer (plate: video + identical still + anchored children), Hotspots, Panel, Title, Controls
src/content/destinations.ts   the five rooms: anchors, labels, copy
src/harness/, harness.html    edit-comparison harness (recordings + live links for every edit combination)
scripts/                      probe-media, extract-posters, analyse-clips, analyse-joins, validate (65 checks),
                              lib/browser.mjs (finds Chrome for Testing), media/ (encode + colour-retag tools)
diagnostics/                  instrumented journeys, transition analysis, screencast captures
docs/                         engineering reports (this file, V1, V1.1, MEDIA, VERIFICATION)
```

**Routes:** `#/` (exterior/home), `#/courtyard`, `#/courtyard/<durbar|music|library|workshop|unfinished>`.

The films are journeys *between* routes, never routes themselves. Back, Forward, deep links and reloads therefore always land on a still scene.

**Controls** (full list in [`README.md`](../README.md)):
- Skip (Esc); Back to exterior; Return to courtyard; Replay;
- the Rooms menu; keys 1–5; ←/→ between markers;
- the sound toggle (M; off by default, persisted, but there is no audio yet);
- drag/swipe pan on phone portrait; reduced-motion mode.

## 9. Cinematic sequence and transition implementation

[verified: `src/media/scenes.ts`, `src/engine/Director.ts`, `docs/V1.1-PLAYBACK-REPAIR.md`]

**The core rule:** never more than **one moving video** on screen.
- The incoming clip is **parked** under the outgoing layer, paused on a decoded frame.
- It is started while still covered, and revealed in the frame callback of its **first steady presented frame**.
- In that same rendering update the outgoing layer is hidden (a cut) or replaced by a static **held copy** of the frame on screen (WebGL `HeldFrame`), which then clears (a dissolve).

| join | default edit | details |
|---|---|---|
| Exterior → gateway | **0.5 s held-frame dissolve**, no zoom | The gateway is parked on frame 0 from 1.5 s into the intro. The title starts clearing about 6 ms after Enter. A 0.3 s lead-in, then the gateway starts covered. The courtyard is fetched and parked once the gateway plays |
| Gateway → courtyard | **doorway match cut: gateway frame 189 → courtyard frame 8** | The courtyard is parked on frame 1 and started 7 gateway frames early (compensating a measured ~300 ms start-up when started under another clip). A backstop cuts anyway if the gateway passes 189 |
| Courtyard → inside | swap to the identical decoded last frame, settle ease | The markers fade in one by one |

**Other mechanics:**
- **Cancellation.** Every command runs as a cancellable `Seq`. Each await is guarded, animations and timers stop, and unused clips are released. Double Enter is ignored.
- **Seen policy.** Enter marks the entrance as seen, so a later Enter cross-fades straight in; only *Replay the entrance* replays it.
- **Alternatives.** Cut, dissolve and threshold variants exist for both joins. Try them with `?edit=` or `/harness.html`.

**Constraint for all future work** (Jatin's V1.2 brief):
- preserve the single-moving-video strategy and the cancellation safeguards;
- **do not use longer crossfades to hide architectural differences**.

## 10. Media inventory

[verified: `docs/MEDIA.md`, `npm run probe`, SHA-256]

| asset | in this repo | details |
|---|---|---|
| `public/media/exterior.mp4` | yes | 1920×1080, H.264 High, 192 frames @ 24 fps, 8.000 s, 9.6 Mb/s, **9.6 MB**, faststart, no audio |
| `public/media/gateway.mp4` | yes | same format, 9.7 Mb/s, **9.7 MB** |
| `public/media/courtyard.mp4` | yes | same format, 9.6 Mb/s, **9.6 MB** |
| `public/posters/*-{first,last}.jpg` | yes | six stills decoded in Chromium, JPEG q 0.92, ≈ 3.4 MB |
| **Masters** (approved originals) | **no** | 21.6 / 37.8 / 41.1 MB (100.4 MB), 21–41 Mb/s, not faststart. AI-generated, with Google C2PA manifests. Held locally [local only] at `/Users/rex/jatinmittal-universe/ai-cinematic-edition/media/`. SHA-256 in `docs/MEDIA.md` |
| Blender Durbar renders, Phase 1 assets | no | [local only], development repository |
| V1.2 candidate encodes, review recordings | no | [local only], git-ignored `public/variants/`, `public/review/` (§14) |

**How the web encodes were made:**
- Apple `avconvert` (Preset1920x1080), from copies of the masters whose H.264 colour description was retagged from sRGB to BT.709 transfer.
- Without the retag, the encodes rendered about 6% darker in Chrome.
- Every encode keeps the exact frame structure, so the edit points are unchanged.
- Tone matches the masters within 0.5/255.

**Storage and bandwidth:**
- Storage is plain Git, with no LFS; the largest file is 9.7 MB.
- Every replaced clip stays in Git history permanently, so consider LFS or external storage *before* frequent media churn.
- A full first visit downloads ≈ 29 MB of video, ≈ 19 MB of it before Enter.

**Licensing: open, unresolved.**
- There is no `LICENSE` file, so all rights are reserved by default.
- Jatin has **not yet confirmed** that the video generator's terms allow public redistribution of the clips.

## 11. Playback diagnostics and fixes

[verified: `docs/V1-PLAYBACK-DIAGNOSTIC.md`, `docs/V1.1-PLAYBACK-REPAIR.md`]

Jatin's complaint after V1 was that it "feels stuck… not fluid". The diagnostic found three causes:

| cause | kind | V1.1 fix |
|---|---|---|
| **A.** A Blender Cycles render running on the same GPU (first frame 948 ms vs 152 ms; Enter 334–354 ms vs 30 ms) | environmental stall | Blender stopped. Always test on a clean GPU |
| **B.** Two playing videos blended on screen → Chrome compositor collapse (12–15 fps presented, 31–45 skipped frames, rAF ~30 Hz) | architectural stall | Single moving video: park → covered start → reveal on the first steady frame; held-frame canvas for dissolves |
| **C.** Joins built from freeze-frames and zooms on a frozen frame (a 14% push on the frozen exterior; the gateway ending 0.6 s into a 0.95 s dissolve) | edit design | The push was removed; a 0.5 s dissolve; the doorway match cut 189 → 8 chosen from decoded frames |
| Navigation races (replay, double Enter, leaving mid-film) | logic | Cancellable `Seq`, seen policy, and validation races R1–R10 |

**V1.1 measurements** (production build, clean GPU, 1440×900 @2):
- 1 visible moving video per join;
- 0 skipped frames;
- rAF max ≈ 9.4–10.4 ms;
- the cut lands on 189 → 8 in every run;
- click → first screen change 5–7 ms.

## 12. Automated tests and verification evidence

[verified]

- **`npm test` / `scripts/validate.mjs`: 65 end-to-end checks** in Chrome for Testing 147. They cover:
  - the full journey;
  - held stills against the decoded last frames (41.4–42.7 dB);
  - hotspot alignment (0.00–0.03 px error on desktop, phone portrait and phone landscape);
  - loading order;
  - keyboard and touch;
  - Back/Forward and deep links;
  - Skip and Replay;
  - reduced motion;
  - refused autoplay, a missing clip and a hidden tab;
  - one moving video (per-frame sampler);
  - navigation races R1–R10.
- **Results on V1.1 `main`: 65/65** against the production build and **65/65** against the dev server, from a fresh clone (`docs/VERIFICATION.md`).
- **Fresh clone:** `npm ci` reported 0 vulnerabilities; the build passes (main JS ≈ 101.5 kB gzip); all requests go to `127.0.0.1`.
- **Not verified:** Safari, Firefox, real phones, Windows and Linux hosts.
- **Check run for this handoff commit:** see the commit message and §24.

## 13. Known continuity problems and technical limitations

[verified: README "Known issues", V1.1 and V1.2 reports]

1. **Exterior → gateway joins different worlds.** It goes from a golden-hour aerial to a blue-sky ground shot, and the gateway's gate is not the gate on the exterior.
2. **Gateway → courtyard changes the building.** A sandstone pointed-arch gate becomes a red-sandstone cusped gate with twin chhatris. It is a cut-in on a door, but a different door.
3. **The courtyard shows no unfinished architecture.** The exterior and gateway show scaffolding, the courtyard doesn't, so the Unfinished Wing marker sits on a corner pavilion.
4. **Colour and time-of-day drift.** Mean level rises from 74 to 90 to 110 across the three clips, and the sky goes from amber to blue to pale haze.
5. **The exterior has a burned-in letterbox** (10.7% top and bottom). It is cropped away, so the exterior is the softest clip.
6. **Phone portrait is a tight crop** (≈ 26% of the frame width). On a phone the gateway → courtyard cut lands at **184 → 3**, not 189 → 8, in both V1.1 and V1.2. A fix was tried and reverted because it added skipped frames.
7. **No soundtrack.** The sound toggle has nothing to play.
8. **Delivery weight:** ≈ 29 MB per full visit.
9. **AI artefacts:** "melted" carving, an indistinct jaali, edge halos on the exterior, and softness at about 2× magnification on high-density screens.
10. **Only 1080p, 8 s clips; no rooms built; untested outside Chromium.**

Only **new generations** can fix items 1–5 and 9. The encoder and the code cannot.

## 14. V1.2 media-quality investigation (unmerged, unapproved)

> **Status: [local only] candidates for review. NOT approved, NOT merged, NOT pushed.** The approved site media are
> still V1.1. Nothing in this section is on `main`. The branch is `v1.2-quality` at `b8d7236`, in
> `/Users/rex/the-unfinished-empire` on the development machine; its report is `docs/V1.2-QUALITY-REPORT.md`, on that
> branch only. The candidate files are git-ignored.

**Why the picture looks soft:**
- **Presentation magnification, ≈ 2× on high-DPI laptops.** The exterior is stretched 2.1–2.65× because of its letterbox crop; gateway and courtyard 1.7–2.1×. Chrome's scaling itself is fine.
- **The generated texture itself.** The masters are genuinely 1080p.
- **The V1.1 encode is secondary.** It loses about 12% of the finest-band detail on the gateway and courtyard.

**Candidates:**

| id | encode | total size | finest detail kept (gateway / courtyard) |
|---|---|---|---|
| `v11` | current | 29.0 MB | 87 / 88% |
| **`avc-q27`** (Claude's recommendation) | H.264 constant QP 27 | 68.5 MB | 95 / 93% |
| `avc-q24` | H.264 constant QP 24 | 96.5 MB | 96 / 94% |
| `hevc-q28` | HEVC QP 28; needs an H.264 fallback | 53.4 MB | 94 / 94% |

**Playback with every candidate:**
- 1 moving video;
- 0 skipped frames in the joins;
- the cut lands on 189 → 8;
- costs: +200–300 MB browser RSS, and 2.4× the bytes for avc-q27.

**Tests:** 65/65 with avc-q27, on both the production build and the dev server.

**Deliberately not done:** no 4K upscaling, no sharpening, no new footage.

**Decision pending from Jatin:**
- Compare the candidates in `/quality.html` (local) and choose avc-q27, another candidate, or V1.1.
- Only after that approval may the media be replaced, and the branch be merged and pushed.

## 15. Personal photography and asset requirements

### 15.1 What the old portfolio already contains

[verified: audit of https://github.com/Jatinmittal0408/portfolio at `350e800`]

This answers the requirement that Jatin should not resubmit photographs that already exist.

| file (in the old repo) | size | what it is | usable as an authentic personal photo? |
|---|---|---|---|
| `IMG_0764.heic` (root) | 3024×4032 | **Real photograph of Jatin**: standing, half to full body, smiling, white shirt, **sunglasses**, at a crowded riverside ghat | **Candidate** for the standing/half-body or travel slot. Limits: sunglasses hide the eyes; identifiable bystanders in the background would need cropping or blurring; the busy background is wrong for a hero portrait |
| `assets/images/profile.jpg` (= `guitar_raw.jpg` = `0EC36EA0-….jpg`, byte-identical) | 914×1626 | **Real candid**: in profile, cap, carrying a guitar case, hills behind | **Candidate** for the candid and Music/Travel slots. Limits: a phone-story screenshot with blurred bars top and bottom; low resolution; face in profile; strong teal grade |
| `assets/images/profile.png` | 1024×1536 | Jatin in a black hoodie and sunglasses, against a server-room bokeh background | **Appears AI-generated or AI-stylised** (synthetic background, smoothed skin). **Must not be the portrait** unless Jatin confirms it is an unaltered photograph, because of the facial-identity rule |
| `guitar.jpg`, `trekking.jpg`, `cooking.jpg` | 800 px | Stock-style photographs: a guitar on an amp, two hikers in Patagonia-like mountains, a pasta dish | **Not Jatin.** Do not use them as personal photographs |
| `cicd.jpg`, `cost-optimization.jpg`, `k8s-optimization.jpg`, `migration.jpg`, `monitoring.jpg`, `security.jpg` | 640×640 | AI-style illustrations of pipelines and dashboards, with third-party product names | **Not personal; not real architecture.** Do not use |
| `JatinMittal_Devops_Resume.pdf`, `resume.pdf` | — | two résumé versions (§17) | **Source for the professional timeline only.** Both contain a phone number: never copy it |

**Conclusion.** The old repository has **at most two authentic photographs** of Jatin, and **neither is a clear, unobstructed face portrait**. It has **no** keyboard, stage, Dastaan, workstation or presenting photographs, and **no** videos.

### 15.2 What Jatin still needs to provide

From the agreed plan, §20:

| set | needed | priority | gap after the audit |
|---|---|---|---|
| **A. Portrait** | 3–5: one clear face photograph, one standing or half-body, one natural candid, plus optional alternates | **Highest** | **The clear face photo is missing** (no eyes-visible, unobstructed portrait). A better half-body is also needed. The candid can come from the guitar/hills photo for now |
| **B. Music** | 3–5 photographs + 1 video: guitar performances, keyboard, stage moments, Dastaan rehearsals or band, natural instrument photographs | High | **All missing** apart from the guitar-case candid. No performance video at all |
| **C. Engineering** | 1–3: working, presenting or demonstrating, at a workstation or technical setup | Medium | **All missing.** Screens must show nothing confidential (§18) |
| **D. Personal life** | a curated selection: travel, trekking, memorable experiences, genuine interests | Medium | Only the ghat photo. The "trekking" image in the old site is stock |

**First submission:** Jatin's best 5–10 photographs. The reviewer (GPT or Claude) then:
1. ranks them;
2. names the strongest portrait candidate;
3. lists the specific remaining gaps.

**Rules for personal assets:**
- Photographs are **not committed or published until Jatin approves each one**.
- Keep originals out of Git; commit only approved, web-sized, metadata-stripped (EXIF/GPS) derivatives.
- Never AI-alter Jatin's face. Lighting and grade adjustments for visual integration are acceptable only if Jatin approves them.
- Blur or crop bystanders.

## 16. Durbar Veo generation plan

**Status: [needs approval]. No generation has been made.**

### 16.1 Scope

**Scenes:**

| scene | status |
|---|---|
| Exterior | approved |
| Gateway | approved |
| Courtyard | approved |
| **Next: Durbar (Engineering Hall)** | to be generated |

**Size of the first step:** **one 8-second establishing shot first**, then review. Do not generate all the rooms at once.

**Room order:** the Music Chamber comes after the Durbar; the Library, Workshop and Unfinished Wing come later.

### 16.2 Creative brief for the Durbar shot

**What it is.** An architectural metaphor for Jatin's engineering mind: monumental structure, precision, systems and interconnected components. Interconnection must read as architecture and craft, not as screens or neon.

**It must not look like:**
- an ordinary museum;
- a copied film throne room;
- an office disguised as a palace.

**Visual requirements:**
- Rajasthan palace architecture, from Jaipur City Palace interiors (Sabha Niwas, Diwan-i-Khas) and the Rajasthan forts (the Amber Diwan-i-Aam, Mehrangarh's Phool Mahal);
- cinematic 3D realism, not cartoon-like;
- monumental scale and rich craftsmanship;
- natural, controlled light;
- **no throne**, with the niche or dais left empty;
- **controlled camera tilt, no more than about 8.5°**;
- a strong establishing composition that leaves clear space for interactive engineering exhibits.

**Continuity with the approved clips.** The Durbar is entered from the courtyard's great cusped arch on the main axis, at the Durbar marker. Its stone and palette should be compatible with the courtyard clip's red sandstone and warm haze.

**Technical targets for the generation** (from §13/§14):
- the highest resolution the tool offers (1440p/4K if available; 1080p otherwise);
- **full-frame 16:9, no letterbox bars**;
- a camera that **ends nearly still**, so a held final frame works as the interactive base;
- crisp, physically plausible carving: avoid "melted" ornament and haloed edges;
- no people;
- no on-screen text.

### 16.3 Canonical architecture description

This is a draft, derived from the approved Blender Durbar [historical]. Reuse it across generations:

> A monumental Rajput audience hall. Raised on a plinth. A long nave of **paired giant marble columns** (about 10 m,
> slender, lotus capitals and carved toda brackets) carrying **13-lobed engrailed arches**, with aisles either side.
> **Red Dholpur-type sandstone** structure and aisle walls in red and ivory polished lime plaster; **white Makrana-type
> marble** for columns, arches and floor. A **taller 15-lobed triumphal arch** opens to a domed crossing. Beneath it,
> a five-step marble dais under a marble canopy, and an **empty** darshan niche glowing through a large marble jaali.
> At the dais, a large **brass armillary yantra** in the spirit of Jantar Mantar instruments, the hall's engineering
> artefact. One decorative scheme throughout: scrolling floral vine relief, the khatam eight-pointed star in floor
> inlay and jaali, restrained gilding and mirror work; Ragamala paintings only in aisle niches. Late-afternoon
> sunlight through high openings; calm, deep, warm interior shadows. No throne, no figures, no text.

**Needs Jatin's approval:**
- whether the yantra stays the central artefact in the Veo version;
- what "systems and interconnected components" should look like architecturally (for example: rhythmically repeated, interlocking structural members; instrument-like precision in brass).

### 16.4 Image-to-video and reference images

**What can and cannot be verified here.**
- Claude has no access to Jatin's Veo account, plan or interface, so it cannot confirm which mode his workflow supports.
- The approved masters carry Google C2PA manifests, which confirms they came from Google's generation pipeline. They do not record which product, tier or mode was used.

**What Google's public documentation says** (checked 3 Nov 2026):
- Veo 3.1, in the Gemini API and in Flow, supports **image-to-video from a first frame**.
- It supports **first-and-last-frame** generation.
- It supports **up to three reference images** ("ingredients") for a scene, character or object.
- At least one third-party source says some tiers (Fast) or mode combinations (first frame together with reference images) are not supported.

Sources: [Google Developers Blog: Introducing Veo 3.1](https://developers.googleblog.com/introducing-veo-3-1-and-new-creative-capabilities-in-the-gemini-api/), [getimg.ai review](https://getimg.ai/blog/google-veo-3-1-review), [Scenario help: Veo 3.1 essentials](https://help.scenario.com/articles/1049410120-veo-3-1-the-essentials).

**Action for Jatin before generating:** confirm in his own Veo workflow whether a first frame, a last frame or reference images can be supplied, and on which tier.

**Decision rule:**
- **If image conditioning is available**, use an **approved reference image** to improve continuity. Candidates:
  - the courtyard's held last frame, `public/posters/courtyard-last.jpg`, to match palette and stone;
  - an approved still of the Durbar entrance;
  - with Jatin's explicit approval only, a Blender Durbar render [local only] as an architectural reference.

  Using the Blender render as a reference is **not** a restart of Blender work.
- **If only text-to-video is available**:
  - do **not** promise exact architectural continuity across separate generations;
  - use the canonical description in §16.3 verbatim;
  - join scenes with **deliberate editorial cuts**, a doorway or threshold cut as in V1.1, not with long crossfades.

**Next step.** GPT and Jatin turn §16.2–16.4 into the exact Veo prompt (§20, last paragraph). Jatin reviews the first 8-second result before anything else is generated.

## 17. Professional timeline and engineering content

### 17.1 Timeline

> Every row below needs Jatin's confirmation before publication. Sources: the old portfolio's `Experience.tsx`
> (13 Mar 2026), `JatinMittal_Devops_Resume.pdf` and `resume.pdf` (both in the old repo, undated), and Jatin's own
> statements. **The sources disagree**, so the conflicts are listed rather than resolved.

| period | organisation | role / title as written | source | conflicts to resolve |
|---|---|---|---|---|
| **May 2026 → present** | **Aiko / Xansrmedia** | DevOps / SRE / platform engineering | [stated by Jatin] | In **neither** résumé. Exact title, start date, public company name and whether it may be mentioned at all need confirmation |
| Apr 2025 → (May 2026?) | **Park+** (ParkPlus), Gurugram | "DevOps & Site Reliability Engineer" / "Platform / DevOps Engineer" / "DevOps Engineer" | résumés, old site | Three different titles. Both résumés say "Present", so the end date must be confirmed |
| Jan 2024 (or Apr 2024) → Apr 2025 | **Insight Solutions**, Delhi | "Cloud Security Engineer II" / "Cloud Engineer II (Promoted)" / "Cloud & DevSecOps Engineer → Engineer II" | résumés, old site | Start of the Engineer II role differs (Jan vs Apr 2024) |
| Oct 2022 (or Jun 2022 / Apr 2023) → Dec 2023 / Apr 2024 | **Insight Solutions (formerly Hanu Solutions)** | "Cloud Engineer"; joined as Associate in his final year of college | résumés, old site | The old site lists Hanu Solutions Jun 2022–Mar 2023 and Insight from Apr 2023; the résumés say Insight (formerly Hanu) from Oct 2022 |
| 2019 → 2023 | SKIT, Jaipur | B.Tech, Computer Science | both résumés | — |

### 17.2 Possible case studies

These are themes from the résumés, the old site and Jatin's own public repositories. **None is approved for publication.**

| theme | evidence available | publication risk |
|---|---|---|
| Hybrid-cloud migration (GCP → another provider) with IPsec/BGP networking and staged traffic cut-over | résumé text | **High.** Employer architecture and scale. Only a sanitised, generic narrative is possible, with employer approval |
| Large MySQL migration with zero data loss, binlog replication, PITR | résumé text | High, for the same reasons |
| Cost optimisation and rightsizing | résumé text, old site | High. The résumés give **internal cost and capacity figures; do not reuse them without approval** |
| SLO-driven alerting, runbooks, MTTR reduction | résumé text | Medium. Methods are fine; employer metrics are not |
| Hardened VM golden image (Packer + Ansible, Lynis) | public repo [`ansible-server-hardening`](https://github.com/Jatinmittal0408/ansible-server-hardening) | Lower, if it is shown as Jatin's own public code |
| Wazuh SIEM deployment | public repo [`wazuh-docker-deployment`](https://github.com/Jatinmittal0408/wazuh-docker-deployment) | Lower, as public code; employer scale figures excluded |
| Terraform GCP, Kubernetes monitoring, ArgoCD GitOps, CI/CD pipeline, cloud cost optimizer, CI/CD architecture | public repos [`terraform-gcp-infrastructure`](https://github.com/Jatinmittal0408/terraform-gcp-infrastructure), [`kubernetes-monitoring-stack`](https://github.com/Jatinmittal0408/kubernetes-monitoring-stack), [`argocd-gitops-deployment`](https://github.com/Jatinmittal0408/argocd-gitops-deployment), [`cicd-pipeline-kubernetes`](https://github.com/Jatinmittal0408/cicd-pipeline-kubernetes), [`cloud-cost-optimizer`](https://github.com/Jatinmittal0408/cloud-cost-optimizer), [`cicd-architecture-gcp`](https://github.com/Jatinmittal0408/cicd-architecture-gcp) | Low as public code. **Their contents were not audited for this handoff.** Review them before featuring any |
| This website itself (cinematic engine, measured playback repair) | this repository | **Safe.** Fully Jatin's, fully public. Phase 1 already used it as "Engineering record 01" |

**Rules for engineering content:**
- **Distinguish verified facts from claims.** Every metric must be confirmed by Jatin, be safe to publish, and be attributable to his own contribution: "led", "built" and "contributed to" are different claims. **Do not claim ownership of team work.**
- **What the old site and résumés contain.** They include specific scale, cost, latency and deployment figures and client names. They are deliberately **not copied here**: treat them as unapproved internal operational metrics and customer information.
- **Diagrams in the Durbar.** Use **sanitised architecture diagrams**: generic components, no internal names, domains, project IDs, IP ranges, vendor account details or customer names.

## 18. Privacy, confidentiality and public-repository rules

[from Jatin's standing instructions; all in force]

- **Never commit or publish:**
  - employer-confidential architecture, internal URLs or domains, project IDs, credentials, tokens or secrets;
  - dashboards or screens, customer data, internal operational metrics.
- **No fabricated content:**
  - no invented achievements, awards, companies or success stories;
  - no claiming ownership of team work;
  - placeholder content is clearly labelled.
- **No private history.** No family finances, childhood trauma or personal loss.
- **Personal photographs:**
  - not published until Jatin approves each one;
  - metadata stripped;
  - no AI alteration of his face.
- **Git identity:**
  - commits to this repository use the **noreply** identity `Jatin Mittal <84990849+Jatinmittal0408@users.noreply.github.com>`, set in the **repository-local** git config;
  - **do not modify global git config**;
  - **no employer email address may appear in this repository**;
  - contact details such as phone numbers stay out of the repository.
- **GitHub session:** use the existing authenticated GitHub session; never request, print or store passwords or tokens.
- **Do not publish:**
  - the old development worktrees;
  - Blender renders or `.blend` files;
  - diagnostic recordings or review videos;
  - masters;
  - unrelated branches.
- **Assets:** only CC0 or properly licensed assets; record their provenance.
- **Before any public deployment:**
  - Jatin chooses a LICENSE;
  - Jatin confirms the AI generator's terms allow redistribution;
  - **no deployment without explicit authorisation.**

## 19. Approved decisions vs decisions awaiting approval

### Approved (do not change without Jatin)

- **Direction:** The Unfinished Empire, the Rajasthan palace metaphor and the signature line.
- **Media:** the three approved clips (exterior, gateway, courtyard) and their V1.1 web encodes as the site's media.
- **Design:** the homepage typography, editorial copy, UI design, courtyard layout, room names and navigation behaviour.
- **Destinations:** the five, with their anchors.
- **Playback:** the single-moving-video playback architecture and the cancellation safeguards.
- **Rooms:** Durbar = Engineering, with no throne and an empty niche; a controlled camera (tilt ≤ about 8.5°).
- **Priority change:** no Blender, no procedural 3D, no deployments.
- **Repository:** the public repository with V1.1 on `main` as the stable checkpoint.
- **Plan:** the preproduction-before-V1.3 sequence (§20, §21).

### Awaiting Jatin's approval

| item | where it stands |
|---|---|
| V1.2 media candidate (avc-q27 recommended) vs keeping V1.1 | local comparison ready (§14) |
| LICENSE choice; AI-generator redistribution terms | open since publication |
| Portrait choice and the design of the portrait reveal | needs photographs (§15) |
| Which Veo mode is available; the exact Durbar prompt; the first Durbar clip | §16 |
| Whether the yantra remains the Durbar's artefact | §16.3 |
| Professional timeline (titles, dates, current employer mention) | §17.1 |
| Each public-safe accomplishment and metric | §17.2 |
| Where travel and personal-life photographs live (a new room? the Library? the Unfinished Wing?) | §6 |
| Audio and soundtrack (real recordings for the Music Chamber) | not started |
| Deployment, hosting and domain | **not authorised** |

## 20. Latest agreed direction: preproduction before V1.3

> **What this section contains.** It records the decision from the latest planning discussion between Jatin and
> GPT, as Jatin supplied it to Claude in the brief for this handoff (2 Nov 2026). Its meaning and detail are kept;
> it is not reduced to a checklist. Jatin's brief asked for the complete original discussion text to be inserted,
> beginning with "Yes. Before giving Claude the V1.3 implementation prompt, we should collect your photographs and
> prepare the next Veo scenes" and ending with "Then we'll prepare the exact Durbar Veo prompt around the visual
> direction we've established." **That complete text was not included in what Claude received.** The version below is
> the decision as restated in Jatin's brief. Paste the original wording into §20.1 if it should be kept verbatim.
> **The visual reference links** from that discussion were not supplied either, so none are recorded. If they are
> added later, they are **historical references only, not approved assets.**

### 20.1 The decision

**Before giving Claude the V1.3 implementation prompt, we should collect Jatin's photographs and prepare the next Veo
scenes.**

Otherwise, Claude will design around placeholders, and we will have to redesign everything when the real photographs
arrive.

We have enough technical material from the old portfolio to plan the professional content. What we are missing is
the **personal visual identity**.

**A. Jatin's portrait: 3 to 5 photographs. Highest priority.**
- One clear face photograph.
- One standing or half-body photograph.
- One natural candid.
- Optional alternate portraits.

We will select the strongest authentic photograph for the full portrait reveal after entering the palace.
Jatin's facial identity must never be replaced or materially altered by AI generation.

**B. Music: 3 to 5 photographs and one video.**
- Guitar performances.
- Keyboard.
- Stage moments.
- Dastaan rehearsals or band photographs.
- Natural instrument photographs.

These will become real exhibits inside the Music Chamber.

**C. Engineering: 1 to 3 photographs.**
- Jatin working.
- Presenting or demonstrating.
- At a workstation or technical setup.

These can be used alongside sanitised architecture diagrams in the Durbar. Never publish confidential employer
screens, dashboards, internal URLs, credentials or customer data.

**D. Personal life: selected photographs.**
- Travel.
- Trekking.
- Memorable experiences.
- Other genuine interests.

These should communicate personality without turning the portfolio into a social-media gallery.

Initially, Jatin will provide his best 5–10 photographs. They will be reviewed, the strongest candidates identified,
and the specific remaining gaps named. The old portfolio repository is audited for usable images first, so that Jatin
does not resubmit photographs that are already available. That audit is done: §15.1.

**The Veo scenes.** Three environmental scenes exist and are approved: the exterior, the gateway and the courtyard. The next
generation is **the Durbar (Engineering Hall)**.
- **Scope:** one eight-second establishing shot first.
- **Character:** it must not look like an ordinary museum, a copied film throne room or an office disguised as a palace. It is an architectural metaphor for Jatin's engineering mind: monumental structure, precision, systems and interconnected components.
- **Visual preferences to preserve:**
  - Rajasthan palace architecture, inspired by Jaipur City Palace interiors and the Rajasthan forts;
  - cinematic 3D realism, not cartoon-like;
  - monumental scale and rich craftsmanship;
  - natural, controlled lighting;
  - no throne;
  - controlled camera tilt, previously preferred at no more than about 8.5°;
  - a strong establishing composition that can support interactive engineering exhibits.
- **Before generating:** check whether the Veo workflow supports image-to-video or reference-image conditioning.
  - **If it does:** use an approved reference image to improve architectural continuity.
  - **If it only supports text-to-video:** do not promise exact architectural continuity across separate generations. Create a canonical architecture description (§16.3) and use deliberate editorial cuts.
- **Do not generate all the rooms at once.** The Music Chamber comes after the Durbar; the Library, Workshop and Unfinished Wing come later.

**Then we'll prepare the exact Durbar Veo prompt around the visual direction we've established.**

### 20.2 The agreed V1.3 order

**Do not implement V1.3 immediately.** The sequence is:

1. Audit the old portfolio repository and available résumé material. **Done in this handoff** (§15.1, §17).
2. Collect and select real personal photographs.
3. Choose the homepage portrait.
4. Prepare and approve one Durbar Veo scene.
5. Verify and approve public-safe professional accomplishments.
6. Plan the complete V1.3 experience.
7. Only then, implement through Claude.

This prevents redesigning the same interface several times.

## 21. Next steps and development phases

| # | step | owner | done when |
|---|---|---|---|
| 0 | **Decide V1.2:** compare candidates locally; approve avc-q27, another candidate, or keep V1.1 | Jatin (Claude applies) | decision recorded here; if approved, Claude replaces the media, re-runs the 65 checks, merges and pushes |
| 1 | Old portfolio and résumé audit | Claude | **done** (§15.1, §17) |
| 2 | Jatin sends the best 5–10 photographs; they are ranked and the gaps listed | Jatin → GPT or Claude | portrait shortlist and gap list agreed |
| 3 | Choose the homepage/portrait-reveal photograph | Jatin (GPT advises) | one photo approved for publication |
| 4 | Confirm the Veo mode; write the exact Durbar prompt; generate **one 8 s establishing shot**; review; iterate | Jatin + GPT | Durbar clip approved (it then joins the masters, kept outside Git) |
| 5 | Confirm the timeline; choose and sanitise 2–4 case studies; approve every metric | Jatin + GPT | approved content list, with sources |
| 6 | Plan V1.3 end to end (portrait reveal, Durbar integration, courtyard → Durbar transition, exhibits, mobile) | GPT drafts, Jatin approves | an approved, detailed implementation brief |
| 7 | Implement V1.3 on a new branch; test; document; commit; report | Claude | tests pass; Jatin reviews a recording **and** approves visually before merge/push |
| later | Music Chamber (needs the music photos, video and recordings) → Library → Workshop → Unfinished Wing; soundtrack; licence; deployment | — | each is approved separately |

**Do not, until Jatin says otherwise:**
- deploy;
- restart Blender or procedural 3D;
- generate several rooms at once;
- replace approved footage;
- publish personal photographs;
- start V1.3 implementation before step 6.

## 22. Responsibilities: GPT vs Claude

| GPT / ChatGPT | Claude (Claude Code) |
|---|---|
| Understands the overall product and creative direction | **Primary coding and implementation agent** |
| Reviews the repository (this file first) and the project history | Inspects the real repository and machine state before acting |
| Challenges weak design or technical decisions | Implements **approved** tasks only |
| Helps plan architecture and user experience | Maintains the application and its tests (65 checks and growing) |
| Researches tools and visual approaches, including Veo prompts | Updates technical documentation, including this handoff, at each milestone |
| Prepares **detailed, approved implementation briefs** for Claude | Commits completed work to GitHub when authorised, using the noreply identity |
| Reviews Claude's reports and implementation, and identifies gaps | Reports exact changes, test results, measurements and limitations honestly |

**Working agreement:**
- **One designer of record per decision.** GPT and Claude must not independently redesign the same thing.
- **The flow:** GPT plans → Jatin approves → Claude implements → GPT reviews → Jatin decides.
- **Claude's latitude.** Claude may push back on a brief with evidence, but does not silently change the approved design.
- **Approval is visual and Jatin's.** Passing automated tests is not approval.

## 23. Copy-paste prompt for a new GPT conversation

```text
You are continuing work on my personal website project, "The Unfinished Empire" (jatinmittal.com, not deployed).
Repository: https://github.com/Jatinmittal0408/the-unfinished-empire

Before answering anything, read docs/PROJECT-HANDOFF.md in that repository completely, then README.md and the other
documents under docs/. Treat PROJECT-HANDOFF.md as the source of truth for vision, history, approved decisions,
open decisions, privacy rules and next steps. Distinguish what it marks as verified, historical, stated by me, local
only, and needing approval.

Your role (section 22): creative and technical planning partner and reviewer. You understand the product, challenge
weak ideas, research tools and visual approaches, prepare detailed implementation briefs for Claude (the coding
agent), and review Claude's results. You do not redesign approved work without my approval, and you never invent
achievements, metrics or personal history.

Current status: V1.1 is on main (three approved AI clips: exterior → gateway → courtyard, interactive courtyard with
five destinations: Durbar/Engineering, Music Chamber, Library/Ideas, Workshop/Experiments, The Unfinished Wing/Future).
V1.2 media candidates exist only locally and are not approved. We are in PREPRODUCTION before V1.3 (sections 20–21):
collect and select my real photographs (portrait first), prepare and approve one 8-second Durbar Veo establishing shot,
and verify public-safe professional content. V1.3 must not be implemented until those are ready.

Rules: no deployment; no Blender/procedural 3D; no confidential employer information, internal metrics, customer
names, credentials or internal URLs; no AI alteration of my face; no publishing personal photos until I approve
them; no claiming team work as mine; keep historical and proposed decisions clearly labelled.

Start by summarising, in under 15 bullet points, what you understood: what we're building, what exists, what is
approved, what is pending, and the immediate next step. Then ask me only for what you need for that next step.
```

## 24. Appendix: where everything lives

| thing | location | on GitHub? |
|---|---|---|
| V1.1 site, docs, tests | this repository, `main` | yes |
| V1.2 candidates branch | `/Users/rex/the-unfinished-empire`, branch `v1.2-quality` (`b8d7236`) | **no** |
| V1.2 candidate media, review recordings, measurement artefacts | `public/variants/`, `public/review/`, `.generated/quality/`, `diagnostics/out/` in that working copy (git-ignored) | no |
| Approved masters | `/Users/rex/jatinmittal-universe/ai-cinematic-edition/media/` (untracked) | no |
| AI Cinematic Edition dev history (V1, diagnostic, V1.1) | `/Users/rex/jatinmittal-universe-ai`, branch `ai-cinematic-edition`, tags `v1-checkpoint`, `v1.1` | no |
| Phase 1 real-time slice | `/Users/rex/jatinmittal-universe`, `main` / tag `phase1-realtime` | no |
| Blender Durbar proof | `/Users/rex/jatinmittal-universe`, branch `durbar-visual-proof` (`852518f` + uncommitted round-3 work), `cinematic/durbar/README.md` | no |
| Old portfolio, résumés, old images | https://github.com/Jatinmittal0408/portfolio | yes (public) |

**Do not assume the local-only items survive.** Back up the masters and any Blender work Jatin wants to keep.

**How to run this repository:** `npm ci && npm run dev` (http://127.0.0.1:5180). Tests: `npm run browsers` once, then
`npm test`. Full details are in [`README.md`](../README.md).

**Maintaining this file.**
- Claude updates it whenever a decision is made or a milestone lands.
- Every update: change the "Written" date, add a row to §7, and move items between the two lists in §19.
