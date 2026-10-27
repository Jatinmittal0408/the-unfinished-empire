# Media: what is stored, how it was made, what it costs to serve

## What is in the repository

| path | what | size |
|---|---|---|
| `public/media/exterior.mp4` | web encode of the approved exterior clip | 9.6 MB |
| `public/media/gateway.mp4` | web encode of the approved gateway clip | 9.7 MB |
| `public/media/courtyard.mp4` | web encode of the approved courtyard clip | 9.6 MB |
| `public/posters/*.jpg` | first and last frame of each clip, decoded in Chromium (`npm run posters`) | 3.4 MB |
| `src/media/manifest.json` | the media manifest (paths, frames, fps, stills) | — |

The approved **masters are not in the repository.** They are 21–41 Mb/s and 96 MB in total, and they are not
faststart. They are kept by the owner. For reference, their SHA-256 checksums are:

```
d2d1c7aa674bfd72ba5d7bc920fa9aac02ca474f8de84bb11e2593b41acca2e0  exterior.mp4   (master)
02bc403c35db256a5e77f393da9374e0cedc5ca650dd92168d33da0684a80a1b  gateway.mp4    (master)
42446c77e3fb3176e47c7a868f539f7b8a0123f97ea1b09631045df0d85385b4  courtyard.mp4  (master)
4d494118196a5994ae121f1f60bba5ad885c8deae1db6733e0765c5ccc1f99ab  exterior.mp4   (web, in this repository)
fe466455ab89f136a22eba51208595cb17569c255ab187d99a56b9168614b529  gateway.mp4    (web)
df174b6c7461b019ec52879cae487cfb91954fa06bb86fc90e681f220169905b  courtyard.mp4  (web)
```

The clips are AI-generated. Before publishing, confirm that the terms of the generation service allow public
redistribution of its output, and choose a licence for the repository. No `LICENSE` file is included yet, which
means all rights are reserved by default.

## Storage: plain Git, no LFS

- **Largest file:** 9.7 MB, far below GitHub's 50 MB warning and 100 MB hard limit per file.
- **Repository size:** about 33 MB of media plus about 0.5 MB of code and documentation, well within GitHub's recommended size.
- **Why not Git LFS:** LFS is not required at this size, and it would make things worse for a public repository. LFS downloads count against the owner's LFS bandwidth quota on every clone and every CI checkout, whereas ordinary Git objects have no such quota. Plain Git also keeps a fresh clone fully self-contained (`git clone` + `npm ci` + `npm run dev`).
- **Caveat: history is permanent.** Every replaced version of a clip stays in the history (about 10 MB each time). If clips will be re-generated often, move `public/media/` to LFS or to external storage *before* those changes accumulate. Rewriting history later is disruptive.

## Bandwidth: what one visitor downloads

| visit | downloads |
|---|---|
| Full first visit (intro, Enter, entrance to the courtyard) | ≈ 29 MB of video. Breakdown: exterior 9.6 MB at load, gateway 9.7 MB parked from 1.5 s into the intro, courtyard 9.6 MB parked once the gateway plays. Plus ≈ 1.4–2.1 MB of stills, ≈ 100 kB of JS (gzip) and ≈ 100 kB of fonts |
| Visitor who leaves on the homepage | exterior + gateway ≈ 19 MB (the gateway is fetched to make Enter instant) |
| Reduced motion, or a deep link into the courtyard | stills only, ≈ 1–2 MB |
| Return visit with a warm cache | close to nothing, if the host sends cacheable headers |

**If the site is ever deployed:**
- **Volume:** 1,000 full visits is ≈ 29 GB of egress. GitHub Pages, for example, has a soft limit of 100 GB/month, about 3,400 full visits.
- **Headers:** serve `public/media` and `public/posters` from a CDN or object store that supports HTTP Range requests (the videos are seeked and streamed), with long-lived cache headers. Rename files when their content changes.
- **Mobile:** a 720p variant (≈ 4 Mb/s, ≈ 4 MB per clip) would cut a mobile visit to about 12 MB. Not made yet.
- **Not for hosting:** raw.githubusercontent.com and GitHub release assets are not suitable video hosts (no proper caching or range-serving guarantees).

## How the web encodes were made

On macOS, with Apple's `avconvert` (AVFoundation hardware H.264 encoder) and a small colour-tag tool, the steps are:

1. Copy each master and rewrite **only its colour description** in the H.264 SPS from *sRGB transfer* to *BT.709 transfer* (primaries BT.709 and matrix BT.601 unchanged): `scripts/media/retag-h264-colour.py master.mp4 tagged.mp4 1 1 6`. The master files themselves are never modified.
2. `avconvert -s tagged.mp4 -p Preset1920x1080 -o web.mp4 --multiPass`. This gives H.264 High at about 9.7 Mb/s, faststart by default, with source metadata stripped.

`scripts/media/encode-web.sh MASTER_DIR` runs both steps for the three clips.

**Why step 1 exists.** The masters declare sRGB transfer with a BT.601 matrix. AVFoundation colour-manages: given those tags, it re-encodes the pixel values from the sRGB curve to the BT.709 curve. Chrome, however, ignores the transfer tag for these videos (measured: transfer 1, 2 or 13 render identically) and honours only the matrix. A direct encode therefore rendered **about 6 % darker** in Chrome (mean RGB of the courtyard 148.7 → 140.1). Re-tagging the copy's transfer as BT.709 makes AVFoundation pass the values through untouched, so the encode renders like the master.

## Verification

All of these were decoded in Chrome for Testing 147, comparing the web encodes with the masters:

| check | exterior | gateway | courtyard |
|---|---|---|---|
| frames / fps / duration | 192 / 24 / 8.000 s | 192 / 24 / 8.000 s | 192 / 24 / 8.000 s |
| faststart (`moov` before `mdat`) | yes | yes | yes |
| frame alignment (frames 0, 1, 8, 48, 96, 144, 183, 189, 191 each match the same master frame) | exact | exact | exact |
| mean RGB, frame 96 (master → web) | 91.8/69.4/52.0 → 91.9/69.4/52.5 | 120.8/95.3/75.4 → 120.9/95.4/75.8 | 148.7/120.2/94.9 → 148.6/120.1/95.2 |
| tone/colour fidelity (PSNR after 8×8 averaging) | 44.6 dB | 40.7 dB | 39.7 dB |
| full-detail PSNR (compression of very fine AI texture) | 35.0 dB | 31.7 dB | 30.2 dB |

At 1:1, the web encodes are visually indistinguishable from the masters apart from a slight softening of the finest
carving. Because frame structure and timing are identical, the edit points in `src/media/scenes.ts`
(gateway 189 → courtyard 8 and the rest) apply unchanged. They were re-verified on the web encodes from a fresh
clone: see [`VERIFICATION.md`](VERIFICATION.md).
