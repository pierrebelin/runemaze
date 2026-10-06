import { TOWERS } from '../../domain/catalog/towers';
import type { Command, Result } from '../../domain/model/types';
import type { World } from '../../domain/model/World';
import { builderTowers, upgradeOptions } from '../../domain/rules/builder';
import { upgradeCost } from '../../domain/rules/pricing';
import { fail } from '../result';
import { CommandType, GameEventType } from '../../domain/model/types';

export function upgrade(world: World, cmd: Extract<Command, { c: CommandType.Upgrade }>): Result {
  const t = world.towerById.get(cmd.tower);
  if (!t) return fail('Tour introuvable.');
  if (!upgradeOptions(t.def, builderTowers(world.builder, TOWERS)).includes(cmd.def)) return fail('Amélioration indisponible.');
  const to = TOWERS[cmd.def];
  const cost = upgradeCost(t.def, to);
  if (world.gold < cost) return fail(`Il faut ${cost} pièces d'or.`);
  world.gold -= cost;
  t.def = to;
  t.spent += cost;
  t.cooldown = Math.min(t.cooldown, 0.3);
  world.emit({ t: GameEventType.Upgraded, towerId: t.id });
  return { ok: true, id: t.id };
}
