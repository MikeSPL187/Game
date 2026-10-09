import { createRequire } from 'module'; const require = createRequire('/opt/node22/lib/node_modules/'); const { chromium } = require('playwright');
import { readFileSync, mkdirSync, writeFileSync } from 'fs';
const svg = readFileSync('assets/icon.svg', 'utf8');
const fg = svg.replace('<rect width="512" height="512" fill="url(#bg)"/>', '').replace(/<circle cx="256" cy="256" r="236"[^>]+>/, '');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage();
const res = 'android/app/src/main/res';
const dens = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
async function render(html, w, h, out, transparent = false) {
  await p.setViewportSize({ width: w, height: h });
  await p.setContent(`<html><body style="margin:0;background:${transparent ? 'transparent' : '#0b0f1a'}">${html}</body></html>`);
  await p.waitForTimeout(50);
  await p.screenshot({ path: out, omitBackground: transparent });
}
const u = (s) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
for (const [d, m] of Object.entries(dens)) {
  const dir = `${res}/mipmap-${d}`;
  mkdirSync(dir, { recursive: true });
  const s = Math.round(48 * m);
  await render(`<img src="${u(svg)}" width="${s}" height="${s}" style="display:block;border-radius:${s * 0.18}px">`, s, s, `${dir}/ic_launcher.png`, true);
  await render(`<img src="${u(svg)}" width="${s}" height="${s}" style="display:block;border-radius:50%">`, s, s, `${dir}/ic_launcher_round.png`, true);
  const f = Math.round(108 * m), inner = Math.round(72 * m);
  await render(`<div style="width:${f}px;height:${f}px;display:flex;align-items:center;justify-content:center"><img src="${u(fg)}" width="${inner}" height="${inner}"></div>`, f, f, `${dir}/ic_launcher_foreground.png`, true);
}
// splash
const splash = (w, h) => `<div style="width:${w}px;height:${h}px;background:radial-gradient(ellipse at 50% 40%,#1d2a4a 0%,#0b0f1a 70%);display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:Georgia,serif;color:#ffe29a">
  <img src="${u(svg)}" style="width:${Math.min(w, h) * 0.32}px;border-radius:22%;box-shadow:0 0 60px rgba(127,227,255,.35)">
  <div style="font-size:${Math.min(w, h) * 0.075}px;letter-spacing:${Math.min(w, h) * 0.015}px;margin-top:${h * 0.04}px;text-shadow:0 0 24px rgba(127,227,255,.5)">AETHERFALL</div></div>`;
const land = { mdpi: [480, 320], hdpi: [800, 480], xhdpi: [1280, 720], xxhdpi: [1600, 960], xxxhdpi: [1920, 1280] };
for (const [d, [w, h]] of Object.entries(land)) {
  await render(splash(w, h), w, h, `${res}/drawable-land-${d}/splash.png`);
  await render(splash(h, w), h, w, `${res}/drawable-port-${d}/splash.png`);
}
await render(splash(480, 320), 480, 320, `${res}/drawable/splash.png`);
// play store / readme icon
mkdirSync('docs/img', { recursive: true });
await render(`<img src="${u(svg)}" width="512" height="512" style="display:block">`, 512, 512, 'docs/img/icon-512.png');
await b.close();
writeFileSync(`${res}/values/ic_launcher_background.xml`, '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#1A2448</color>\n</resources>\n');
console.log('done');
