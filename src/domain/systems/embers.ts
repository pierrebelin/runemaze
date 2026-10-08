import type { World } from '../model/World';
import { strongestEmber } from '../rules/ember';
import { applyDamage } from './combat';
import { applySlow } from './status';

/** Flaques de braise : expiration, puis brûlure et lenteur de la plus forte sous chaque créature au sol. */
export function updateEmbers(world: World, dt: number): void {
  if (world.embers.length === 0) return;
  for (const c of world.creeps) {
    if (!c.alive || c.def.air) continue;
    const e = strongestEmber(world.embers, c.x, c.y, c.def.radius);
    if (!e) continue;
    applyDamage(world, c, e.dps * dt, 'normal', e.towerId, true);
    if (e.slow && c.alive) applySlow(c, e.slow);
  }
  // Retrait après la brûlure : une flaque de durée d brûle d × 60 ticks pleins.
  world.embers = world.embers.filter((e) => e.expires > world.tick);
}
