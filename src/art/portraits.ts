import { HERO_BY_ID, RARITY_INFO } from '../data/heroes';
import { Svg, shade, svgUrl } from './svg';

const W = 240, H = 300;
const OUT = (c: string) => `stroke="${c}" stroke-width="2" stroke-linejoin="round"`;

export function portraitSvg(id: string, opts: { bg?: boolean } = {}): string {
  const h = HERO_BY_ID[id];
  const s = new Svg(W, H);
  const p = h.palette;
  const L = h.look;
  const rar = RARITY_INFO[h.rarity];
  const cx = 120, hy = 118;
  const skin = p.skin, skinD = shade(p.skin, -0.32), skinL = shade(p.skin, 0.25);
  const ink = shade(p.bg, -0.7);

  if (opts.bg !== false) {
    s.rect(0, 0, W, H, s.rad([[0, shade(p.bg, 0.45)], [0.55, p.bg], [1, shade(p.bg, -0.6)]], 0.5, 0.38, 0.75));
    // light rays
    for (let i = 0; i < 9; i++) {
      const a = -Math.PI / 2 + (i - 4) * 0.28;
      s.path(`M${cx},${hy} L${cx + Math.cos(a - 0.06) * 320},${hy + Math.sin(a - 0.06) * 320} L${cx + Math.cos(a + 0.06) * 320},${hy + Math.sin(a + 0.06) * 320} Z`, rar.color, 'opacity=".07"');
    }
    s.circle(cx, hy, 105, s.rad([[0, rar.color, 0.35], [1, rar.color, 0]]));
    for (let i = 0; i < 18; i++) {
      const x = (i * 53) % W, y = (i * 97) % (H - 60) + 10;
      s.circle(x, y, 1 + (i % 3), '#fff', `opacity="${0.15 + (i % 4) * 0.08}"`);
    }
  }

  // ——— back hair (long styles)
  if (L.hair === 'long' || L.hair === 'braids') {
    s.path(`M${cx - 52},${hy - 20} Q${cx - 70},${hy + 80} ${cx - 50},${hy + 140} L${cx + 50},${hy + 140} Q${cx + 70},${hy + 80} ${cx + 52},${hy - 20} Z`, s.lin([[0, shade(p.hair, 0.1)], [1, shade(p.hair, -0.45)]]), OUT(shade(p.hair, -0.6)));
  }
  if (L.hair === 'hood') {
    s.path(`M${cx - 70},${H} Q${cx - 78},${hy + 40} ${cx - 56},${hy - 30} Q${cx},${hy - 100} ${cx + 56},${hy - 30} Q${cx + 78},${hy + 40} ${cx + 70},${H} Z`, s.lin([[0, shade(p.armor, 0.15)], [1, shade(p.armor, -0.5)]], 0, 0, 1, 0), OUT(shade(p.armor, -0.7)));
  }

  // ——— shoulders & armour
  const armor = p.armor;
  s.path(`M${cx - 110},${H} Q${cx - 104},${hy + 102} ${cx - 54},${hy + 86} L${cx + 54},${hy + 86} Q${cx + 104},${hy + 102} ${cx + 110},${H} Z`, s.lin([[0, shade(armor, 0.25)], [0.5, armor], [1, shade(armor, -0.45)]], 0, 0, 1, 0.4), OUT(shade(armor, -0.7)));
  // chest plate
  s.path(`M${cx - 46},${hy + 92} Q${cx},${hy + 120} ${cx + 46},${hy + 92} L${cx + 40},${H} L${cx - 40},${H} Z`, s.lin([[0, shade(armor, 0.4)], [1, shade(armor, -0.2)]]), OUT(shade(armor, -0.7)));
  s.path(`M${cx - 46},${hy + 92} Q${cx},${hy + 120} ${cx + 46},${hy + 92}`, 'none', `stroke="${p.accent}" stroke-width="4"`);
  // emblem
  s.path(`M${cx},${hy + 128} l14,12 l-14,22 l-14,-22 z`, s.lin([[0, shade(p.accent, 0.5)], [1, shade(p.accent, -0.3)]]), OUT(shade(p.accent, -0.6)));
  // pauldrons
  for (const d of [-1, 1]) {
    const px = cx + d * 78, py = hy + 108;
    s.ellipse(px, py, 40, 26, s.lin([[0, shade(armor, 0.45)], [0.6, armor], [1, shade(armor, -0.5)]], d < 0 ? 0 : 1, 0, d < 0 ? 1 : 0, 1), OUT(shade(armor, -0.7)));
    s.path(`M${px - 36},${py + 4} Q${px},${py - 22} ${px + 36},${py + 4}`, 'none', `stroke="${p.accent}" stroke-width="3"`);
    s.circle(px + d * -6, py - 6, 4, p.accent);
  }
  // cape collar
  s.path(`M${cx - 54},${hy + 86} Q${cx - 40},${hy + 70} ${cx - 26},${hy + 74} L${cx + 26},${hy + 74} Q${cx + 40},${hy + 70} ${cx + 54},${hy + 86} Q${cx},${hy + 100} ${cx - 54},${hy + 86} Z`, shade(p.accent, -0.35), OUT(shade(p.accent, -0.7)));

  // ——— neck
  s.path(`M${cx - 18},${hy + 40} L${cx - 20},${hy + 84} Q${cx},${hy + 94} ${cx + 20},${hy + 84} L${cx + 18},${hy + 40} Z`, s.lin([[0, skin], [1, skinD]], 0, 0, 1, 0));
  s.path(`M${cx - 18},${hy + 62} Q${cx},${hy + 74} ${cx + 18},${hy + 62} L${cx + 18},${hy + 50} Q${cx},${hy + 60} ${cx - 18},${hy + 50} Z`, skinD, 'opacity=".5"');

  // ——— ears
  for (const d of [-1, 1]) {
    if (L.ears) s.path(`M${cx + d * 38},${hy - 4} L${cx + d * 70},${hy - 34} L${cx + d * 44},${hy + 16} Z`, s.lin([[0, skinL], [1, skinD]]), OUT(shade(skin, -0.55)));
    else s.ellipse(cx + d * 41, hy + 4, 8, 13, d < 0 ? skin : skinD, OUT(shade(skin, -0.55)));
  }

  // ——— face
  const jaw = L.female ? 30 : 36;
  const face = `M${cx - 40},${hy - 10} Q${cx - 42},${hy - 62} ${cx},${hy - 64} Q${cx + 42},${hy - 62} ${cx + 40},${hy - 10} Q${cx + 40},${hy + 26} ${cx + jaw * 0.6},${hy + 44} Q${cx},${hy + 66} ${cx - jaw * 0.6},${hy + 44} Q${cx - 40},${hy + 26} ${cx - 40},${hy - 10} Z`;
  s.path(face, s.lin([[0, skinL], [0.55, skin], [1, skinD]], 0, 0, 1, 0.3), OUT(shade(skin, -0.6)));
  // cheek shading
  s.path(`M${cx + 18},${hy + 8} Q${cx + 34},${hy + 4} ${cx + 38},${hy - 14} Q${cx + 40},${hy + 24} ${cx + 18},${hy + 44} Z`, skinD, 'opacity=".35"');
  if (L.female) s.ellipse(cx - 22, hy + 18, 9, 5, '#ff8a8a', 'opacity=".25"');

  // ——— eyes
  const eyeY = hy + 2;
  for (const d of [-1, 1]) {
    const ex = cx + d * 17;
    s.path(`M${ex - 11},${eyeY} Q${ex},${eyeY - 9} ${ex + 11},${eyeY} Q${ex},${eyeY + 6} ${ex - 11},${eyeY} Z`, '#fbf6ee', `stroke="${ink}" stroke-width="1.6"`);
    if (L.glow) s.circle(ex, eyeY - 1, 9, s.rad([[0, p.eye, 0.7], [1, p.eye, 0]]));
    s.circle(ex, eyeY - 1, 4.6, s.rad([[0, shade(p.eye, 0.5)], [1, shade(p.eye, -0.4)]]));
    s.circle(ex, eyeY - 1, 2, '#0a0a10');
    s.circle(ex - 1.6, eyeY - 2.8, 1.2, '#fff');
    // upper lid
    s.path(`M${ex - 12},${eyeY - 1} Q${ex},${eyeY - 11} ${ex + 12},${eyeY - 1}`, 'none', `stroke="${ink}" stroke-width="${L.female ? 3 : 2.4}" stroke-linecap="round"`);
    if (L.female) s.line(ex + d * 11, eyeY - 2, ex + d * 15, eyeY - 6, ink, 2);
    // brows
    const by = eyeY - 14 - (L.scar && d > 0 ? 1 : 0);
    s.path(`M${ex - d * 11},${by + (L.female ? 2 : 3)} Q${ex},${by - 5} ${ex + d * 12},${by + (L.female ? 0 : -1)}`, 'none', `stroke="${shade(p.hair, -0.3)}" stroke-width="${L.female ? 2.6 : 4.2}" stroke-linecap="round"`);
  }
  // nose & mouth
  s.path(`M${cx + 2},${eyeY + 4} Q${cx + 7},${hy + 24} ${cx + 1},${hy + 26} Q${cx - 4},${hy + 27} ${cx - 6},${hy + 24}`, 'none', `stroke="${shade(skin, -0.5)}" stroke-width="1.8" stroke-linecap="round"`);
  if (!L.beard) {
    s.path(`M${cx - 11},${hy + 38} Q${cx},${hy + 44} ${cx + 11},${hy + 38}`, L.female ? shade('#d86a6a', -0.1) : 'none', `stroke="${shade(skin, -0.55)}" stroke-width="2" stroke-linecap="round"`);
  }
  if (L.scar) s.path(`M${cx + 22},${eyeY - 22} L${cx + 12},${eyeY + 20}`, 'none', 'stroke="#a04a4a" stroke-width="2.6" stroke-linecap="round" opacity=".85"');
  if (L.tattoo) {
    s.path(`M${cx - 30},${hy + 6} l8,10 l-8,10 M${cx - 34},${hy + 14} l6,0`, 'none', `stroke="${p.accent}" stroke-width="2.4" opacity=".85"`);
  }

  // ——— beard
  if (L.beard) {
    s.path(`M${cx - 38},${hy + 6} Q${cx - 36},${hy + 50} ${cx - 14},${hy + 70} Q${cx},${hy + 84} ${cx + 14},${hy + 70} Q${cx + 36},${hy + 50} ${cx + 38},${hy + 6} Q${cx + 30},${hy + 30} ${cx + 16},${hy + 30} Q${cx},${hy + 24} ${cx - 16},${hy + 30} Q${cx - 30},${hy + 30} ${cx - 38},${hy + 6} Z`, s.lin([[0, shade(p.hair, 0.15)], [1, shade(p.hair, -0.4)]], 0, 0, 1, 1), OUT(shade(p.hair, -0.65)));
    s.path(`M${cx - 10},${hy + 37} Q${cx},${hy + 41} ${cx + 10},${hy + 37}`, 'none', `stroke="${shade(p.hair, -0.7)}" stroke-width="2.4" stroke-linecap="round"`);
    for (let i = -2; i <= 2; i++) s.path(`M${cx + i * 9},${hy + 46} q${i},12 ${i * 2},20`, 'none', `stroke="${shade(p.hair, -0.5)}" stroke-width="1.2" opacity=".6"`);
  }

  // ——— hair / headwear (front)
  const hairG = s.lin([[0, shade(p.hair, 0.35)], [0.5, p.hair], [1, shade(p.hair, -0.4)]], 0, 0, 1, 0.6);
  const hairS = OUT(shade(p.hair, -0.65));
  switch (L.hair) {
    case 'long':
    case 'braids':
      s.path(`M${cx - 46},${hy + 10} Q${cx - 54},${hy - 76} ${cx},${hy - 76} Q${cx + 54},${hy - 76} ${cx + 46},${hy + 10} Q${cx + 40},${hy - 34} ${cx + 10},${hy - 46} Q${cx - 18},${hy - 30} ${cx - 40},${hy - 26} Q${cx - 44},${hy - 6} ${cx - 46},${hy + 10} Z`, hairG, hairS);
      if (L.hair === 'braids') {
        for (const d of [-1, 1]) for (let i = 0; i < 6; i++) s.ellipse(cx + d * 48, hy + 24 + i * 15, 9, 9, hairG, hairS);
      } else {
        for (const d of [-1, 1]) s.path(`M${cx + d * 44},${hy - 4} Q${cx + d * 56},${hy + 60} ${cx + d * 46},${hy + 104}`, 'none', `stroke="${shade(p.hair, -0.3)}" stroke-width="2" opacity=".6"`);
      }
      if (h.rarity === 'legendary') { // circlet
        s.path(`M${cx - 42},${hy - 34} Q${cx},${hy - 50} ${cx + 42},${hy - 34}`, 'none', `stroke="${p.accent}" stroke-width="4"`);
        s.path(`M${cx},${hy - 56} l7,9 l-7,9 l-7,-9 z`, s.lin([[0, '#fff'], [1, p.eye]]), OUT(shade(p.accent, -0.6)));
      }
      break;
    case 'short':
      s.path(`M${cx - 42},${hy - 8} Q${cx - 50},${hy - 74} ${cx},${hy - 72} Q${cx + 52},${hy - 72} ${cx + 42},${hy - 8} L${cx + 36},${hy - 30} L${cx + 22},${hy - 40} L${cx + 6},${hy - 32} L${cx - 10},${hy - 42} L${cx - 26},${hy - 34} L${cx - 36},${hy - 24} Z`, hairG, hairS);
      break;
    case 'mohawk':
      s.path(`M${cx - 14},${hy - 52} Q${cx - 18},${hy - 110} ${cx + 6},${hy - 104} Q${cx + 24},${hy - 96} ${cx + 14},${hy - 52} Q${cx},${hy - 60} ${cx - 14},${hy - 52} Z`, hairG, hairS);
      s.path(`M${cx - 40},${hy - 18} Q${cx - 38},${hy - 54} ${cx},${hy - 62} Q${cx + 38},${hy - 54} ${cx + 40},${hy - 18}`, 'none', `stroke="${shade(p.hair, 0.2)}" stroke-width="2" opacity=".5"`);
      break;
    case 'bald':
      s.path(`M${cx - 30},${hy - 52} Q${cx},${hy - 66} ${cx + 30},${hy - 52}`, 'none', 'stroke="#fff" stroke-width="5" opacity=".25" stroke-linecap="round"');
      break;
    case 'hood':
      s.path(`M${cx - 58},${hy + 30} Q${cx - 60},${hy - 84} ${cx},${hy - 88} Q${cx + 60},${hy - 84} ${cx + 58},${hy + 30} Q${cx + 50},${hy - 40} ${cx},${hy - 52} Q${cx - 50},${hy - 40} ${cx - 58},${hy + 30} Z`, s.lin([[0, shade(p.armor, 0.3)], [1, shade(p.armor, -0.45)]], 0, 0, 1, 0.5), OUT(shade(p.armor, -0.75)));
      s.path(`M${cx - 50},${hy - 30} Q${cx},${hy - 56} ${cx + 50},${hy - 30}`, 'none', `stroke="${p.accent}" stroke-width="3"`);
      if (L.hair === 'hood' && h.palette.hair !== h.palette.armor) {
        s.path(`M${cx - 34},${hy - 34} Q${cx},${hy - 52} ${cx + 34},${hy - 34} Q${cx + 20},${hy - 38} ${cx},${hy - 36} Q${cx - 20},${hy - 38} ${cx - 34},${hy - 34} Z`, hairG);
      }
      break;
    case 'helm':
      s.path(`M${cx - 50},${hy + 14} Q${cx - 56},${hy - 84} ${cx},${hy - 86} Q${cx + 56},${hy - 84} ${cx + 50},${hy + 14} L${cx + 40},${hy + 16} L${cx + 40},${hy - 20} Q${cx},${hy - 30} ${cx - 40},${hy - 20} L${cx - 40},${hy + 16} Z`, s.lin([[0, '#f4f6fa'], [0.4, '#b8c0cc'], [1, '#5a6270']], 0, 0, 1, 0.5), OUT('#2a2e36'));
      s.path(`M${cx - 4},${hy - 86} L${cx + 4},${hy - 86} L${cx + 4},${hy - 20} L${cx - 4},${hy - 20} Z`, p.accent, 'opacity=".9"');
      for (const d of [-1, 1]) s.path(`M${cx + d * 50},${hy - 40} q${d * 26},-26 ${d * 18},-60 q${d * -8},26 ${d * -20},44 z`, '#f0e8d8', OUT('#5a5040'));
      break;
    case 'crown':
      s.path(`M${cx - 42},${hy - 40} L${cx - 42},${hy - 76} L${cx - 22},${hy - 56} L${cx},${hy - 84} L${cx + 22},${hy - 56} L${cx + 42},${hy - 76} L${cx + 42},${hy - 40} Z`, s.lin([[0, '#fff2a8'], [1, '#b8761a']]), OUT('#5a3a08'));
      break;
  }
  if (L.horns) for (const d of [-1, 1]) s.path(`M${cx + d * 30},${hy - 54} q${d * 30},-20 ${d * 24},-58 q${d * -2},30 ${d * -16},48 z`, '#e8dcc8', OUT('#5a5040'));
  if (L.mask) s.path(`M${cx - 40},${hy - 10} Q${cx},${hy - 22} ${cx + 40},${hy - 10} L${cx + 36},${hy + 12} Q${cx},${hy + 2} ${cx - 36},${hy + 12} Z`, '#1a1a22', 'opacity=".85"');

  // rim light
  s.path(`M${cx + 40},${hy - 30} Q${cx + 44},${hy + 10} ${cx + 30},${hy + 40}`, 'none', `stroke="${rar.color}" stroke-width="3" opacity=".5" stroke-linecap="round"`);
  if (opts.bg !== false) {
    s.rect(0, H - 70, W, 70, s.lin([[0, '#000', 0], [1, '#000', 0.65]]));
  }
  return s.toString();
}

const cache = new Map<string, string>();
export function portraitUrl(id: string, bg = true): string {
  const k = id + (bg ? '' : ':nobg');
  let u = cache.get(k);
  if (!u) { u = svgUrl(portraitSvg(id, { bg })); cache.set(k, u); }
  return u;
}
