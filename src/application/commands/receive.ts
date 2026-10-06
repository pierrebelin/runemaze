import type { Command, Result } from '../../domain/model/types';
import type { World } from '../../domain/model/World';
import { CREEPS } from '../../domain/catalog/creeps';
import { fail } from '../result';
import { CommandType } from '../../domain/model/types';

export function receive(world: World, cmd: Extract<Command, { c: CommandType.Receive }>): Result {
  if (!CREEPS[cmd.creep]?.send) return fail('Créature impossible à envoyer.');
  world.sends.push(cmd.creep);
  return { ok: true };
}
