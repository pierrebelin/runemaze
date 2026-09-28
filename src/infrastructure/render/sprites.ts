import { Grid } from '../../domain/model/Grid';
import type { CellKind, Creep, CreepDef, MapDef, TowerDef } from '../../domain/model/types';
import { CREEP_STYLE, FAMILY_COLOR, PAL } from './palette';
import { BreakerPhase } from '../../domain/model/types';

// Dessins vectoriels procéduraux. Le contexte est déjà mis à l'échelle :
// une unité = une case de la grille. Les mêmes fonctions servent à la carte,
// au portrait et aux icônes du panneau de commandes.

type Ctx = CanvasRenderingContext2D;

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function circle(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
}

/** Socle de pierre commun, plus orné à chaque niveau. Un hybride porte en plus le liseré de sa seconde famille. */
function plinth(ctx: Ctx, cx: number, cy: number, tier: number, hybrid?: string): void {
  const s = 1.78;
  ctx.fillStyle = PAL.shadow;
  roundRect(ctx, cx - s / 2 + 0.08, cy - s / 2 + 0.12, s, s, 0.22);
  ctx.fill();
  ctx.fillStyle = PAL.stoneDark;
  roundRect(ctx, cx - s / 2, cy - s / 2, s, s, 0.22);
  ctx.fill();
  ctx.fillStyle = PAL.stone;
  roundRect(ctx, cx - s / 2 + 0.1, cy - s / 2 + 0.08, s - 0.2, s - 0.24, 0.16);
  ctx.fill();
  // Joints de pierre.
  ctx.strokeStyle = 'rgba(40,34,26,0.35)';
  ctx.lineWidth = 0.04;
  ctx.beginPath();
  ctx.moveTo(cx - s / 2 + 0.1, cy);
  ctx.lineTo(cx + s / 2 - 0.1, cy);
  ctx.moveTo(cx, cy - s / 2 + 0.1);
  ctx.lineTo(cx, cy - 0.02);
  ctx.moveTo(cx - 0.45, cy + 0.02);
  ctx.lineTo(cx - 0.45, cy + s / 2 - 0.18);
  ctx.moveTo(cx + 0.45, cy + 0.02);
  ctx.lineTo(cx + 0.45, cy + s / 2 - 0.18);
  ctx.stroke();
  if (tier >= 2 || hybrid) {
    ctx.strokeStyle = tier >= 3 || (hybrid && tier >= 2) ? PAL.gold : PAL.bronze;
    ctx.lineWidth = 0.07;
    roundRect(ctx, cx - s / 2 + 0.06, cy - s / 2 + 0.05, s - 0.12, s - 0.14, 0.18);
    ctx.stroke();
  }
  if (hybrid) {
    ctx.strokeStyle = hybrid;
    ctx.lineWidth = 0.08;
    roundRect(ctx, cx - s / 2 + 0.16, cy - s / 2 + 0.15, s - 0.32, s - 0.34, 0.12);
    ctx.stroke();
  }
}

function pips(ctx: Ctx, cx: number, cy: number, tier: number): void {
  for (let i = 0; i < tier; i++) {
    ctx.fillStyle = tier >= 3 ? PAL.gold : PAL.parchment;
    circle(ctx, cx - 0.125 * (tier - 1) + i * 0.25, cy + 0.72, 0.075);
    ctx.fill();
  }
}

// ─── Briques de dessin ─────────────────────────────────────────────────────

/** Ce qu'un dessin de tour reçoit : centre du corps, visée, horloge. */
interface Pose {
  ctx: Ctx;
  cx: number;
  top: number;
  aim: number;
  time: number;
}

const ARCHER = FAMILY_COLOR.archer;
const CANNON = FAMILY_COLOR.cannon;
const FROST = FAMILY_COLOR.frost;
const STORM = FAMILY_COLOR.storm;
const VENOM = FAMILY_COLOR.venom;
const IRON = '#1d1d20';
const COPPER = '#c07a3a';
const RUST = '#b5562a';
const ACID = '#c9d94a';

function disc(ctx: Ctx, x: number, y: number, r: number, color: string): void {
  circle(ctx, x, y, r);
  ctx.fillStyle = color;
  ctx.fill();
}

/** Polygone fermé : coordonnées x, y à la suite. */
function poly(ctx: Ctx, color: string, pts: number[]): void {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function line(ctx: Ctx, color: string, width: number, pts: number[]): void {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.lineCap = 'butt';
}

function pulse(p: Pose, speed: number): number {
  return 0.5 + 0.5 * Math.sin(p.time * speed + p.cx);
}

/** Dessine dans le repère de la visée : x vers la cible. */
function aimed(p: Pose, draw: (ctx: Ctx) => void): void {
  p.ctx.save();
  p.ctx.translate(p.cx, p.top);
  p.ctx.rotate(p.aim);
  draw(p.ctx);
  p.ctx.restore();
}

function aura(p: Pose, rgb: string, r: number): void {
  disc(p.ctx, p.cx, p.top, r, `rgba(${rgb}, ${0.16 + 0.12 * pulse(p, 2.4)})`);
}

/** Bulles qui montent et s'estompent. */
function bubbles(p: Pose, rgb: string, n: number, spread: number, rise: number, y = p.top): void {
  for (let i = 0; i < n; i++) {
    const ph = (p.time * 0.9 + i / n) % 1;
    disc(p.ctx, p.cx + Math.sin(i * 2.1 + 0.4) * spread, y - ph * rise, 0.04 + 0.06 * ph, `rgba(${rgb}, ${1 - ph})`);
  }
}

/** Gouttes qui tombent d'un point. */
function drips(ctx: Ctx, x: number, y: number, color: string, time: number): void {
  for (let i = 0; i < 2; i++) {
    const ph = (time * 0.7 + i * 0.5) % 1;
    ctx.globalAlpha = 1 - ph;
    disc(ctx, x, y + ph * 0.3, 0.05, color);
    ctx.globalAlpha = 1;
  }
}

/** Éclair en zigzag, redessiné quelques fois par seconde. */
function bolt(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, color: string, time: number): void {
  const seed = Math.floor(time * 8);
  const pts = [x1, y1];
  const nx = -(y2 - y1);
  const ny = x2 - x1;
  for (let i = 1; i < 4; i++) {
    const j = Math.sin(seed * 12.9898 + i * 78.233) * 0.25;
    pts.push(x1 + ((x2 - x1) * i) / 4 + nx * j, y1 + ((y2 - y1) * i) / 4 + ny * j);
  }
  pts.push(x2, y2);
  line(ctx, color, 0.05, pts);
}

// Archers : plateforme de bois, arc qui suit la cible, toit.

function deck(p: Pose, r = 0.52, rim = ARCHER.dark): void {
  disc(p.ctx, p.cx, p.top, r + 0.1, rim);
  disc(p.ctx, p.cx, p.top, r, ARCHER.main);
  line(p.ctx, 'rgba(60,36,18,0.45)', 0.03, [p.cx - r * 0.8, p.top - 0.15, p.cx + r * 0.8, p.top - 0.15]);
  line(p.ctx, 'rgba(60,36,18,0.45)', 0.03, [p.cx - r * 0.8, p.top + 0.15, p.cx + r * 0.8, p.top + 0.15]);
}

function squareDeck(p: Pose): void {
  p.ctx.fillStyle = ARCHER.dark;
  roundRect(p.ctx, p.cx - 0.58, p.top - 0.58, 1.16, 1.16, 0.1);
  p.ctx.fill();
  p.ctx.fillStyle = ARCHER.main;
  roundRect(p.ctx, p.cx - 0.5, p.top - 0.5, 1, 1, 0.07);
  p.ctx.fill();
  for (const [dx, dy] of [[-0.46, -0.46], [0.46, -0.46], [-0.46, 0.46], [0.46, 0.46]]) disc(p.ctx, p.cx + dx, p.top + dy, 0.08, ARCHER.dark);
}

/** Arcs en éventail autour de la visée, avec leur flèche encochée. */
function bows(p: Pose, n: number, spread: number, tip = PAL.parchment, r = 0.26): void {
  aimed(p, (ctx) => {
    for (let i = 0; i < n; i++) {
      const a = n === 1 ? 0 : -spread / 2 + (spread * i) / (n - 1);
      const bx = Math.cos(a) * 0.34;
      const by = Math.sin(a) * 0.34;
      ctx.beginPath();
      ctx.arc(bx, by, r, a - 1.2, a + 1.2);
      ctx.strokeStyle = PAL.parchment;
      ctx.lineWidth = 0.06;
      ctx.stroke();
      line(ctx, '#5a3a1e', 0.035, [bx - Math.cos(a) * 0.05, by - Math.sin(a) * 0.05, bx + Math.cos(a) * 0.36, by + Math.sin(a) * 0.36]);
      disc(ctx, bx + Math.cos(a) * 0.38, by + Math.sin(a) * 0.38, 0.05, tip);
    }
  });
}

function roof(p: Pose, color: string, h: number, w: number, tip?: string): void {
  poly(p.ctx, color, [p.cx, p.top - h, p.cx + w, p.top + 0.05, p.cx - w, p.top + 0.05]);
  poly(p.ctx, 'rgba(255,240,210,0.15)', [p.cx, p.top - h, p.cx, p.top + 0.05, p.cx - w, p.top + 0.05]);
  if (tip) disc(p.ctx, p.cx, p.top - h, 0.07, tip);
}

// Canons : tourelle de fer, fût orienté vers la cible.

function turret(p: Pose, main = CANNON.main, r = 0.46): void {
  disc(p.ctx, p.cx, p.top, r + 0.12, CANNON.dark);
  disc(p.ctx, p.cx, p.top, r, main);
}

function barrel(p: Pose, len: number, wid: number, color = IRON, muzzle = '#3a3a40', y = 0): void {
  aimed(p, (ctx) => {
    ctx.fillStyle = color;
    roundRect(ctx, 0, y - wid / 2, len, wid, 0.07);
    ctx.fill();
    ctx.fillStyle = muzzle;
    roundRect(ctx, len - 0.14, y - wid / 2 - 0.04, 0.14, wid + 0.08, 0.04);
    ctx.fill();
  });
}

/** Mortier vu de dessus : gueule large tournée vers le ciel, légèrement penchée vers la cible. */
function bowl(p: Pose, r: number, rim: string, inside: string): void {
  const x = p.cx + Math.cos(p.aim) * 0.12;
  const y = p.top + Math.sin(p.aim) * 0.12;
  disc(p.ctx, x, y, r + 0.06, IRON);
  disc(p.ctx, x, y, r, rim);
  disc(p.ctx, x, y, r * 0.62, inside);
}

function hub(p: Pose, color: string): void {
  disc(p.ctx, p.cx, p.top, 0.1, color);
}

// Givre : cristaux.

function crystal(ctx: Ctx, x: number, y: number, h: number, w: number, dark: string, main: string, glow: string, tilt = 0): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  poly(ctx, dark, [0, -h, w, 0, 0, h * 0.7, -w, 0]);
  poly(ctx, main, [0, -h + 0.08, w * 0.68, 0, 0, h * 0.7 - 0.1]);
  poly(ctx, glow, [-0.02, -h + 0.14, -w * 0.52, 0, -0.02, 0.1]);
  ctx.restore();
}

// Foudre : orbe, anneaux.

function orb(p: Pose, core: string, halo: string, ring: string, rings: number, r = 0.42): void {
  const k = pulse(p, 3.1);
  p.ctx.strokeStyle = STORM.dark;
  p.ctx.lineWidth = 0.1;
  circle(p.ctx, p.cx, p.top, r + 0.08);
  p.ctx.stroke();
  disc(p.ctx, p.cx, p.top, r, halo.replace('A', String(0.35 + 0.3 * k)));
  disc(p.ctx, p.cx, p.top, r * 0.48 + 0.05 * k, core);
  p.ctx.strokeStyle = ring;
  p.ctx.lineWidth = 0.05;
  for (let i = 0; i < rings; i++) {
    p.ctx.beginPath();
    p.ctx.ellipse(p.cx, p.top, r + 0.2, 0.2, p.time * (1 + i * 0.4) + i, 0, Math.PI * 2);
    p.ctx.stroke();
  }
}

// Venin : chaudrons et nids.

function cauldron(p: Pose, liquid: string, r = 0.42, rim = '#2d2a24'): void {
  disc(p.ctx, p.cx, p.top + 0.05, r + 0.14, rim);
  disc(p.ctx, p.cx, p.top, r, liquid);
}

function nest(p: Pose, holes: number, r: number): void {
  const ctx = p.ctx;
  ctx.beginPath();
  for (let i = 0; i <= 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const rr = r * (1 + 0.08 * Math.sin(i * 2.7));
    if (i === 0) ctx.moveTo(p.cx + Math.cos(a) * rr, p.top + Math.sin(a) * rr);
    else ctx.lineTo(p.cx + Math.cos(a) * rr, p.top + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = '#5a4630';
  ctx.fill();
  disc(ctx, p.cx - 0.08, p.top - 0.08, r * 0.7, '#6e5638');
  for (let i = 0; i < holes; i++) {
    const a = (i / holes) * Math.PI * 2 + 0.5;
    const hx = p.cx + Math.cos(a) * r * 0.5;
    const hy = p.top + Math.sin(a) * r * 0.5;
    disc(ctx, hx, hy, 0.09, '#1e1a12');
    disc(ctx, hx, hy, 0.05, VENOM.main);
    const ph = (p.time * 0.8 + i / holes) % 1;
    disc(ctx, hx, hy - ph * 0.4, 0.06 + 0.1 * ph, `rgba(152, 201, 74, ${0.6 * (1 - ph)})`);
  }
}

// ─── Une silhouette par tour ───────────────────────────────────────────────

export const TOWER_ART: Record<string, (p: Pose) => void> = {
  wall: (p) => {
    const cx = p.cx;
    const cy = p.top + 0.12;
    const ctx = p.ctx;
    ctx.fillStyle = PAL.shadow;
    roundRect(ctx, cx - 0.85, cy - 0.78, 1.78, 1.72, 0.3);
    ctx.fill();
    const blocks: [number, number, number, number][] = [
      [-0.85, -0.85, 0.95, 0.8], [0.12, -0.85, 0.75, 0.9], [-0.85, 0.0, 0.7, 0.85], [-0.12, 0.1, 1.0, 0.75],
    ];
    for (const [x, y, w, h] of blocks) {
      ctx.fillStyle = PAL.stoneDark;
      roundRect(ctx, cx + x, cy + y, w, h, 0.14);
      ctx.fill();
      ctx.fillStyle = PAL.stone;
      roundRect(ctx, cx + x + 0.05, cy + y + 0.04, w - 0.1, h - 0.14, 0.1);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,245,220,0.12)';
      roundRect(ctx, cx + x + 0.08, cy + y + 0.06, w - 0.3, 0.12, 0.05);
      ctx.fill();
    }
  },

  // Archers
  archer: (p) => {
    deck(p);
    bows(p, 1, 0);
    roof(p, '#6e3b2a', 0.5, 0.36);
  },
  sniper: (p) => {
    squareDeck(p);
    aimed(p, (ctx) => {
      line(ctx, '#3a2614', 0.09, [0, 0, 0.85, 0]);
      line(ctx, PAL.parchment, 0.06, [0.42, -0.3, 0.5, 0, 0.42, 0.3]);
    });
    roof(p, '#3f6b4a', 0.6, 0.3);
  },
  hawkeye: (p) => {
    squareDeck(p);
    aimed(p, (ctx) => {
      line(ctx, '#3a2614', 0.1, [0, 0, 0.98, 0]);
      line(ctx, PAL.gold, 0.06, [0.48, -0.34, 0.58, 0, 0.48, 0.34]);
    });
    roof(p, '#2f5a3b', 0.7, 0.34, PAL.gold);
    p.ctx.beginPath();
    p.ctx.ellipse(p.cx, p.top - 0.18, 0.16, 0.09, 0, 0, Math.PI * 2);
    p.ctx.fillStyle = PAL.gold;
    p.ctx.fill();
    disc(p.ctx, p.cx, p.top - 0.18, 0.05, PAL.ink);
  },
  volley: (p) => {
    deck(p, 0.55);
    bows(p, 3, 1.1);
    roof(p, '#6e3b2a', 0.36, 0.42);
  },
  arrowstorm: (p) => {
    deck(p, 0.58);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.2;
      const x = p.cx + Math.cos(a) * 0.62;
      const y = p.top + Math.sin(a) * 0.62;
      line(p.ctx, PAL.parchment, 0.04, [x - Math.cos(a) * 0.14, y - Math.sin(a) * 0.14, x, y]);
    }
    bows(p, 5, 1.8, PAL.gold, 0.22);
    roof(p, '#7a2f22', 0.4, 0.4, PAL.gold);
  },
  stinger: (p) => {
    deck(p);
    aimed(p, (ctx) => {
      poly(ctx, VENOM.dark, [0.05, -0.12, 0.9, 0, 0.05, 0.12]);
      poly(ctx, VENOM.main, [0.1, -0.06, 0.82, 0, 0.1, 0.06]);
    });
    drips(p.ctx, p.cx + Math.cos(p.aim) * 0.8, p.top + Math.sin(p.aim) * 0.8, VENOM.glow, p.time);
    roof(p, '#4a5a2a', 0.46, 0.34, VENOM.main);
  },
  rustspike: (p) => {
    deck(p, 0.56, '#5a2c16');
    aimed(p, (ctx) => {
      for (const a of [-0.45, 0, 0.45]) {
        const l = a === 0 ? 0.98 : 0.75;
        ctx.save();
        ctx.rotate(a);
        poly(ctx, '#6e2c14', [0.05, -0.12, l, 0, 0.05, 0.12]);
        poly(ctx, RUST, [0.1, -0.06, l - 0.08, 0, 0.1, 0.06]);
        ctx.restore();
      }
    });
    drips(p.ctx, p.cx + Math.cos(p.aim) * 0.9, p.top + Math.sin(p.aim) * 0.9, ACID, p.time);
    roof(p, '#7a3a1e', 0.5, 0.36, ACID);
  },
  ballista: (p) => {
    deck(p, 0.5, CANNON.dark);
    aimed(p, (ctx) => {
      line(ctx, '#5a3a1e', 0.14, [0.2, -0.55, 0.3, 0, 0.2, 0.55]);
      disc(ctx, 0.2, -0.55, 0.07, CANNON.main);
      disc(ctx, 0.2, 0.55, 0.07, CANNON.main);
      line(ctx, PAL.parchment, 0.03, [0.2, -0.55, -0.1, 0, 0.2, 0.55]);
      line(ctx, '#3a2614', 0.1, [-0.2, 0, 0.8, 0]);
      poly(ctx, IRON, [0.78, -0.1, 0.98, 0, 0.78, 0.1]);
    });
    hub(p, CANNON.glow);
  },
  siegebow: (p) => {
    deck(p, 0.56, CANNON.dark);
    aimed(p, (ctx) => {
      line(ctx, '#4a2e16', 0.16, [0.25, -0.66, 0.36, 0, 0.25, 0.66]);
      for (const y of [-0.66, 0.66]) disc(ctx, 0.25, y, 0.09, CANNON.main);
      line(ctx, PAL.parchment, 0.03, [0.25, -0.66, -0.12, 0, 0.25, 0.66]);
      for (const y of [-0.1, 0.1]) {
        line(ctx, '#3a2614', 0.08, [-0.25, y, 0.85, y]);
        poly(ctx, IRON, [0.83, y - 0.08, 1.02, y, 0.83, y + 0.08]);
      }
      ctx.fillStyle = CANNON.main;
      roundRect(ctx, -0.42, -0.3, 0.2, 0.6, 0.05);
      ctx.fill();
      for (const y of [-0.18, 0, 0.18]) disc(ctx, -0.32, y, 0.035, PAL.gold);
    });
  },
  frostarrow: (p) => {
    deck(p);
    bows(p, 3, 1, FROST.glow);
    crystal(p.ctx, p.cx, p.top, 0.52, 0.3, FROST.dark, FROST.main, FROST.glow);
  },
  rimevolley: (p) => {
    aura(p, '143, 211, 242', 0.82);
    deck(p, 0.56);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const x = p.cx + Math.cos(a) * 0.6;
      const y = p.top + Math.sin(a) * 0.6;
      poly(p.ctx, FROST.main, [x - 0.06, y, x + 0.06, y, x, y + 0.2]);
    }
    bows(p, 4, 1.5, FROST.glow, 0.24);
    crystal(p.ctx, p.cx, p.top, 0.62, 0.32, FROST.dark, FROST.main, FROST.glow);
  },
  thunderarrow: (p) => {
    deck(p);
    bows(p, 1, 0, STORM.glow);
    aimed(p, (ctx) => bolt(ctx, 0.4, 0, 0.95, 0, STORM.main, p.time));
    roof(p, STORM.dark, 0.48, 0.34);
    line(p.ctx, PAL.bronze, 0.04, [p.cx, p.top - 0.48, p.cx, p.top - 0.72]);
    disc(p.ctx, p.cx, p.top - 0.74, 0.06 + 0.04 * pulse(p, 6), STORM.glow);
  },
  skypiercer: (p) => {
    deck(p, 0.56);
    bows(p, 1, 0, STORM.glow, 0.3);
    aimed(p, (ctx) => bolt(ctx, 0.45, 0, 1.05, 0, STORM.glow, p.time));
    p.ctx.strokeStyle = STORM.main;
    p.ctx.lineWidth = 0.04;
    p.ctx.beginPath();
    p.ctx.ellipse(p.cx, p.top - 0.2, 0.5, 0.16, 0, 0, Math.PI * 2);
    p.ctx.stroke();
    roof(p, '#3a2870', 0.85, 0.26);
    disc(p.ctx, p.cx, p.top - 0.88, 0.07 + 0.05 * pulse(p, 6), STORM.glow);
  },

  // Canons
  cannon: (p) => {
    turret(p);
    barrel(p, 0.72, 0.24);
    hub(p, CANNON.glow);
  },
  mortar: (p) => {
    turret(p, CANNON.main, 0.5);
    bowl(p, 0.34, '#3a3a40', IRON);
    disc(p.ctx, p.cx + Math.cos(p.aim) * 0.12, p.top + Math.sin(p.aim) * 0.12, 0.08, 'rgba(240,154,74,0.5)');
  },
  bombard: (p) => {
    turret(p, CANNON.main, 0.52);
    for (const [dx, dy] of [[-0.5, 0.36], [-0.34, 0.46], [-0.42, 0.24]]) {
      disc(p.ctx, p.cx + dx, p.top + dy, 0.1, IRON);
      disc(p.ctx, p.cx + dx - 0.03, p.top + dy - 0.03, 0.03, '#5a5a60');
    }
    bowl(p, 0.42, PAL.bronze, IRON);
    disc(p.ctx, p.cx + Math.cos(p.aim) * 0.12, p.top + Math.sin(p.aim) * 0.12, 0.12 + 0.03 * pulse(p, 4), 'rgba(240,154,74,0.7)');
  },
  flak: (p) => {
    turret(p, '#6a5a44');
    barrel(p, 0.8, 0.16, IRON, '#3a3a40', -0.18);
    barrel(p, 0.8, 0.16, IRON, '#3a3a40', 0.18);
    hub(p, CANNON.glow);
  },
  skybattery: (p) => {
    turret(p, '#6a5a44', 0.5);
    for (const y of [-0.27, -0.09, 0.09, 0.27]) barrel(p, 0.92, 0.12, IRON, '#3a3a40', y);
    const a = p.time * 1.5;
    p.ctx.save();
    p.ctx.translate(p.cx - Math.cos(p.aim) * 0.2, p.top - Math.sin(p.aim) * 0.2);
    p.ctx.rotate(a);
    p.ctx.beginPath();
    p.ctx.ellipse(0, 0, 0.26, 0.1, 0, 0, Math.PI);
    p.ctx.fillStyle = PAL.stoneLight;
    p.ctx.fill();
    p.ctx.restore();
    hub(p, PAL.gold);
  },
  cryoshell: (p) => {
    turret(p, '#4f6470');
    barrel(p, 0.74, 0.26, '#2c4656', FROST.main);
    crystal(p.ctx, p.cx - Math.cos(p.aim) * 0.3, p.top - Math.sin(p.aim) * 0.3, 0.3, 0.14, FROST.dark, FROST.main, FROST.glow);
    hub(p, FROST.glow);
  },
  permafrost: (p) => {
    aura(p, '143, 211, 242', 0.86);
    turret(p, '#4f6470', 0.5);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      crystal(p.ctx, p.cx + Math.cos(a) * 0.5, p.top + Math.sin(a) * 0.5, 0.22, 0.09, FROST.dark, FROST.main, FROST.glow, a + Math.PI / 2);
    }
    barrel(p, 0.86, 0.3, '#2c4656', FROST.glow);
    hub(p, FROST.glow);
  },
  teslacannon: (p) => {
    turret(p);
    barrel(p, 0.74, 0.22, IRON, STORM.main);
    aimed(p, (ctx) => {
      for (const x of [0.2, 0.36, 0.52]) {
        ctx.fillStyle = COPPER;
        roundRect(ctx, x, -0.16, 0.07, 0.32, 0.03);
        ctx.fill();
      }
      disc(ctx, 0.82, 0, 0.07 + 0.04 * pulse(p, 7), STORM.glow);
    });
    hub(p, STORM.main);
  },
  thundergun: (p) => {
    turret(p, CANNON.main, 0.5);
    barrel(p, 0.9, 0.26, IRON, STORM.main);
    aimed(p, (ctx) => {
      for (const x of [0.18, 0.32, 0.46, 0.6]) {
        ctx.fillStyle = COPPER;
        roundRect(ctx, x, -0.19, 0.07, 0.38, 0.03);
        ctx.fill();
      }
      bolt(ctx, 0.95, 0, 1.15, -0.2, STORM.glow, p.time);
    });
    disc(p.ctx, p.cx, p.top, 0.2, STORM.dark);
    disc(p.ctx, p.cx, p.top, 0.13 + 0.03 * pulse(p, 5), STORM.glow);
  },
  plagueshell: (p) => {
    turret(p);
    aimed(p, (ctx) => {
      ctx.fillStyle = VENOM.dark;
      roundRect(ctx, -0.55, -0.2, 0.3, 0.4, 0.08);
      ctx.fill();
      ctx.fillStyle = VENOM.main;
      roundRect(ctx, -0.52, -0.16, 0.24, 0.32, 0.06);
      ctx.fill();
    });
    barrel(p, 0.72, 0.26, IRON, VENOM.dark);
    aimed(p, (ctx) => disc(ctx, 0.74, 0, 0.07, VENOM.glow));
    hub(p, VENOM.main);
  },
  miasma: (p) => {
    turret(p, CANNON.main, 0.52);
    for (const s of [-1, 1]) {
      aimed(p, (ctx) => {
        ctx.fillStyle = VENOM.dark;
        roundRect(ctx, -0.35, s * 0.42 - 0.13, 0.5, 0.26, 0.1);
        ctx.fill();
        ctx.fillStyle = VENOM.main;
        roundRect(ctx, -0.32, s * 0.42 - 0.09, 0.44, 0.18, 0.07);
        ctx.fill();
      });
    }
    bowl(p, 0.36, PAL.bronze, '#2a3a14');
    bubbles(p, '214, 245, 154', 4, 0.15, 0.55, p.top + Math.sin(p.aim) * 0.12);
  },

  // Givre
  frost: (p) => {
    aura(p, '143, 211, 242', 0.78);
    crystal(p.ctx, p.cx, p.top, 0.7, 0.38, FROST.dark, FROST.main, FROST.glow);
  },
  glacier: (p) => {
    aura(p, '143, 211, 242', 0.88);
    crystal(p.ctx, p.cx - 0.3, p.top + 0.12, 0.5, 0.22, FROST.dark, FROST.main, FROST.glow, -0.35);
    crystal(p.ctx, p.cx + 0.3, p.top + 0.12, 0.5, 0.22, FROST.dark, FROST.main, FROST.glow, 0.35);
    crystal(p.ctx, p.cx, p.top, 0.72, 0.3, FROST.dark, FROST.main, FROST.glow);
  },
  winterheart: (p) => {
    aura(p, '216, 243, 255', 0.9);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      crystal(p.ctx, p.cx + Math.cos(a) * 0.42, p.top + Math.sin(a) * 0.42, 0.34, 0.14, FROST.dark, FROST.main, FROST.glow, a + Math.PI / 2);
    }
    const r = 0.14 + 0.04 * pulse(p, 2.4);
    disc(p.ctx, p.cx, p.top, r + 0.06, FROST.dark);
    disc(p.ctx, p.cx, p.top, r, '#ffffff');
    for (let i = 0; i < 3; i++) {
      const a = p.time * 0.6 + (i * Math.PI) / 3;
      line(p.ctx, PAL.gold, 0.03, [p.cx - Math.cos(a) * 0.3, p.top - Math.sin(a) * 0.3, p.cx + Math.cos(a) * 0.3, p.top + Math.sin(a) * 0.3]);
    }
  },
  iceshard: (p) => {
    aura(p, '143, 211, 242', 0.72);
    crystal(p.ctx, p.cx, p.top, 0.88, 0.22, FROST.dark, FROST.main, FROST.glow);
    for (let i = 0; i < 2; i++) {
      const a = p.time * 1.4 + i * Math.PI;
      crystal(p.ctx, p.cx + Math.cos(a) * 0.5, p.top + Math.sin(a) * 0.22, 0.2, 0.08, FROST.dark, FROST.main, FROST.glow);
    }
  },
  frostlance: (p) => {
    aura(p, '143, 211, 242', 0.8);
    disc(p.ctx, p.cx, p.top, 0.3, FROST.dark);
    p.ctx.save();
    p.ctx.translate(p.cx, p.top);
    p.ctx.rotate(p.aim + Math.PI / 2);
    poly(p.ctx, FROST.dark, [0, -1.02, 0.17, 0, 0, 0.5, -0.17, 0]);
    poly(p.ctx, FROST.main, [0, -0.94, 0.11, 0, 0, 0.42]);
    poly(p.ctx, '#ffffff', [-0.02, -0.88, -0.09, 0, -0.02, 0.1]);
    p.ctx.restore();
    disc(p.ctx, p.cx, p.top, 0.08, PAL.gold);
  },
  hail: (p) => {
    crystal(p.ctx, p.cx, p.top + 0.12, 0.42, 0.24, FROST.dark, FROST.main, FROST.glow);
    for (const [dx, dy, r] of [[-0.25, -0.32, 0.24], [0.1, -0.4, 0.28], [0.34, -0.28, 0.2]]) disc(p.ctx, p.cx + dx, p.top + dy, r, '#5d5a86');
    for (let i = 0; i < 4; i++) {
      const ph = (p.time * 1.2 + i / 4) % 1;
      disc(p.ctx, p.cx - 0.3 + i * 0.2, p.top - 0.2 + ph * 0.6, 0.04, `rgba(216, 243, 255, ${1 - ph})`);
    }
    bolt(p.ctx, p.cx + 0.05, p.top - 0.32, p.cx + 0.2, p.top + 0.05, STORM.glow, p.time);
  },
  hailstorm: (p) => {
    aura(p, '169, 140, 240', 0.86);
    crystal(p.ctx, p.cx - 0.24, p.top + 0.2, 0.36, 0.16, FROST.dark, FROST.main, FROST.glow, -0.2);
    crystal(p.ctx, p.cx + 0.24, p.top + 0.2, 0.36, 0.16, FROST.dark, FROST.main, FROST.glow, 0.2);
    for (const [dx, dy, r] of [[-0.38, -0.3, 0.26], [-0.05, -0.44, 0.32], [0.32, -0.32, 0.27], [0.05, -0.2, 0.24]]) disc(p.ctx, p.cx + dx, p.top + dy, r, '#4a4478');
    for (let i = 0; i < 6; i++) {
      const ph = (p.time * 1.3 + i / 6) % 1;
      disc(p.ctx, p.cx - 0.45 + i * 0.18, p.top - 0.15 + ph * 0.7, 0.045, `rgba(216, 243, 255, ${1 - ph})`);
    }
    bolt(p.ctx, p.cx - 0.15, p.top - 0.3, p.cx - 0.35, p.top + 0.15, STORM.glow, p.time);
    bolt(p.ctx, p.cx + 0.2, p.top - 0.3, p.cx + 0.35, p.top + 0.15, STORM.glow, p.time + 0.5);
  },
  blightfrost: (p) => {
    aura(p, '152, 201, 74', 0.78);
    crystal(p.ctx, p.cx, p.top, 0.7, 0.36, '#2f5a4a', '#8fd8b8', '#d6f5c8');
    bubbles(p, '214, 245, 154', 3, 0.1, 0.5, p.top + 0.1);
    drips(p.ctx, p.cx, p.top + 0.5, VENOM.main, p.time);
  },
  deathfrost: (p) => {
    aura(p, '120, 180, 90', 0.9);
    crystal(p.ctx, p.cx - 0.3, p.top + 0.12, 0.48, 0.2, '#1f3a2e', '#5fae8a', '#b8e8c8', -0.35);
    crystal(p.ctx, p.cx + 0.3, p.top + 0.12, 0.48, 0.2, '#1f3a2e', '#5fae8a', '#b8e8c8', 0.35);
    crystal(p.ctx, p.cx, p.top, 0.74, 0.3, '#1f3a2e', '#5fae8a', '#b8e8c8');
    disc(p.ctx, p.cx, p.top - 0.05, 0.1 + 0.03 * pulse(p, 3), VENOM.glow);
    bubbles(p, '214, 245, 154', 4, 0.3, 0.6, p.top + 0.1);
  },

  // Foudre
  storm: (p) => orb(p, STORM.glow, 'rgba(169, 140, 240, A)', STORM.main, 1),
  tempest: (p) => {
    orb(p, STORM.glow, 'rgba(169, 140, 240, A)', STORM.main, 2, 0.46);
    for (let i = 0; i < 4; i++) {
      const a = p.time * 2 + (i * Math.PI) / 2;
      disc(p.ctx, p.cx + Math.cos(a) * 0.62, p.top + Math.sin(a) * 0.62, 0.05, STORM.glow);
    }
  },
  maelstrom: (p) => {
    orb(p, '#ffffff', 'rgba(140, 110, 230, A)', PAL.gold, 3, 0.5);
    for (let i = 0; i < 3; i++) {
      const a0 = -p.time * 2.5 + (i * Math.PI * 2) / 3;
      p.ctx.beginPath();
      p.ctx.arc(p.cx, p.top, 0.3, a0, a0 + 1.6);
      p.ctx.strokeStyle = STORM.glow;
      p.ctx.lineWidth = 0.05;
      p.ctx.stroke();
    }
  },
  obelisk: (p) => {
    poly(p.ctx, STORM.dark, [p.cx - 0.3, p.top + 0.55, p.cx - 0.16, p.top - 0.7, p.cx, p.top - 0.85, p.cx + 0.16, p.top - 0.7, p.cx + 0.3, p.top + 0.55]);
    poly(p.ctx, 'rgba(255,255,255,0.12)', [p.cx - 0.3, p.top + 0.55, p.cx - 0.16, p.top - 0.7, p.cx, p.top - 0.85, p.cx, p.top + 0.55]);
    disc(p.ctx, p.cx, p.top - 0.35, 0.13 + 0.03 * pulse(p, 3.1), STORM.glow);
  },
  voidprism: (p) => {
    const k = pulse(p, 3.1);
    poly(p.ctx, '#2a1f3d', [p.cx, p.top - 0.9, p.cx + 0.42, p.top + 0.5, p.cx - 0.42, p.top + 0.5]);
    poly(p.ctx, '#43305f', [p.cx, p.top - 0.9, p.cx + 0.42, p.top + 0.5, p.cx + 0.05, p.top + 0.3]);
    disc(p.ctx, p.cx, p.top + 0.05, 0.15 + 0.03 * k, `rgba(255, 90, 160, ${0.6 + 0.4 * k})`);
    for (let i = 0; i < 3; i++) {
      const a = p.time * 1.2 + (i * Math.PI * 2) / 3;
      const x = p.cx + Math.cos(a) * 0.62;
      const y = p.top + Math.sin(a) * 0.3;
      poly(p.ctx, '#ff5aa0', [x, y - 0.1, x + 0.06, y, x, y + 0.1, x - 0.06, y]);
    }
  },
  acidarc: (p) => {
    orb(p, ACID, 'rgba(120, 170, 60, A)', STORM.main, 1);
    drips(p.ctx, p.cx - 0.15, p.top + 0.45, VENOM.main, p.time);
    drips(p.ctx, p.cx + 0.18, p.top + 0.45, VENOM.main, p.time + 0.4);
    bolt(p.ctx, p.cx - 0.3, p.top - 0.1, p.cx + 0.3, p.top + 0.05, VENOM.glow, p.time);
  },
  toxicstorm: (p) => {
    aura(p, '152, 201, 74', 0.86);
    orb(p, ACID, 'rgba(110, 160, 50, A)', VENOM.main, 2, 0.48);
    bubbles(p, '214, 245, 154', 4, 0.3, 0.65);
    bolt(p.ctx, p.cx - 0.35, p.top - 0.15, p.cx + 0.35, p.top + 0.1, STORM.glow, p.time);
  },

  // Venin
  venom: (p) => {
    cauldron(p, VENOM.main);
    bubbles(p, '214, 245, 154', 3, 0.2, 0.5);
  },
  acid: (p) => {
    cauldron(p, ACID, 0.46);
    for (const a of [0.6, 2.2]) disc(p.ctx, p.cx + Math.cos(a) * 0.52, p.top + 0.05 + Math.sin(a) * 0.52, 0.06, ACID);
    bubbles(p, '240, 250, 150', 3, 0.22, 0.5);
  },
  corrosion: (p) => {
    cauldron(p, ACID, 0.5, '#3a352c');
    p.ctx.strokeStyle = PAL.bronze;
    p.ctx.lineWidth = 0.06;
    circle(p.ctx, p.cx, p.top + 0.05, 0.6);
    p.ctx.stroke();
    for (const x of [-0.3, 0.05, 0.32]) drips(p.ctx, p.cx + x, p.top + 0.58, ACID, p.time + x);
    bubbles(p, '240, 250, 150', 5, 0.28, 0.6);
  },
  plague: (p) => nest(p, 3, 0.56),
  blight: (p) => {
    for (let i = 0; i < 5; i++) {
      const a = p.time * 0.8 + (i * Math.PI * 2) / 5;
      disc(p.ctx, p.cx + Math.cos(a) * 0.72, p.top + Math.sin(a) * 0.5, 0.08, 'rgba(152, 201, 74, 0.55)');
    }
    nest(p, 5, 0.64);
    disc(p.ctx, p.cx, p.top, 0.08, PAL.gold);
  },
};

export function drawTower(ctx: Ctx, def: TowerDef, cx: number, cy: number, aim: number, time: number): void {
  const art = TOWER_ART[def.id];
  if (def.family !== 'wall') plinth(ctx, cx, cy, def.tier, def.elements && FAMILY_COLOR[def.elements[1]].main);
  art({ ctx, cx, top: cy - 0.12, aim, time });
  if (def.family !== 'wall') pips(ctx, cx, cy, def.tier);
}

const CELL_COLOR: Record<CellKind, string> = {
  build: PAL.grassA,
  rock: PAL.rock,
  spawn: PAL.good,
  exit: PAL.danger,
  road: PAL.dirt,
  checkpoint: PAL.gold,
};

/** Vignette d'une carte : une couleur par nature de case, ratio conservé. */
export function drawMapThumbnail(ctx: Ctx, map: MapDef, size: number): void {
  const grid = new Grid(map);
  const scale = size / Math.max(grid.w, grid.h);
  const ox = (size - grid.w * scale) / 2;
  const oy = (size - grid.h * scale) / 2;
  for (let y = 0; y < grid.h; y++) {
    for (let x = 0; x < grid.w; x++) {
      ctx.fillStyle = CELL_COLOR[grid.kind[grid.idx(x, y)]];
      ctx.fillRect(ox + x * scale, oy + y * scale, scale + 0.5, scale + 0.5);
    }
  }
}

export interface CreepLike {
  def: CreepDef;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  slowPct: number;
  poisons: unknown[];
  shred: number;
  hitFlash: number;
  bob: number;
  breaker?: Creep['breaker'];
}

export function drawCreep(ctx: Ctx, c: CreepLike, dirX: number, dirY: number, time: number, showBar = true): void {
  const st = CREEP_STYLE[c.def.id] ?? CREEP_STYLE.rat;
  const r = c.def.radius * 1.3;
  const air = !!c.def.air;
  const lift = air ? 0.45 + Math.sin(time * 4 + c.bob) * 0.06 : Math.abs(Math.sin(time * 9 + c.bob)) * 0.04;
  const x = c.x;
  const y = c.y - lift;

  // Ombre portée au sol.
  ctx.fillStyle = PAL.shadow;
  ctx.beginPath();
  ctx.ellipse(c.x + 0.04, c.y + r * 0.55, r * (air ? 0.8 : 1), r * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();

  // Aura du Sapeur gobelin en fenêtre de destruction.
  if (c.breaker?.phase === BreakerPhase.Armed) {
    ctx.fillStyle = PAL.breakerAura;
    ctx.beginPath();
    ctx.arc(x, y, r + 0.14 + 0.05 * Math.sin(time * 6 + c.bob), 0, Math.PI * 2);
    ctx.fill();
  }

  if (st.shape === 'wing') {
    const flap = Math.sin(time * 12 + c.bob) * 0.35;
    ctx.fillStyle = st.dark;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + s * r * 2.1, y - r * (0.5 + flap));
      ctx.lineTo(x + s * r * 1.4, y + r * 0.4);
      ctx.closePath();
      ctx.fill();
    }
  }

  const flash = c.hitFlash > 0;
  ctx.globalAlpha = st.shape === 'ghost' ? 0.78 : 1;
  ctx.fillStyle = st.dark;
  if (st.shape === 'block') {
    roundRect(ctx, x - r, y - r, r * 2, r * 2, r * 0.35);
  } else if (st.shape === 'ghost') {
    ctx.beginPath();
    ctx.arc(x, y - r * 0.1, r, Math.PI, 0);
    const wave = Math.sin(time * 6 + c.bob) * r * 0.15;
    ctx.lineTo(x + r, y + r * 0.8);
    ctx.lineTo(x + r * 0.5, y + r * 0.55 + wave);
    ctx.lineTo(x, y + r * 0.85);
    ctx.lineTo(x - r * 0.5, y + r * 0.55 - wave);
    ctx.lineTo(x - r, y + r * 0.8);
    ctx.closePath();
  } else {
    circle(ctx, x, y, r);
  }
  ctx.fill();
  ctx.fillStyle = flash ? '#fff4dc' : st.body;
  if (st.shape === 'block') {
    roundRect(ctx, x - r + 0.05, y - r + 0.04, r * 2 - 0.1, r * 2 - 0.12, r * 0.3);
    ctx.fill();
  } else if (st.shape === 'ghost') {
    circle(ctx, x, y - r * 0.12, r * 0.82);
    ctx.fill();
  } else {
    circle(ctx, x, y - 0.02, r * 0.84);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Yeux orientés dans le sens de la marche.
  const len = Math.hypot(dirX, dirY) || 1;
  const fx = dirX / len;
  const fy = dirY / len;
  const ex = x + fx * r * 0.45;
  const ey = y + fy * r * 0.45 - r * 0.1;
  ctx.fillStyle = st.eye;
  for (const s of [-1, 1]) {
    circle(ctx, ex - fy * s * r * 0.32, ey + fx * s * r * 0.32, Math.max(0.035, r * 0.14));
    ctx.fill();
  }

  if (c.def.boss) {
    ctx.strokeStyle = PAL.gold;
    ctx.lineWidth = 0.06;
    ctx.beginPath();
    const cy = y - r - 0.08;
    ctx.moveTo(x - r * 0.5, cy + 0.1);
    ctx.lineTo(x - r * 0.5, cy - 0.12);
    ctx.lineTo(x - r * 0.2, cy);
    ctx.lineTo(x, cy - 0.16);
    ctx.lineTo(x + r * 0.2, cy);
    ctx.lineTo(x + r * 0.5, cy - 0.12);
    ctx.lineTo(x + r * 0.5, cy + 0.1);
    ctx.stroke();
  }

  if (c.slowPct > 0) {
    ctx.strokeStyle = 'rgba(160, 220, 255, 0.85)';
    ctx.lineWidth = 0.05;
    circle(ctx, x, y, r + 0.08);
    ctx.stroke();
  }
  if (c.poisons.length > 0) {
    const ph = (time * 1.4 + c.bob) % 1;
    ctx.fillStyle = `rgba(170, 230, 90, ${0.9 - ph * 0.9})`;
    circle(ctx, x + r * 0.6, y - r - ph * 0.3, 0.06);
    ctx.fill();
  }

  if (showBar && c.hp < c.maxHp) {
    const w = Math.max(0.7, r * 2.2);
    const bx = x - w / 2;
    const by = y - r - (c.def.boss ? 0.42 : 0.24);
    ctx.fillStyle = 'rgba(15, 12, 8, 0.8)';
    ctx.fillRect(bx - 0.03, by - 0.03, w + 0.06, 0.16);
    const f = Math.max(0, c.hp / c.maxHp);
    ctx.fillStyle = f > 0.5 ? PAL.good : f > 0.25 ? PAL.gold : PAL.danger;
    ctx.fillRect(bx, by, w * f, 0.1);
  }
}
