import type { Result } from '../../domain/model/types';
import { Phase } from '../../domain/model/types';
import type { World } from '../../domain/model/World';
import { fail } from '../result';

export function endless(world: World): Result {
  if (world.phase !== Phase.Victory) return fail('La campagne n\'est pas encore gagnée.');
  world.continueEndless();
  return { ok: true };
}
