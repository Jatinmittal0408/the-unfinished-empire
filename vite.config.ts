import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Localhost only. /media is a symlink in public/ to the local, git-ignored media folder.
export default defineConfig({
  plugins: [react()],
  // the app, plus the local comparison harness for the edits (harness.html)
  build: { rollupOptions: { input: { main: 'index.html', harness: 'harness.html' } } },
  server: { host: '127.0.0.1', port: 5180, strictPort: true },
  preview: { host: '127.0.0.1', port: 5181, strictPort: true },
});
