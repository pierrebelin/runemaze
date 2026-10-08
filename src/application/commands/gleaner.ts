import type { Result } from '../../domain/model/types';
import type { World } from '../../domain/model/World';
import { GLEANER } from '../../domain/catalog/ether';
import { gleanerCost } from '../../domain/rules/gleanerCost';
import { canBuyGleaner } from '../queries/canBuyGleaner';

export function gleaner(world: World): Result {
  const r = canBuyGleaner(world);
  if (!r.ok) return r;
  world.gold -= gleanerCost(GLEANER.cost, world.builder);
  world.gleaners.push(world.tick);
  return { ok: true };
}
