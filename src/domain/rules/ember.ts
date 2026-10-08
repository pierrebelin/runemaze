import type { Ember } from '../model/types';

/** Flaque au plus fort dps parmi celles qui contiennent le point ; à égalité, le plus petit id. */
export function strongestEmber(embers: Ember[], x: number, y: number, radius: number): Ember | undefined {
  let best: Ember | undefined;
  for (const e of embers) {
    if (Math.hypot(x - e.x, y - e.y) > e.radius + radius) continue;
    if (!best || e.dps > best.dps || (e.dps === best.dps && e.id < best.id)) best = e;
  }
  return best;
}
