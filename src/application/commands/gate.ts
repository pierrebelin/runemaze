import type { Command, Result } from '../../domain/model/types';
import type { World } from '../../domain/model/World';
import { GATE } from '../../domain/catalog/ether';
import { gateLevelCost, gateLevelIncome } from '../../domain/rules/pricing';
import { fail } from '../result';
import { CommandType } from '../../domain/model/types';

export function gate(world: World, cmd: Extract<Command, { c: CommandType.Gate }>): Result {
  if (!world.duel) return fail('La Porte ne s\'améliore qu\'en duel.');
  const next = world.gate[cmd.upgrade] + 1;
  if (next > GATE[cmd.upgrade].maxLevel) return fail('Niveau maximal atteint.');
  const cost = gateLevelCost(next);
  if (world.ether < cost) return fail('Pas assez d\'éther.');
  world.ether -= cost;
  world.income += gateLevelIncome(next);
  world.gate[cmd.upgrade] = next;
  return { ok: true };
}
