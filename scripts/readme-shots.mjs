import { createRequire } from 'module'; const require = createRequire('/opt/node22/lib/node_modules/'); const { chromium } = require('playwright');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 640 } });
p.on('pageerror', (e) => console.log('pageerror:', e.message));
await p.goto('http://localhost:5173/?new=order&skipintro&seed=4242');
await p.waitForTimeout(9000);
// advance the city to look lived-in
await p.evaluate(`(() => { const g = ga.game; const lv = { citadel: 12, wall: 11, farm: 9, sawmill: 9, quarry: 8, goldmine: 7, barracks: 10, range: 10, stable: 8, spire: 6, academy: 10, infirmary: 9, tavern: 10, warehouse: 10, watchtower: 10, sanctum: 0 };
  for (const b of g.s.buildings) { const p = { farm3: 6, farm4: 0, saw3: 5, saw4: 0, quarry2: 4, quarry3: 0, gold2: 3, gold3: 0 }[b.plot]; b.level = p ?? lv[b.type] ?? b.level; b.stored = b.level ? 99999 : 0; }
  for (const k of ['aerena','kael','grom','lyra','syra']) { g.s.heroes[k].owned = true; g.s.heroes[k].level = 18; g.s.heroes[k].stars = 2; }
  g.s.troops = { inf2: 1400, arc2: 900, cav2: 700, mag2: 300 }; g.s.res = { food: 284000, wood: 251000, stone: 98000, gold: 41000, aether: 640 };
  g.s.tutorial.done = true; bus.emit('state'); })()`);
await p.waitForTimeout(3000);
await p.evaluate(`ga.city.camera.x = 1350; ga.city.camera.y = 860; ga.city.camera.zoom = 0.62`);
await p.waitForTimeout(1500);
await p.screenshot({ path: 'docs/img/city.png' });
await p.evaluate(`ui.open('heroes')`); await p.waitForTimeout(800);
await p.screenshot({ path: 'docs/img/heroes.png' });
await p.evaluate(`ui.closeAll(); ga.setView('world')`); await p.waitForTimeout(2500);
await p.evaluate(`(() => { const g = ga.game; const c = g.cityPos(); const camps = g.s.world.objects.filter(o => o.kind==='camp').sort((a,b)=>Math.hypot(a.x-c.x,a.y-c.y)-Math.hypot(b.x-c.x,b.y-c.y)); 
  g.dispatch({ lead: 'grom', deputy: 'kael', troops: { cav2: 600, inf2: 400 }, target: {x: camps[2].x, y: camps[2].y}, action: 'attack', targetId: camps[2].id });
  const nodes = g.s.world.objects.filter(o => o.kind==='node').sort((a,b)=>Math.hypot(a.x-c.x,a.y-c.y)-Math.hypot(b.x-c.x,b.y-c.y));
  g.dispatch({ lead: 'lyra', deputy: null, troops: { arc2: 500 }, target: {x: nodes[1].x, y: nodes[1].y}, action: 'gather', targetId: nodes[1].id });
  const r = g.s.world.objects.find(o => o.kind==='titan' && o.titanId==='roc'); for (let dy=-14; dy<=14; dy++) for (let dx=-14; dx<=14; dx++) { const x=r.x+dx,y=r.y+dy; if (x>=0&&y>=0&&x<128&&y<128&&dx*dx+dy*dy<196) g.fog[y*128+x]=1; }
  for (let dy=-22; dy<=22; dy++) for (let dx=-22; dx<=22; dx++) { const x=c.x+dx,y=c.y+dy; if (x>=0&&y>=0&&x<128&&y<128&&dx*dx+dy*dy<484) g.fog[y*128+x]=1; }
  bus.emit('fog'); })()`);
await p.waitForTimeout(4000);
await p.evaluate(`(() => { const c = ga.game.cityPos(); ga.world.camera.x = (c.x+3)*64; ga.world.camera.y = (c.y-1)*64; ga.world.camera.zoom = 0.52; })()`);
await p.waitForTimeout(1500);
await p.screenshot({ path: 'docs/img/world.png' });
await p.waitForTimeout(25000);
await p.evaluate(`ui.open('reports', { id: ga.game.s.reports.find(r => r.kind === 'battle')?.id })`); await p.waitForTimeout(7000);
await p.screenshot({ path: 'docs/img/report.png' });
await b.close();
