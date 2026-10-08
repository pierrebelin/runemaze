import { Grid } from '../../domain/model/Grid';
import type { Biome, CellKind, Creep, CreepDef, MapDef, TowerDef } from '../../domain/model/types';
import { BIOME_PALETTE, CREEP_STYLE, FAMILY_COLOR, PAL } from './palette';
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

/**
 * Socle de pierre commun. Quatre équerres d'angle gris clair donnent le niveau :
 * elles s'allongent à chaque niveau. Un hybride porte en plus le liseré de sa seconde famille.
 */
function plinth(ctx: Ctx, cx: number, cy: number, tier: number, hybrid?: string): void {
  const s = 1.78;
  ctx.fillStyle = PAL.shadow;
  roundRect(ctx, cx - s / 2 + 0.04, cy - s / 2 + 0.06, s, s, 0.22);
  ctx.fill();
  ctx.fillStyle = PAL.stoneDark;
  roundRect(ctx, cx - s / 2, cy - s / 2, s, s, 0.22);
  ctx.fill();
  ctx.fillStyle = PAL.stone;
  roundRect(ctx, cx - s / 2 + 0.1, cy - s / 2 + 0.1, s - 0.2, s - 0.2, 0.16);
  ctx.fill();
  // Joints de pierre.
  ctx.strokeStyle = 'rgba(30,31,34,0.35)';
  ctx.lineWidth = 0.04;
  ctx.beginPath();
  ctx.moveTo(cx - s / 2 + 0.1, cy);
  ctx.lineTo(cx + s / 2 - 0.1, cy);
  ctx.moveTo(cx, cy - s / 2 + 0.1);
  ctx.lineTo(cx, cy - 0.02);
  ctx.moveTo(cx - 0.45, cy + 0.02);
  ctx.lineTo(cx - 0.45, cy + s / 2 - 0.1);
  ctx.moveTo(cx + 0.45, cy + 0.02);
  ctx.lineTo(cx + 0.45, cy + s / 2 - 0.1);
  ctx.stroke();
  const len = [0, 0.14, 0.3, 0.5][tier];
  const e = s / 2 - 0.08;
  ctx.strokeStyle = PAL.stoneLight;
  ctx.lineWidth = 0.06;
  ctx.lineCap = 'round';
  for (const dx of [-1, 1]) {
    for (const dy of [-1, 1]) {
      const x = cx + dx * e;
      const y = cy + dy * e;
      ctx.beginPath();
      ctx.moveTo(x - dx * len, y);
      ctx.lineTo(x, y);
      ctx.lineTo(x, y - dy * len);
      ctx.stroke();
    }
  }
  ctx.lineCap = 'butt';
  if (hybrid) {
    ctx.strokeStyle = hybrid;
    ctx.lineWidth = 0.08;
    roundRect(ctx, cx - s / 2 + 0.16, cy - s / 2 + 0.16, s - 0.32, s - 0.32, 0.12);
    ctx.stroke();
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
const FIRE = FAMILY_COLOR.fire;
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

  // Pyromanciens
  brazier: (p) => {
    disc(p.ctx, p.cx, p.top + 0.1, 0.46, '#2d2a24');
    disc(p.ctx, p.cx, p.top + 0.1, 0.36, FIRE.dark);
    poly(p.ctx, FIRE.main, [p.cx - 0.26, p.top + 0.1, p.cx - 0.1, p.top - 0.3, p.cx, p.top - 0.08, p.cx + 0.12, p.top - 0.36, p.cx + 0.26, p.top + 0.1]);
    poly(p.ctx, FIRE.glow, [p.cx - 0.1, p.top + 0.1, p.cx, p.top - 0.12, p.cx + 0.1, p.top + 0.1]);
  },
  blaze: (p) => {
    aura(p, '224, 97, 42', 0.8);
    disc(p.ctx, p.cx, p.top + 0.1, 0.56, '#2d2a24');
    disc(p.ctx, p.cx, p.top + 0.1, 0.46, FIRE.dark);
    poly(p.ctx, FIRE.main, [p.cx - 0.36, p.top + 0.1, p.cx - 0.2, p.top - 0.45, p.cx - 0.02, p.top - 0.1, p.cx + 0.16, p.top - 0.55, p.cx + 0.36, p.top + 0.1]);
    poly(p.ctx, FIRE.glow, [p.cx - 0.14, p.top + 0.1, p.cx, p.top - 0.2, p.cx + 0.14, p.top + 0.1]);
  },
  volcano: (p) => {
    aura(p, '224, 97, 42', 0.95);
    poly(p.ctx, IRON, [p.cx - 0.6, p.top + 0.5, p.cx - 0.2, p.top - 0.3, p.cx + 0.2, p.top - 0.3, p.cx + 0.6, p.top + 0.5]);
    poly(p.ctx, FIRE.main, [p.cx - 0.2, p.top - 0.3, p.cx + 0.2, p.top - 0.3, p.cx + 0.1, p.top - 0.18, p.cx - 0.1, p.top - 0.18]);
    bubbles(p, '255, 194, 122', 4, 0.2, 0.7, p.top - 0.3);
  },
  flamethrower: (p) => {
    turret(p, FIRE.dark, 0.44);
    barrel(p, 0.7, 0.2, IRON, FIRE.glow);
    disc(p.ctx, p.cx, p.top, 0.12, FIRE.glow);
  },
  dragonbreath: (p) => {
    aura(p, '224, 97, 42', 0.86);
    turret(p, FIRE.dark, 0.5);
    barrel(p, 0.85, 0.3, FIRE.main, FIRE.glow);
    barrel(p, 0.7, 0.14, IRON, FIRE.glow);
    disc(p.ctx, p.cx, p.top, 0.16, FIRE.glow);
  },
  hearth: (p) => {
    disc(p.ctx, p.cx, p.top, 0.5, '#2d2a24');
    disc(p.ctx, p.cx, p.top, 0.4, FIRE.dark);
    disc(p.ctx, p.cx, p.top, 0.24 + 0.06 * pulse(p, 4), FIRE.main);
    disc(p.ctx, p.cx, p.top, 0.1, FIRE.glow);
  },
  conflagration: (p) => {
    aura(p, '224, 97, 42', 0.9);
    disc(p.ctx, p.cx, p.top, 0.58, '#2d2a24');
    disc(p.ctx, p.cx, p.top, 0.48, FIRE.dark);
    disc(p.ctx, p.cx, p.top, 0.34 + 0.08 * pulse(p, 5), FIRE.main);
    disc(p.ctx, p.cx, p.top, 0.18, FIRE.glow);
    bubbles(p, '255, 194, 122', 4, 0.3, 0.6);
  },
  ashfield: (p) => {
    disc(p.ctx, p.cx, p.top, 0.58, '#2d2a24');
    disc(p.ctx, p.cx, p.top, 0.46, '#5a554e');
    disc(p.ctx, p.cx, p.top, 0.2 + 0.05 * pulse(p, 3), FIRE.main);
    bubbles(p, '170, 165, 155', 4, 0.3, 0.6);
  },
  steam: (p) => {
    cauldron(p, '#c9d6dc');
    bubbles(p, '230, 240, 245', 4, 0.2, 0.7, p.top - 0.1);
    disc(p.ctx, p.cx, p.top + 0.3, 0.1, FIRE.main);
  },
  scorchmist: (p) => {
    aura(p, '224, 97, 42', 0.86);
    cauldron(p, '#e8d2c0', 0.5);
    bubbles(p, '255, 220, 190', 6, 0.3, 0.9, p.top - 0.1);
    disc(p.ctx, p.cx, p.top + 0.3, 0.14, FIRE.main);
  },
  plasma: (p) => {
    orb(p, FIRE.glow, 'rgba(224, 97, 42, A)', STORM.glow, 1);
  },
  solararc: (p) => {
    aura(p, '224, 97, 42', 0.9);
    orb(p, '#fff1c8', 'rgba(224, 97, 42, A)', STORM.glow, 2, 0.5);
  },

  // Garde et Ronces
  guard: (p) => {
    disc(p.ctx, p.cx, p.top, 0.5, ARCHER.dark);
    disc(p.ctx, p.cx, p.top, 0.4, ARCHER.main);
    poly(p.ctx, IRON, [p.cx - 0.16, p.top - 0.3, p.cx + 0.16, p.top - 0.3, p.cx + 0.12, p.top + 0.12, p.cx, p.top + 0.28, p.cx - 0.12, p.top + 0.12]);
  },
  champion: (p) => {
    disc(p.ctx, p.cx, p.top, 0.56, ARCHER.dark);
    disc(p.ctx, p.cx, p.top, 0.46, ARCHER.main);
    poly(p.ctx, PAL.gold, [p.cx - 0.2, p.top - 0.36, p.cx + 0.2, p.top - 0.36, p.cx + 0.15, p.top + 0.14, p.cx, p.top + 0.34, p.cx - 0.15, p.top + 0.14]);
    disc(p.ctx, p.cx, p.top - 0.05, 0.07, IRON);
  },
  standard: (p) => {
    disc(p.ctx, p.cx, p.top, 0.5, ARCHER.dark);
    disc(p.ctx, p.cx, p.top, 0.4, ARCHER.main);
    line(p.ctx, '#3a2614', 0.06, [p.cx - 0.1, p.top + 0.3, p.cx - 0.1, p.top - 0.7]);
    poly(p.ctx, PAL.gold, [p.cx - 0.1, p.top - 0.7, p.cx + 0.4, p.top - 0.52, p.cx - 0.1, p.top - 0.34]);
  },
  bramble: (p) => {
    for (const a of [0.3, 1.9, 3.6, 5.1]) line(p.ctx, VENOM.dark, 0.07, [p.cx, p.top, p.cx + Math.cos(a) * 0.5, p.top + Math.sin(a) * 0.5]);
    disc(p.ctx, p.cx, p.top, 0.14, VENOM.main);
  },
  briar: (p) => {
    for (const a of [0.2, 1.3, 2.4, 3.5, 4.6, 5.5]) line(p.ctx, VENOM.dark, 0.08, [p.cx, p.top, p.cx + Math.cos(a) * 0.62, p.top + Math.sin(a) * 0.62]);
    disc(p.ctx, p.cx, p.top, 0.2, VENOM.main);
    drips(p.ctx, p.cx, p.top + 0.3, ACID, p.time);
  },
  mothertorn: (p) => {
    aura(p, '143, 211, 242', 0.7);
    for (const a of [0.2, 1.3, 2.4, 3.5, 4.6, 5.5]) line(p.ctx, '#2f5a4a', 0.08, [p.cx, p.top, p.cx + Math.cos(a) * 0.62, p.top + Math.sin(a) * 0.62]);
    disc(p.ctx, p.cx, p.top, 0.2, '#8fd8b8');
  },

  // Gong
  gong: (p) => {
    disc(p.ctx, p.cx, p.top, 0.46, PAL.bronze);
    disc(p.ctx, p.cx, p.top, 0.36, PAL.gold);
    disc(p.ctx, p.cx, p.top, 0.1, PAL.bronze);
  },
  greatgong: (p) => {
    aura(p, '216, 243, 255', 0.8);
    disc(p.ctx, p.cx, p.top, 0.56, PAL.bronze);
    disc(p.ctx, p.cx, p.top, 0.46, PAL.gold);
    disc(p.ctx, p.cx, p.top, 0.26, PAL.bronze);
    disc(p.ctx, p.cx, p.top, 0.12, PAL.gold);
  },
  chime: (p) => {
    for (const x of [-0.3, -0.1, 0.1, 0.3]) line(p.ctx, FROST.main, 0.09, [p.cx + x, p.top - 0.4, p.cx + x, p.top + 0.1 + Math.abs(x) * 0.8]);
    line(p.ctx, PAL.bronze, 0.06, [p.cx - 0.4, p.top - 0.4, p.cx + 0.4, p.top - 0.4]);
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
  anvil: (p) => {
    turret(p);
    poly(p.ctx, IRON, [p.cx - 0.4, p.top - 0.2, p.cx + 0.4, p.top - 0.2, p.cx + 0.2, p.top + 0.05, p.cx + 0.2, p.top + 0.3, p.cx - 0.2, p.top + 0.3, p.cx - 0.2, p.top + 0.05]);
    barrel(p, 0.6, 0.18);
  },
  furnace: (p) => {
    turret(p, '#6a3a24', 0.52);
    disc(p.ctx, p.cx, p.top, 0.3, IRON);
    disc(p.ctx, p.cx, p.top, 0.2 + 0.04 * pulse(p, 4), 'rgba(240,154,74,0.85)');
    barrel(p, 0.8, 0.2);
  },
  triphammer: (p) => {
    turret(p, CANNON.main, 0.5);
    aimed(p, (ctx) => {
      line(ctx, '#3a2614', 0.1, [-0.1, 0, 0.6, 0]);
      ctx.fillStyle = IRON;
      roundRect(ctx, 0.5, -0.26, 0.34, 0.52, 0.06);
      ctx.fill();
    });
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
  pylon: (p) => {
    poly(p.ctx, STORM.dark, [p.cx - 0.22, p.top + 0.5, p.cx - 0.1, p.top - 0.6, p.cx + 0.1, p.top - 0.6, p.cx + 0.22, p.top + 0.5]);
    disc(p.ctx, p.cx, p.top - 0.65, 0.1 + 0.04 * pulse(p, 5), STORM.glow);
  },
  capacitor: (p) => {
    for (const x of [-0.26, 0.26]) {
      p.ctx.fillStyle = COPPER;
      roundRect(p.ctx, p.cx + x - 0.12, p.top - 0.5, 0.24, 1, 0.06);
      p.ctx.fill();
    }
    bolt(p.ctx, p.cx - 0.26, p.top - 0.5, p.cx + 0.26, p.top - 0.5, STORM.glow, p.time);
    disc(p.ctx, p.cx, p.top, 0.12 + 0.04 * pulse(p, 5), STORM.glow);
  },
  volatileprism: (p) => {
    poly(p.ctx, STORM.dark, [p.cx, p.top - 0.8, p.cx + 0.36, p.top + 0.45, p.cx - 0.36, p.top + 0.45]);
    poly(p.ctx, STORM.main, [p.cx, p.top - 0.8, p.cx + 0.36, p.top + 0.45, p.cx + 0.04, p.top + 0.25]);
    disc(p.ctx, p.cx, p.top, 0.12 + 0.04 * pulse(p, 7), STORM.glow);
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

  dispeller: (p) => {
    disc(p.ctx, p.cx, p.top, 0.4, STORM.dark);
    p.ctx.strokeStyle = STORM.glow;
    p.ctx.lineWidth = 0.06;
    circle(p.ctx, p.cx, p.top, 0.3 + 0.05 * pulse(p, 3));
    p.ctx.stroke();
    disc(p.ctx, p.cx, p.top, 0.1, STORM.glow);
  },
  greatdispeller: (p) => {
    aura(p, '169, 140, 240', 0.8);
    disc(p.ctx, p.cx, p.top, 0.5, STORM.dark);
    p.ctx.strokeStyle = PAL.gold;
    p.ctx.lineWidth = 0.06;
    for (const r of [0.2, 0.34 + 0.05 * pulse(p, 3)]) {
      circle(p.ctx, p.cx, p.top, r);
      p.ctx.stroke();
    }
    disc(p.ctx, p.cx, p.top, 0.1, STORM.glow);
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
  art({ ctx, cx, top: cy, aim, time });
}

/** Couleur des cases `build` dans l'aperçu : Terre garde son herbe claire, les autres biomes leur sol. */
const THUMB_BUILD: Record<Biome, string> = {
  earth: PAL.grassA,
  snow: BIOME_PALETTE.snow.ground,
  space: BIOME_PALETTE.space.ground,
};

/** Vignette d'une carte : une couleur par nature de case, ratio conservé. */
export function drawMapThumbnail(ctx: Ctx, map: MapDef, size: number): void {
  const biome = map.biome ?? 'earth';
  const pal = BIOME_PALETTE[biome];
  const color: Record<CellKind, string> = {
    build: THUMB_BUILD[biome],
    rock: pal.rock,
    spawn: PAL.good,
    exit: PAL.danger,
    road: pal.dirt,
    checkpoint: PAL.gold,
    ice: PAL.ice,
  };
  const grid = new Grid(map);
  const scale = size / Math.max(grid.w, grid.h);
  const ox = (size - grid.w * scale) / 2;
  const oy = (size - grid.h * scale) / 2;
  for (let y = 0; y < grid.h; y++) {
    for (let x = 0; x < grid.w; x++) {
      ctx.fillStyle = color[grid.kind[grid.idx(x, y)]];
      ctx.fillRect(ox + x * scale, oy + y * scale, scale + 0.5, scale + 0.5);
    }
  }
}

// ─── Une silhouette par créature ───────────────────────────────────────────

/** Ce qu'un dessin de créature reçoit : repère centré, x vers l'avant de la marche. */
interface Beast {
  ctx: Ctx;
  r: number;
  body: string;
  dark: string;
  eye: string;
  t: number;
}

const BONE = '#e8dcc0';
const WOOD = '#6b4a2b';
const STEEL = '#aab3bd';

function oval(ctx: Ctx, x: number, y: number, rx: number, ry: number, color: string, rot = 0): void {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

/** Corps en deux tons : ombre puis dessus légèrement décalé, comme les anciens sprites. */
function hull(b: Beast, x: number, y: number, rx: number, ry: number): void {
  oval(b.ctx, x, y, rx, ry, b.dark);
  oval(b.ctx, x + rx * 0.04, y - ry * 0.06, rx * 0.84, ry * 0.8, b.body);
}

function eyes(b: Beast, x: number, spread: number, size: number, color = b.eye): void {
  for (const s of [-1, 1]) disc(b.ctx, x, s * spread, Math.max(0.03, size), color);
}

/** Pattes latérales qui balancent d'avant en arrière, en alternance. */
function legs(b: Beast, xs: number[], side: number, reach: number, width: number, speed: number): void {
  xs.forEach((lx, i) => {
    for (const s of [-1, 1]) {
      const swing = Math.sin(b.t * speed + i * Math.PI + (s > 0 ? Math.PI : 0)) * reach * 0.45;
      line(b.ctx, b.dark, width, [lx, s * side, lx + swing, s * (side + reach)]);
    }
  });
}

/** Queue souple : une courbe effilée qui ondule derrière la créature. */
function tail(b: Beast, from: number, to: number, width: number, wag: number, color = b.dark): void {
  const sway = Math.sin(b.t * 5) * wag;
  const ctx = b.ctx;
  ctx.beginPath();
  ctx.moveTo(from, -width / 2);
  ctx.quadraticCurveTo((from + to) / 2, sway - width / 3, to, sway * 1.6);
  ctx.quadraticCurveTo((from + to) / 2, sway + width / 3, from, width / 2);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function slime(b: Beast): void {
  const { ctx, r } = b;
  const squash = 1 + Math.sin(b.t * 6) * 0.08;
  ctx.beginPath();
  for (let i = 0; i <= 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const rr = r * (1 + Math.sin(a * 3 + b.t * 4) * 0.06);
    const px = Math.cos(a) * rr * squash;
    const py = Math.sin(a) * rr / squash;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.fillStyle = b.dark;
  ctx.fill();
  ctx.globalAlpha = 0.85;
  oval(ctx, 0, -r * 0.05, r * 0.82 * squash, r * 0.78 / squash, b.body);
  ctx.globalAlpha = 1;
  disc(ctx, -r * 0.3, r * 0.25, r * 0.16, b.dark);
  disc(ctx, -r * 0.1, -r * 0.35, r * 0.1, b.dark);
  oval(ctx, -r * 0.2, -r * 0.45, r * 0.3, r * 0.12, 'rgba(255,255,255,0.35)', -0.4);
  eyes(b, r * 0.4, r * 0.28, r * 0.17, b.eye);
  eyes(b, r * 0.46, r * 0.28, r * 0.07, PAL.ink);
}

export const CREEP_ART: Record<string, (b: Beast) => void> = {
  rat: (b) => {
    const { ctx, r } = b;
    tail(b, -r * 0.7, -r * 1.75, r * 0.14, r * 0.35);
    legs(b, [-r * 0.35, r * 0.35], r * 0.45, r * 0.3, 0.05, 16);
    hull(b, -r * 0.1, 0, r * 0.85, r * 0.6);
    poly(ctx, b.body, [r * 0.35, -r * 0.38, r * 1.3, 0, r * 0.35, r * 0.38]);
    disc(ctx, r * 1.3, 0, r * 0.09, b.dark);
    for (const s of [-1, 1]) {
      disc(ctx, r * 0.35, s * r * 0.4, r * 0.22, b.dark);
      disc(ctx, r * 0.37, s * r * 0.4, r * 0.13, '#c99a8a');
    }
    eyes(b, r * 0.75, r * 0.16, r * 0.09);
  },
  wolf: (b) => {
    const { ctx, r } = b;
    legs(b, [-r * 0.55, r * 0.45], r * 0.35, r * 0.45, 0.07, 14);
    oval(ctx, -r * 1.15, Math.sin(b.t * 7) * r * 0.15, r * 0.5, r * 0.2, b.dark, Math.sin(b.t * 7) * 0.3);
    hull(b, -r * 0.05, 0, r * 1.0, r * 0.48);
    line(ctx, b.dark, r * 0.18, [-r * 0.7, 0, r * 0.4, 0]);
    oval(ctx, r * 0.45, 0, r * 0.38, r * 0.5, b.dark);
    poly(ctx, b.body, [r * 0.55, -r * 0.3, r * 1.5, 0, r * 0.55, r * 0.3]);
    disc(ctx, r * 1.48, 0, r * 0.08, PAL.ink);
    for (const s of [-1, 1]) poly(ctx, b.dark, [r * 0.75, s * r * 0.2, r * 0.45, s * r * 0.5, r * 0.55, s * r * 0.12]);
    eyes(b, r * 0.9, r * 0.15, r * 0.09);
  },
  raider: (b) => {
    const { ctx, r } = b;
    const swing = Math.sin(b.t * 6) * 0.25;
    oval(ctx, -r * 0.1, 0, r * 0.5, r * 0.95, b.dark);
    oval(ctx, -r * 0.05, 0, r * 0.4, r * 0.82, b.body);
    // Hache à droite, bouclier rond à gauche.
    ctx.save();
    ctx.translate(r * 0.1, r * 0.7);
    ctx.rotate(swing);
    line(ctx, WOOD, r * 0.12, [0, 0, r * 1.05, 0]);
    poly(ctx, STEEL, [r * 0.8, 0, r * 1.1, r * 0.05, r * 1.15, r * 0.4, r * 0.85, r * 0.3]);
    ctx.restore();
    disc(ctx, r * 0.3, -r * 0.72, r * 0.34, PAL.bronze);
    disc(ctx, r * 0.3, -r * 0.72, r * 0.26, WOOD);
    disc(ctx, r * 0.3, -r * 0.72, r * 0.09, PAL.bronze);
    disc(ctx, r * 0.1, 0, r * 0.42, b.dark);
    disc(ctx, r * 0.05, 0, r * 0.34, b.body);
    eyes(b, r * 0.35, r * 0.14, r * 0.08);
  },
  troll: (b) => {
    const { ctx, r } = b;
    const sw = Math.sin(b.t * 5) * r * 0.15;
    for (const s of [-1, 1]) {
      line(ctx, b.dark, r * 0.32, [0, s * r * 0.75, r * 0.85 + s * sw, s * r * 0.85]);
      disc(ctx, r * 0.9 + s * sw, s * r * 0.85, r * 0.24, b.body);
    }
    hull(b, -r * 0.15, 0, r * 0.85, r * 0.9);
    disc(ctx, -r * 0.4, r * 0.3, r * 0.18, b.dark);
    disc(ctx, -r * 0.55, -r * 0.2, r * 0.13, b.dark);
    disc(ctx, -r * 0.2, -r * 0.45, r * 0.1, b.dark);
    disc(ctx, r * 0.55, 0, r * 0.36, b.dark);
    disc(ctx, r * 0.58, 0, r * 0.28, b.body);
    for (const s of [-1, 1]) poly(ctx, BONE, [r * 0.78, s * r * 0.12, r * 1.05, s * r * 0.24, r * 0.8, s * r * 0.22]);
    eyes(b, r * 0.68, r * 0.14, r * 0.08);
  },
  golem: (b) => {
    const { ctx, r } = b;
    const glow = 0.55 + 0.45 * Math.sin(b.t * 2.5);
    for (const s of [-1, 1]) {
      poly(ctx, b.dark, [r * 0.35, s * r * 0.7, r * 0.95, s * r * 0.62, r * 1.0, s * r * 1.1, r * 0.4, s * r * 1.15]);
      poly(ctx, b.body, [r * 0.42, s * r * 0.75, r * 0.88, s * r * 0.7, r * 0.9, s * r * 1.02, r * 0.45, s * r * 1.05]);
    }
    poly(ctx, b.dark, [-r * 0.9, -r * 0.4, -r * 0.5, -r * 0.9, r * 0.4, -r * 0.85, r * 0.8, -r * 0.2, r * 0.75, r * 0.5, r * 0.3, r * 0.92, -r * 0.6, r * 0.85, -r * 0.95, r * 0.3]);
    poly(ctx, b.body, [-r * 0.78, -r * 0.35, -r * 0.42, -r * 0.76, r * 0.35, -r * 0.72, r * 0.66, -r * 0.18, r * 0.62, r * 0.4, r * 0.24, r * 0.76, -r * 0.52, r * 0.7, -r * 0.82, r * 0.24]);
    ctx.globalAlpha = glow;
    line(ctx, b.eye, r * 0.06, [-r * 0.5, -r * 0.3, -r * 0.1, 0, -r * 0.35, r * 0.4]);
    line(ctx, b.eye, r * 0.06, [-r * 0.1, 0, r * 0.25, -r * 0.1]);
    ctx.globalAlpha = 1;
    poly(ctx, b.dark, [r * 0.4, -r * 0.3, r * 0.78, -r * 0.25, r * 0.78, r * 0.25, r * 0.4, r * 0.3]);
    line(ctx, b.eye, r * 0.1, [r * 0.62, -r * 0.16, r * 0.62, r * 0.16]);
  },
  knight: (b) => {
    const { ctx, r } = b;
    line(ctx, STEEL, r * 0.14, [r * 0.1, r * 0.72, r * 1.45, r * 0.72]);
    line(ctx, PAL.bronze, r * 0.1, [r * 0.35, r * 0.5, r * 0.35, r * 0.94]);
    roundRect(ctx, -r * 0.6, -r * 0.7, r * 1.1, r * 1.4, r * 0.25);
    ctx.fillStyle = b.dark;
    ctx.fill();
    for (const s of [-1, 1]) {
      disc(ctx, -r * 0.05, s * r * 0.68, r * 0.42, b.dark);
      disc(ctx, -r * 0.02, s * r * 0.65, r * 0.33, b.body);
      disc(ctx, -r * 0.02, s * r * 0.65, r * 0.08, STEEL);
    }
    disc(ctx, r * 0.1, 0, r * 0.45, b.dark);
    disc(ctx, r * 0.12, 0, r * 0.37, b.body);
    line(ctx, b.dark, r * 0.12, [-r * 0.3, 0, r * 0.3, 0]);
    line(ctx, b.eye, r * 0.09, [r * 0.42, -r * 0.2, r * 0.42, r * 0.2]);
  },
  harpy: (b) => {
    const { ctx, r } = b;
    const flap = 0.75 + Math.sin(b.t * 11) * 0.3;
    for (const s of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const fx = r * (0.25 - i * 0.28);
        oval(ctx, fx, s * r * (0.55 + 0.75 * flap), r * 0.17, r * 0.8 * flap, i % 2 ? b.dark : b.body, s * (0.25 + i * 0.12));
      }
    }
    for (const a of [-0.35, 0, 0.35]) oval(ctx, -r * 0.8, Math.sin(a) * r * 0.5, r * 0.4, r * 0.12, b.dark, a);
    hull(b, 0, 0, r * 0.62, r * 0.42);
    disc(ctx, r * 0.55, 0, r * 0.3, b.body);
    poly(ctx, PAL.gold, [r * 0.78, -r * 0.1, r * 1.1, 0, r * 0.78, r * 0.1]);
    eyes(b, r * 0.62, r * 0.13, r * 0.07);
  },
  wyvern: (b) => {
    const { ctx, r } = b;
    const flap = 0.7 + Math.sin(b.t * 8) * 0.3;
    for (const s of [-1, 1]) {
      const tipY = s * r * (0.6 + 1.0 * flap);
      poly(ctx, b.dark, [r * 0.3, s * r * 0.25, r * 0.15, tipY, -r * 0.25, s * r * 1.0 * flap, -r * 0.55, s * r * 0.85 * flap, -r * 0.45, s * r * 0.25]);
      line(ctx, b.body, r * 0.06, [r * 0.3, s * r * 0.25, r * 0.15, tipY]);
      line(ctx, b.body, r * 0.04, [r * 0.15, tipY * 0.7, -r * 0.25, s * r * 1.0 * flap]);
      line(ctx, b.body, r * 0.04, [r * 0.15, tipY * 0.7, -r * 0.55, s * r * 0.85 * flap]);
    }
    tail(b, -r * 0.4, -r * 1.55, r * 0.22, r * 0.3);
    poly(ctx, b.dark, [-r * 1.45 , Math.sin(b.t * 5) * r * 0.48, -r * 1.75, Math.sin(b.t * 5) * r * 0.48 - r * 0.15, -r * 1.75, Math.sin(b.t * 5) * r * 0.48 + r * 0.15]);
    hull(b, -r * 0.05, 0, r * 0.6, r * 0.36);
    line(ctx, b.body, r * 0.22, [r * 0.4, 0, r * 0.95, Math.sin(b.t * 3) * r * 0.1]);
    oval(ctx, r * 1.05, Math.sin(b.t * 3) * r * 0.1, r * 0.3, r * 0.2, b.body);
    for (const s of [-1, 1]) line(ctx, BONE, r * 0.05, [r * 0.95, s * r * 0.12, r * 0.7, s * r * 0.3]);
    ctx.save();
    ctx.translate(0, Math.sin(b.t * 3) * r * 0.1);
    eyes(b, r * 1.12, r * 0.1, r * 0.06);
    ctx.restore();
  },
  wraith: (b) => {
    const { ctx, r } = b;
    ctx.globalAlpha = 0.25 + 0.1 * Math.sin(b.t * 3);
    disc(ctx, 0, 0, r * 1.15, b.body);
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.moveTo(r * 0.55, -r * 0.65);
    for (let i = 0; i <= 5; i++) {
      const k = i / 5;
      const tx = -r * (0.9 + (i % 2) * 0.55) + Math.sin(b.t * 6 + i) * r * 0.12;
      ctx.lineTo(tx, -r * 0.7 + k * r * 1.4);
    }
    ctx.lineTo(r * 0.55, r * 0.65);
    ctx.closePath();
    ctx.fillStyle = b.dark;
    ctx.fill();
    oval(ctx, -r * 0.1, 0, r * 0.65, r * 0.55, b.body);
    disc(ctx, r * 0.35, 0, r * 0.42, b.dark);
    disc(ctx, r * 0.45, 0, r * 0.28, PAL.ink);
    ctx.globalAlpha = 1;
    eyes(b, r * 0.55, r * 0.12, r * 0.08);
  },
  ogre: (b) => {
    const { ctx, r } = b;
    const swing = Math.sin(b.t * 4) * 0.3;
    ctx.save();
    ctx.translate(r * 0.1, r * 0.75);
    ctx.rotate(swing);
    line(ctx, WOOD, r * 0.16, [0, 0, r * 0.95, r * 0.15]);
    disc(ctx, r * 1.0, r * 0.16, r * 0.24, WOOD);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      disc(ctx, r * 1.0 + Math.cos(a) * r * 0.24, r * 0.16 + Math.sin(a) * r * 0.24, r * 0.06, STEEL);
    }
    ctx.restore();
    disc(ctx, r * 0.45, -r * 0.82, r * 0.2, b.body);
    hull(b, -r * 0.1, 0, r * 0.8, r * 0.95);
    line(ctx, WOOD, r * 0.12, [-r * 0.2, -r * 0.88, -r * 0.2, r * 0.88]);
    disc(ctx, -r * 0.2, 0, r * 0.12, PAL.bronze);
    disc(ctx, r * 0.5, 0, r * 0.33, b.dark);
    disc(ctx, r * 0.52, 0, r * 0.26, b.body);
    line(ctx, PAL.ink, r * 0.12, [r * 0.3, 0, r * 0.6, 0]);
    for (const s of [-1, 1]) poly(ctx, BONE, [r * 0.7, s * r * 0.12, r * 0.95, s * r * 0.2, r * 0.72, s * r * 0.22]);
    eyes(b, r * 0.66, r * 0.12, r * 0.06);
  },
  hydra: (b) => {
    const { ctx, r } = b;
    tail(b, -r * 0.5, -r * 1.4, r * 0.4, r * 0.2);
    hull(b, -r * 0.15, 0, r * 0.75, r * 0.75);
    for (let i = 0; i < 4; i++) disc(ctx, -r * 0.45 + i * r * 0.2, (i % 2 ? 1 : -1) * r * 0.2, r * 0.1, b.dark);
    [-0.65, 0, 0.65].forEach((a, i) => {
      const sway = Math.sin(b.t * 3 + i * 2) * 0.18;
      const hx = Math.cos(a + sway) * r * 1.15;
      const hy = Math.sin(a + sway) * r * 1.15;
      ctx.beginPath();
      ctx.moveTo(r * 0.3, Math.sin(a) * r * 0.35);
      ctx.quadraticCurveTo(r * 0.75, Math.sin(a) * r * 0.5 - sway * r, hx, hy);
      ctx.strokeStyle = b.dark;
      ctx.lineWidth = r * 0.26;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.strokeStyle = b.body;
      ctx.lineWidth = r * 0.16;
      ctx.stroke();
      ctx.lineCap = 'butt';
      ctx.save();
      ctx.translate(hx, hy);
      ctx.rotate(a + sway);
      oval(ctx, r * 0.05, 0, r * 0.26, r * 0.18, b.dark);
      oval(ctx, r * 0.07, 0, r * 0.2, r * 0.13, b.body);
      eyes(b, r * 0.1, r * 0.09, r * 0.05);
      ctx.restore();
    });
  },
  ashlord: (b) => {
    const { ctx, r } = b;
    const ember = 0.5 + 0.5 * Math.sin(b.t * 3);
    ctx.beginPath();
    ctx.moveTo(-r * 0.1, -r * 0.8);
    for (let i = 0; i <= 6; i++) ctx.lineTo(-r * (0.95 + (i % 2) * 0.3) + Math.sin(b.t * 4 + i) * r * 0.05, -r * 0.8 + (i / 6) * r * 1.6);
    ctx.lineTo(-r * 0.1, r * 0.8);
    ctx.closePath();
    ctx.fillStyle = '#3a1410';
    ctx.fill();
    for (const s of [-1, 1]) {
      disc(ctx, 0, s * r * 0.62, r * 0.36, b.dark);
      poly(ctx, '#2a1a16', [-r * 0.1, s * r * 0.7, r * 0.15, s * r * 1.15, r * 0.2, s * r * 0.65]);
    }
    hull(b, -r * 0.05, 0, r * 0.62, r * 0.7);
    ctx.globalAlpha = 0.5 + 0.5 * ember;
    line(ctx, PAL.gold, r * 0.05, [-r * 0.45, -r * 0.3, -r * 0.1, -r * 0.05, -r * 0.35, r * 0.35]);
    line(ctx, PAL.gold, r * 0.05, [-r * 0.1, -r * 0.05, r * 0.15, r * 0.25]);
    ctx.globalAlpha = 1;
    disc(ctx, r * 0.35, 0, r * 0.3, '#2a1a16');
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(r * 0.3, s * r * 0.2);
      ctx.quadraticCurveTo(r * 0.4, s * r * 0.45, r * 0.7, s * r * 0.36);
      ctx.strokeStyle = BONE;
      ctx.lineWidth = r * 0.07;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.lineCap = 'butt';
    }
    eyes(b, r * 0.5, r * 0.11, r * 0.07);
  },
  runeguard: (b) => {
    const { ctx, r } = b;
    const glow = 0.5 + 0.5 * Math.sin(b.t * 2.2);
    hull(b, -r * 0.2, 0, r * 0.55, r * 0.8);
    disc(ctx, -r * 0.05, 0, r * 0.34, b.dark);
    disc(ctx, -r * 0.03, 0, r * 0.26, b.body);
    // Pavois de pierre gravé d'une rune.
    roundRect(ctx, r * 0.4, -r * 0.95, r * 0.4, r * 1.9, r * 0.12);
    ctx.fillStyle = b.dark;
    ctx.fill();
    roundRect(ctx, r * 0.47, -r * 0.85, r * 0.26, r * 1.7, r * 0.08);
    ctx.fillStyle = b.body;
    ctx.fill();
    ctx.globalAlpha = 0.4 + 0.6 * glow;
    line(ctx, b.eye, r * 0.08, [r * 0.6, -r * 0.55, r * 0.6, r * 0.55]);
    line(ctx, b.eye, r * 0.07, [r * 0.6, -r * 0.2, r * 0.6 - r * 0.0, -r * 0.2, r * 0.6, r * 0.1]);
    line(ctx, b.eye, r * 0.07, [r * 0.52, -r * 0.35, r * 0.68, -r * 0.05, r * 0.52, r * 0.25]);
    ctx.globalAlpha = 1;
  },
  dunerunner: (b) => {
    const { ctx, r } = b;
    tail(b, -r * 0.4, -r * 1.7, r * 0.3, r * 0.5);
    legs(b, [-r * 0.4, r * 0.35], r * 0.25, r * 0.55, 0.07, 22);
    hull(b, 0, 0, r * 0.75, r * 0.35);
    for (let i = 0; i < 4; i++) poly(ctx, b.dark, [-r * 0.5 + i * r * 0.3, -r * 0.06, -r * 0.35 + i * r * 0.3, 0, -r * 0.5 + i * r * 0.3, r * 0.06]);
    poly(ctx, b.body, [r * 0.5, -r * 0.28, r * 1.25, 0, r * 0.5, r * 0.28]);
    for (const s of [-1, 1]) poly(ctx, b.dark, [r * 0.55, s * r * 0.22, r * 0.4, s * r * 0.55, r * 0.75, s * r * 0.25]);
    eyes(b, r * 0.8, r * 0.15, r * 0.08);
  },
  shaman: (b) => {
    const { ctx, r } = b;
    const glow = 0.5 + 0.5 * Math.sin(b.t * 3);
    ctx.globalAlpha = 0.15 + 0.15 * glow;
    disc(ctx, 0, 0, r * 1.25, b.eye);
    ctx.globalAlpha = 1;
    line(ctx, WOOD, r * 0.1, [-r * 0.5, r * 0.75, r * 1.05, r * 0.65]);
    disc(ctx, r * 1.12, r * 0.64, r * 0.2, b.dark);
    disc(ctx, r * 1.12, r * 0.64, r * (0.1 + 0.05 * glow), b.eye);
    hull(b, -r * 0.1, 0, r * 0.62, r * 0.75);
    for (const s of [-1, 1]) {
      oval(ctx, -r * 0.35, s * r * 0.55, r * 0.3, r * 0.08, BONE, s * 0.5);
      oval(ctx, -r * 0.5, s * r * 0.45, r * 0.28, r * 0.07, PAL.danger, s * 0.7);
    }
    disc(ctx, r * 0.25, 0, r * 0.36, b.dark);
    disc(ctx, r * 0.42, 0, r * 0.2, PAL.ink);
    eyes(b, r * 0.48, r * 0.09, r * 0.06);
  },
  slime,
  slimelet: slime,
  sapper: (b) => {
    const { ctx, r } = b;
    // Bombe sur le dos, mèche qui crépite.
    disc(ctx, -r * 0.65, 0, r * 0.45, IRON);
    disc(ctx, -r * 0.72, -r * 0.12, r * 0.12, '#4a4a52');
    line(ctx, BONE, r * 0.06, [-r * 1.0, 0, -r * 1.25, -r * 0.2]);
    const spark = Math.sin(b.t * 30) > 0 ? PAL.gold : PAL.danger;
    disc(ctx, -r * 1.27, -r * 0.22, r * 0.12, spark);
    legs(b, [0], r * 0.35, r * 0.25, 0.06, 18);
    hull(b, 0, 0, r * 0.5, r * 0.55);
    for (const s of [-1, 1]) poly(ctx, b.body, [r * 0.3, s * r * 0.2, -r * 0.05, s * r * 1.05, r * 0.15, s * r * 0.25]);
    disc(ctx, r * 0.4, 0, r * 0.34, b.body);
    poly(ctx, b.dark, [r * 0.6, -r * 0.08, r * 0.95, 0, r * 0.6, r * 0.08]);
    eyes(b, r * 0.55, r * 0.15, r * 0.08);
  },
  hydrahead: (b) => {
    const { ctx, r } = b;
    tail(b, -r * 0.2, -r * 1.6, r * 0.55, r * 0.45);
    for (let i = 0; i < 3; i++) poly(ctx, b.dark, [-r * (0.3 + i * 0.4), -r * 0.05, -r * (0.15 + i * 0.4), -r * 0.35, -r * (0.05 + i * 0.4), 0]);
    hull(b, r * 0.15, 0, r * 0.85, r * 0.55);
    oval(ctx, r * 0.75, 0, r * 0.35, r * 0.2, b.dark);
    for (const s of [-1, 1]) line(ctx, BONE, r * 0.05, [r * 0.95, s * r * 0.06, r * 1.05, s * r * 0.16]);
    eyes(b, r * 0.45, r * 0.25, r * 0.1);
  },
};

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

  // Silhouette propre à la créature, dessinée dans le repère de la marche (x vers l'avant).
  const len = Math.hypot(dirX, dirY) || 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.atan2(dirY / len, dirX / len));
  const art = CREEP_ART[c.def.id] ?? CREEP_ART.rat;
  art({ ctx, r, body: c.hitFlash > 0 ? '#fff4dc' : st.body, dark: st.dark, eye: st.eye, t: time + c.bob });
  ctx.restore();

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

/** Graine du décor : empreinte FNV-1a de la disposition, le biome n'y entre pas. */
export function decorSeed(map: MapDef): number {
  let h = 0x811c9dc5;
  for (const ch of map.rows.join('\n')) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193);
  return h >>> 0;
}
