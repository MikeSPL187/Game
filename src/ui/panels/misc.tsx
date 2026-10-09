import { useEffect, useState } from 'preact/hooks';
import { bus } from '../../core/bus';
import { fmt, fmtTime } from '../../core/format';
import type { FactionId, Reward, TroopKey } from '../../core/types';
import { portraitUrl } from '../../art/portraits';
import { ITEMS, ITEM_BY_ID } from '../../data/items';
import { CALENDAR, CHAPTERS, DAILIES, DAILY_CHESTS } from '../../data/quests';
import { TROOPS, ALL_TROOP_KEYS } from '../../data/troops';
import { FACTIONS, TITANS, TITAN_BY_ID } from '../../data/world';
import { infirmaryRate, legionSlots, wallBonus, warehouseProtect } from '../../data/buildings';
import { HERO_BY_ID, HEROES } from '../../data/heroes';
import { sumTroops } from '../../game/game';
import { clearSave } from '../../core/storage';
import { Bar, Btn, Icon, Panel, RewardList, Stars, Timer, Toggle, act, ga, haptic, toast, ui, useGame } from '../core';
import { goTo, findWorldTarget } from '../nav';
import { initAudio, setMusic, setSound, sfx } from '../../audio/audio';
import { HeroCard } from './heroes';

export function showReward(r: Reward, title = 'Награда') { bus.emit('show-reward', { r, title }); }

// ———————————————————————————————————————— inventory
export function InventoryPanel() {
  const g = useGame();
  const [cat, setCat] = useState<'all' | 'speed' | 'res' | 'hero' | 'special'>('all');
  const list = ITEMS.filter((i) => (g.s.inventory[i.id] ?? 0) > 0 && (cat === 'all' || i.cat === cat));
  const [sel, setSel] = useState<string | null>(list[0]?.id ?? null);
  const it = sel && (g.s.inventory[sel] ?? 0) > 0 ? ITEM_BY_ID[sel] : list[0];
  const n = it ? g.s.inventory[it.id] ?? 0 : 0;
  return (
    <Panel title="Сумка" width={940} icon="bag" tabs={[{ id: 'all', label: 'Все' }, { id: 'speed', label: 'Ускорения' }, { id: 'res', label: 'Ресурсы' }, { id: 'hero', label: 'Герои' }, { id: 'special', label: 'Особое' }]} tab={cat} onTab={(c) => setCat(c as any)}>
      <div class="row" style={{ alignItems: 'stretch', gap: 14 }}>
        <div class="igrid grow scroll" style={{ maxHeight: 330, alignContent: 'start' }}>
          {list.map((i) => (
            <div class={`icell r-${i.rarity}${it?.id === i.id ? ' sel' : ''}`} onClick={() => { sfx('click'); setSel(i.id); }}>
              <Icon name={i.icon} size={52} /><span class="cnt">{fmt(g.s.inventory[i.id])}</span>
            </div>
          ))}
          {!list.length && <div class="mute" style={{ gridColumn: '1/-1', padding: 20 }}>Пусто</div>}
        </div>
        {it && (
          <div class="card col" style={{ width: 300, flex: 'none' }}>
            <div class="row"><div class={`icell r-${it.rarity}`} style={{ width: 70 }}><Icon name={it.icon} size={50} /></div><div><b style={{ fontSize: 17 }}>{it.name}</b><div class="mute">В наличии: {fmt(n)}</div></div></div>
            <div style={{ fontSize: 14 }}>{it.desc}</div>
            {it.usable && <div class="row"><Btn kind="green" wide onClick={() => { if (act(g.useItem(it.id, 1), 'collect')) { if (it.id.startsWith('chest')) toast('Сундук открыт!'); } }}>Использовать</Btn>{n > 1 && <Btn kind="dark" onClick={() => act(g.useItem(it.id, Math.min(n, 10)), 'collect')}>×{Math.min(n, 10)}</Btn>}</div>}
            {it.cat === 'speed' && <div class="mute" style={{ fontSize: 12 }}>Применяется через кнопку «Ускорить» у строительства, обучения или исследования.</div>}
            {it.cat === 'hero' && <Btn kind="dark" onClick={() => { ui.close(); ui.open(it.id.startsWith('key') ? 'tavern' : 'heroes'); }}>{it.id.startsWith('key') ? 'В таверну' : 'К героям'}</Btn>}
            {it.id === 'titan_food' && <Btn kind="dark" onClick={() => { ui.close(); ui.open('titans'); }}>К титанам</Btn>}
          </div>
        )}
      </div>
    </Panel>
  );
}

// ———————————————————————————————————————— quests
export function QuestsPanel() {
  const g = useGame();
  const [tab, setTab] = useState<'story' | 'daily'>('story');
  const ch = g.chapter();
  const dailyBadge = DAILIES.some((d) => !g.s.quests.dailyClaimed.includes(d.id) && g.dailyProgress(d.id) >= d.target) || DAILY_CHESTS.some((c, i) => !g.s.quests.dailyChests.includes(i) && g.s.quests.dailyPoints >= c.points);
  return (
    <Panel title="Задания" width={980} icon="quest" tabs={[{ id: 'story', label: 'Сюжет' }, { id: 'daily', label: 'Ежедневные', badge: dailyBadge }]} tab={tab} onTab={(t) => setTab(t as any)}>
      {tab === 'story' ? (
        ch ? (
          <div class="col">
            <div class="row" style={{ alignItems: 'flex-start', gap: 12 }}>
              <img src={portraitUrl('orian')} style={{ width: 90, height: 110, objectFit: 'cover', borderRadius: 10, boxShadow: '0 0 0 2px var(--gold3)' }} />
              <div class="grow">
                <div class="h" style={{ fontSize: 22, color: 'var(--gold2)' }}>Глава {ch.n}. {ch.title}</div>
                <div style={{ fontSize: 14, fontStyle: 'italic', marginTop: 4 }} class="mute">{ch.intro}</div>
              </div>
            </div>
            {ch.quests.map((q) => {
              const p = g.questProgress(q);
              const done = p >= q.target;
              const claimed = g.s.quests.claimed.includes(q.id);
              return (
                <div class={'card row' + (done && !claimed ? ' hl' : '')} style={{ opacity: claimed ? 0.55 : 1 }}>
                  <Icon name={claimed ? 'check' : 'quest'} size={30} />
                  <div class="grow">
                    <b>{q.title}</b>
                    <div class="row" style={{ marginTop: 4 }}><div style={{ width: 200 }}><Bar value={p} max={q.target} h={10} kind="gold" /></div><span class="mute" style={{ fontSize: 12 }}>{fmt(p)} / {fmt(q.target)}</span></div>
                  </div>
                  <RewardList r={q.reward} compact />
                  {claimed ? <span class="good" style={{ width: 96, textAlign: 'center' }}>Получено</span>
                    : done ? <Btn kind="green" size="small" onClick={() => { if (act(g.claimQuest(q.id), 'collect')) showReward(q.reward, 'Задание выполнено'); }}>Забрать</Btn>
                    : <Btn size="small" onClick={() => goTo(q.go)}>Вперёд</Btn>}
                </div>
              );
            })}
            <div class={'card row' + (g.chapterDone() ? ' hl shine' : '')}>
              <Icon name="trophy" size={40} />
              <div class="grow"><b>Награда за главу</b><RewardList r={ch.reward} compact /></div>
              <Btn kind="green" off={!g.chapterDone()} onClick={() => {
                const n = ch.n;
                if (act(g.claimChapter(), 'victory')) { showReward(ch.reward, `Глава ${n} завершена!`); bus.emit('story', { text: ch.outro, next: CHAPTERS.find((c) => c.n === n + 1)?.intro }); }
              }}>Завершить главу</Btn>
            </div>
          </div>
        ) : <div class="col center" style={{ padding: 30 }}><div class="h" style={{ fontSize: 24 }}>Все главы пройдены!</div><div class="mute">Ваше владение — сильнейшее в Расколотых землях. Продолжайте развивать город, охотиться на разломы и лордов.</div></div>
      ) : (
        <div class="col">
          <div class="card col">
            <div class="row"><b class="grow">Активность: {g.s.quests.dailyPoints} / 100</b><span class="mute" style={{ fontSize: 12 }}>Сброс в полночь</span></div>
            <div style={{ position: 'relative', height: 64 }}>
              <div style={{ position: 'absolute', left: 0, right: 30, top: 26 }}><Bar value={g.s.quests.dailyPoints} max={100} kind="gold" h={12} /></div>
              {DAILY_CHESTS.map((c, i) => {
                const open = g.s.quests.dailyChests.includes(i);
                const ready = !open && g.s.quests.dailyPoints >= c.points;
                return (
                  <button class={ready ? 'pulse' : ''} style={{ position: 'absolute', left: `calc(${c.points}% - 30px)`, top: 0, width: 56, height: 56, borderRadius: 12, opacity: open ? 0.4 : 1 }} onClick={() => { if (ready && act(g.claimDailyChest(i), 'collect')) showReward(c.reward, 'Сундук активности'); else if (!ready && !open) toast(`Нужно ${c.points} очков активности`); }}>
                    <Icon name={i === 4 ? 'chest_gold' : 'chest'} size={50} />
                  </button>
                );
              })}
            </div>
          </div>
          {DAILIES.map((d) => {
            const p = g.dailyProgress(d.id);
            const claimed = g.s.quests.dailyClaimed.includes(d.id);
            const done = p >= d.target;
            return (
              <div class={'card row' + (done && !claimed ? ' hl' : '')} style={{ opacity: claimed ? 0.55 : 1 }}>
                <Icon name="calendar" size={28} />
                <div class="grow"><b>{d.title}</b><div class="row" style={{ marginTop: 4 }}><div style={{ width: 200 }}><Bar value={p} max={d.target} h={10} /></div><span class="mute" style={{ fontSize: 12 }}>{fmt(p)} / {fmt(d.target)}</span></div></div>
                <span class="chip">+{d.points} актив.</span>
                {claimed ? <span class="good" style={{ width: 90, textAlign: 'center' }}>Готово</span> : <Btn size="small" kind={done ? 'green' : 'dark'} off={!done} onClick={() => act(g.claimDaily(d.id), 'collect')}>Забрать</Btn>}
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

// ———————————————————————————————————————— army & infirmary
export function ArmyPanel() {
  const g = useGame();
  const all = g.allTroops();
  const wounded = g.woundedCount();
  const cap = g.infirmaryCapacity();
  const rate = infirmaryRate(g.level('infirmary'));
  const cost = g.healCost();
  return (
    <Panel title="Армия" width={940} icon="troops">
      <div class="row" style={{ alignItems: 'stretch', gap: 14 }}>
        <div class="card col grow">
          <div class="row"><b class="grow h" style={{ color: 'var(--gold2)' }}>Войска</b><span>Всего: <b>{fmt(sumTroops(all))}</b></span></div>
          <div class="col scroll" style={{ gap: 4, maxHeight: 300 }}>
            {ALL_TROOP_KEYS.filter((k) => (all[k] ?? 0) >= 1).map((k) => (
              <div class="row"><Icon name={TROOPS[k].type} size={28} /><span class="grow">{TROOPS[k].name} <span class="mute" style={{ fontSize: 12 }}>T{TROOPS[k].tier}</span></span><b>{fmt(Math.floor(all[k] ?? 0))}</b><span class="mute" style={{ fontSize: 12, width: 110, textAlign: 'right' }}>в городе {fmt(Math.floor(g.s.troops[k] ?? 0))}</span></div>
            ))}
          </div>
          <div class="row">
            {(['barracks', 'range', 'stable', 'spire'] as const).map((b) => <Btn size="small" kind="dark" onClick={() => ui.open('train', { type: b })}><Icon name={{ barracks: 'inf', range: 'arc', stable: 'cav', spire: 'mag' }[b]} size={20} /></Btn>)}
            <span class="mute grow" style={{ fontSize: 12, textAlign: 'right' }}>Легионов: {g.s.legions.length} / {legionSlots(g.citadel)}</span>
          </div>
        </div>
        <div class="card col" style={{ width: 340, flex: 'none' }}>
          <div class="row"><Icon name="heart" size={30} /><b class="grow h" style={{ color: 'var(--gold2)' }}>Лазарет</b></div>
          <div class="statline"><span class="mute">Раненых</span><b>{fmt(wounded)} / {fmt(cap)}</b></div>
          <Bar value={wounded} max={cap} kind="red" />
          <div class="statline"><span class="mute">Бесплатное лечение</span><b>{rate}/мин</b></div>
          {wounded > 0 && <div class="mute" style={{ fontSize: 12 }}>Все вылечатся примерно через {fmtTime(wounded / rate * 60000)}</div>}
          <div class="col scroll" style={{ gap: 2, maxHeight: 120 }}>
            {(Object.entries(g.s.wounded) as [TroopKey, number][]).filter(([, n]) => n >= 1).map(([k, n]) => <div class="statline"><span>{TROOPS[k].name}</span><b>{fmt(Math.floor(n))}</b></div>)}
          </div>
          {wounded > 0 && <><div class="cost">{Object.entries(cost).map(([k, v]) => <span class={'chip' + (g.s.res[k as 'food'] < (v ?? 0) ? ' lack' : '')}><Icon name={k} size={18} />{fmt(v ?? 0)}</span>)}</div><Btn kind="green" onClick={() => act(g.healAll(), 'levelup')}>Вылечить сразу</Btn></>}
          <div class="mute" style={{ fontSize: 12 }}>Раненые в боях с Пустотой и титанами попадают в лазарет и исцеляются бесплатно. Если лазарет переполнен — бойцы гибнут.</div>
        </div>
      </div>
    </Panel>
  );
}

// ———————————————————————————————————————— titans
export function TitansPanel() {
  const g = useGame();
  const ess = g.s.inventory.titan_food ?? 0;
  return (
    <Panel title="Святилище титанов" width={1000} icon="titan">
      <div class="row" style={{ gap: 12, alignItems: 'stretch' }}>
        {TITANS.map((t) => {
          const tamed = g.s.titans.tamed[t.id];
          const active = g.s.titans.active === t.id;
          return (
            <div class={'card col' + (active ? ' hl' : '')} style={{ flex: 1, gap: 6, filter: tamed ? undefined : 'saturate(.5)' }}>
              <img src={titanImg(t.id)} style={{ width: '100%', height: 150, objectFit: 'contain', filter: tamed ? 'drop-shadow(0 0 14px ' + t.color + ')' : 'grayscale(.6) brightness(.6)' }} />
              <div class="h" style={{ fontSize: 20, color: t.color }}>{t.name}</div>
              <div class="mute" style={{ fontSize: 12 }}>{t.title} · Ур. {tamed ? tamed.level : t.level}</div>
              <div style={{ fontSize: 13 }}>{t.desc}</div>
              <div class="cost">
                {t.buff.atk && <span class="chip">Атака +{Math.round(t.buff.atk * 100 * (1 + g.titanPower(t.id)))}%</span>}
                {t.buff.def && <span class="chip">Защита +{Math.round(t.buff.def * 100 * (1 + g.titanPower(t.id)))}%</span>}
                {t.buff.hp && <span class="chip">Здоровье +{Math.round(t.buff.hp * 100 * (1 + g.titanPower(t.id)))}%</span>}
                <span class="chip">Удар титана ×{t.strike}</span>
              </div>
              {tamed ? (
                <>
                  <Bar value={tamed.xp} max={400 * tamed.level} kind="purple" h={10} label={`Опыт ${tamed.xp}/${400 * tamed.level}`} />
                  <div class="row">
                    <Btn size="small" kind={active ? 'dark' : 'blue'} onClick={() => act(g.setActiveTitan(t.id))}>{active ? '✓ В бою' : 'Взять в бой'}</Btn>
                    <Btn size="small" kind="purple" off={!ess} onClick={() => act(g.feedTitan(t.id, 1), 'levelup')}><Icon name="essence" size={18} /> ×{ess}</Btn>
                  </div>
                </>
              ) : (
                <Btn size="small" kind="red" onClick={() => { const o = findWorldTarget('titan', undefined, t.id); if (o) goTo({ kind: 'world', find: 'titan', titan: t.id }); else toast('Титан уже покинул эти земли'); }}>Найти на карте</Btn>
              )}
            </div>
          );
        })}
      </div>
      <div class="mute" style={{ fontSize: 12, marginTop: 8 }}>Активный титан сопровождает все ваши легионы: усиливает войска и дважды за бой наносит сокрушительный удар. Уровень Святилища увеличивает его силу.</div>
    </Panel>
  );
}
import { titanArt } from '../../art/worldArt';
import { svgUrl } from '../../art/svg';
const tCache = new Map<string, string>();
function titanImg(id: string) { let u = tCache.get(id); if (!u) { u = svgUrl(titanArt(id).svg); tCache.set(id, u); } return u; }

// ———————————————————————————————————————— wall / defense
export function WallPanel() {
  const g = useGame();
  const r = g.incomingRaid();
  const def = g.cityDefenseArmy();
  const owned = HEROES.filter((h) => g.s.heroes[h.id].owned);
  const shield = g.s.shieldUntil > Date.now();
  return (
    <Panel title="Оборона города" width={960} icon="tower">
      <div class="row" style={{ alignItems: 'stretch', gap: 14 }}>
        <div class="col grow">
          {r ? (
            <div class="card hl col" style={{ boxShadow: '0 0 0 2px #ff6a4a' }}>
              <div class="row"><Icon name="skull" size={34} /><b class="grow" style={{ fontSize: 17 }}>Набег: {g.s.lords.find((l) => l.id === r.lordId)?.name}</b><b class="bad"><Timer end={r.arrive} /></b></div>
              <div class="mute" style={{ fontSize: 13 }}>{g.level('watchtower') >= 3 ? `Разведка: ~${fmt(sumTroops(r.troops))} воинов` : 'Улучшите Дозорную башню до 3 ур., чтобы узнать численность врага'}</div>
              <div class="mute" style={{ fontSize: 12 }}>Все войска в городе вступят в бой. Отзовите легионы домой, если нужно подкрепление.</div>
              {g.s.legions.some((l) => l.state !== 'return') && <Btn kind="blue" onClick={() => { const n = g.recallAll(); act({ ok: n > 0, error: 'Нет легионов для отзыва' }, 'horn'); }}><Icon name="home" size={20} /> Вернуть все легионы</Btn>}
            </div>
          ) : <div class="card row"><Icon name="shieldItem" size={34} /><div class="grow"><b>{shield ? 'Город под защитой щита' : g.citadel < 6 ? 'Защита новичка' : 'Угроз не обнаружено'}</b><div class="mute" style={{ fontSize: 12 }}>{shield ? <>Щит активен ещё <Timer end={g.s.shieldUntil} /></> : g.citadel < 6 ? 'Лорды не нападают, пока Цитадель ниже 6 уровня' : 'Набеги возможны, только пока вы в игре — честные правила'}</div></div></div>}
          <div class="card col" style={{ gap: 2 }}>
            <div class="h" style={{ color: 'var(--gold2)' }}>Гарнизон</div>
            <div class="statline"><span class="mute">Воинов в городе</span><b>{fmt(sumTroops(g.s.troops))}</b></div>
            <div class="statline"><span class="mute">Бонус стены</span><b class="good">+{Math.round((0.15 + wallBonus(g.level('wall')) + g.fx.city_def) * 100)}%</b></div>
            <div class="statline"><span class="mute">Хранилище защищает</span><b>{fmt(warehouseProtect(g.level('warehouse')))} каждого ресурса</b></div>
            <div class="statline"><span class="mute">Мощь обороны</span><b>{fmt(Math.round(g.troopPower(g.s.troops) * (1 + def.mods.def)))}</b></div>
          </div>
          {(g.s.inventory.shield8 ?? 0) > 0 && <Btn kind="blue" onClick={() => act(g.useItem('shield8'), 'levelup')}><Icon name="shieldItem" size={20} /> Щит мира 8ч (×{g.s.inventory.shield8})</Btn>}
        </div>
        <div class="card col" style={{ width: 380, flex: 'none' }}>
          <div class="h" style={{ color: 'var(--gold2)' }}>Защитник города</div>
          <div class="hgrid scroll" style={{ gridTemplateColumns: 'repeat(3, 1fr)', maxHeight: 320 }}>
            {owned.map((h) => <HeroCard id={h.id} small sel={g.s.defender === h.id} onClick={() => { g.s.defender = h.id; sfx('click'); bus.emit('state'); }} />)}
          </div>
        </div>
      </div>
    </Panel>
  );
}

// ———————————————————————————————————————— calendar
export function CalendarPanel() {
  const g = useGame();
  const ready = g.calendarReady();
  return (
    <Panel title="Награды за вход" width={980} icon="gift">
      <div class="row" style={{ gap: 8, alignItems: 'stretch' }}>
        {CALENDAR.map((r, i) => {
          const got = i < g.s.calendar.day;
          const today = i === g.s.calendar.day && ready;
          return (
            <div class={'card col center' + (today ? ' hl shine' : '')} style={{ flex: 1, opacity: got ? 0.5 : 1, gap: 6, padding: 8 }}>
              <b class="h" style={{ color: i === 6 ? 'var(--legend)' : 'var(--gold2)' }}>День {i + 1}</b>
              <Icon name={i === 6 ? 'chest_gold' : i === 3 ? 'key_gold' : 'gift'} size={54} />
              <div style={{ transform: 'scale(.85)' }}><RewardList r={r} compact /></div>
              {got ? <span class="good">✓</span> : today ? <Btn size="small" kind="green" onClick={() => { if (act(g.claimCalendar(), 'collect')) showReward(r, `День ${i + 1}`); }}>Забрать</Btn> : <span class="mute" style={{ fontSize: 12 }}>Скоро</span>}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

// ———————————————————————————————————————— settings / profile
export function SettingsPanel() {
  const g = useGame();
  const s = g.s.settings;
  const set = (k: keyof typeof s, v: any) => { (s as any)[k] = v; bus.emit('state'); if (k === 'sound') setSound(v); if (k === 'music') { initAudio(); setMusic(v); } };
  return (
    <Panel title="Настройки" width={640} icon="gear">
      <div class="col">
        {([['sound', 'Звуковые эффекты'], ['music', 'Музыка'], ['haptics', 'Вибрация'], ['dayNight', 'Смена дня и ночи']] as const).map(([k, l]) => (
          <div class="card row"><b class="grow">{l}</b><Toggle on={!!s[k]} onChange={(v) => set(k, v)} /></div>
        ))}
        <div class="card row"><b class="grow">Качество графики</b>
          <Btn size="small" kind={s.quality === 'high' ? 'gold' : 'dark'} onClick={() => set('quality', 'high')}>Высокое</Btn>
          <Btn size="small" kind={s.quality === 'low' ? 'gold' : 'dark'} onClick={() => set('quality', 'low')}>Экономия</Btn>
        </div>
        <div class="mute" style={{ fontSize: 12 }}>Качество графики применяется после перезапуска игры.</div>
        <div class="sep" />
        <div class="row"><Btn kind="dark" onClick={() => { ga.save(); toast('Прогресс сохранён'); }}>Сохранить</Btn><div class="grow" />
          <Btn kind="red" size="small" onClick={async () => { if (confirm('Начать игру заново? Весь прогресс будет удалён.')) { ga.paused = true; await clearSave(); location.href = location.pathname; } }}>Начать заново</Btn></div>
        <div class="mute" style={{ fontSize: 12, textAlign: 'center' }}>Aetherfall: Эпоха Титанов · v0.1 · Вся графика и звук созданы процедурно</div>
      </div>
    </Panel>
  );
}

export function ProfilePanel() {
  const g = useGame();
  const [name, setName] = useState(g.s.player.name);
  const f = FACTIONS[g.s.player.faction];
  const st = g.s.stats;
  return (
    <Panel title="Профиль лорда" width={820} icon="castle">
      <div class="row" style={{ alignItems: 'stretch', gap: 14 }}>
        <div class="card col center" style={{ width: 280, flex: 'none' }}>
          <input class="nameinput" style={{ width: '100%' }} maxLength={18} value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)} onBlur={() => { if (name.trim()) { g.s.player.name = name.trim(); bus.emit('state'); } }} />
          <div class="h" style={{ color: f.color, fontSize: 18 }}>{f.name}</div>
          <div class="mute" style={{ fontSize: 13, fontStyle: 'italic' }}>«{f.motto}»</div>
          <div class="good" style={{ fontSize: 12, textAlign: 'center' }}>{f.bonus}</div>
          <div class="power" style={{ fontSize: 18 }}><Icon name="power" size={26} />{fmt(g.power())}</div>
        </div>
        <div class="card col grow" style={{ gap: 2 }}>
          <div class="h" style={{ color: 'var(--gold2)' }}>Летопись</div>
          {([['Цитадель', g.citadel], ['Логов Пустоты разорено', st.campsDefeated], ['Макс. уровень логова', st.maxCampLevel], ['Добыто ресурсов', fmt(st.gathered)], ['Обучено воинов', fmt(st.troopsTrained)], ['Призывов героев', st.summons], ['Руин исследовано', st.ruinsExplored], ['Набегов отражено', st.raidsDefended], ['Побед над лордами', st.lordsDefeated], ['Разломов закрыто', st.riftsCleared], ['Титанов приручено', Object.keys(g.s.titans.tamed).length]] as const).map(([l, v]) => (
            <div class="statline"><span class="mute">{l}</span><b>{v}</b></div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

// ———————————————————————————————————————— intro / faction select
export function IntroScreen({ onDone }: { onDone: (f: FactionId, name: string) => void }) {
  const [f, setF] = useState<FactionId>('order');
  const [name, setName] = useState('Лорд Эйдан');
  const [step, setStep] = useState(0);
  if (step === 0) {
    return (
      <div class="intro" onClick={() => { initAudio(); sfx('horn'); setStep(1); }}>
        <div class="logo">AETHERFALL</div>
        <div class="tag">ЭПОХА ТИТАНОВ</div>
        <div style={{ maxWidth: 760, textAlign: 'center', fontSize: 17, lineHeight: 1.6, margin: '20px 0', color: '#d8d0c0' }}>
          Тысячу лет назад небесный престол раскололся, и осколки эфира упали на землю. Там, где они коснулись камня, пробудились Титаны — древние исполины, повелители бурь и пламени. Из трещин мира полезла Пустота.<br /><br />
          Королевства пали. Теперь, среди пепла, поднимается новый лорд…
        </div>
        <div class="btn big pulse">Нажмите, чтобы начать</div>
      </div>
    );
  }
  return (
    <div class="intro">
      <div class="h" style={{ fontSize: 34, color: 'var(--gold2)' }}>Выберите свой путь</div>
      <div class="fcards">
        {(Object.keys(FACTIONS) as FactionId[]).map((id) => {
          const fc = FACTIONS[id];
          const hero = id === 'order' ? 'aerena' : id === 'wild' ? 'lyra' : 'grom';
          return (
            <div class={'fcard' + (f === id ? ' on' : '')} style={{ '--fc': fc.color } as any} onClick={() => { sfx('click'); haptic(); setF(id); }}>
              <img src={portraitUrl(hero)} style={{ width: 120, height: 150, objectFit: 'cover', borderRadius: 12, boxShadow: `0 0 0 2px ${fc.color}` }} />
              <div class="fn">{fc.name}</div>
              <div class="fm">«{fc.motto}»</div>
              <div class="fd">{fc.desc}</div>
              <div class="fb">{fc.bonus}</div>
            </div>
          );
        })}
      </div>
      <div class="row"><span class="mute">Имя лорда:</span><input class="nameinput" maxLength={18} value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)} /></div>
      <Btn kind="gold" size="big" onClick={() => { sfx('victory'); onDone(f, name.trim() || 'Лорд'); }}>Основать владение</Btn>
    </div>
  );
}

// ———————————————————————————————————————— story dialog
export function StoryDialog({ lines, onDone }: { lines: string[]; onDone: () => void }) {
  const [i, setI] = useState(0);
  const [shown, setShown] = useState(0);
  const text = lines[i] ?? '';
  useEffect(() => {
    setShown(0);
    const t = setInterval(() => setShown((s) => { if (s >= text.length) { clearInterval(t); return s; } return s + 2; }), 16);
    return () => clearInterval(t);
  }, [i]);
  const next = () => {
    sfx('page');
    if (shown < text.length) { setShown(text.length); return; }
    if (i + 1 < lines.length) setI(i + 1); else onDone();
  };
  return (
    <div class="overlay" style={{ background: 'rgba(0,0,0,.35)', alignItems: 'flex-end' }} onClick={next}>
      <div class="story">
        <img class="por" src={portraitUrl('orian', false)} />
        <div class="box">
          <div class="who">Магистр Ориан, советник</div>
          <div class="txt">{text.slice(0, shown)}</div>
          <div class="row" style={{ justifyContent: 'flex-end' }}><span class="mute" style={{ fontSize: 12 }}>Нажмите, чтобы продолжить ▸</span></div>
        </div>
      </div>
    </div>
  );
}

// ———————————————————————————————————————— reward popup
export function RewardPopup({ r, title, onClose }: { r: Reward; title: string; onClose: () => void }) {
  return (
    <div class="overlay" onClick={onClose}>
      <div class="col center" style={{ gap: 18 }} onClick={(e) => e.stopPropagation()}>
        <div class="ribbon win" style={{ animation: 'panelin .4s' }}>{title}</div>
        <RewardList r={r} />
        <Btn kind="gold" size="big" onClick={onClose}>Отлично!</Btn>
      </div>
    </div>
  );
}

export function WelcomeBack({ away, gained, onClose }: { away: number; gained: Record<string, number>; onClose: () => void }) {
  return (
    <Panel title="С возвращением, милорд!" width={620} icon="castle" onClose={onClose}>
      <div class="col center welcome">
        <div class="mute">Вас не было {fmtTime(away)}. Владение не дремало:</div>
        <RewardList r={{ res: gained }} />
        <div class="mute" style={{ fontSize: 12 }}>Ресурсы ждут сбора в зданиях. Нажмите на пузыри над фермами и лесопилками.</div>
        <Btn kind="gold" size="big" onClick={onClose}>В бой!</Btn>
      </div>
    </Panel>
  );
}

export { Stars, HERO_BY_ID, TITAN_BY_ID };
