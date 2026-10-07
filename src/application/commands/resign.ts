import type { Result } from '../../domain/model/types';
import { GameEventType, Phase } from '../../domain/model/types';
import type { World } from '../../domain/model/World';

/** Abandon : défaite immédiate, les vies restent telles quelles. */
export function resign(world: World): Result {
  world.phase = Phase.Defeat;
  world.emit({ t: GameEventType.Defeat });
  return { ok: true };
}
