// Planche des sprites : dessine tous les éléments graphiques du jeu avec le vrai code de rendu.
// En développement : npm run dev, puis /sprites.html. À publier : npm run build:sprites.
import { TOWERS } from '../../src/domain/catalog/towers';
import { CREEPS } from '../../src/domain/catalog/creeps';
import { BUILDERS } from '../../src/domain/catalog/builders';
import { MAPS, MAP_CROSSING } from '../../src/domain/catalog/map';
import { builderTowers } from '../../src/domain/rules/builder';
import { World } from '../../src/domain/model/World';
import { spawnCreep } from '../../src/domain/systems/waves';
import { BreakerPhase, type Tower, type TowerDef, type CreepDef } from '../../src/domain/model/types';
import { Renderer, type ViewState } from '../../src/infrastructure/render/Renderer';
import { Effects } from '../../src/infrastructure/render/Effects';
import { fittedView } from '../../src/infrastructure/render/commonWorld';
import { drawTower, drawCreep, type CreepLike } from '../../src/infrastructure/render/sprites';
import { PAL, FAMILY_COLOR, CREEP_STYLE } from '../../src/infrastructure/render/palette';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (sel: string) => document.querySelector(sel) as HTMLElement;
const el = (tag: string, cls = '', text = ''): HTMLElement => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
};

type Drawer = (t: number) => void;
const drawers: Drawer[] = [];

/** Toile en unités de case : `cells` cases de large, `px` pixels par case. */
function cellCanvas(wCells: number, hCells: number, px: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; prep: () => void } {
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(wCells * px * dpr);
  canvas.height = Math.round(hCells * px * dpr);
  canvas.style.width = `${wCells * px}px`;
  canvas.style.height = `${hCells * px}px`;
  const ctx = canvas.getContext('2d')!;
  const prep = () => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(px * dpr, 0, 0, px * dpr, 0, 0);
  };
  return { canvas, ctx, prep };
}

// ─── Palette ────────────────────────────────────────────────────────────────
const UI = {
  ground: '#14110d', panel: '#1d1914', 'panel-2': '#262019', slot: '#211c16', line: '#4a3d29', 'line-soft': '#342c20',
  bronze: '#b98d4c', gold: '#e9b949', text: '#efe3c4', 'text-dim': '#b3a78b', 'text-faint': '#857a63',
  good: '#8cc464', bad: '#e0664f', frost: '#8fd3f2',
};
const FAMILY_LABEL: Record<string, string> = { wall: 'Mur', archer: 'Archer', cannon: 'Canon', frost: 'Givre', storm: 'Foudre', venom: 'Venin' };

function swatches(host: HTMLElement, title: string, entries: [string, string][]): void {
  const g = el('div', 'swgroup');
  g.append(el('h4', '', title));
  const list = el('div', 'swlist');
  for (const [name, color] of entries) {
    const s = el('div', 'sw');
    const chip = el('span', 'chip');
    chip.style.background = color;
    s.append(chip, el('span', 'swname', name), el('code', '', color));
    list.append(s);
  }
  g.append(list);
  host.append(g);
}
{
  const host = $('#palette');
  swatches(host, 'Monde (PAL)', Object.entries(PAL));
  swatches(host, 'Interface (index.html)', Object.entries(UI).map(([k, v]) => [`--${k}`, v]));
  const fam = el('div', 'swgroup');
  fam.append(el('h4', '', 'Familles de tours (main · dark · glow)'));
  const famList = el('div', 'famlist');
  for (const [f, c] of Object.entries(FAMILY_COLOR)) {
    const row = el('div', 'fam');
    const bars = el('div', 'fambars');
    for (const v of [c.main, c.dark, c.glow]) {
      const b = el('span', '');
      b.style.background = v;
      b.title = v;
      bars.append(b);
    }
    row.append(bars, el('span', 'swname', FAMILY_LABEL[f] ?? f), el('code', '', `${c.main} ${c.dark} ${c.glow}`));
    famList.append(row);
  }
  fam.append(famList);
  host.append(fam);
}

// ─── Cartes ─────────────────────────────────────────────────────────────────
const noView: ViewState = { buildDef: null, ghost: null, previewRoute: null, selectedTower: null, selectedCreep: null, showRoute: false };

function mapBoard(host: HTMLElement, world: World, fx: Effects, width: number, view: ViewState = noView): Drawer {
  const g = world.grid;
  const canvas = document.createElement('canvas');
  host.append(canvas);
  const r = new Renderer(canvas);
  const place = { x: 0, y: 0, w: g.w, h: g.h };
  let last = { w: 0, h: 0 };
  return (t: number) => {
    const w = Math.min(width, host.clientWidth || width);
    const hh = Math.round((w * g.h) / g.w);
    if (w !== last.w || hh !== last.h) {
      r.resize(w, hh);
      last = { w, h: hh };
    }
    r.draw([{ world, place, fx, view, nick: '' }], fittedView(place, { w, h: hh }), 0, t, t);
  };
}

{
  const host = $('#maps');
  for (const map of MAPS) {
    const fig = el('figure', 'map');
    const frame = el('div', 'mapframe');
    fig.append(frame);
    const cap = el('figcaption');
    cap.append(el('strong', '', map.name), el('span', '', `${map.width} × ${map.height} cases`));
    fig.append(cap);
    host.append(fig);
    const world = new World({ map, difficulty: 'normal', seed: 7, builder: 'bastion' });
    drawers.push(mapBoard(frame, world, new Effects(false), 720));
  }
}

// ─── Tours ──────────────────────────────────────────────────────────────────
const TIER_LABEL = (d: TowerDef) => (d.family === 'wall' ? 'base' : d.elements ? `hybride ${d.tier}` : `niveau ${d.tier}`);

function towerTile(def: TowerDef, px = 46): HTMLElement {
  const tile = el('figure', 'tile');
  const { canvas, ctx, prep } = cellCanvas(3, 3, px);
  tile.append(canvas);
  const cap = el('figcaption');
  const name = el('span', 'tname', def.name);
  const fam = def.elements ?? [def.family];
  const dots = el('span', 'dots');
  for (const f of fam) {
    const d = el('i', '');
    d.style.background = FAMILY_COLOR[f].main;
    d.title = FAMILY_LABEL[f];
    dots.append(d);
  }
  cap.append(name, el('span', 'tmeta', TIER_LABEL(def)), dots);
  tile.append(cap);
  const phase = Math.random() * 6;
  drawers.push((t) => {
    prep();
    ctx.fillStyle = PAL.grassB;
    ctx.fillRect(0, 0, 3, 3);
    drawTower(ctx, def, 1.5, 1.6, -Math.PI / 2 + Math.sin(t * 0.6 + phase) * 0.9, t);
  });
  return tile;
}

function chain(roots: string[], allowed: Set<string>, hybrids: string[]): string[] {
  const out: string[] = [];
  const visit = (id: string) => {
    if (out.includes(id) || !allowed.has(id)) return;
    if (TOWERS[id].elements && !hybrids.includes(id) && !out.some((o) => TOWERS[o].elements)) return;
    out.push(id);
    for (const u of TOWERS[id].upgrades) if (!TOWERS[u].elements || TOWERS[id].elements) visit(u);
  };
  roots.forEach(visit);
  return out;
}

{
  const host = $('#towers');
  const wallSec = el('section', 'builder');
  const wh = el('header');
  wh.append(el('h3', '', 'Commun'), el('p', '', 'Le mur de pierre, ouvert à tous les bâtisseurs.'));
  const wg = el('div', 'tiles');
  wg.append(towerTile(TOWERS.wall));
  wallSec.append(wh, wg);
  host.append(wallSec);

  for (const b of Object.values(BUILDERS)) {
    const sec = el('section', 'builder');
    const head = el('header');
    head.append(el('h3', '', b.name), el('p', '', `${b.style[0].toUpperCase()}${b.style.slice(1)}.`));
    sec.append(head);
    const allowed = builderTowers(b, TOWERS);
    for (const root of b.roots) {
      const row = el('div', 'tiles');
      const ids = chain([root], allowed, []).filter((id) => !TOWERS[id].elements);
      ids.forEach((id) => row.append(towerTile(TOWERS[id])));
      sec.append(el('h5', '', `Lignée ${TOWERS[root].name}`), row);
    }
    const hy = el('div', 'tiles');
    for (const h of b.hybrids) {
      hy.append(towerTile(TOWERS[h]));
      for (const u of TOWERS[h].upgrades) hy.append(towerTile(TOWERS[u]));
    }
    sec.append(el('h5', '', 'Hybrides'), hy);
    host.append(sec);
  }
}

// ─── Créatures ──────────────────────────────────────────────────────────────
function fakeCreep(def: CreepDef, patch: Partial<CreepLike> = {}): CreepLike {
  return { def, x: 0, y: 0, hp: 100, maxHp: 100, slowPct: 0, poisons: [], shred: 0, hitFlash: 0, bob: Math.random() * 6, ...patch };
}

function creepTile(c: CreepLike, label: string, meta: string, px = 52, cells = 2.4): HTMLElement {
  const tile = el('figure', 'tile ctile');
  const { canvas, ctx, prep } = cellCanvas(cells, cells, px);
  tile.append(canvas);
  const cap = el('figcaption');
  cap.append(el('span', 'tname', label), el('span', 'tmeta', meta));
  tile.append(cap);
  const st = CREEP_STYLE[c.def.id];
  if (st) {
    const dots = el('span', 'dots');
    for (const v of [st.body, st.dark, st.eye]) {
      const d = el('i', '');
      d.style.background = v;
      dots.append(d);
    }
    cap.append(dots);
  }
  drawers.push((t) => {
    prep();
    ctx.fillStyle = PAL.grassB;
    ctx.fillRect(0, 0, cells, cells);
    c.x = cells / 2;
    c.y = cells / 2 + (c.def.air ? 0.35 : 0.1);
    drawCreep(ctx, c, 1, 0.25, t);
  });
  return tile;
}

{
  const groups: [string, (d: CreepDef) => boolean][] = [
    ['Créatures', (d) => !d.boss && !d.air && !['slimelet', 'hydrahead'].includes(d.id)],
    ['Volants', (d) => !!d.air],
    ['Chefs', (d) => !!d.boss],
    ['Rejetons', (d) => ['slimelet', 'hydrahead'].includes(d.id)],
  ];
  const host = $('#creeps');
  for (const [title, f] of groups) {
    host.append(el('h5', '', title));
    const row = el('div', 'tiles');
    for (const d of Object.values(CREEPS).filter(f)) {
      const big = d.boss ? 3.2 : 2.4;
      row.append(creepTile(fakeCreep(d), d.name, `armure ${d.armorType}`, 52, big));
    }
    host.append(row);
  }

  const states = $('#states');
  const raider = CREEPS.raider;
  const flashCreep = fakeCreep(raider);
  const armed = fakeCreep(CREEPS.sapper, { breaker: { phase: BreakerPhase.Armed, timer: 1 } });
  const cases: [CreepLike, string, string][] = [
    [fakeCreep(raider), 'Plein', 'sans barre'],
    [fakeCreep(raider, { hp: 70 }), 'Blessé', '70 % (vert)'],
    [fakeCreep(raider, { hp: 40 }), 'Blessé', '40 % (or)'],
    [fakeCreep(raider, { hp: 15 }), 'Blessé', '15 % (rouge)'],
    [fakeCreep(raider, { slowPct: 0.3 }), 'Ralenti', 'anneau givre'],
    [fakeCreep(raider, { poisons: [1] }), 'Empoisonné', 'bulle verte'],
    [flashCreep, 'Touché', 'éclair blanc'],
    [armed, 'Sapeur armé', 'aura orange'],
  ];
  for (const [c, a, b] of cases) states.append(creepTile(c, a, b));
  drawers.push((t) => {
    flashCreep.hitFlash = (t % 1.2) < 0.12 ? 1 : 0;
  });
}

// ─── Scène vivante : projectiles et effets ──────────────────────────────────
{
  const world = new World({ map: MAP_CROSSING, difficulty: 'easy', seed: 42, builder: 'bastion', lives: 1e9 });
  world.nextWaveIn = 1e9;
  const place = (def: string, x: number, y: number) => {
    const d = TOWERS[def];
    const t: Tower = {
      id: world.id(), def: d, x, y, cx: x + 1, cy: y + 1, cooldown: 0.2, targetMode: 'first', spent: d.cost,
      kills: 0, damage: 0, aim: -Math.PI / 2, ramp: 0, fate: 'standing',
    };
    world.towers.push(t);
    world.towerById.set(t.id, t);
    for (const i of world.grid.footprint(x, y)) world.grid.tower[i] = t.id;
  };
  const layout: [string, number, number][] = [
    ['volley', 7, 6], ['mortar', 12, 9], ['glacier', 16, 3], ['tempest', 20, 7], ['plague', 24, 4],
    ['guard', 14, 13], ['greatgong', 20, 12], ['ballista', 26, 15], ['acid', 10, 16], ['flak', 18, 17],
    ['standard', 28, 8], ['hail', 6, 11], ['pylon', 24, 10], ['briar', 8, 3],
  ];
  layout.forEach(([d, x, y]) => place(d, x, y));
  world.refreshPaths();
  const fx = new Effects(false);
  const cycle = ['raider', 'wolf', 'harpy', 'golem', 'wraith', 'slime', 'shaman', 'knight', 'wyvern', 'dunerunner', 'sapper', 'runeguard'];
  let k = 0;
  let spawnTimer = 0;
  let acc = 0;
  let prev = 0;
  const frame = $('#scene');
  const draw = mapBoard(frame, world, fx, 1100, { ...noView, showRoute: true });
  drawers.push((t) => {
    const dt = Math.min(0.1, prev ? t - prev : 0);
    prev = t;
    acc += dt;
    while (acc >= 1 / 60) {
      acc -= 1 / 60;
      spawnTimer -= 1 / 60;
      if (spawnTimer <= 0 && world.creeps.filter((c) => c.alive).length < 14) {
        spawnCreep(world, cycle[k++ % cycle.length], 14);
        spawnTimer = 0.9;
      }
      try {
        world.step();
      } catch {
        /* la scène reste décorative */
      }
      fx.consume(world.drainEvents());
    }
    fx.update(dt);
    draw(t);
  });
}

// ─── Boucle ─────────────────────────────────────────────────────────────────
const start = performance.now();
function tick(now: number): void {
  const t = (now - start) / 1000;
  for (const d of drawers) d(t);
  if (!reduced) requestAnimationFrame(tick);
}
if (reduced) {
  // Une seule image fixe, mais la scène avance quelques secondes pour montrer des effets.
  for (let i = 0; i < 300; i++) drawers[drawers.length - 1](i / 60);
  tick(start + 2000);
} else requestAnimationFrame(tick);
