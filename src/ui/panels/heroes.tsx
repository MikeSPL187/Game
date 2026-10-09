import { useState } from 'preact/hooks';
import { fmt } from '../../core/format';
import { portraitUrl } from '../../art/portraits';
import { HEROES, HERO_BY_ID, RARITY_INFO, shardsForNextStar, xpForLevel, type HeroDef } from '../../data/heroes';
import { TYPE_INFO } from '../../data/troops';
import { FACTIONS } from '../../data/world';
import { Bar, Btn, Icon, Panel, Stars, act, ga, haptic, toast, ui, useGame } from '../core';
import { BRANCHES, ROW_REQ, TALENTS, spentIn } from '../../data/talents';
import { HeroGear } from './forge';
import { sfx } from '../../audio/audio';

export function HeroCard({ id, onClick, sel, busy, small }: { id: string; onClick?: () => void; sel?: boolean; busy?: boolean; small?: boolean }) {
  const g = ga.game;
  const h = HERO_BY_ID[id];
  const st = g.s.heroes[id];
  return (
    <div class={`hcard ${h.rarity}${st.owned ? '' : ' locked'}${sel ? ' sel' : ''}${busy ? ' busy' : ''}`} style={small ? { width: 96 } : undefined} onClick={() => { sfx('click'); onClick?.(); }}>
      <img src={portraitUrl(id)} />
      {st.owned && <span class="lv">Ур. {st.level}</span>}
      {st.owned && !small && g.talentPoints(id) > 0 && <span class="badge" style={{ top: 30, right: 4 }}>{g.talentPoints(id)}</span>}
      <span class="spec"><Icon name={h.spec} size={small ? 22 : 26} /></span>
      <div class="nm">
        <b>{h.name}</b>
        {st.owned ? <Stars n={st.stars} size={small ? 10 : 12} /> : <span style={{ fontSize: 11 }} class="mute"><Icon name="shard" size={12} /> {st.shards}/10</span>}
      </div>
    </div>
  );
}

export function HeroesPanel({ id: initial }: { id?: string }) {
  const g = useGame();
  const owned = HEROES.filter((h) => g.s.heroes[h.id].owned).sort(sortHeroes);
  const [id, setId] = useState<string | null>(initial ?? null);
  if (id) return <HeroDetail id={id} onBack={() => setId(null)} />;
  const notOwned = HEROES.filter((h) => !g.s.heroes[h.id].owned);
  const busy = g.busyHeroes();
  return (
    <Panel title="Герои" width={1000} icon="hero">
      <div class="h" style={{ color: 'var(--gold2)', marginBottom: 8 }}>Ваши герои · {owned.length}</div>
      <div class="hgrid">{owned.map((h) => <HeroCard id={h.id} busy={busy.has(h.id)} onClick={() => setId(h.id)} />)}</div>
      {notOwned.length > 0 && (
        <>
          <div class="h" style={{ color: 'var(--mute)', margin: '14px 0 8px' }}>Ещё не призваны</div>
          <div class="hgrid">{notOwned.map((h) => <HeroCard id={h.id} onClick={() => setId(h.id)} />)}</div>
        </>
      )}
    </Panel>
  );
}

function sortHeroes(a: HeroDef, b: HeroDef) {
  const r = { legendary: 0, epic: 1, rare: 2 };
  const g = ga.game;
  return r[a.rarity] - r[b.rarity] || g.s.heroes[b.id].level - g.s.heroes[a.id].level;
}

function HeroDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const g = useGame();
  const h = HERO_BY_ID[id];
  const st = g.s.heroes[id];
  const cap = g.heroCap(id);
  const need = shardsForNextStar(st.stars);
  const rar = RARITY_INFO[h.rarity];
  const tomes = ['tome1', 'tome2', 'tome3'];
  const starMul = 1 + (st.stars - 1) * 0.06;
  const lvl = st.level * 0.35;
  const univ = g.s.inventory.shard_any ?? 0;
  const [tab, setTab] = useState<'info' | 'talents' | 'gear'>('info');
  const pts = st.owned ? g.talentPoints(id) : 0;
  return (
    <Panel title={<span>{h.name} <span style={{ color: rar.color, fontSize: 16 }}>· {h.title}</span></span>} width={1000} onClose={onBack}
      tabs={st.owned ? [{ id: 'info', label: 'Обзор' }, { id: 'talents', label: `Таланты${pts ? ` (${pts})` : ''}`, badge: pts > 0 }, { id: 'gear', label: 'Снаряжение' }] : undefined} tab={tab} onTab={(t) => setTab(t as any)}>
      {tab === 'gear' && st.owned ? <HeroGear id={id} /> : tab === 'talents' && st.owned ? <TalentTree id={id} /> : (
      <div class="row" style={{ alignItems: 'stretch', gap: 16 }}>
        <div class={'hcard ' + h.rarity} style={{ width: 250, flex: 'none', aspectRatio: '4/5', cursor: 'default' }}>
          <img src={portraitUrl(id)} style={{ filter: st.owned ? undefined : 'grayscale(1) brightness(.5)' }} />
          <div class="nm"><b style={{ fontSize: 20 }}>{h.name}</b><span style={{ color: rar.color, fontWeight: 800, fontSize: 13 }}>{rar.name}</span></div>
        </div>
        <div class="col grow" style={{ gap: 10 }}>
          <div class="row wrap" style={{ gap: 10 }}>
            <span class="chip"><Icon name={h.spec} size={22} />{TYPE_INFO[h.spec].name}</span>
            <span class="chip" style={{ color: FACTIONS[h.faction].color }}>{FACTIONS[h.faction].name}</span>
            <span class="chip">{h.role}</span>
            {st.owned && <Stars n={st.stars} size={18} />}
          </div>
          <div class="mute" style={{ fontStyle: 'italic', fontSize: 14 }}>{h.lore}</div>
          {st.owned ? (
            <div class="card col" style={{ gap: 6 }}>
              <div class="row"><b class="grow">Уровень {st.level} / {cap}</b><span class="mute" style={{ fontSize: 12 }}>{st.level >= cap ? 'Повысьте звёзды, чтобы поднять предел' : `${fmt(st.xp)} / ${fmt(xpForLevel(st.level))} XP`}</span></div>
              <Bar value={st.level >= cap ? 1 : st.xp} max={st.level >= cap ? 1 : xpForLevel(st.level)} kind="purple" />
              <div class="row" style={{ gap: 6 }}>
                {tomes.map((t) => {
                  const n = g.s.inventory[t] ?? 0;
                  return <Btn size="small" kind="dark" off={!n || st.level >= cap} onClick={() => { if (act(g.useTome(id, t, 1), 'levelup')) { /* */ } }}><Icon name="tome" size={20} />{['+500', '+2.5K', '+10K'][tomes.indexOf(t)]} <span class="mute">×{n}</span></Btn>;
                })}
                <Btn size="small" kind="purple" off={st.level >= cap} onClick={() => {
                  let used = 0;
                  for (const t of tomes) while ((g.s.inventory[t] ?? 0) > 0 && g.s.heroes[id].level < cap) { if (!g.useTome(id, t, 1).ok) break; used++; }
                  if (used) sfx('levelup');
                }}>Все</Btn>
              </div>
            </div>
          ) : (
            <div class="card">Герой ещё не присоединился к вам. Призовите его в Таверне или соберите 10 осколков.</div>
          )}
          <div class="row" style={{ alignItems: 'stretch', gap: 10 }}>
            <div class="card col grow" style={{ gap: 2 }}>
              <div class="h" style={{ color: 'var(--gold2)' }}>Характеристики</div>
              <div class="statline"><span class="mute">Атака отряда</span><b class="good">+{((h.atk + lvl) * starMul).toFixed(1)}%</b></div>
              <div class="statline"><span class="mute">Защита отряда</span><b class="good">+{((h.def + lvl) * starMul).toFixed(1)}%</b></div>
              <div class="statline"><span class="mute">Здоровье отряда</span><b class="good">+{((h.hp + lvl) * starMul).toFixed(1)}%</b></div>
              <div class="statline"><span class="mute">Вместимость отряда</span><b>{fmt(g.legionCapacity(id))}</b></div>
            </div>
            <div class="card col grow" style={{ gap: 4 }}>
              <div class="h" style={{ color: 'var(--gold2)' }}>Звёзды</div>
              <Stars n={st.stars} size={22} />
              {st.stars < 5 ? (
                <>
                  <Bar value={st.shards + univ} max={need} kind="gold" label={`${st.shards}${univ ? ` (+${univ})` : ''} / ${need}`} />
                  <Btn kind="gold" size="small" off={!st.owned || st.shards + univ < need} onClick={() => act(g.starUp(id), 'legendary')}><Icon name="star" size={18} /> Повысить</Btn>
                </>
              ) : <div class="good">Максимум!</div>}
            </div>
          </div>
          <div class="card col" style={{ gap: 6 }}>
            <div class="row"><Icon name="rune" size={30} /><div class="grow"><b style={{ color: '#d8b0ff' }}>{h.skill.name}</b> <span class="mute" style={{ fontSize: 12 }}>· активный навык (ярость)</span><div style={{ fontSize: 13 }}>{h.skill.desc}</div></div></div>
            {h.passives.map((p) => <div class="row"><Icon name="shield" size={26} /><div class="grow"><b>{p.name}</b><div style={{ fontSize: 13 }} class="mute">{p.desc}</div></div></div>)}
          </div>
          {st.owned && <div class="row"><Btn kind={g.s.defender === id ? 'dark' : 'blue'} size="small" onClick={() => { g.s.defender = id; act({ ok: true }); }}>{g.s.defender === id ? '✓ Защитник города' : 'Назначить защитником города'}</Btn></div>}
        </div>
      </div>
      )}
    </Panel>
  );
}

function TalentTree({ id }: { id: string }) {
  const g = useGame();
  const h = HERO_BY_ID[id];
  const st = g.s.heroes[id];
  const pts = g.talentPoints(id);
  const busy = g.busyHeroes().has(id);
  return (
    <div class="col" style={{ gap: 10 }}>
      <div class="row">
        <Icon name="star" size={28} />
        <b class="grow">Свободных очков: <span style={{ color: pts ? 'var(--good)' : 'var(--mute)', fontSize: 18 }}>{pts}</span> <span class="mute" style={{ fontSize: 12 }}>· очко за каждый уровень героя · действуют, когда герой — командир легиона</span></b>
        <Btn size="small" kind="dark" off={busy || !spentIn(st.talents)} onClick={() => { if (confirm('Сбросить все таланты? Очки вернутся.')) act(g.resetTalents(id), 'page'); }}>Сбросить</Btn>
      </div>
      {busy && <div class="warn" style={{ fontSize: 13 }}>Герой в походе — таланты можно менять, когда он вернётся.</div>}
      <div class="row" style={{ alignItems: 'stretch', gap: 10 }}>
        {BRANCHES.map((br) => {
          const spent = spentIn(st.talents, br.id);
          return (
            <div class="card col" style={{ flex: 1, gap: 6, borderColor: br.color + '66' }}>
              <div class="row"><Icon name={br.icon} size={26} /><b class="h grow" style={{ color: br.color, fontSize: 17 }}>{br.name}</b><span class="mute" style={{ fontSize: 12 }}>{spent} очк.</span></div>
              {TALENTS.filter((n) => n.branch === br.id).map((n) => {
                const rank = st.talents?.[n.id] ?? 0;
                const open = spent >= ROW_REQ[n.row];
                const can = g.canLearn(id, n.id).ok;
                return (
                  <button class={'card row' + (can ? ' hl' : '')} style={{ gap: 8, padding: '6px 8px', textAlign: 'left', opacity: open ? 1 : 0.45, background: rank ? `linear-gradient(90deg, ${br.color}22, transparent)` : undefined }}
                    onClick={() => { const r = g.learnTalent(id, n.id); if (r.ok) { sfx('levelup'); haptic(); } else toast(r.error, true); }}>
                    <Icon name={open ? n.icon : 'lock'} size={30} />
                    <div class="grow">
                      <div style={{ fontWeight: 800, fontSize: 13 }}>{n.name}</div>
                      <div class="mute" style={{ fontSize: 11 }}>{n.desc(h.spec)}{n.max > 1 ? ' за ранг' : ''}{!open ? ` · нужно ${ROW_REQ[n.row]} очк.` : ''}</div>
                    </div>
                    <b style={{ color: rank >= n.max ? 'var(--good)' : 'var(--gold2)', fontSize: 13 }}>{rank}/{n.max}</b>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function TavernPanel() {
  const g = useGame();
  const [result, setResult] = useState<{ hero: string; isNew: boolean; shards: number } | null>(null);
  const free = g.s.freeSummonAt <= Date.now();
  const doSummon = (kind: 'silver' | 'gold', isFree = false) => {
    const r = g.summon(kind, isFree);
    if (!r.ok) { act(r); return; }
    const rar = HERO_BY_ID[r.hero!].rarity;
    sfx('summon');
    setTimeout(() => sfx(rar === 'legendary' ? 'legendary' : rar === 'epic' ? 'victory' : 'levelup'), 700);
    setResult({ hero: r.hero!, isNew: !!r.isNew, shards: r.shards ?? 0 });
  };
  if (result) {
    const h = HERO_BY_ID[result.hero];
    const rar = RARITY_INFO[h.rarity];
    return (
      <Panel title="Призыв героя" width={760} icon="key_gold" onClose={() => setResult(null)}>
        <div class="summon-stage" style={{ '--rc': rar.color } as any}>
          <div class="rays" />
          <div class="summon-card"><HeroCard id={result.hero} /></div>
        </div>
        <div class="col center" style={{ gap: 6 }}>
          <div class="h" style={{ fontSize: 26, color: rar.color }}>{h.name} — {h.title}</div>
          <div>{result.isNew ? <b class="good">Новый герой присоединился к вам!</b> : <span>Уже в отряде: получено <b>{result.shards}</b> осколков</span>}</div>
          <div class="row"><Btn kind="dark" onClick={() => setResult(null)}>Ещё призыв</Btn><Btn onClick={() => { setResult(null); ui.close(); ui.open('heroes', { id: result.hero }); }}>К герою</Btn></div>
        </div>
      </Panel>
    );
  }
  const silver = g.s.inventory.key_silver ?? 0, gold = g.s.inventory.key_gold ?? 0;
  return (
    <Panel title="Таверна героев" width={900} icon="key_gold">
      <div class="row" style={{ gap: 16, alignItems: 'stretch' }}>
        <div class="card col center grow" style={{ gap: 8, padding: 18 }}>
          <Icon name="key_silver" size={90} />
          <div class="h" style={{ fontSize: 20 }}>Серебряный призыв</div>
          <div class="mute" style={{ fontSize: 13, textAlign: 'center' }}>Редкие и эпические герои.<br />Шанс легендарного: 1.5%</div>
          <div>Ключей: <b>{silver}</b></div>
          {free ? <Btn kind="green" class="pulse" onClick={() => doSummon('silver', true)}>Бесплатно</Btn> : <span class="mute" style={{ fontSize: 12 }}>Бесплатный призыв через {fmtTimeLeft(g.s.freeSummonAt)}</span>}
          <Btn off={!silver} onClick={() => doSummon('silver')}><Icon name="key_silver" size={20} /> Призвать</Btn>
        </div>
        <div class="card hl col center grow shine" style={{ gap: 8, padding: 18 }}>
          <Icon name="key_gold" size={90} />
          <div class="h" style={{ fontSize: 20, color: 'var(--legend)' }}>Золотой призыв</div>
          <div class="mute" style={{ fontSize: 13, textAlign: 'center' }}>Эпические и легендарные герои.<br />Гарантированный легендарный каждые 10 призывов</div>
          <div>Ключей: <b>{gold}</b> · До гарантии: <b>{10 - g.s.pity.gold}</b></div>
          <Btn kind="purple" off={!gold} onClick={() => doSummon('gold')}><Icon name="key_gold" size={20} /> Призвать</Btn>
        </div>
      </div>
      <div class="mute" style={{ fontSize: 12, marginTop: 10, textAlign: 'center' }}>Ключи добываются в заданиях, руинах, логовах Пустоты и ежедневных наградах. Никаких покупок за реальные деньги — только честная игра.</div>
    </Panel>
  );
}

function fmtTimeLeft(t: number) { const ms = t - Date.now(); const h = Math.floor(ms / 3600e3), m = Math.floor((ms % 3600e3) / 60e3); return `${h}ч ${m}м`; }
