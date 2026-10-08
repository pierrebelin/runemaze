import { TOWERS } from '../../domain/catalog/towers';
import { buildMenu } from '../../domain/rules/builder';
import { capOf, opposes } from '../../domain/rules/heading';
import { wormholesOpen } from '../../domain/rules/wormhole';
import type { Creep, Result } from '../../domain/model/types';
import type { World } from '../../domain/model/World';
import { fail } from '../result';

/**
 * Vérifie qu'une tour peut être posée en (x, y) : terrain constructible,
 * aucune créature dessous, et surtout le labyrinthe ne doit jamais être
 * fermé — ni pour le trajet complet, ni pour une créature déjà en route —,
 * et aucune créature en route ne doit faire demi-tour : son pas suivant ne peut
 * pas s'écarter de plus de 90° de son cap (voir `Creep.heading`).
 */
export function canBuild(world: World, defId: string, x: number, y: number): Result {
  const def = TOWERS[defId];
  if (!def || !buildMenu(world.builder).includes(defId)) return fail('Construction inconnue.');
  const g = world.grid;
  if (!g.inBounds(x, y) || !g.inBounds(x + 1, y + 1)) return fail('Hors de la carte.');
  const cells = g.footprint(x, y);
  if (!cells.every((i) => g.buildable(i))) return fail('Terrain non constructible.');
  if (world.gold < def.cost) return fail(`Il faut ${def.cost} pièces d'or.`);

  const fp = new Set(cells);
  for (const c of world.creeps) {
    if (!c.alive || c.def.air) continue;
    const r = c.def.radius;
    if (c.x + r > x && c.x - r < x + 2 && c.y + r > y && c.y - r < y + 2) return fail('Une créature bloque l’emplacement.');
    if (fp.has(g.idx(c.tx, c.ty))) return fail('Une créature bloque l’emplacement.');
  }
  const paths = checkPaths(world, fp);
  if (!paths.ok) return paths;
  return wormholesOpen(g, fp) ? paths : fail('L’accès au trou de ver doit rester ouvert.');
}

function checkPaths(world: World, blocked: Set<number>): Result {
  const g = world.grid;
  const ground = world.creeps.filter((c) => c.alive && !c.def.air);
  const nextBefore = nextSteps(world, ground);
  const fields = world.fields;
  for (const f of fields) f.compute(blocked);
  let ok = fields[0].reachable(world.spawnCell);
  for (let k = 1; ok && k < fields.length; k++) {
    ok = g.checkpoints[k - 1].some((i) => fields[k].reachable(i));
  }
  let result: Result = ok ? { ok: true } : fail('Impossible de bloquer le chemin.');
  for (const [k, c] of ground.entries()) {
    if (!result.ok) break;
    const cell = g.idx(c.tx, c.ty);
    if (!fields[c.leg].reachable(cell)) result = fail('Impossible de bloquer le chemin.');
    else if (fields[c.leg].next[cell] !== nextBefore[k] && turnsBack(world, c, fields[c.leg].next[cell])) {
      result = fail('Les créatures en route ne peuvent pas faire demi-tour.');
    }
  }
  // Restaure les champs de la grille réelle.
  world.refreshPaths();
  return result;
}

/** Case suivante de chaque créature terrestre, depuis la case qu'elle vise, sur les champs actuels. */
export function nextSteps(world: World, creeps: Creep[]): number[] {
  return creeps.map((c) => world.fields[c.leg].next[world.grid.idx(c.tx, c.ty)]);
}

/** Vrai si le pas suivant `next` s'écarte de plus de 90° du cap de la créature. */
function turnsBack(world: World, c: Creep, next: number): boolean {
  if (next < 0) return false; // Case d'arrivée du tronçon : pas de pas suivant.
  const g = world.grid;
  const step = { x: g.cx(next) - c.tx, y: g.cy(next) - c.ty };
  // Un saut non voisin (trou de ver) est une téléportation, pas un demi-tour.
  if (Math.abs(step.x) > 1 || Math.abs(step.y) > 1) return false;
  return opposes(capOf(c), step);
}
