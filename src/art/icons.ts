import { Svg, crystal, shade, svgUrl } from './svg';
import { artUrl, hasArt } from './manifest';

type Draw = (s: Svg) => void;

const gold = (s: Svg) => s.lin([[0, '#fff2a8'], [0.45, '#ffc93c'], [1, '#b8761a']], 0, 0, 0.6, 1);
const steel = (s: Svg) => s.lin([[0, '#ffffff'], [0.5, '#c8d0dc'], [1, '#6a7484']], 0, 0, 0.7, 1);
const wood = (s: Svg) => s.lin([[0, '#c8905a'], [1, '#6a3e1c']], 0, 0, 0, 1);
const OUT = 'stroke="#20160e" stroke-width="2" stroke-linejoin="round"';

const ICONS: Record<string, Draw> = {
  food: (s) => {
    // wheat sheaf
    for (const [dx, rot] of [[-8, -18], [0, 0], [8, 18]] as const) {
      s.group(() => {
        s.line(0, 0, 0, 30, '#7a6a2a', 3);
        for (let i = 0; i < 5; i++) {
          s.ellipse(-4, -2 - i * 6, 4, 6.5, gold(s), 'stroke="#7a4a10" stroke-width="1.2" transform="rotate(-25)"');
          s.ellipse(4, -2 - i * 6, 4, 6.5, gold(s), 'stroke="#7a4a10" stroke-width="1.2" transform="rotate(25)"');
        }
      }, `transform="translate(${32 + dx},${30}) rotate(${rot})"`);
    }
    s.rect(18, 38, 28, 7, '#b84a2a', 'rx="2" stroke="#4a1a0a" stroke-width="1.5"');
  },
  wood: (s) => {
    const log = (y: number, x: number) => {
      s.add(`<rect x="${x - 22}" y="${y - 8}" width="40" height="16" rx="7" fill="${wood(s)}" ${OUT}/>`);
      s.ellipse(x + 16, y, 7, 8, '#e8c08a', 'stroke="#5a3010" stroke-width="2"');
      s.ellipse(x + 16, y, 3.5, 4, 'none', 'stroke="#a0703a" stroke-width="1.4"');
    };
    log(46, 26); log(46, 44); log(30, 35);
  },
  stone: (s) => {
    s.poly([[10, 40], [22, 18], [44, 14], [56, 30], [50, 52], [20, 54]], s.lin([[0, '#e4e0d8'], [1, '#7a7468']], 0, 0, 1, 1), OUT);
    s.poly([[22, 18], [44, 14], [40, 30], [24, 32]], '#f4f2ee', 'opacity=".6"');
    s.poly([[40, 30], [56, 30], [50, 52], [36, 48]], '#5a5448', 'opacity=".35"');
  },
  gold: (s) => {
    for (const [x, y] of [[22, 42], [42, 42], [32, 30], [32, 48]]) {
      s.ellipse(x, y + 3, 13, 6, '#8a5a10', OUT);
      s.ellipse(x, y, 13, 6, gold(s), 'stroke="#7a4a08" stroke-width="1.6"');
      s.ellipse(x, y, 8, 3.5, 'none', 'stroke="#c8902a" stroke-width="1.2"');
    }
  },
  aether: (s) => { crystal(s, 32, 56, 46, '#5ad8ff'); },
  power: (s) => {
    s.path('M32 6 L54 16 L50 40 Q44 54 32 60 Q20 54 14 40 L10 16 Z', s.lin([[0, '#ff8a5a'], [1, '#a02a1a']]), OUT);
    s.path('M24 20 L40 20 L36 30 L44 30 L26 50 L30 36 L22 36 Z', gold(s), 'stroke="#5a2a08" stroke-width="1.5"');
  },
  hourglass: (s) => {
    s.rect(14, 8, 36, 6, wood(s), `rx="2" ${OUT}`);
    s.rect(14, 50, 36, 6, wood(s), `rx="2" ${OUT}`);
    s.path('M18 14 L46 14 Q46 28 34 32 Q46 36 46 50 L18 50 Q18 36 30 32 Q18 28 18 14 Z', 'rgba(200,235,255,.55)', OUT);
    s.path('M22 20 L42 20 Q40 27 32 30 Q24 27 22 20 Z', gold(s));
    s.path('M22 48 L42 48 Q38 40 32 38 Q26 40 22 48 Z', gold(s));
    s.line(32, 30, 32, 40, '#ffc93c', 1.5);
  },
  tome: (s) => {
    s.path('M10 14 L32 10 L54 14 L54 54 L32 50 L10 54 Z', s.lin([[0, '#5a8ae8'], [1, '#2a3a8a']]), OUT);
    s.path('M32 10 L32 50', 'none', 'stroke="#1a2050" stroke-width="2"');
    s.path('M14 18 L30 15 L30 46 L14 49 Z', '#f4ecd8', 'opacity=".95"');
    s.path('M34 15 L50 18 L50 49 L34 46 Z', '#e4dcc8');
    s.circle(42, 30, 6, gold(s), 'stroke="#7a4a08" stroke-width="1.2"');
    for (let i = 0; i < 4; i++) s.line(17, 22 + i * 6, 27, 20 + i * 6, '#8a7a5a', 1.2);
  },
  key_silver: (s) => keyIcon(s, steel(s)),
  key_gold: (s) => keyIcon(s, gold(s)),
  shard: (s) => {
    s.circle(32, 32, 26, s.rad([[0, '#c27bff', 0.6], [1, '#c27bff', 0]]));
    s.poly([[32, 6], [46, 26], [38, 58], [24, 50], [18, 22]], s.lin([[0, '#f0d8ff'], [0.5, '#b56cff'], [1, '#4a1a8a']], 0, 0, 1, 1), OUT);
    s.poly([[32, 6], [46, 26], [32, 30]], '#fff', 'opacity=".45"');
  },
  shieldItem: (s) => {
    s.circle(32, 32, 28, s.rad([[0, '#7fe3ff', 0.5], [1, '#7fe3ff', 0]]));
    s.path('M32 8 L52 16 Q52 42 32 56 Q12 42 12 16 Z', s.lin([[0, '#9ad8ff'], [1, '#2a5aa8']]), OUT);
    s.path('M32 14 L46 20 Q46 40 32 50 Z', '#fff', 'opacity=".25"');
  },
  chest: (s) => chestIcon(s, wood(s), steel(s)),
  chest_gold: (s) => chestIcon(s, s.lin([[0, '#c84a3a'], [1, '#6a1a10']]), gold(s)),
  essence: (s) => {
    s.circle(32, 34, 26, s.rad([[0, '#7fe3ff', 0.6], [1, '#7fe3ff', 0]]));
    s.path('M24 12 L40 12 L40 20 Q52 28 50 42 Q48 56 32 56 Q16 56 14 42 Q12 28 24 20 Z', 'rgba(200,240,255,.35)', OUT);
    s.path('M17 38 Q32 32 47 38 Q47 52 32 53 Q17 52 17 38 Z', s.lin([[0, '#a8f0ff'], [1, '#1a8ad8']]));
    s.rect(22, 6, 20, 7, wood(s), `rx="2" ${OUT}`);
  },
  hammer: (s) => {
    s.line(20, 54, 40, 24, '#6a3e1c', 6);
    s.add(`<rect x="28" y="6" width="30" height="16" rx="3" fill="${steel(s)}" ${OUT} transform="rotate(35 43 14)"/>`);
  },
  book: (s) => ICONS.tome(s),
  sword: (s) => {
    s.path('M44 6 L58 6 L58 20 L26 44 L20 38 Z', steel(s), OUT);
    s.line(22, 50, 14, 58, '#6a3e1c', 6);
    s.line(14, 36, 28, 50, gold(s), 6);
    s.circle(12, 60, 3.5, gold(s));
  },
  shield: (s) => {
    s.path('M32 6 L54 14 Q54 42 32 58 Q10 42 10 14 Z', s.lin([[0, '#5a8ae8'], [1, '#1a2a6a']]), OUT);
    s.path('M32 12 L48 18 Q48 40 32 52 Q16 40 16 18 Z', 'none', 'stroke="#ffc93c" stroke-width="2.5"');
    s.path('M32 20 L36 30 L32 42 L28 30 Z', gold(s));
  },
  heart: (s) => s.path('M32 56 Q8 40 8 22 Q8 8 21 8 Q29 8 32 16 Q35 8 43 8 Q56 8 56 22 Q56 40 32 56 Z', s.lin([[0, '#ff7a7a'], [1, '#a01a2a']]), OUT),
  flag: (s) => {
    s.line(14, 58, 14, 6, '#5a3a1a', 4);
    s.path('M16 8 Q32 2 50 10 L44 22 L52 34 Q34 28 16 32 Z', s.lin([[0, '#ff6a4a'], [1, '#a01a10']]), OUT);
  },
  bow: (s) => {
    s.path('M18 6 Q54 32 18 58', 'none', 'stroke="#7a4a1a" stroke-width="5" stroke-linecap="round"');
    s.line(18, 6, 18, 58, '#e8e0d0', 1.5);
    s.line(10, 32, 54, 32, '#6a3e1c', 2.5);
    s.poly([[56, 32], [48, 27], [48, 37]], steel(s));
  },
  lance: (s) => {
    s.line(8, 56, 50, 14, '#6a3e1c', 5);
    s.poly([[58, 6], [44, 14], [50, 20]], steel(s), OUT);
    s.path('M24 40 l10 -2 l-2 10 z', '#ff6a4a');
  },
  banner: (s) => {
    s.line(10, 8, 54, 8, '#5a3a1a', 4);
    s.path('M16 10 L48 10 L48 54 L32 46 L16 54 Z', s.lin([[0, '#5a8ae8'], [1, '#1a2a6a']]), OUT);
    s.circle(32, 26, 7, gold(s));
  },
  rune: (s) => {
    s.circle(32, 32, 26, s.lin([[0, '#5a4a8a'], [1, '#1a1030']]), OUT);
    s.path('M24 18 L32 46 L40 18 M26 30 L38 30', 'none', 'stroke="#c27bff" stroke-width="3.5" stroke-linecap="round"');
  },
  skull: (s) => {
    s.path('M32 8 Q52 8 52 28 Q52 38 46 42 L46 52 L18 52 L18 42 Q12 38 12 28 Q12 8 32 8 Z', s.lin([[0, '#f4ecd8'], [1, '#a89a80']]), OUT);
    s.ellipse(24, 30, 6, 7, '#2a1a10'); s.ellipse(40, 30, 6, 7, '#2a1a10');
    s.path('M32 36 L28 44 L36 44 Z', '#2a1a10');
    for (let i = 0; i < 4; i++) s.line(23 + i * 6, 46, 23 + i * 6, 52, '#2a1a10', 1.5);
  },
  armor: (s) => {
    s.path('M18 8 L28 12 Q32 16 36 12 L46 8 L56 18 L50 26 L48 56 L16 56 L14 26 L8 18 Z', steel(s), OUT);
    s.path('M32 16 L32 54', 'none', 'stroke="#6a7484" stroke-width="2"');
    s.path('M20 30 Q32 36 44 30', 'none', 'stroke="#ffc93c" stroke-width="2.5"');
  },
  tower: (s) => {
    s.path('M18 58 L20 22 L44 22 L46 58 Z', s.lin([[0, '#e4dccb'], [1, '#8a8070']], 0, 0, 1, 0), OUT);
    for (let i = 0; i < 4; i++) s.rect(16 + i * 8.5, 12, 6, 10, '#c8beac', 'stroke="#20160e" stroke-width="1.5"');
    s.path('M28 58 L28 44 Q32 38 36 44 L36 58 Z', '#3a2414');
    s.rect(29, 28, 6, 8, '#ffc93c');
  },
  boot: (s) => s.path('M20 6 L38 6 L38 36 L56 44 L56 56 L14 56 L14 46 L20 40 Z', s.lin([[0, '#a0704a'], [1, '#4a2a12']]), OUT),
  cart: (s) => {
    s.path('M8 18 L56 18 L50 40 L14 40 Z', wood(s), OUT);
    s.circle(20, 46, 9, '#4a3020', OUT); s.circle(44, 46, 9, '#4a3020', OUT);
    s.circle(20, 46, 3, '#c8a070'); s.circle(44, 46, 3, '#c8a070');
    s.ellipse(32, 18, 20, 7, gold(s), 'stroke="#7a4a08" stroke-width="1.4"');
  },
  pick: (s) => {
    s.line(16, 56, 40, 20, '#6a3e1c', 5);
    s.path('M14 14 Q34 2 56 20 Q36 12 18 20 Z', steel(s), OUT);
  },
  herb: (s) => {
    s.path('M32 58 Q30 36 32 14', 'none', 'stroke="#3a6a2a" stroke-width="3"');
    for (const [y, d] of [[44, -1], [34, 1], [24, -1], [16, 1]] as const) s.path(`M32 ${y} Q${32 + d * 20} ${y - 12} ${32 + d * 22} ${y + 2} Q${32 + d * 10} ${y + 6} 32 ${y} Z`, s.lin([[0, '#9ae86a'], [1, '#2a7a2a']]), 'stroke="#1a4a1a" stroke-width="1.5"');
  },
  coin: (s) => ICONS.gold(s),
  crystal: (s) => ICONS.aether(s),
  quest: (s) => {
    s.rect(14, 10, 36, 46, s.lin([[0, '#f8ecc8'], [1, '#c8a870']]), `rx="3" ${OUT}`);
    s.add(`<rect x="10" y="6" width="44" height="8" rx="4" fill="${wood(s)}" ${OUT}/>`);
    s.add(`<rect x="10" y="52" width="44" height="8" rx="4" fill="${wood(s)}" ${OUT}/>`);
    for (let i = 0; i < 4; i++) s.line(20, 22 + i * 7, 44, 22 + i * 7, '#8a6a3a', 2);
    s.path('M44 40 l4 6 l-8 0 z', '#c83a2a');
  },
  mail: (s) => {
    s.rect(8, 16, 48, 34, s.lin([[0, '#f8ecc8'], [1, '#c8a870']]), `rx="3" ${OUT}`);
    s.path('M8 18 L32 36 L56 18', 'none', 'stroke="#20160e" stroke-width="2"');
    s.circle(32, 36, 6, '#c83a2a', 'stroke="#5a1a0a" stroke-width="1.5"');
  },
  bag: (s) => {
    s.path('M20 18 Q32 10 44 18 L52 50 Q52 58 44 58 L20 58 Q12 58 12 50 Z', s.lin([[0, '#c8905a'], [1, '#6a3e1c']]), OUT);
    s.path('M22 18 Q32 4 42 18', 'none', 'stroke="#20160e" stroke-width="3"');
    s.rect(26, 30, 12, 10, gold(s), 'rx="2" stroke="#5a3a08" stroke-width="1.5"');
  },
  gear: (s) => {
    s.circle(32, 32, 18, steel(s), OUT);
    for (let i = 0; i < 8; i++) s.add(`<rect x="28" y="4" width="8" height="12" rx="2" fill="#c8d0dc" stroke="#20160e" stroke-width="1.8" transform="rotate(${i * 45} 32 32)"/>`);
    s.circle(32, 32, 18, steel(s));
    s.circle(32, 32, 7, '#3a4250', OUT);
  },
  map: (s) => {
    s.path('M6 14 L22 8 L42 14 L58 8 L58 50 L42 56 L22 50 L6 56 Z', s.lin([[0, '#f8ecc8'], [1, '#c8a870']]), OUT);
    s.path('M22 8 L22 50 M42 14 L42 56', 'none', 'stroke="#8a6a3a" stroke-width="1.5"');
    s.path('M12 40 Q24 30 30 36 T50 22', 'none', 'stroke="#c83a2a" stroke-width="2.5" stroke-dasharray="4 3"');
    s.path('M48 18 l5 5 m0 -5 l-5 5', 'none', 'stroke="#c83a2a" stroke-width="2.5"');
  },
  castle: (s) => {
    s.path('M8 58 L8 26 L16 26 L16 20 L22 20 L22 26 L26 26 L26 14 L30 8 L34 8 L38 14 L38 26 L42 26 L42 20 L48 20 L48 26 L56 26 L56 58 Z', s.lin([[0, '#f0e8d8'], [1, '#9a9080']], 0, 0, 1, 0), OUT);
    s.path('M26 58 L26 44 Q32 36 38 44 L38 58 Z', '#3a2414');
    s.path('M30 8 L34 8 L32 2 Z', '#5a8ae8');
  },
  hero: (s) => {
    s.path('M14 34 Q14 10 32 8 Q50 10 50 34 L50 44 L42 52 L22 52 L14 44 Z', steel(s), OUT);
    s.path('M20 30 L44 30 L44 36 L34 36 L32 48 L30 36 L20 36 Z', '#20160e');
    s.path('M32 8 Q36 0 44 2 Q38 4 36 10 Z', '#c83a2a', OUT);
  },
  troops: (s) => {
    for (const [x, c] of [[20, '#5a8ae8'], [44, '#c83a2a'], [32, '#ffc93c']] as const) {
      s.circle(x, 22, 8, '#e8c8a8', 'stroke="#20160e" stroke-width="1.6"');
      s.path(`M${x - 11},58 L${x - 9},36 Q${x},28 ${x + 9},36 L${x + 11},58 Z`, c, 'stroke="#20160e" stroke-width="1.6"');
    }
  },
  lock: (s) => {
    s.path('M20 28 L20 20 Q20 8 32 8 Q44 8 44 20 L44 28', 'none', 'stroke="#8a929e" stroke-width="5"');
    s.rect(14, 28, 36, 28, gold(s), `rx="4" ${OUT}`);
    s.circle(32, 40, 4, '#20160e'); s.rect(30.5, 42, 3, 8, '#20160e');
  },
  star: (s) => s.path('M32 4 L40 23 L60 24 L44 37 L50 58 L32 46 L14 58 L20 37 L4 24 L24 23 Z', gold(s), OUT),
  clock: (s) => {
    s.circle(32, 32, 26, s.lin([[0, '#f8f4ea'], [1, '#c8beac']]), OUT);
    s.line(32, 32, 32, 16, '#20160e', 3); s.line(32, 32, 44, 38, '#20160e', 3);
    s.circle(32, 32, 3, '#c83a2a');
  },
  titan: (s) => {
    s.path('M8 40 Q18 14 32 18 Q46 14 56 40 L48 34 L44 46 L32 36 L20 46 L16 34 Z', s.lin([[0, '#7fe3ff'], [1, '#1a4a8a']]), OUT);
    s.circle(26, 28, 2.5, '#fff'); s.circle(38, 28, 2.5, '#fff');
    s.path('M24 18 L20 6 L28 16 M40 18 L44 6 L36 16', 'none', 'stroke="#20160e" stroke-width="2.5"');
  },
  calendar: (s) => {
    s.rect(8, 12, 48, 44, s.lin([[0, '#f8f4ea'], [1, '#c8beac']]), `rx="4" ${OUT}`);
    s.rect(8, 12, 48, 12, '#c83a2a', `rx="4" ${OUT}`);
    s.line(20, 6, 20, 16, '#20160e', 3); s.line(44, 6, 44, 16, '#20160e', 3);
    s.add('<text x="32" y="50" font-family="Georgia,serif" font-size="22" font-weight="bold" fill="#20160e" text-anchor="middle">7</text>');
  },
  gift: (s) => {
    s.rect(10, 26, 44, 30, s.lin([[0, '#c27bff'], [1, '#5a1a9a']]), `rx="2" ${OUT}`);
    s.rect(6, 18, 52, 10, s.lin([[0, '#d89aff'], [1, '#7a3aba']]), `rx="2" ${OUT}`);
    s.rect(28, 18, 8, 38, gold(s));
    s.path('M32 18 Q20 2 14 12 Q14 18 32 18 Q44 18 50 12 Q44 2 32 18 Z', gold(s), 'stroke="#5a3a08" stroke-width="1.5"');
  },
  trophy: (s) => {
    s.path('M18 8 L46 8 L44 30 Q40 40 32 40 Q24 40 20 30 Z', gold(s), OUT);
    s.path('M18 12 Q6 12 8 22 Q10 30 20 28 M46 12 Q58 12 56 22 Q54 30 44 28', 'none', 'stroke="#c8902a" stroke-width="3"');
    s.rect(28, 40, 8, 8, gold(s));
    s.rect(18, 48, 28, 8, wood(s), `rx="2" ${OUT}`);
  },
  inf: (s) => ICONS.shield(s),
  arc: (s) => ICONS.bow(s),
  cav: (s) => {
    s.path('M14 58 L18 38 Q14 28 22 18 Q28 8 40 8 L46 4 L46 12 Q56 18 56 30 L48 32 L44 26 L36 32 L40 58 Z', s.lin([[0, '#c8905a'], [1, '#5a3010']]), OUT);
    s.circle(42, 16, 2.5, '#20160e');
    s.path('M22 18 Q20 32 26 40', 'none', 'stroke="#3a2010" stroke-width="3"');
  },
  mag: (s) => {
    s.line(22, 58, 38, 18, '#6a3e1c', 4.5);
    crystal(s, 40, 22, 22, '#c27bff');
    s.circle(48, 10, 2, '#fff'); s.circle(30, 14, 1.6, '#fff');
  },
  plus: (s) => { s.rect(26, 8, 12, 48, '#5ad85a', `rx="3" ${OUT}`); s.rect(8, 26, 48, 12, '#5ad85a', `rx="3" ${OUT}`); },
  check: (s) => s.path('M8 34 L24 50 L56 14 L48 8 L24 36 L14 26 Z', s.lin([[0, '#9ae86a'], [1, '#2a8a2a']]), OUT),
  arrowUp: (s) => s.path('M32 6 L56 32 L42 32 L42 58 L22 58 L22 32 L8 32 Z', s.lin([[0, '#9ae86a'], [1, '#2a8a2a']]), OUT),
  camp: (s) => {
    s.path('M6 54 L32 14 L58 54 Z', s.lin([[0, '#6a3a8a'], [1, '#2a1030']], 0, 0, 1, 0), OUT);
    s.path('M26 54 L32 34 L38 54 Z', '#100810');
    s.circle(32, 26, 3, '#ff4af0');
  },
  node: (s) => ICONS.pick(s),
  ruin: (s) => {
    s.path('M10 58 L10 22 L18 18 L18 58 Z M30 58 L30 30 L38 28 L38 58 Z M46 58 L46 14 L54 12 L54 58 Z', s.lin([[0, '#e4dccb'], [1, '#8a8070']], 0, 0, 1, 0), OUT);
    s.path('M8 22 L56 10 L56 16 L8 28 Z', '#c8beac', OUT);
  },
  rift: (s) => {
    s.circle(32, 32, 26, s.rad([[0, '#ffffff'], [0.3, '#ff4af0'], [0.7, '#5a1a9a'], [1, '#5a1a9a', 0]]));
    s.path('M32 10 Q50 20 44 36 Q36 50 22 42 Q12 32 24 24 Q32 20 36 30', 'none', 'stroke="#fff" stroke-width="2.5" opacity=".8"');
  },
  lord: (s) => ICONS.castle(s),
  report: (s) => ICONS.mail(s),
  attack: (s) => {
    s.path('M44 6 L58 6 L58 20 L26 44 L20 38 Z', steel(s), OUT);
    s.path('M20 6 L6 6 L6 20 L38 44 L44 38 Z', steel(s), OUT);
    s.line(22, 50, 14, 58, '#6a3e1c', 6); s.line(42, 50, 50, 58, '#6a3e1c', 6);
  },
  info: (s) => {
    s.circle(32, 32, 26, s.lin([[0, '#7ab8ff'], [1, '#1a4a9a']]), OUT);
    s.add('<text x="32" y="44" font-family="Georgia,serif" font-size="34" font-weight="bold" fill="#fff" text-anchor="middle">i</text>');
  },
  speed: (s) => ICONS.hourglass(s),
  home: (s) => ICONS.castle(s),
  gauntlet: (s) => {
    s.path('M16 58 L14 34 Q14 26 20 24 L22 10 Q22 6 26 6 Q30 6 30 10 L30 22 L32 8 Q32 4 36 4 Q40 4 40 8 L40 22 L42 10 Q42 6 46 6 Q50 6 50 10 L50 34 L48 58 Z', steel(s), OUT);
    s.rect(14, 44, 36, 8, gold(s), 'stroke="#5a3a08" stroke-width="1.5"');
  },
  amulet: (s) => {
    s.path('M14 6 Q32 34 50 6', 'none', 'stroke="#c8902a" stroke-width="3"');
    s.circle(32, 40, 16, gold(s), OUT);
    s.circle(32, 40, 9, s.rad([[0, '#e8fbff'], [0.6, '#5ad8ff'], [1, '#1a5aa8']]), 'stroke="#20160e" stroke-width="1.5"');
    s.circle(29, 37, 2.4, '#fff', 'opacity=".8"');
  },
  ore: (s) => {
    s.poly([[8, 46], [16, 22], [34, 12], [54, 24], [58, 46], [40, 56], [18, 56]], s.lin([[0, '#9a948a'], [1, '#3a3632']], 0, 0, 1, 1), OUT);
    for (const [x, y] of [[24, 30], [40, 26], [34, 42], [46, 40], [22, 46]]) s.poly([[x, y - 5], [x + 5, y], [x, y + 5], [x - 5, y]], s.lin([[0, '#e8f0ff'], [1, '#7a8aa8']]), 'stroke="#2a3040" stroke-width="1"');
  },
  leather: (s) => {
    s.path('M10 14 Q20 8 32 12 Q44 8 54 14 Q50 26 56 36 Q46 46 50 56 Q32 50 14 56 Q18 44 8 36 Q14 26 10 14 Z', s.lin([[0, '#c8905a'], [1, '#6a3e1c']]), OUT);
    s.path('M18 22 Q32 28 46 22 M18 42 Q32 36 46 42', 'none', 'stroke="#4a2a12" stroke-width="1.6" stroke-dasharray="3 3"');
  },
  bone: (s) => {
    const g = s.lin([[0, '#fff8e8'], [1, '#bfae8a']]);
    s.path('M14 48 L44 18', 'none', 'stroke="#20160e" stroke-width="12" stroke-linecap="round"');
    s.path('M14 48 L44 18', 'none', `stroke="${g}" stroke-width="8" stroke-linecap="round"`);
    for (const [x, y] of [[10, 44], [18, 52], [40, 14], [48, 22]]) s.circle(x, y, 7, g, OUT);
    s.circle(30, 32, 16, s.rad([[0, '#c27bff', 0.4], [1, '#c27bff', 0]]));
  },
  crystalMat: (s) => {
    crystal(s, 24, 56, 34, '#7fe3ff');
    crystal(s, 42, 58, 26, '#b56cff');
  },
  move: (s) => {
    s.path('M32 6 Q48 6 48 22 Q48 34 32 58 Q16 34 16 22 Q16 6 32 6 Z', s.lin([[0, '#ff7a6a'], [1, '#a01a1a']]), OUT);
    s.circle(32, 22, 6, '#fff');
  },
};

function keyIcon(s: Svg, fill: string) {
  s.circle(20, 22, 13, fill, OUT);
  s.circle(20, 22, 5, '#20160e');
  s.path('M28 30 L54 56 L48 60 L44 56 L40 58 L36 54 L40 50 L24 34 Z', fill, OUT);
}

function chestIcon(s: Svg, body: string, metal: string) {
  s.path('M8 30 L56 30 L56 56 L8 56 Z', body, OUT);
  s.path('M8 30 Q8 12 32 12 Q56 12 56 30 Z', body, OUT);
  s.rect(6, 28, 52, 6, metal, `rx="1" ${OUT}`);
  s.rect(14, 12, 6, 44, metal, 'opacity=".9"');
  s.rect(44, 12, 6, 44, metal, 'opacity=".9"');
  s.rect(26, 26, 12, 14, metal, `rx="2" ${OUT}`);
  s.circle(32, 33, 2.4, '#20160e');
}

const cache = new Map<string, string>();

export function iconSvg(name: string, size = 64): string {
  const s = new Svg(64, 64);
  (ICONS[name] ?? ICONS.info)(s);
  const str = s.toString();
  return size === 64 ? str : str.replace('width="64" height="64"', `width="${size}" height="${size}"`);
}

export function iconUrl(name: string): string {
  let u = cache.get(name);
  if (!u) { u = hasArt('icon_' + name) ? artUrl('icon_' + name) : svgUrl(iconSvg(name)); cache.set(name, u); }
  return u;
}

export const ICON_NAMES = Object.keys(ICONS);

export { shade };
