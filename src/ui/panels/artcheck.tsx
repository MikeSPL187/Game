import { useState } from 'preact/hooks';
import manifest from '../../data/art-manifest.json';
import { artUrl, type ArtEntry } from '../../art/manifest';
import { Panel } from '../core';

const M = manifest as Record<string, ArtEntry>;
const FX_COL: Record<string, string> = { smoke: '#ddd', fire: '#ff8a2a', magic: '#7fe3ff', sparkle: '#fff', gold: '#ffd24a' };

/** Developer view (?artcheck): every imported asset on a checkerboard with its ground anchor and emitters. */
export function ArtCheckPanel() {
  const names = Object.keys(M);
  const [filter, setFilter] = useState('');
  const list = names.filter((n) => n.includes(filter));
  return (
    <Panel title={`Ассеты: ${names.length}`} width={1100} icon="gear">
      <input class="nameinput" placeholder="фильтр, например bld_citadel" value={filter} onInput={(e) => setFilter((e.target as HTMLInputElement).value)} style={{ width: '100%', marginBottom: 8 }} />
      {!names.length && <div class="mute" style={{ padding: 20 }}>Манифест пуст: положите картинки в art/incoming и запустите node scripts/art-import.mjs</div>}
      <div class="row" style={{ flexWrap: 'wrap', gap: 8 }}>
        {list.map((n) => {
          const e = M[n];
          const box = 200, k = Math.min(box / e.w, box / e.h), dw = e.w * k, dh = e.h * k;
          return (
            <div class="card col" style={{ width: 216, gap: 4, padding: 8 }}>
              <div style={{ position: 'relative', width: box, height: box, background: 'repeating-conic-gradient(#3a3f4f 0 25%, #2a2e3a 0 50%) 0 0 / 16px 16px', borderRadius: 6 }}>
                <img src={artUrl(n)} style={{ position: 'absolute', left: (box - dw) / 2, top: (box - dh) / 2, width: dw, height: dh }} />
                <div title="точка опоры" style={{ position: 'absolute', left: (box - dw) / 2 + e.ax * dw - 6, top: (box - dh) / 2 + e.ay * dh - 6, width: 12, height: 12, borderRadius: 6, border: '2px solid #ff3a3a', boxShadow: '0 0 0 1px #000' }} />
                {(e.fx ?? []).map((f) => <div title={f.kind} style={{ position: 'absolute', left: (box - dw) / 2 + f.x * dw - 4, top: (box - dh) / 2 + f.y * dh - 4, width: 8, height: 8, borderRadius: 4, background: FX_COL[f.kind] ?? '#fff', boxShadow: '0 0 0 1px #000' }} />)}
              </div>
              <b style={{ fontSize: 12, wordBreak: 'break-all' }}>{n}</b>
              <span class="mute" style={{ fontSize: 11 }}>{e.w}×{e.h} · размер в сцене {e.size} · опора ({e.ax}, {e.ay})</span>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
