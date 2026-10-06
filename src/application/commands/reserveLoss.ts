import type { Command, Result } from '../../domain/model/types';
import type { World } from '../../domain/model/World';
import type { CommandType } from '../../domain/model/types';

export function reserveLoss(world: World, cmd: Extract<Command, { c: CommandType.ReserveLoss }>): Result {
  world.loseLives(cmd.lives);
  return { ok: true };
}
