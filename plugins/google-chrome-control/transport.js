import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

// Deliberately lazy: loading this plugin never reads Chrome discovery data or connects.
export async function connectChrome() {
  // Desktop Host does not necessarily inherit the managed shell environment.
  // This local bundle is deployed for the desktop profile; explicit env wins.
  const root = process.env.LOCALAPPDATA || '__DSH_SUITE_GOOGLE_CHROME_CONTROL_USER_HOME__\\AppData\\Local';
  const profile = process.env.DSH_PROFILE_DIR || '__DSH_SUITE_GOOGLE_CHROME_CONTROL_PROFILE_ROOT__';
  const raw = await readFile(join(root, 'Google', 'Chrome', 'User Data', 'DevToolsActivePort'), 'utf8');
  const [port, endpoint] = raw.trim().split(/\r?\n/);
  if (!/^\d{1,5}$/.test(port) || Number(port) < 1 || Number(port) > 65535 || !/^\/devtools\/browser\/[a-zA-Z0-9-]+$/.test(endpoint)) {
    throw new Error('CHROME_DISCOVERY_UNAVAILABLE');
  }
  const { puppeteer } = await import(pathToFileURL(join(profile, 'node_modules', 'chrome-devtools-mcp', 'build', 'src', 'third_party', 'index.js')).href);
  return puppeteer.connect({ browserWSEndpoint: `ws://127.0.0.1:${port}${endpoint}`, defaultViewport: null, protocolTimeout: 20000 });
}
