// Minimal static server with HTTP Range support (video seeking needs it), for the extraction and
// validation scripts. Serves `root` on 127.0.0.1 only.
import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const TYPES = { '.mp4': 'video/mp4', '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

export function serve(root, port = 0) {
  const server = createServer((req, res) => {
    if (req.url === '/' || req.url === '/__blank') { res.writeHead(200, { 'Content-Type': 'text/html' }).end('<!doctype html><title>serve</title>'); return; }
    const rel = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
    const path = join(root, rel);
    let st;
    try { st = statSync(path); if (!st.isFile()) throw 0; } catch { res.writeHead(404).end(); return; }
    const type = TYPES[extname(path)] ?? 'application/octet-stream';
    const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? '');
    if (m) {
      const start = m[1] ? +m[1] : st.size - +m[2];
      const end = m[1] && m[2] ? +m[2] : st.size - 1;
      res.writeHead(206, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1, 'Content-Range': `bytes ${start}-${end}/${st.size}` });
      createReadStream(path, { start, end }).pipe(res);
    } else {
      res.writeHead(200, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Length': st.size });
      createReadStream(path).pipe(res);
    }
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve({ server, url: `http://127.0.0.1:${server.address().port}` })));
}
