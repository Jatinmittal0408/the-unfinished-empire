// Chromium for the scripts. It must decode H.264, so it is Playwright's "Chrome for Testing" build (plain
// open-source Chromium cannot) or an installed Google Chrome. Resolution order:
//   1. CHROME_PATH
//   2. the build playwright-core expects (`npx playwright-core install chromium`)
//   3. any Chrome for Testing build already in the Playwright cache (macOS, Linux, Windows)
//   4. an installed Google Chrome (channel "chrome")
import { chromium } from 'playwright-core';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir, platform } from 'node:os';

function cacheDirs() {
  if (process.env.PLAYWRIGHT_BROWSERS_PATH) return [process.env.PLAYWRIGHT_BROWSERS_PATH];
  const h = homedir();
  return { darwin: [join(h, 'Library/Caches/ms-playwright')], linux: [join(h, '.cache/ms-playwright')], win32: [join(process.env.LOCALAPPDATA ?? join(h, 'AppData/Local'), 'ms-playwright')] }[platform()] ?? [];
}
const CANDIDATES = [
  'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
  'chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
  'chrome-mac/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
  'chrome-linux64/chrome', 'chrome-linux/chrome', 'chrome-win64/chrome.exe', 'chrome-win/chrome.exe',
];

/** Path to a usable browser executable, or null to fall back to an installed Google Chrome. */
export function chromePath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  try { const p = chromium.executablePath(); if (p && existsSync(p)) return p; } catch { /* not installed */ }
  for (const cache of cacheDirs()) {
    if (!existsSync(cache)) continue;
    for (const b of readdirSync(cache).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse()) {
      for (const c of CANDIDATES) { const p = join(cache, b, c); if (existsSync(p)) return p; }
    }
  }
  return null;
}

export async function launch(opts = {}) {
  const executablePath = chromePath();
  if (executablePath) return chromium.launch({ executablePath, ...opts });
  try { return await chromium.launch({ channel: 'chrome', ...opts }); }
  catch { throw new Error('No H.264-capable Chromium found: run `npx playwright-core install chromium`, install Google Chrome, or set CHROME_PATH.'); }
}
