import type { Result } from '../../domain/model/types';
import type { World } from '../../domain/model/World';
import { GLEANER } from '../../domain/catalog/ether';
import { canBuyGleaner } from '../queries/canBuyGleaner';

export function gleaner(world: World): Result {
  const r = canBuyGleaner(world);
  if (!r.ok) return r;
  world.gold -= GLEANER.cost;
  world.gleaners.push(world.tick);
  return { ok: true };
}
