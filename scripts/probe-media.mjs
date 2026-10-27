// Read the actual container metadata of every clip in the media manifest (no ffmpeg needed).
//   node scripts/probe-media.mjs            → prints a table, writes .generated/probe.json (the media files are never modified)
// Frame count and rate come from the sample table, not from the (rounded) duration.
import { readFileSync, writeFileSync, statSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import MP4Box from 'mp4box';

const ROOT = new URL('..', import.meta.url).pathname;
const manifest = JSON.parse(readFileSync(ROOT + 'src/media/manifest.json', 'utf8'));

function probe(path) {
  return new Promise((resolve, reject) => {
    const file = MP4Box.createFile();
    file.onError = reject;
    file.onReady = (info) => resolve(info);
    const buf = readFileSync(path);
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    ab.fileStart = 0;
    file.appendBuffer(ab);
    file.flush();
  });
}

const out = {};
for (const clip of manifest.clips) {
  const path = ROOT + 'public/media/' + clip.file;
  const info = await probe(path);
  const v = info.videoTracks[0];
  const bytes = readFileSync(path);
  out[clip.id] = {
    file: clip.file,
    bytes: statSync(path).size,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    codec: v.codec,
    width: v.video.width,
    height: v.video.height,
    frames: v.nb_samples,
    fps: +(v.nb_samples / (v.duration / v.timescale)).toFixed(3),
    duration_s: +(v.duration / v.timescale).toFixed(4),
    bitrate_mbps: +(v.bitrate / 1e6).toFixed(2),
    audio_tracks: info.audioTracks.length,
    progressive: info.isProgressive,     // moov before mdat: playback can start before the whole file arrives
    fragmented: info.isFragmented,
  };
}
mkdirSync(ROOT + '.generated', { recursive: true });
writeFileSync(ROOT + '.generated/probe.json', JSON.stringify(out, null, 2));
console.table(Object.fromEntries(Object.entries(out).map(([k, v]) => [k, { ...v, sha256: v.sha256.slice(0, 12) }])));
