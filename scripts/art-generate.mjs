// Batch image generation through the OpenAI Images API (no clicking through ChatGPT).
//
//   OPENAI_API_KEY=… node scripts/art-generate.mjs --stage 0          the pilot (5 images)
//   node scripts/art-generate.mjs --stage A --quality high             all Order buildings
//   node scripts/art-generate.mjs --match "^icon_" --limit 10
//   node scripts/art-generate.mjs --stage all --dry                    count and cost estimate only
//
// Prompts come from docs/art/prompts.json (node scripts/art-prompts.mjs). Results are written to
// art/incoming/<name>.png, existing files are skipped (use --force to redo), then run
// node scripts/art-import.mjs. Once the style reference (Citadel T3, bld_citadel_order_t3) exists,
// every other image is generated as an edit with it — plus the previous tier for buildings —
// attached as a reference, which keeps one consistent look across hundreds of images.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const has = (k) => argv.includes(k);
const STAGE = opt('--stage', '0');
const MATCH = opt('--match');
const LIMIT = Number(opt('--limit', '0')) || Infinity;
const QUALITY = opt('--quality', 'medium');
const CONC = Number(opt('--concurrency', '3'));
const MODEL = process.env.OPENAI_IMAGE_MODEL ?? 'gpt-image-2';
const KEY = process.env.OPENAI_API_KEY;
const OUT = 'art/incoming';
const ETALON = 'bld_citadel_order_t3';
// rough per-image prices for 1024×1024 (third-party figures, Aug 2026) — check OpenAI's pricing page
const PRICE = { low: 0.006, medium: 0.053, high: 0.211 };

const all = JSON.parse(readFileSync('docs/art/prompts.json', 'utf8'));
const manifest = JSON.parse(readFileSync('src/data/art-manifest.json', 'utf8'));
let list = all.filter((a) => STAGE === 'all' || a.stage === STAGE);
if (MATCH) list = list.filter((a) => new RegExp(MATCH).test(a.name));
if (!has('--force')) list = list.filter((a) => !existsSync(`${OUT}/${a.name}.png`) && !manifest[a.name]);
// the style reference goes first, everything else waits for it
list.sort((a, b) => (b.name === ETALON) - (a.name === ETALON));
list = list.slice(0, LIMIT);

const big = list.filter((a) => a.size !== '1024x1024').length;
const cost = list.length * PRICE[QUALITY] + big * PRICE[QUALITY] * 0.5;
console.log(`${list.length} image(s) to generate · model ${MODEL} · quality ${QUALITY} · ≈ $${cost.toFixed(2)}`);
if (has('--dry') || !list.length) process.exit(0);
if (!KEY) { console.error('OPENAI_API_KEY is not set'); process.exit(1); }
mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const CHROMA = 'isolated on a solid flat pure green (#00FF00) chroma key background';

async function call(a, refs, transparentOk) {
  const prompt = (refs.length ? 'Use the attached image(s) only as a reference for the art style, rendering, materials, lighting and camera angle; draw a new subject as described. ' : '')
    + (transparentOk ? a.prompt : a.prompt.replace('isolated on a transparent background', CHROMA));
  const common = { model: MODEL, prompt, size: a.size, quality: QUALITY, n: 1 };
  let res;
  if (refs.length) {
    const fd = new FormData();
    for (const [k, v] of Object.entries(common)) fd.append(k, String(v));
    if (a.transparent && transparentOk) fd.append('background', 'transparent');
    for (const r of refs) fd.append('image[]', new Blob([readFileSync(`${OUT}/${r}.png`)], { type: 'image/png' }), `${r}.png`);
    res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { Authorization: `Bearer ${KEY}` }, body: fd });
  } else {
    res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST', headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...common, ...(a.transparent && transparentOk ? { background: 'transparent' } : {}) }),
    });
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(body?.error?.message ?? `HTTP ${res.status}`); e.status = res.status; throw e; }
  return Buffer.from(body.data[0].b64_json, 'base64');
}

async function generate(a) {
  const refs = [];
  if (a.name !== ETALON && existsSync(`${OUT}/${ETALON}.png`)) refs.push(ETALON);
  const m = /^(bld_.+_t)(\d)$/.exec(a.name);
  if (m && Number(m[2]) > 1 && existsSync(`${OUT}/${m[1]}${Number(m[2]) - 1}.png`)) refs.push(`${m[1]}${Number(m[2]) - 1}`);
  let transparentOk = true;
  for (let attempt = 1; ; attempt++) {
    try {
      const png = await call(a, refs, transparentOk);
      writeFileSync(`${OUT}/${a.name}.png`, png);
      return;
    } catch (e) {
      if (/background|transparen/i.test(e.message) && transparentOk) { transparentOk = false; continue; } // model without alpha: use a chroma key
      if (/image\[\]|edits/i.test(e.message) && refs.length) { refs.length = 0; continue; }
      if (attempt >= 4 || (e.status && e.status < 500 && e.status !== 429)) throw e;
      await sleep(2000 * 2 ** attempt);
    }
  }
}

let done = 0, failed = 0;
const queue = [...list];
// the reference must exist before the rest start
if (queue[0]?.name === ETALON) {
  const a = queue.shift();
  try { await generate(a); done++; console.log(`✓ ${a.name} (style reference — check it before generating the rest)`); }
  catch (e) { failed++; console.log(`✗ ${a.name}: ${e.message}`); }
}
await Promise.all(Array.from({ length: CONC }, async () => {
  for (let a; (a = queue.shift());) {
    try { await generate(a); done++; console.log(`✓ ${a.name}  (${done}/${list.length})`); }
    catch (e) { failed++; console.log(`✗ ${a.name}: ${e.message}`); }
  }
}));
console.log(`done: ${done} generated, ${failed} failed → now run: node scripts/art-import.mjs`);
