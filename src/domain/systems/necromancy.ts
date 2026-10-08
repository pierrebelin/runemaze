import type { Corpse, Tower } from '../model/types';
import { TICK, type World } from '../model/World';
import { towerRange } from '../rules/crystal';
import { applyDamage } from './combat';

const SKELETON_SPEED = 2;
/** Marge de contact ajoutée au rayon de la créature. */
const CONTACT_MARGIN = 0.3;

/** Cadavres : expiration, puis consommation par les Autels (ordre de construction, puis cadavre le plus proche ; égalité : premier de la liste, donc plus petit id). */
export function updateNecromancy(world: World): void {
  // Un Autel consomme au plus un cadavre par seconde. Calculé ici : import circulaire avec World.
  const offerTicks = Math.round(1 / TICK);
  if (world.corpses.length > 0) world.corpses = world.corpses.filter((k) => k.expires > world.tick);
  for (const t of world.towers) {
    const altar = t.def.altar;
    const raise = t.def.raise;
    if (raise) {
      const timer = (t.raiseTimer ?? 0) - TICK;
      t.raiseTimer = timer;
      if (timer <= 0) {
        const k = takeNearestCorpse(world, t);
        if (k) {
          t.raiseTimer = raise.every;
          world.skeletons.push({
            id: world.id(), towerId: t.id, x: k.x, y: k.y, step: nearestStep(world, k.x, k.y),
            damage: raise.damage, radius: raise.radius, expires: world.tick + Math.round(8 / TICK),
          });
        }
      }
    }
    if (!altar) continue;
    if (t.offerings.length > 0) t.offerings = t.offerings.filter((e) => e > world.tick);
    if (t.offerings.length >= altar.maxStacks) continue;
    if (t.offeredAt !== undefined && world.tick - t.offeredAt < offerTicks) continue;
    if (!takeNearestCorpse(world, t)) continue;
    t.offerings.push(world.tick + Math.round(altar.duration / TICK));
    t.offeredAt = world.tick;
  }
}

/** Retire et renvoie le cadavre le plus proche dans la portée de la tour (bonus de cristal compris). */
function takeNearestCorpse(world: World, t: Tower): Corpse | undefined {
  const range = towerRange(t);
  let best = -1;
  let bestDist = Infinity;
  world.corpses.forEach((k, i) => {
    const d = Math.hypot(k.x - t.cx, k.y - t.cy);
    if (d > range) return;
    if (d < bestDist) {
      best = i;
      bestDist = d;
    }
  });
  return best < 0 ? undefined : world.corpses.splice(best, 1)[0];
}

/** Indice de la case du tracé la plus proche (égalité : plus petit indice). */
export function nearestStep(world: World, x: number, y: number): number {
  let best = 0;
  let bestDist = Infinity;
  world.route.forEach((c, i) => {
    const d = Math.hypot(world.grid.cx(c) - x, world.grid.cy(c) - y);
    if (d < bestDist) {
      best = i;
      bestDist = d;
    }
  });
  return best;
}

/** Les squelettes remontent le tracé vers le portail, de case en case ; ils explosent au contact d'une créature au sol, ou disparaissent au portail ou à l'expiration. */
export function updateSkeletons(world: World, dt: number): void {
  if (world.skeletons.length === 0) return;
  const move = SKELETON_SPEED * dt;
  world.skeletons = world.skeletons.filter((s) => {
    if (s.expires <= world.tick || s.step <= 0) return false;
    const c = world.route[s.step - 1];
    const dx = world.grid.cx(c) - s.x;
    const dy = world.grid.cy(c) - s.y;
    const d = Math.hypot(dx, dy);
    if (d <= move) {
      s.x += dx;
      s.y += dy;
      s.step--;
    } else {
      s.x += (dx / d) * move;
      s.y += (dy / d) * move;
    }
    if (s.step <= 0) return false;
    const touched = world.creeps.some((k) => k.alive && !k.def.air && Math.hypot(k.x - s.x, k.y - s.y) <= k.def.radius + CONTACT_MARGIN);
    if (!touched) return true;
    for (const k of world.creeps) {
      if (k.alive && !k.def.air && Math.hypot(k.x - s.x, k.y - s.y) <= s.radius) applyDamage(world, k, s.damage, 'chaos', s.towerId, false);
    }
    return false;
  });
}
