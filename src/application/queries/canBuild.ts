import { TOWERS } from '../../domain/catalog/towers';
import { buildMenu } from '../../domain/rules/builder';
import type { Result } from '../../domain/model/types';
import type { World } from '../../domain/model/World';
import { fail } from '../result';

/**
 * Vérifie qu'une tour peut être posée en (x, y) : terrain constructible,
 * aucune créature dessous, et surtout le labyrinthe ne doit jamais être
 * fermé — ni pour le trajet complet, ni pour une créature déjà en route.
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
  if (!pathsStayOpen(world, fp)) return fail('Impossible de bloquer le chemin.');
  return { ok: true };
}

function pathsStayOpen(world: World, blocked: Set<number>): boolean {
  const fields = world.fields;
  for (const f of fields) f.compute(blocked);
  const g = world.grid;
  let ok = fields[0].reachable(world.spawnCell);
  for (let k = 1; ok && k < fields.length; k++) {
    ok = g.checkpoints[k - 1].some((i) => fields[k].reachable(i));
  }
  if (ok) {
    for (const c of world.creeps) {
      if (!c.alive || c.def.air) continue;
      if (!world.fields[c.leg].reachable(g.idx(c.tx, c.ty))) {
        ok = false;
        break;
      }
    }
  }
  // Restaure les champs de la grille réelle.
  world.refreshPaths();
  return ok;
}
