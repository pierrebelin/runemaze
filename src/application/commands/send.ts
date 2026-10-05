import type { Command, Result } from '../../domain/model/types';
import type { World } from '../../domain/model/World';
import { CREEPS } from '../../domain/catalog/creeps';
import { raiseIncome } from '../../domain/rules/income';
import { canLaunchNext } from '../../domain/systems/waves';
import { fail } from '../result';
import { CommandType } from '../../domain/model/types';

export function send(world: World, cmd: Extract<Command, { c: CommandType.Send }>): Result {
  if (!world.duel) return fail('L\'envoi n\'existe qu\'en duel.');
  const offer = CREEPS[cmd.creep]?.send;
  if (!offer) return fail('Créature impossible à envoyer.');
  if (!canLaunchNext(world)) return fail('Plus aucune vague à venir.');
  if (world.gold < offer.cost) return fail('Pas assez d\'or.');
  world.gold -= offer.cost;
  world.income = raiseIncome(world.income, offer.income, world.wave + 2);
  return { ok: true };
}
