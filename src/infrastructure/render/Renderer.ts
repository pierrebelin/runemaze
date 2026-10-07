import { Rng } from '../../domain/Rng';
import { TOWERS } from '../../domain/catalog/towers';
import type { World } from '../../domain/model/World';
import type { Projectile } from '../../domain/model/types';
import { fittedView, MAX_ZOOM, type MapPlacement, type WorldView } from './commonWorld';
import { BANNER_LIFE, type Effects } from './Effects';
import { FAMILY_COLOR, PAL } from './palette';
import { drawCreep, drawTower } from './sprites';

export interface ViewState {
  buildDef: string | null;
  ghost: { x: number; y: number; ok: boolean } | null;
  previewRoute: number[][] | null;
  selectedTower: number | null;
  selectedCreep: number | null;
  showRoute: boolean;
}

const DISPLAY_FONT = '"Grenze Gotisch", "Palatino Linotype", Palatino, serif';
const BODY_FONT = '"Alegreya Sans", "Gill Sans", "Trebuchet MS", sans-serif';

/** Une carte de la partie : son monde, sa place dans le monde commun, ses effets et son aperçu. */
export interface Board { world: World; place: MapPlacement; fx: Effects; view: ViewState; nick: string }

interface Terrain { canvas: HTMLCanvasElement; mapId: string; scale: number; dpr: number }
interface Trail { canvas: HTMLCanvasElement; key: string }
interface Facing { x: number; y: number; dx: number; dy: number }

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private dpr = 1;
  private cssW = 0;
  private cssH = 0;
  /** Caches par rang de carte : le `World` adverse est remplacé à chaque `Rival`, le terrain (clé : id de carte, échelle ajustée, dpr) et les orientations lui survivent. */
  private terrains: Terrain[] = [];
  /** Sentier de terre sous le trajet terrestre : redessiné seulement quand le trajet ou le terrain change. */
  private trails: Trail[] = [];
  private facings: Map<number, Facing>[] = [];

  constructor(readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D indisponible');
    this.ctx = ctx;
  }

  /** Dimensionne la toile à toute la zone de jeu. */
  resize(availW: number, availH: number): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    this.cssW = availW;
    this.cssH = availH;
    this.canvas.style.width = `${availW}px`;
    this.canvas.style.height = `${availH}px`;
    this.canvas.width = Math.round(availW * this.dpr);
    this.canvas.height = Math.round(availH * this.dpr);
  }

  /** Convertit une position écran (clientX/Y) en pixels CSS de la toile. */
  toScreen(clientX: number, clientY: number): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    return { x: clientX - r.left, y: clientY - r.top };
  }

  /** Repère en pixels CSS, origine décalée de (ox, oy). */
  private pixelSpace(ox: number, oy: number): void {
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, ox * this.dpr, oy * this.dpr);
  }

  /** Terrain construit une fois à la résolution du zoom maximal ; le zoom courant le réduit au dessin. */
  private terrainOf(index: number, world: World, place: MapPlacement): Terrain {
    const scale = MAX_ZOOM * fittedView(place, { w: this.cssW, h: this.cssH }).scale;
    let t = this.terrains[index];
    if (!t || t.mapId !== world.map.id || t.scale !== scale || t.dpr !== this.dpr) {
      t = { canvas: this.buildTerrain(world, scale), mapId: world.map.id, scale, dpr: this.dpr };
      this.terrains[index] = t;
    }
    return t;
  }

  private trailOf(index: number, world: World, terrain: Terrain): HTMLCanvasElement {
    const route = world.groundRoute();
    const key = `${terrain.mapId}|${terrain.scale}|${terrain.dpr}|${route.map((leg) => leg.join(',')).join(';')}`;
    let t = this.trails[index];
    if (!t || t.key !== key) {
      t = { canvas: this.buildTrail(world, route, terrain.scale), key };
      this.trails[index] = t;
    }
    return t.canvas;
  }

  /** Sentier discret : terre usée translucide, bords irréguliers, quelques cailloux. Le grain dépend de la case, pas du tracé : il ne scintille pas quand le labyrinthe change. */
  private buildTrail(world: World, route: number[][], scale: number): HTMLCanvasElement {
    const g = world.grid;
    const c = document.createElement('canvas');
    c.width = Math.round(g.w * scale * this.dpr);
    c.height = Math.round(g.h * scale * this.dpr);
    const ctx = c.getContext('2d')!;
    const s = this.dpr * scale;
    ctx.setTransform(s, 0, 0, s, 0, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const legs = route.filter((leg) => leg.length > 1).map((leg) => leg.map((i) => ({ x: g.cx(i) + 0.5, y: g.cy(i) + 0.5 })));
    const smooth = (pts: { x: number; y: number }[]): void => {
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let k = 1; k < pts.length - 1; k++) {
        ctx.quadraticCurveTo(pts[k].x, pts[k].y, (pts[k].x + pts[k + 1].x) / 2, (pts[k].y + pts[k + 1].y) / 2);
      }
      ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
    };
    const stroke = (width: number, color: string): void => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      for (const pts of legs) {
        smooth(pts);
        ctx.stroke();
      }
    };
    const cells = [...new Set(route.flat())];

    // Herbe usée : un liseré à peine plus sombre, aux bords mordus.
    for (const i of cells) {
      const rng = new Rng(i * 7919 + 13);
      ctx.fillStyle = 'rgba(40, 34, 22, 0.14)';
      ctx.beginPath();
      ctx.ellipse(g.cx(i) + 0.5 + (rng.next() - 0.5) * 0.3, g.cy(i) + 0.5 + (rng.next() - 0.5) * 0.3, 0.42 + rng.next() * 0.1, 0.38 + rng.next() * 0.08, rng.next() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Terre qui affleure, translucide : l'herbe transparaît encore.
    stroke(0.55, 'rgba(87, 70, 45, 0.32)');
    stroke(0.3, 'rgba(106, 86, 57, 0.28)');
    // Grain : quelques mottes et cailloux, épars.
    for (const i of cells) {
      const rng = new Rng(i * 104729 + 7);
      const n = 1 + rng.int(3);
      for (let k = 0; k < n; k++) {
        const x = g.cx(i) + 0.5 + (rng.next() - 0.5) * 0.55;
        const y = g.cy(i) + 0.5 + (rng.next() - 0.5) * 0.55;
        const pebble = rng.next() < 0.3;
        ctx.fillStyle = pebble ? 'rgba(176, 162, 132, 0.3)' : 'rgba(60, 46, 30, 0.25)';
        ctx.beginPath();
        ctx.ellipse(x, y, pebble ? 0.045 : 0.07, pebble ? 0.03 : 0.045, rng.next() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    return c;
  }

  private buildTerrain(world: World, scale: number): HTMLCanvasElement {
    const g = world.grid;
    const c = document.createElement('canvas');
    c.width = Math.round(g.w * scale * this.dpr);
    c.height = Math.round(g.h * scale * this.dpr);
    const ctx = c.getContext('2d')!;
    const s = this.dpr * scale;
    ctx.setTransform(s, 0, 0, s, 0, 0);
    const rng = new Rng(20240611);

    // Herbe : fond uni, puis taches douces pour casser la grille.
    ctx.fillStyle = PAL.grassB;
    ctx.fillRect(0, 0, g.w, g.h);
    for (let i = 0; i < 220; i++) {
      const x = rng.next() * g.w;
      const y = rng.next() * g.h;
      const r = 0.8 + rng.next() * 2.6;
      ctx.fillStyle = rng.next() < 0.5 ? 'rgba(78, 100, 56, 0.22)' : 'rgba(34, 46, 26, 0.25)';
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * (0.6 + rng.next() * 0.4), rng.next() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Terre battue autour du portail, de la pierre runique et de la porte.
    for (let y = 0; y < g.h; y++) {
      for (let x = 0; x < g.w; x++) {
        const k = g.kind[g.idx(x, y)];
        if (k !== 'road' && k !== 'spawn' && k !== 'exit' && k !== 'checkpoint') continue;
        for (let j = 0; j < 3; j++) {
          ctx.fillStyle = rng.next() < 0.5 ? PAL.dirt : PAL.dirtDark;
          ctx.beginPath();
          ctx.ellipse(x + 0.5 + (rng.next() - 0.5) * 0.5, y + 0.5 + (rng.next() - 0.5) * 0.5, 0.75, 0.6, rng.next() * 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    // Touffes d'herbe et cailloux.
    for (let i = 0; i < g.w * g.h * 0.9; i++) {
      const x = rng.next() * g.w;
      const y = rng.next() * g.h;
      const k = g.kind[g.idx(Math.floor(x), Math.floor(y))];
      if (k !== 'build') continue;
      if (rng.next() < 0.85) {
        ctx.strokeStyle = rng.next() < 0.5 ? PAL.tuft : '#2f3f25';
        ctx.lineWidth = 0.04;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 0.06, y - 0.16);
        ctx.moveTo(x, y);
        ctx.lineTo(x + 0.07, y - 0.14);
        ctx.stroke();
      } else {
        ctx.fillStyle = 'rgba(160, 150, 125, 0.45)';
        ctx.beginPath();
        ctx.ellipse(x, y, 0.07, 0.05, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Rochers et falaises.
    for (let y = 0; y < g.h; y++) {
      for (let x = 0; x < g.w; x++) {
        if (g.kind[g.idx(x, y)] !== 'rock') continue;
        const border = x === 0 || y === 0 || x === g.w - 1 || y === g.h - 1;
        ctx.fillStyle = border ? PAL.cliff : PAL.rockDark;
        ctx.fillRect(x - 0.02, y - 0.02, 1.04, 1.04);
        const n = 2 + rng.int(2);
        for (let k = 0; k < n; k++) {
          const rx = x + 0.2 + rng.next() * 0.6;
          const ry = y + 0.2 + rng.next() * 0.6;
          const rr = 0.25 + rng.next() * 0.25;
          ctx.fillStyle = border ? '#3a352c' : PAL.rock;
          ctx.beginPath();
          ctx.ellipse(rx, ry, rr, rr * 0.8, rng.next(), 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = border ? 'rgba(120,110,90,0.25)' : PAL.rockLight;
          ctx.beginPath();
          ctx.ellipse(rx - rr * 0.25, ry - rr * 0.3, rr * 0.45, rr * 0.25, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    // Bord intérieur ombré des falaises.
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(1, 1, g.w - 2, 0.18);
    ctx.fillRect(1, 1, 0.18, g.h - 2);
    return c;
  }

  draw(boards: Board[], view: WorldView, own: number, time: number, realTime: number): void {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = PAL.cliff;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    boards.forEach((board, i) => this.drawBoard(i, board, view, boards.length > 1, time, realTime));
    // Bannière et voile de fuite : à l'écran, pour la carte du joueur seulement.
    this.pixelSpace(0, 0);
    this.drawAlerts(boards[own].fx, view.scale);
  }

  private drawBoard(index: number, { world: w, place, fx, view, nick }: Board, wv: WorldView, duel: boolean, time: number, realTime: number): void {
    const ctx = this.ctx;
    const g = w.grid;
    const cs = wv.scale;
    const ox = (place.x - wv.x) * cs;
    const oy = (place.y - wv.y) * cs;
    const cellSpace = (): void => {
      const s = this.dpr * cs;
      ctx.setTransform(s, 0, 0, s, ox * this.dpr, oy * this.dpr);
    };

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const terrain = this.terrainOf(index, w, place);
    const rect = [ox * this.dpr, oy * this.dpr, g.w * cs * this.dpr, g.h * cs * this.dpr] as const;
    ctx.drawImage(terrain.canvas, ...rect);
    ctx.drawImage(this.trailOf(index, w, terrain), ...rect);
    cellSpace();

    this.drawLandmarks(g, realTime);

    if (view.buildDef) {
      ctx.strokeStyle = 'rgba(239, 227, 196, 0.07)';
      ctx.lineWidth = 0.03;
      ctx.beginPath();
      for (let x = 1; x < g.w; x++) {
        ctx.moveTo(x, 1);
        ctx.lineTo(x, g.h - 1);
      }
      for (let y = 1; y < g.h; y++) {
        ctx.moveTo(1, y);
        ctx.lineTo(g.w - 1, y);
      }
      ctx.stroke();
    }

    if (view.showRoute || view.buildDef) this.drawRoute(g, w.groundRoute(), 'rgba(239, 227, 196, 0.32)', realTime, view.previewRoute ? 0.5 : 1);
    if (view.previewRoute) this.drawRoute(g, view.previewRoute, 'rgba(233, 185, 73, 0.85)', realTime, 1);

    const sel = view.selectedTower !== null ? w.towerById.get(view.selectedTower) : undefined;
    if (sel?.def.attack) this.rangeCircle(sel.cx, sel.cy, sel.def.attack.range, 'rgba(233, 185, 73, 0.9)');

    const towers = [...w.towers].sort((a, b) => a.cy - b.cy);
    for (const t of towers) {
      const rec = fx.recoil.get(t.id) ?? 0;
      ctx.save();
      if (rec > 0) {
        ctx.translate(-Math.cos(t.aim) * rec * 0.5, -Math.sin(t.aim) * rec * 0.5);
      }
      drawTower(ctx, t.def, t.cx, t.cy, t.aim, realTime);
      ctx.restore();
      if (t === sel) {
        ctx.strokeStyle = PAL.gold;
        ctx.lineWidth = 0.08;
        ctx.strokeRect(t.x + 0.04, t.y + 0.04, 1.92, 1.92);
      }
    }

    if (view.buildDef && view.ghost) {
      const gh = view.ghost;
      const def = TOWERS[view.buildDef];
      ctx.fillStyle = gh.ok ? 'rgba(140, 196, 100, 0.28)' : 'rgba(216, 85, 63, 0.35)';
      ctx.fillRect(gh.x, gh.y, 2, 2);
      ctx.strokeStyle = gh.ok ? PAL.good : PAL.danger;
      ctx.lineWidth = 0.06;
      ctx.strokeRect(gh.x + 0.03, gh.y + 0.03, 1.94, 1.94);
      ctx.globalAlpha = 0.65;
      drawTower(ctx, def, gh.x + 1, gh.y + 1, -Math.PI / 2, realTime);
      ctx.globalAlpha = 1;
      if (def.attack) this.rangeCircle(gh.x + 1, gh.y + 1, def.attack.range, gh.ok ? 'rgba(239, 227, 196, 0.7)' : 'rgba(216, 85, 63, 0.7)');
    }

    // Créatures : d'abord au sol, puis les volants au-dessus de tout.
    const ground = w.creeps.filter((c) => c.alive && !c.def.air).sort((a, b) => a.y - b.y);
    const air = w.creeps.filter((c) => c.alive && c.def.air).sort((a, b) => a.y - b.y);
    for (const c of ground) this.creep(index, c, time);
    for (const p of w.projectiles) this.projectile(p, true);
    for (const c of air) this.creep(index, c, time);
    for (const p of w.projectiles) this.projectile(p, false);

    const selC = view.selectedCreep !== null ? w.creeps.find((c) => c.id === view.selectedCreep && c.alive) : undefined;
    if (selC) {
      ctx.strokeStyle = PAL.gold;
      ctx.lineWidth = 0.06;
      ctx.beginPath();
      ctx.ellipse(selC.x, selC.y + selC.def.radius * 0.5, selC.def.radius + 0.18, (selC.def.radius + 0.18) * 0.5, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    for (const r of fx.rings) {
      const k = 1 - r.life / r.max;
      ctx.strokeStyle = r.color;
      ctx.globalAlpha = 1 - k;
      ctx.lineWidth = 0.08;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r * (0.4 + 0.6 * k), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for (const b of fx.bolts) this.bolt(b.points, b.life / 0.2, b.seed);
    for (const p of fx.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;

    // Textes en pixels pour rester nets.
    this.pixelSpace(ox, oy);
    for (const f of fx.floaters) {
      ctx.globalAlpha = Math.min(1, f.life * 2);
      ctx.font = `700 ${Math.round(cs * (f.big ? 0.9 : 0.62))}px ${BODY_FONT}`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(20, 15, 8, 0.85)';
      ctx.strokeText(f.text, f.x * cs, f.y * cs);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x * cs, f.y * cs);
    }
    ctx.globalAlpha = 1;

    // Pseudo dans la bande de rocher du haut, en duel seulement.
    if (duel) {
      ctx.font = `700 ${Math.round(cs * 0.7)}px ${BODY_FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = PAL.parchment;
      ctx.fillText(nick, (g.w * cs) / 2, cs * 0.5);
      ctx.textBaseline = 'alphabetic';
    }
    this.pruneFacing(index, w);
  }

  private drawAlerts(fx: Effects, cs: number): void {
    const ctx = this.ctx;
    const W = this.cssW;
    const H = this.cssH;
    if (fx.leakFlash > 0) {
      const a = Math.min(0.5, fx.leakFlash);
      const grad = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.7);
      grad.addColorStop(0, 'rgba(216, 85, 63, 0)');
      grad.addColorStop(1, `rgba(216, 85, 63, ${a})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    }

    if (fx.banner) {
      const b = fx.banner;
      const k = b.life > BANNER_LIFE - 0.4 ? (BANNER_LIFE - b.life) / 0.4 : b.life < 0.6 ? b.life / 0.6 : 1;
      ctx.globalAlpha = Math.max(0, Math.min(1, k));
      ctx.fillStyle = 'rgba(20, 16, 10, 0.55)';
      ctx.fillRect(0, H * 0.38, W, cs * (2.45 + 0.9 * b.lines.length));
      ctx.textAlign = 'center';
      ctx.font = `${Math.round(cs * 1.9)}px ${DISPLAY_FONT}`;
      ctx.fillStyle = b.boss ? '#f07a5c' : PAL.parchment;
      ctx.fillText(b.title, W / 2, H * 0.38 + cs * 1.85);
      ctx.font = `500 ${Math.round(cs * 0.72)}px ${BODY_FONT}`;
      ctx.fillStyle = PAL.gold;
      b.lines.forEach((line, i) => ctx.fillText(line, W / 2, H * 0.38 + cs * (2.75 + 0.9 * i)));
      ctx.globalAlpha = 1;
    }
  }

  private drawLandmarks(g: World['grid'], t: number): void {
    const ctx = this.ctx;
    // Portail d'apparition : faille violacée tourbillonnante.
    const sp = g.regionCenter(g.spawnCells);
    for (let i = 0; i < 4; i++) {
      ctx.strokeStyle = `rgba(150, 110, 200, ${0.5 - i * 0.1})`;
      ctx.lineWidth = 0.12;
      ctx.beginPath();
      ctx.ellipse(sp.x, sp.y, 1.3 - i * 0.25, 1.0 - i * 0.2, t * (0.6 + i * 0.3), 0.3, Math.PI * 1.6);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(40, 20, 60, 0.55)';
    ctx.beginPath();
    ctx.ellipse(sp.x, sp.y, 0.5, 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pierres runiques : un cercle de runes qui pulse par pierre, numéroté s'il y en a plusieurs.
    const pulse = 0.5 + 0.5 * Math.sin(t * 2);
    g.checkpoints.forEach((cells, k) => {
      const cp = g.regionCenter(cells);
      ctx.fillStyle = 'rgba(30, 26, 20, 0.35)';
      ctx.beginPath();
      ctx.arc(cp.x, cp.y, 1.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(233, 185, 73, ${0.45 + 0.35 * pulse})`;
      ctx.lineWidth = 0.08;
      ctx.beginPath();
      ctx.arc(cp.x, cp.y, 1.55, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + t * 0.2;
        const rx = cp.x + Math.cos(a) * 1.55;
        const ry = cp.y + Math.sin(a) * 1.55;
        ctx.fillStyle = PAL.gold;
        ctx.fillRect(rx - 0.07, ry - 0.12, 0.14, 0.24);
      }
      ctx.fillStyle = PAL.stone;
      ctx.beginPath();
      ctx.moveTo(cp.x - 0.35, cp.y + 0.5);
      ctx.lineTo(cp.x - 0.25, cp.y - 0.6);
      ctx.lineTo(cp.x + 0.25, cp.y - 0.7);
      ctx.lineTo(cp.x + 0.35, cp.y + 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = `rgba(255, 220, 120, ${0.6 + 0.4 * pulse})`;
      ctx.lineWidth = 0.06;
      ctx.beginPath();
      ctx.moveTo(cp.x, cp.y - 0.4);
      ctx.lineTo(cp.x, cp.y + 0.25);
      ctx.moveTo(cp.x - 0.14, cp.y - 0.15);
      ctx.lineTo(cp.x + 0.14, cp.y);
      ctx.stroke();
      if (g.checkpoints.length > 1) {
        ctx.fillStyle = 'rgba(255, 240, 210, 0.9)';
        ctx.font = '0.6px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(k + 1), cp.x, cp.y + 1.1);
      }
    });

    // Porte de sortie : arche de pierre et lueur rouge.
    const ex = g.regionCenter(g.exitCells);
    ctx.fillStyle = `rgba(216, 85, 63, ${0.18 + 0.1 * pulse})`;
    ctx.beginPath();
    ctx.ellipse(ex.x, ex.y, 1.5, 1.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PAL.stoneDark;
    ctx.fillRect(ex.x - 1.3, ex.y - 1.4, 0.4, 2.6);
    ctx.fillRect(ex.x + 0.9, ex.y - 1.4, 0.4, 2.6);
    ctx.beginPath();
    ctx.arc(ex.x, ex.y - 1.3, 1.3, Math.PI, 0);
    ctx.lineWidth = 0.35;
    ctx.strokeStyle = PAL.stoneDark;
    ctx.stroke();
    ctx.fillStyle = 'rgba(25, 10, 8, 0.7)';
    ctx.beginPath();
    ctx.arc(ex.x, ex.y - 1.1, 0.85, Math.PI, 0);
    ctx.lineTo(ex.x + 0.85, ex.y + 1.2);
    ctx.lineTo(ex.x - 0.85, ex.y + 1.2);
    ctx.closePath();
    ctx.fill();
  }

  private drawRoute(g: World['grid'], route: number[][], color: string, t: number, alpha: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.1;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.setLineDash([0.28, 0.32]);
    ctx.lineDashOffset = -t * 1.2;
    for (const leg of route) {
      if (leg.length < 2) continue;
      ctx.beginPath();
      leg.forEach((i, k) => {
        const x = g.cx(i) + 0.5;
        const y = g.cy(i) + 0.5;
        if (k === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }
    ctx.restore();
  }

  private rangeCircle(x: number, y: number, r: number, color: string): void {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(239, 227, 196, 0.06)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.05;
    ctx.setLineDash([0.3, 0.2]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  private creep(index: number, c: World['creeps'][number], time: number): void {
    const facing = (this.facings[index] ??= new Map());
    let f = facing.get(c.id);
    if (!f) {
      f = { x: c.x, y: c.y, dx: 1, dy: 0 };
      facing.set(c.id, f);
    }
    const dx = c.x - f.x;
    const dy = c.y - f.y;
    if (Math.hypot(dx, dy) > 0.02) {
      f.dx = f.dx * 0.7 + dx * 0.3;
      f.dy = f.dy * 0.7 + dy * 0.3;
      f.x = c.x;
      f.y = c.y;
    }
    drawCreep(this.ctx, c, f.dx, f.dy, time);
  }

  private pruneFacing(index: number, w: World): void {
    const facing = this.facings[index];
    if (!facing) return;
    const alive = new Set(w.creeps.map((c) => c.id));
    for (const k of facing.keys()) if (!alive.has(k)) facing.delete(k);
  }

  private projectile(p: Projectile, lowPass: boolean): void {
    // Les boulets et projectiles vers les volants passent au-dessus.
    const high = p.family === 'cannon';
    if (lowPass === high) return;
    const ctx = this.ctx;
    const col = FAMILY_COLOR[p.family];
    const ang = Math.atan2(p.ty - p.y, p.tx - p.x);
    switch (p.family) {
      case 'archer': {
        ctx.strokeStyle = '#e8d6b0';
        ctx.lineWidth = 0.05;
        ctx.beginPath();
        ctx.moveTo(p.x - Math.cos(ang) * 0.35, p.y - Math.sin(ang) * 0.35);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        ctx.fillStyle = p.crit ? PAL.gold : '#cfc6b5';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 0.05, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'cannon': {
        const total = Math.hypot(p.tx - p.sx, p.ty - p.sy) || 1;
        const left = Math.hypot(p.tx - p.x, p.ty - p.y);
        const k = Math.max(0, Math.min(1, 1 - left / total));
        const air = p.attack.targets === 'air';
        const h = air ? 0 : Math.sin(Math.PI * k) * Math.min(1.4, total * 0.25);
        ctx.fillStyle = PAL.shadow;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, 0.12, 0.06, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = air ? '#f0a050' : '#1b1b1e';
        ctx.beginPath();
        ctx.arc(p.x, p.y - h, air ? 0.09 : 0.13, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'frost': {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(ang);
        ctx.fillStyle = col.glow;
        ctx.beginPath();
        ctx.moveTo(0.2, 0);
        ctx.lineTo(0, 0.08);
        ctx.lineTo(-0.2, 0);
        ctx.lineTo(0, -0.08);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        break;
      }
      case 'venom': {
        ctx.fillStyle = col.main;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 0.11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = col.glow;
        ctx.beginPath();
        ctx.arc(p.x - 0.03, p.y - 0.03, 0.04, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      default:
        break;
    }
  }

  private bolt(points: { x: number; y: number }[], life: number, seed: number): void {
    const ctx = this.ctx;
    const rng = new Rng(Math.floor(seed));
    const path: { x: number; y: number }[] = [];
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      const n = 5;
      for (let k = 0; k < n; k++) {
        const t = k / n;
        const j = k === 0 ? 0 : (rng.next() - 0.5) * 0.35;
        path.push({ x: a.x + (b.x - a.x) * t + j, y: a.y + (b.y - a.y) * t + j });
      }
    }
    path.push(points[points.length - 1]);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const [w, c] of [[0.22, `rgba(169, 140, 240, ${0.35 * life})`], [0.07, `rgba(245, 238, 255, ${life})`]] as const) {
      ctx.strokeStyle = c;
      ctx.lineWidth = w;
      ctx.beginPath();
      path.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.stroke();
    }
  }
}
