import { createRequire } from 'module'; const require = createRequire('/opt/node22/lib/node_modules/'); const { chromium } = require('playwright');
// usage: url out w h wait jsBeforeShot
const [,, url, out, w = '1280', h = '720', wait = '8000', js = ''] = process.argv;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
p.on('console', (m) => { if (m.type() === 'error') console.log('console:', m.type(), m.text()); });
p.on('pageerror', (e) => console.log('pageerror:', e.message));
await p.goto(url);
await p.waitForTimeout(+wait);
if (js) { const r = await p.evaluate(js); if (r !== undefined) console.log('eval:', r); await p.waitForTimeout(1500); }
await p.screenshot({ path: out });
await b.close();
