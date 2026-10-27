#!/bin/sh
# Make the web encodes in public/media from the approved masters (macOS only: uses Apple's avconvert).
#   scripts/media/encode-web.sh /path/to/masters      (expects exterior.mp4, gateway.mp4, courtyard.mp4)
# The masters are only read. See docs/MEDIA.md for why the colour description is re-tagged first.
set -eu
MASTERS=${1:?usage: encode-web.sh MASTER_DIR}
HERE=$(cd "$(dirname "$0")" && pwd)
OUT="$HERE/../../public/media"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
command -v avconvert >/dev/null || { echo "avconvert not found (macOS only)"; exit 1; }
for c in exterior gateway courtyard; do
  python3 "$HERE/retag-h264-colour.py" "$MASTERS/$c.mp4" "$TMP/$c.mp4" 1 1 6
  avconvert -s "$TMP/$c.mp4" -p Preset1920x1080 -o "$OUT/$c.mp4" --multiPass --replace
  python3 "$HERE/retag-h264-colour.py" --show "$OUT/$c.mp4"
done
echo "done: now run  npm run probe && npm run posters  (stills must come from the files actually served)"
