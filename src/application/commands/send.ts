import type { Command, Result } from '../../domain/model/types';
import type { World } from '../../domain/model/World';
import { CREEPS } from '../../domain/catalog/creeps';
import { fail } from '../result';
import { CommandType } from '../../domain/model/types';

export function send(world: World, cmd: Extract<Command, { c: CommandType.Send }>): Result {
  if (!world.duel) return fail('L\'envoi n\'existe qu\'en duel.');
  const offer = CREEPS[cmd.creep]?.send;
  if (!offer) return fail('Créature impossible à envoyer.');
  if (world.ether < offer.cost) return fail('Pas assez d\'éther.');
  world.ether -= offer.cost;
  world.income += offer.income;
  return { ok: true };
}
