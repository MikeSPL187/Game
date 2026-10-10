// Generates copy-ready image prompts for the art pipeline (see docs/art/STYLEGUIDE.md).
// usage: node scripts/art-prompts.mjs
//   docs/art/PROMPTS*.md   one prompt per asset (Midjourney / ChatGPT / API)
//   docs/art/prompts.json  the same list for scripts/art-generate.mjs (OpenAI API batch)
//   docs/art/SHEETS*.md    ChatGPT sheets: several assets per generation, file named by sheet id
//   docs/art/sheets.json   sheet layouts used by scripts/art-import.mjs to cut sheets apart
import { readFileSync, writeFileSync } from 'node:fs';

const STYLE = 'stylized 3D game asset in the style of premium mobile 4X strategy games, hand-painted PBR textures, chunky readable shapes, slightly exaggerated proportions, rich but natural colors, warm golden-hour key light from the upper left, soft cool fill light from the right, subtle rim light, crisp high detail, clean silhouette';
const ISO = 'classic 2:1 isometric view, camera 30 degrees above the horizon rotated 45 degrees, seen from the front corner, the footprint is a diamond, left wall brighter than the right wall, the whole object fully in frame, centered with margins';
const CUT = 'isolated on a transparent background, no ground, no cast shadow, no text, no frame, no people';
const MJ = '--ar 1:1 --style raw --sref <ETALON_URL> --sw 200 --no text, people, ground, shadow';

const FACTION = {
  order: { name: 'Солнечный Орден', mat: 'white limestone and pale sandstone walls, slate-blue tiled roofs, polished gold trim, pointed arches, royal blue banners with a golden sun emblem, noble paladin architecture' },
  wild: { name: 'Дикий Завет', mat: 'dark timber and mossy fieldstone, roofs of living turf and green thatch, carved antlers and druidic runes, glowing green spirit lanterns, emerald banners with a stag emblem, buildings intertwined with ancient trees' },
  ash: { name: 'Пепельные Кланы', mat: 'black basalt and volcanic stone, rusted iron plates and spikes, terracotta-red roof tiles, glowing lava cracks and fire braziers, crimson banners with a flame emblem, brutal clan fortress architecture' },
};

const TIERS = [
  'tier 1: small and modest, mostly timber on a stone foundation, simple details',
  'tier 2: medium size, stone walls, tiled roof, more windows and decorations, a small banner',
  'tier 3: large and grand, multi-level, ornate carved stone, gold trim, several banners',
  'tier 4: monumental masterpiece, gilded details, glowing blue aether crystals and magical light, the most impressive version',
];

const BUILDINGS = [
  ['citadel', 'Цитадель', "the lord's citadel: a central castle keep with a tall main tower, smaller corner towers, battlements and a grand gate, the largest building of the city"],
  ['farm', 'Ферма', 'a farmstead with a barn, a small windmill and golden wheat fields around it'],
  ['sawmill', 'Лесопилка', 'a lumber mill with a big circular saw and a water wheel, stacks of logs and planks, a timber crane'],
  ['quarry', 'Каменоломня', 'a stone quarry: a cut rock face with terraces, stacked stone blocks, a wooden crane and a mine cart'],
  ['goldmine', 'Золотой рудник', 'a gold mine entrance in a rocky outcrop with wooden supports, mine carts full of glittering gold ore, a small headframe'],
  ['barracks', 'Казармы', 'infantry barracks: a long military hall with a training yard, weapon racks, shields and practice dummies'],
  ['range', 'Стрельбище', 'an archery range: a hall with a covered gallery, straw targets, bow and arrow racks'],
  ['stable', 'Конюшни', 'cavalry stables: horse stalls under a long roof, hay bales, a water trough, a paddock fence, a saddled horse'],
  ['spire', 'Шпиль чародеев', "a mage spire: a tall slender wizard tower with spiral balconies, a floating aether crystal at the top, arcane runes"],
  ['academy', 'Академия', 'an academy of sciences: a domed hall with columns, a small observatory and an armillary sphere on the roof'],
  ['infirmary', 'Лазарет', 'an infirmary: a clean white healers hall with a green leaf emblem, an herb garden, small canvas tents for the wounded'],
  ['tavern', 'Таверна героев', 'a heroes tavern: a cozy two-story timber-framed inn, a hanging sign with a mug, barrels, warm glowing windows, a chimney'],
  ['warehouse', 'Хранилище', 'a storehouse: a sturdy warehouse with a loading crane, crates, sacks and barrels, reinforced doors'],
  ['watchtower', 'Дозорная башня', 'a tall watchtower with a lookout platform, a signal fire brazier and a horn'],
  ['forge', 'Кузница', 'a blacksmith forge: an open glowing furnace, an anvil, a tall chimney, weapon racks and a quench barrel'],
  ['embassy', 'Посольство', 'an embassy and alliance hall: a council hall with a round tower and a row of flags of many allied houses in different colors, a small plaza with a fountain'],
  ['sanctum', 'Святилище титанов', 'a titan sanctum: a circular stone platform with a ring of pillars topped by crystals, a large floating blue aether crystal in the center, a glowing runic circle'],
  ['wall', 'Ворота крепости', 'a fortress gatehouse: two strong towers flanking a gate with a portcullis, short wall stubs on both sides'],
];

/** every asset in prompt order: { name, stage, title, prompt, size } */
const ASSETS = [];
let STAGE = '0';
const apiSize = (s) => (/3:4|768×1024/.test(s) ? '1024x1536' : /3:2|16:9|1024×512/.test(s) ? '1536x1024' : '1024x1024');

const block = (title, file, size, prompt, mj = MJ) => {
  const name = file.replace(/\.png$/, '');
  if (!ASSETS.some((a) => a.name === name)) ASSETS.push({ name, stage: STAGE, title, prompt, size: apiSize(size) });
  return `### ${title}\n\`${file}\` · ${size}\n\n\`\`\`\n${prompt}\n\`\`\`\n<sub>Midjourney: добавьте в конец</sub> \`${mj}\`\n\n`;
};

function buildings(fac) {
  const f = FACTION[fac];
  let out = '';
  for (const [id, ru, what] of BUILDINGS) {
    out += `\n## ${ru} (${f.name})\n\n`;
    TIERS.forEach((t, i) => {
      const p = `${what}, ${f.mat}, ${t}. ${ISO}. ${STYLE}. ${CUT}.`;
      out += block(`${ru} — T${i + 1}`, `bld_${id}_${fac}_t${i + 1}.png`, '1024×1024, прозрачный фон', p);
    });
  }
  return out;
}

const pilot = () => {
  const f = FACTION.order;
  const c = BUILDINGS[0], farm = BUILDINGS[1];
  let out = '\n# Этап 0 — пилот (5 изображений)\n\nСначала **T3** — это эталон стиля. Затем T1, T2, T4 по нему (загрузите T3 как референс: «то же здание, другой уровень»).\n\n';
  for (const i of [2, 0, 1, 3]) out += block(`Цитадель — T${i + 1}${i === 2 ? ' (ЭТАЛОН, первым)' : ''}`, `bld_citadel_order_t${i + 1}.png`, '1024×1024, прозрачный фон', `${c[2]}, ${f.mat}, ${TIERS[i]}. ${ISO}. ${STYLE}. ${CUT}.`, i === 2 ? MJ.replace(' --sref <ETALON_URL> --sw 200', '') : MJ);
  out += block('Ферма — T1', 'bld_farm_order_t1.png', '1024×1024, прозрачный фон', `${farm[2]}, ${f.mat}, ${TIERS[0]}. ${ISO}. ${STYLE}. ${CUT}.`);
  return out;
};

const TEX = 'seamless tileable texture, flat top-down view, even lighting, no perspective, no objects casting shadows, painterly stylized game texture, consistent scale';
const MJT = '--ar 1:1 --tile --style raw --sref <ETALON_URL> --sw 100';
const cityGround = () => {
  let out = '\n## Текстуры земли города\n\n';
  for (const [id, ru, what] of [
    ['city_grass', 'Трава', 'lush green lawn grass with tiny clover and a few small flowers'],
    ['city_plaza', 'Мощёная площадь', 'cobblestone plaza made of light worn stones with moss in the gaps'],
    ['city_road', 'Дорога', 'packed dirt road with small pebbles and cart tracks'],
  ]) out += block(ru, `tex_${id}.png`, '1024×1024, бесшовная', `${what}. ${TEX}.`, MJT);
  out += block('Стройплощадка', 'bld_construction.png', '1024×1024, прозрачный фон', `a construction site: wooden scaffolding, piles of planks and cut stones, ropes, a small wooden crane, on a diamond-shaped dirt plot. ${ISO}. ${STYLE}. ${CUT}.`);
  out += block('Отрезок стены (по диагонали ↗)', 'bld_wall_segment_order.png', '1024×512, прозрачный фон', `a straight castle wall segment with battlements running diagonally from bottom-left to top-right, modular piece that can be repeated end to end, ${FACTION.order.mat}. ${ISO}. ${STYLE}. ${CUT}.`, MJ.replace('1:1', '2:1'));
  out += block('Угловая башня стены', 'bld_wall_tower_order.png', '1024×1024, прозрачный фон', `a round castle wall tower with battlements and a conical roof, ${FACTION.order.mat}. ${ISO}. ${STYLE}. ${CUT}.`);
  return out;
};

const WORLD_OBJS = [
  ['camp_1', 'Логово Пустоты 1', 'a void creature camp: tattered dark purple tents, a bone totem with a skull with glowing pink eyes, corrupted purple crystals, a campfire, purple mist'],
  ['camp_2', 'Логово Пустоты 2', 'a void creature lair: a cave mouth in black rocks, corrupted purple crystals growing around, bones, purple glow from inside'],
  ['camp_3', 'Логово Пустоты 3', 'a void creature nest: twisted dark thorny spires, pulsing purple egg sacs, corrupted crystals'],
  ['node_food', 'Поля (ресурс)', 'a patch of ripe golden wheat fields with haystacks and a small scarecrow'],
  ['node_wood', 'Лес (ресурс)', 'a logging spot: a cluster of tall pine trees, felled logs and a stack of timber'],
  ['node_stone', 'Каменоломня (ресурс)', 'a rocky outcrop of grey stone with cut blocks'],
  ['node_gold', 'Золотая жила (ресурс)', 'a rocky outcrop with glittering gold veins and gold nuggets'],
  ['ruin_1', 'Руины 1', 'ancient temple ruins: broken marble columns, a collapsed arch, overgrown with ivy'],
  ['ruin_2', 'Руины 2', 'a ruined watchtower of an old kingdom, crumbling stone, a faded banner'],
  ['ruin_3', 'Руины 3', 'ancient sky-throne debris: a broken golden statue and a fallen ornate pillar with faint blue runes'],
  ['rift', 'Эфирный разлом', 'an aether rift: a glowing purple and blue swirling tear in the ground, floating rock shards and crystals around it'],
  ['city_order', 'Замок игрока (Орден)', `a walled castle town, ${FACTION.order.mat}`],
  ['city_wild', 'Замок игрока (Завет)', `a walled forest stronghold, ${FACTION.wild.mat}`],
  ['city_ash', 'Замок игрока (Кланы)', `a walled war fortress, ${FACTION.ash.mat}`],
  ['mountain_1', 'Гора 1', 'a rocky mountain peak with cliffs'],
  ['mountain_2', 'Гора 2', 'a pair of jagged mountain peaks'],
  ['mountain_3', 'Гора 3', 'a broad massive mountain with layered rock'],
  ['snowpeak_1', 'Снежная гора 1', 'a snowy mountain peak with ice'],
  ['snowpeak_2', 'Снежная гора 2', 'a pair of snow-capped jagged peaks'],
  ['snowpeak_3', 'Снежная гора 3', 'a broad massive snow-covered mountain'],
  ['hill_1', 'Холм', 'a low grassy hill with a few rocks'],
  ['tree_pine', 'Сосна', 'a single tall pine tree'],
  ['tree_oak', 'Дуб', 'a single broad oak tree'],
  ['tree_birch', 'Берёза', 'a single white birch tree with light green leaves'],
  ['tree_dead', 'Мёртвое дерево', 'a single dead twisted swamp tree without leaves'],
  ['tree_ash', 'Обгоревшее дерево', 'a single charred burnt tree with glowing embers'],
  ['boat', 'Лодка', 'a small wooden sailing boat with a cream sail and a blue stripe, side view facing right'],
];

const MAP = 'a miniature on a strategy world map, small scale object seen from far away. ' + ISO;
const world = () => {
  let out = '\n# Этап B — карта мира\n\n## Объекты\n\n';
  for (const [id, ru, what] of WORLD_OBJS) out += block(ru, `wobj_${id}.png`, '1024×1024, прозрачный фон', `${what}, ${MAP}. ${STYLE}. ${CUT}.`);
  out += '\n## Текстуры биомов (бесшовные)\n\n';
  for (const [id, ru, what] of [
    ['grass', 'Равнина', 'green grassland with subtle variation'], ['meadow', 'Луг', 'flower meadow with small yellow and white flowers'],
    ['forest', 'Лесная подстилка', 'dark forest floor with moss, needles and ferns'], ['sand', 'Песок', 'warm beach sand with small ripples'],
    ['hills', 'Холмы', 'dry rocky grassland'], ['mountain', 'Скалы', 'grey-brown rocky ground'], ['snow', 'Снег', 'fresh snow with soft blue shadows'],
    ['ash', 'Пепельные земли', 'dark volcanic ash ground with faint glowing cracks'], ['swamp', 'Болото', 'murky swamp mud with puddles and reeds'],
  ]) out += block(ru, `tex_${id}.png`, '1024×1024, бесшовная', `${what}, seen from high above at map scale. ${TEX}.`, MJT);
  out += '\n## Титаны на карте\n\n';
  for (const [id, ru, what] of TITANS) out += block(ru, `titan_${id}_map.png`, '1024×1024, прозрачный фон', `${what}, a colossal titan standing on the world map. ${ISO}. ${STYLE}. ${CUT}.`);
  return out;
};

const TITANS = [
  ['roc', 'Громокрыл', 'Stormwing, a colossal storm eagle with feathers of dark thunderclouds and crackling blue lightning, glowing white eyes'],
  ['golem', 'Камнепанцирь', 'Stoneshell, a walking mountain golem with a moss-covered rock body, trees on its back and glowing blue aether crystal veins'],
  ['wyrm', 'Пепельный Змей', 'the Ash Wyrm, an ancient obsidian dragon with glowing lava cracks, horns and ember-filled wings'],
];

const PORTRAIT = 'fantasy hero portrait, chest-up, three-quarter view turned slightly to the left, looking at the viewer, the head in the upper third of the image, same framing for every hero, stylized 3D render like premium mobile RPG hero art, detailed face, expressive eyes, painterly blurred background in faction colors with soft bokeh, cinematic light from the upper left';
const HEROES = [
  ['aerena', 'Айрена', 'order', 'a legendary female paladin, long golden-blond hair, radiant white-and-gold plate armor with sun motifs, a tower shield, glowing light-blue eyes, holy light aura'],
  ['kael', 'Каэль', 'wild', 'a legendary exiled archmage, hooded, short dark beard, storm-blue and dark green robes with druidic runes, blue lightning crackling in his palm, glowing eyes'],
  ['grom', 'Гром', 'ash', 'a legendary ash-clan warlord, black mohawk, braided beard, a scar across the face, tribal ember tattoos, heavy blackened armor with a fire-serpent horn trophy, ember glow'],
  ['lyra', 'Лира', 'wild', 'an elven female ranger with pointed ears and braided auburn hair, a leaf-green hooded cloak, a longbow over the shoulder, calm focused gaze'],
  ['torvald', 'Торвальд', 'order', 'a veteran shieldbearer with a steel helmet and a braided grey beard, heavy steel plate with a royal blue tabard, a big round shield'],
  ['syra', 'Сайра', 'wild', 'a moon witch with long silver hair and pointed ears, deep teal and silver robes, a crescent-moon staff, soft moonlight glow'],
  ['varg', 'Варг', 'ash', 'a half-wolf man hunter with pointed wolf ears, short dark hair, fangs, a scar, a wolf-pelt mantle over dark leather and iron armor'],
  ['orian', 'Ориан', 'order', 'an old bald magister with a long white beard, blue scholar robes with leather pauldrons, a blue aether crystal pendant, holding a rolled map'],
  ['brenn', 'Бренн', 'wild', 'a young hooded hunter, a fur collar over leather armor, a bow, a hunting knife, freckles'],
  ['mira', 'Мира', 'order', 'a female militia captain with short brown hair, practical chainmail with a blue tabard with a wheat emblem, a spear'],
  ['ulf', 'Ульф', 'ash', 'a bald bearded former blacksmith turned warrior with a scar, a leather apron over iron armor, a heavy two-handed axe'],
  ['sella', 'Селла', 'wild', 'a female rider-messenger with two braids, light leather armor, a windswept green scarf, a courier satchel'],
];
const FBG = { order: 'gold and royal blue', wild: 'emerald green and forest teal', ash: 'crimson and ember orange' };

const people = () => {
  let out = '\n# Этап C — персонажи и ключевой арт\n\n## Портреты героев\n\n';
  for (const [id, ru, fac, what] of HEROES) out += block(`${ru} (${FACTION[fac].name})`, `hero_${id}.png`, '768×1024 (3:4)', `${what}. ${PORTRAIT}, background ${FBG[fac]}. No text, no frame.`, '--ar 3:4 --style raw --sref <ETALON_URL> --sw 150');
  out += '\n## Арт титанов (для Святилища)\n\n';
  for (const [id, ru, what] of TITANS) out += block(ru, `titan_${id}_art.png`, '1536×1024 (3:2)', `${what}, epic dramatic splash art, full body, towering over a tiny fortress, stormy sky. ${STYLE}. No text.`, '--ar 3:2 --style raw --sref <ETALON_URL> --sw 150');
  out += '\n## Ключевой арт\n\n';
  out += block('Экран загрузки', 'key_loading.png', '1920×1080 (16:9)', `epic fantasy landscape: a shining citadel on a cliff above a valley, giant titans silhouetted in the distance under a stormy sky with falling blue aether shards, empty space at the top for the game logo. ${STYLE}. No text.`, '--ar 16:9 --style raw --sref <ETALON_URL> --sw 150');
  for (const [fac, what] of [['order', 'paladins of the Sun Order in white-and-gold armor before a white citadel, golden sunlight'], ['wild', 'druids, rangers and a great stag in an ancient glowing forest'], ['ash', 'ash-clan warriors on horseback before a volcanic fortress, embers in the air']])
    out += block(`Выбор фракции: ${FACTION[fac].name}`, `key_faction_${fac}.png`, '768×1024 (3:4)', `${what}, heroic key art. ${STYLE}. No text.`, '--ar 3:4 --style raw --sref <ETALON_URL> --sw 150');
  return out;
};

const UNIT = 'a single battle unit, full body, side three-quarter view facing right, standing in a dynamic ready pose. ' + STYLE + '. ' + CUT;
const ICON = 'game UI icon, stylized 3D render, thick bold shapes, strong rim light, slight three-quarter angle, centered with margins, readable at small size, isolated on a transparent background, no text, no frame';
const ICONS = [
  ['food', 'a golden wheat sheaf'], ['wood', 'a bundle of logs'], ['stone', 'a cut grey stone block'], ['gold', 'a pile of gold coins'],
  ['aether', 'a glowing blue aether crystal'], ['power', 'a red shield with a golden lightning bolt'], ['hourglass', 'an ornate golden hourglass with blue sand'],
  ['tome1', 'a rolled parchment scroll with a blue ribbon'], ['tome2', 'a closed blue book with gold corners'], ['tome3', 'a thick ornate purple folio with a glowing gem'],
  ['key_silver', 'an ornate silver key'], ['key_gold', 'an ornate golden key with a blue gem'], ['shard', 'a glowing hero soul shard, purple crystal'],
  ['shieldItem', 'a blue magic peace shield with a dove emblem'], ['chest', 'a wooden treasure chest with iron bands'], ['chest_gold', 'a luxurious golden treasure chest with gems'],
  ['ore', 'a chunk of iron ore'], ['leather', 'a roll of tanned leather'], ['bone', 'a pale purple void bone'], ['crystalMat', 'a cluster of small aether crystals'],
  ['essence', 'a glass vial of glowing aether essence'], ['inf', 'a crossed sword and shield (infantry)'], ['arc', 'a longbow with an arrow (archers)'],
  ['cav', 'a horse head with a lance (cavalry)'], ['mag', 'a mage staff with a glowing orb (mages)'], ['quest', 'a quest scroll with a red seal'],
  ['mail', 'a sealed envelope with a red wax seal'], ['bag', 'a leather adventurer backpack'], ['map', 'a folded treasure map'], ['castle', 'a small castle'],
  ['hero', 'a knight helmet with a plume'], ['troops', 'a group of three soldiers silhouettes in colored tabards'], ['book', 'an open spellbook with a glowing rune'],
  ['gift', 'a purple gift box with a gold ribbon'], ['trophy', 'a golden trophy cup'], ['calendar', 'a calendar parchment with a golden star'],
  ['gear', 'a bronze settings gear'], ['banner', 'a blue alliance banner with a golden emblem'], ['skull', 'a horned skull with glowing pink eyes (void hunt)'],
  ['titan', 'a stone titan head with glowing blue eyes'], ['hammer', 'a builder hammer'], ['gauntlet', 'an armored gauntlet'], ['armor', 'a steel breastplate'],
  ['sword', 'a fine steel sword'], ['heart', 'a red heart with a green leaf (healing)'],
];

const UNITS = [
  ['order_inf', 'Пехота', 'a royal infantry soldier in steel armor with a blue tabard, a spear and a big shield'],
  ['order_arc', 'Лучник', 'a royal archer in a blue hood and leather armor drawing a longbow'],
  ['order_cav', 'Кавалерия', 'a royal knight in blue-and-steel armor on a brown warhorse with a lance'],
  ['order_mag', 'Маг', 'a battle mage in blue robes with a pointed hat and a staff with a glowing blue orb'],
  ['void_inf', 'Громила Пустоты', 'a hulking void brute, dark purple chitin with spikes, glowing pink eyes, huge claws'],
  ['void_arc', 'Плевун Пустоты', 'a hunched void spitter creature with spines on its back and a glowing green throat'],
  ['void_cav', 'Волк Пустоты', 'a void wolf beast, dark purple fur with spikes, glowing pink eyes, running pose'],
  ['void_mag', 'Огонёк Пустоты', 'a floating void wisp, a glowing purple-white orb with trailing smoke tendrils'],
];

const battleUi = () => {
  let out = '\n# Этап D — бой и интерфейс\n\n## Юниты для повтора битвы\n\n';
  for (const [id, ru, what] of UNITS) out += block(ru, `unit_${id}.png`, '1024×1024, прозрачный фон', `${what}. ${UNIT}.`);
  out += '\nЦвет врагов-людей (красный) я получу из синих юнитов перекраской — отдельно генерировать не нужно.\n\n## Иконки\n\n';
  for (const [id, what] of ICONS) out += block(id, `icon_${id}.png`, '512×512, прозрачный фон', `${what}. ${ICON}.`, '--ar 1:1 --style raw --sref <ETALON_URL> --sw 150 --no text');
  return out;
};

const head = (title) => `<!-- generated by scripts/art-prompts.mjs — edit the script, not this file -->
# ${title}

Правила — в [STYLEGUIDE.md](STYLEGUIDE.md). Каждый промпт полный: копируйте блок целиком.
Для **Midjourney** допишите в конец строку под блоком и замените \`<ETALON_URL>\` на ссылку на ваш эталон (Цитадель T3).
Для **ChatGPT** копируйте только сам промпт; эталон загрузите в начале чата.

> Midjourney не умеет прозрачный фон: в его промптах замените фразу
> \`isolated on a transparent background\` на \`isolated on a solid flat pure green (#00FF00) chroma key background\` — фон я вырежу сам.
> Не используйте серый или белый фон: светлый камень зданий сольётся с ним.
`;

const staged = (st, f) => { STAGE = st; return f(); };
writeFileSync('docs/art/PROMPTS.md', head('Промпты: этапы 0–D (Солнечный Орден)') + staged('0', pilot)
  + '\n# Этап A — город Ордена\n' + staged('A', () => buildings('order') + cityGround()) + staged('B', world) + staged('C', people) + staged('D', battleUi));
STAGE = 'E';
for (const fac of ['wild', 'ash']) {
  writeFileSync(`docs/art/PROMPTS_${fac}.md`, head(`Промпты: этап E — ${FACTION[fac].name}`) + buildings(fac)
    + block('Отрезок стены', `bld_wall_segment_${fac}.png`, '1024×512, прозрачный фон', `a straight castle wall segment with battlements running diagonally from bottom-left to top-right, modular piece that can be repeated end to end, ${FACTION[fac].mat}. ${ISO}. ${STYLE}. ${CUT}.`, MJ.replace('1:1', '2:1'))
    + block('Угловая башня', `bld_wall_tower_${fac}.png`, '1024×1024, прозрачный фон', `a castle wall tower with battlements, ${FACTION[fac].mat}. ${ISO}. ${STYLE}. ${CUT}.`));
}
const count = (f) => (readFileSync(`docs/art/${f}`, 'utf8').match(/^### /gm) ?? []).length;
console.log('prompts:', ['PROMPTS.md', 'PROMPTS_wild.md', 'PROMPTS_ash.md'].map((f) => `${f}=${count(f)}`).join(' '));

// ———————————————————————————————————————— machine-readable list for the API batch
writeFileSync('docs/art/prompts.json', JSON.stringify(ASSETS.map((a) => ({ ...a, transparent: a.prompt.includes('transparent background') })), null, 1) + '\n');

// ———————————————————————————————————————— ChatGPT sheets: several assets per image
// Cells are cut apart by scripts/art-import.mjs (objects are found by their silhouettes and
// assigned to the grid cell their centre falls into), so slight drift off the grid is fine.
const SHEET_RULES = (cols, rows) => `A game asset sheet: ${cols * rows > 1 ? `${cols * rows} separate images arranged in a grid of ${cols} columns and ${rows} row${rows > 1 ? 's' : ''}, each one centered in its own equal cell with wide empty space around it, nothing touching or crossing the cell borders, no grid lines, no labels` : 'one image'}`;
const sheets = { main: [], wild: [], ash: [], ui: [] };
const sheet = (set, title, cols, rows, size, cells, body) => sheets[set].push({ title, cols, rows, size, cells, prompt: cols * rows > 1 ? `${SHEET_RULES(cols, rows)}. ${body}` : body });
const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
const pos = (i, cols) => (cols === 2 && i < 2 ? ['Left', 'Right'][i] : `Cell ${i + 1} (row ${Math.floor(i / cols) + 1}, column ${(i % cols) + 1})`);

function buildingSheets(set, fac, firstCitadel) {
  const f = FACTION[fac];
  const list = firstCitadel ? [BUILDINGS[0], ...BUILDINGS.slice(1)] : BUILDINGS;
  for (const [id, ru, what] of list) {
    for (const pair of firstCitadel && id === 'citadel' ? [[2, 3], [0, 1]] : [[0, 1], [2, 3]]) {
      sheet(set, `${ru} T${pair[0] + 1} + T${pair[1] + 1}`, 2, 1, '1536x1024', pair.map((t) => `bld_${id}_${fac}_t${t + 1}`),
        `Both images show the same building at two upgrade levels: ${what}, ${f.mat}. Left: ${TIERS[pair[0]]}. Right: ${TIERS[pair[1]]}. Same camera angle, lighting and style for both. ${ISO}. ${STYLE}. ${CUT}.`);
    }
  }
  sheet(set, 'Угловая башня стены + стройплощадка', 2, 1, '1536x1024', [`bld_wall_tower_${fac}`, fac === 'order' ? 'bld_construction' : ''],
    `Left: a round castle wall tower with battlements and a conical roof, ${f.mat}. Right: ${fac === 'order' ? 'a construction site: wooden scaffolding, piles of planks and cut stones, ropes, a small wooden crane, on a diamond-shaped dirt plot' : 'leave this cell completely empty'}. ${ISO}. ${STYLE}. ${CUT}.`);
  sheet(set, 'Отрезок стены', 1, 1, '1536x1024', [`bld_wall_segment_${fac}`], ASSETS.find((a) => a.name === `bld_wall_segment_${fac}`)?.prompt ?? '');
}

buildingSheets('main', 'order', true);
for (const a of ASSETS.filter((x) => x.name.startsWith('tex_'))) sheet('main', `Текстура: ${a.title}`, 1, 1, '1024x1024', [a.name], a.prompt);
for (const g of chunk(WORLD_OBJS, 4)) sheet('main', 'Карта: ' + g.map((o) => o[1]).join(', '), 2, 2, '1024x1024', g.map((o) => `wobj_${o[0]}`),
  g.map(([, , what], i) => `${pos(i, 2)}: ${what}.`).join(' ') + (g.length < 4 ? ` Leave the remaining cell${4 - g.length > 1 ? 's' : ''} empty.` : '') + ` Each one is ${MAP}. ${STYLE}. ${CUT}.`);
sheet('main', 'Титаны на карте', 3, 1, '1536x1024', TITANS.map((t) => `titan_${t[0]}_map`),
  TITANS.map(([, , what], i) => `${['Left', 'Middle', 'Right'][i]}: ${what}.`).join(' ') + ` Each one is a colossal titan standing on the world map. ${ISO}. ${STYLE}. ${CUT}.`);
for (const a of ASSETS.filter((x) => /^(hero_|titan_.*_art|key_)/.test(x.name))) sheet('main', a.title, 1, 1, a.size, [a.name], a.prompt);
for (const g of chunk(UNITS, 4)) sheet('main', 'Юниты: ' + g.map((u) => u[1]).join(', '), 2, 2, '1024x1024', g.map((u) => `unit_${u[0]}`),
  g.map(([, , what], i) => `${pos(i, 2)}: ${what}.`).join(' ') + ` Each is ${UNIT}.`);
for (const g of chunk(ICONS, 16)) {
  const cols = 4, rows = Math.ceil(g.length / 4);
  sheet('main', 'Иконки: ' + g.map((x) => x[0]).join(', '), cols, rows, '1024x1024', g.map((x) => `icon_${x[0]}`),
    'A set of matching game UI icons in one consistent style, reading left to right, top to bottom: ' + g.map(([, what], i) => `${i + 1}) ${what}`).join('; ') + `. Each icon is a ${ICON}.`);
}
// ———————————————————————————————————————— UI kit (window chrome, buttons, plates)
const UIS = 'premium fantasy mobile strategy game UI element, polished gold and bronze metal with fine engraving, deep royal-blue enamel, small blue sapphire gems, soft studio light from the upper left, crisp edges, perfectly symmetrical, flat front view with no perspective, isolated on a transparent background, no text, no letters, no icons, no characters';
const UIKIT = [
  { title: 'Рамка окна', cols: 1, rows: 1, size: '1536x1024', cells: ['ui_panel'],
    body: `An empty rectangular game window frame: a thick ornate gold metal border with sapphire gems in all four corners and small filigree ornaments in the middle of each side, the inside is a flat plain dark navy-blue panel with a very subtle texture, the inner area is completely empty. The four sides are straight and evenly thick so the frame can be stretched as a 9-slice. ${UIS}.` },
  { title: 'Заголовок окна + кнопка закрытия', cols: 2, rows: 1, size: '1536x1024', cells: ['ui_header', 'ui_close'],
    body: `Left: a wide horizontal title banner plate for a window header, dark-blue enamel center framed by gold metal with pointed ornamental ends, empty center for text. Right: a round close button, red enamel disc with a gold rim and an engraved silver X cross. ${UIS}.` },
  { title: 'Кнопки', cols: 2, rows: 2, size: '1024x1024', cells: ['ui_btn_gold', 'ui_btn_green', 'ui_btn_blue', 'ui_btn_red'],
    body: `Four wide rectangular game buttons with rounded corners, each a glossy colored enamel body inside a thin gold metal rim, with a soft highlight on top and a darker bottom bevel, completely empty face for text. Cell 1: golden yellow. Cell 2: emerald green. Cell 3: royal blue. Cell 4: crimson red. ${UIS}.` },
  { title: 'Круглые рамки и медальон уровня', cols: 2, rows: 2, size: '1024x1024', cells: ['ui_ring', 'ui_ring_big', 'ui_frame_portrait', 'ui_badge_level'],
    body: `Cell 1: a round ornate gold ring frame for an icon button, with a dark blue enamel disc inside. Cell 2: a larger, more elaborate round gold medallion frame with gems at the four cardinal points and a dark blue enamel disc inside. Cell 3: an ornate round gold portrait frame with laurel leaves and a crown ornament on top, the center is an empty transparent circular hole. Cell 4: a small horizontal oval blue enamel badge with a gold rim, empty for a number. ${UIS}.` },
  { title: 'Панели HUD: ресурсы и нижнее меню', cols: 1, rows: 2, size: '1536x1024', cells: ['ui_bar_top', 'ui_bar_bottom'],
    body: `Top row: a long thin horizontal resource bar plate, dark-blue enamel with a gold metal frame and decorative end caps, empty. Bottom row: a long horizontal bottom menu bar plate, slightly taller, dark-blue enamel with an ornate gold frame, a raised decorative crest in the middle of the top edge, empty. Both are very wide (about 6 times wider than tall). ${UIS}.` },
  { title: 'Вкладки, карточка, полоса прогресса', cols: 2, rows: 2, size: '1024x1024', cells: ['ui_tab', 'ui_tab_on', 'ui_card', 'ui_bar_frame'],
    body: `Cell 1: an inactive tab button shaped like a bookmark with a flat bottom edge, dark blue enamel with a thin bronze rim. Cell 2: the same tab shape but active: polished gold with engraving. Cell 3: a rectangular content card plate, dark translucent blue enamel with a thin engraved gold border and tiny corner ornaments, empty. Cell 4: a long thin empty progress bar frame, gold metal rim around a dark recessed groove. ${UIS}.` },
  { title: 'Ячейки предметов по редкости', cols: 2, rows: 2, size: '1024x1024', cells: ['ui_slot_common', 'ui_slot_rare', 'ui_slot_epic', 'ui_slot_legendary'],
    body: `Four square item slot frames with rounded corners, empty inside with a dark radial gradient background. Cell 1: grey steel frame. Cell 2: blue sapphire-trimmed frame with a soft blue glow. Cell 3: purple amethyst-trimmed frame with a purple glow. Cell 4: ornate gold frame with orange glow and small gems. ${UIS}.` },
  { title: 'Плашки: свиток задания, имя лорда', cols: 1, rows: 2, size: '1536x1024', cells: ['ui_plate_quest', 'ui_plate_name'],
    body: `Top row: a horizontal parchment scroll plate for a quest tracker, light aged parchment with rolled ends and a thin gold trim, empty, about 3.5 times wider than tall. Bottom row: a horizontal name plate ribbon, dark blue enamel with a gold edge that fades out on the right end, empty, about 5 times wider than tall. ${UIS}.` },
];
for (const u of UIKIT) sheet('ui', u.title, u.cols, u.rows, u.size, u.cells, u.body);

buildingSheets('wild', 'wild', false);
buildingSheets('ash', 'ash', false);

const layouts = {};
const sheetMd = (set, prefix, title) => {
  let md = `<!-- generated by scripts/art-prompts.mjs — edit the script, not this file -->
# ${title}

Быстрый режим для **ChatGPT**: одна генерация — сразу несколько ассетов. Правила — в [STYLEGUIDE.md](STYLEGUIDE.md).

1. Скопируйте промпт листа целиком и отправьте в ChatGPT. Размер указан под заголовком
   (если ChatGPT спросит — квадрат, горизонтальный 3:2 или вертикальный 2:3).
2. Скачайте картинку и **назовите файл кодом листа**, например \`${prefix}01.png\`.
   Больше ничего переименовывать не нужно: импорт сам разрежет лист на отдельные ассеты.
3. Если какой-то объект на листе не удался — перегенерируйте весь лист или только этот ассет по одиночному промпту из PROMPTS.md.

`;
  sheets[set].forEach((sh, i) => {
    const id = `${prefix}${String(i + 1).padStart(2, '0')}`;
    layouts[id] = { cols: sh.cols, rows: sh.rows, cells: sh.cells };
    const what = sh.cells.filter(Boolean).map((c) => `\`${c}\``).join(', ');
    md += `### ${id} — ${sh.title}\n${sh.size.replace('x', '×')} · ${sh.cols}×${sh.rows} · даёт: ${what}\n\n\`\`\`\n${sh.prompt}\n\`\`\`\n\n`;
  });
  return md;
};
writeFileSync('docs/art/SHEETS.md', sheetMd('main', 'S', 'Листы для ChatGPT: этапы 0–D (Солнечный Орден)'));
writeFileSync('docs/art/SHEETS_wild.md', sheetMd('wild', 'W', 'Листы для ChatGPT: этап E — Дикий Завет'));
writeFileSync('docs/art/SHEETS_UI.md', sheetMd('ui', 'U', 'Листы для ChatGPT: UI-кит (рамки, кнопки, плашки)'));
writeFileSync('docs/art/SHEETS_ash.md', sheetMd('ash', 'A', 'Листы для ChatGPT: этап E — Пепельные Кланы'));
writeFileSync('docs/art/sheets.json', JSON.stringify(layouts, null, 1) + '\n');
const covered = new Set(Object.values(layouts).flatMap((l) => l.cells).filter(Boolean));
const missing = ASSETS.filter((a) => !a.name.startsWith('ui_')).filter((a) => !covered.has(a.name)).map((a) => a.name);
console.log(`sheets: S=${sheets.main.length} W=${sheets.wild.length} A=${sheets.ash.length} U=${sheets.ui.length} → ${covered.size} assets` + (missing.length ? `; not on any sheet: ${missing.join(', ')}` : ''));
