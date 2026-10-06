import type { Result } from '../../domain/model/types';
import type { World } from '../../domain/model/World';
import { GLEANER } from '../../domain/catalog/ether';
import { fail } from '../result';

export function canBuyGleaner(world: World): Result {
  if (!world.duel) return fail('Les glaneurs n\'existent qu\'en duel.');
  if (world.gold < GLEANER.cost) return fail('Pas assez d\'or.');
  return { ok: true };
}
