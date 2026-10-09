import { BUILDINGS, PRODUCTION_RES, infirmaryRate, productionCap } from '../data/buildings';
import { TECH_BY_ID } from '../data/research';
import { TROOPS } from '../data/troops';
import { HERO_BY_ID } from '../data/heroes';
import type { Game } from './game';

export interface PlannedNotice { id: number; at: number; title: string; body: string }

const MIN_AHEAD = 60_000;       // nothing closer than a minute (the player is probably still looking)
const MERGE_WINDOW = 90_000;    // events this close together become one notice
const MAX_NOTICES = 12;

/** Pure: which reminders to schedule if the player leaves right now. */
export function planNotifications(g: Game, now: number): PlannedNotice[] {
  const raw: { at: number; title: string; body: string }[] = [];
  for (const j of g.s.jobs) {
    if (j.kind === 'build') {
      const b = g.building(j.plot!);
      if (b) raw.push({ at: j.end, title: 'Строительство завершено', body: `${BUILDINGS[b.type].name} достигла ${j.toLevel} уровня. Строитель ждёт новых приказов.` });
    } else if (j.kind === 'research') {
      raw.push({ at: j.end, title: 'Исследование завершено', body: `${TECH_BY_ID[j.tech!].name} ${j.toLevel} — Академия свободна.` });
    } else if (j.kind === 'train') {
      raw.push({ at: j.end, title: 'Войска обучены', body: `${TROOPS[j.troop!].name} ×${j.count} готовы к походу.` });
    }
  }
  for (const l of g.s.legions) {
    if (l.state === 'return') raw.push({ at: g.arrivalTime(l), title: 'Легион вернулся', body: `${HERO_BY_ID[l.lead!]?.name ?? 'Отряд'} привёл войска домой${Object.keys(l.carry).length ? ' с добычей' : ''}.` });
    if (l.state === 'gather') raw.push({ at: l.gatherEnd, title: 'Сбор завершён', body: `${HERO_BY_ID[l.lead!]?.name ?? 'Отряд'} закончил добычу и возвращается.` });
  }
  const wounded = g.woundedCount();
  if (wounded > 0) {
    const rate = infirmaryRate(g.level('infirmary')) * (1 + g.fx.heal_speed);
    raw.push({ at: now + (wounded / rate) * 60_000, title: 'Лазарет пуст', body: 'Все раненые вернулись в строй.' });
  }
  if (g.level('tavern') > 0 && g.s.freeSummonAt > now) {
    raw.push({ at: g.s.freeSummonAt, title: 'Бесплатный призыв', body: 'В Таверне ждёт новый герой — призыв бесплатный.' });
  }
  // the first production building to fill up
  let full = Infinity;
  for (const b of g.s.buildings) {
    if (!PRODUCTION_RES[b.type] || b.level <= 0) continue;
    const rate = g.prodRate(b);
    if (rate <= 0) continue;
    full = Math.min(full, now + ((productionCap(b.level) - b.stored) / rate) * 3_600_000);
  }
  if (full < Infinity && full - now > 30 * 60_000) raw.push({ at: full, title: 'Хранилища переполнены', body: 'Фермы и мастерские заполнены — соберите ресурсы, чтобы добыча не останавливалась.' });

  const sorted = raw.filter((r) => r.at - now >= MIN_AHEAD && Number.isFinite(r.at)).sort((a, b) => a.at - b.at);
  const groups: { at: number; items: { title: string; body: string }[] }[] = [];
  for (const r of sorted) {
    const last = groups[groups.length - 1];
    if (last && r.at - last.at < MERGE_WINDOW) { if (!last.items.some((i) => i.title === r.title)) last.items.push(r); continue; }
    groups.push({ at: r.at, items: [r] });
  }
  const out: PlannedNotice[] = groups.slice(0, MAX_NOTICES).map((gr, i) => (gr.items.length === 1
    ? { id: i + 1, at: Math.round(gr.at), title: gr.items[0].title, body: gr.items[0].body }
    : { id: i + 1, at: Math.round(gr.at), title: 'Владение ждёт вас', body: gr.items.map((x) => x.title).join(' · ') }));
  return out;
}
