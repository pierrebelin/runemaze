import { TOWERS } from '../../domain/catalog/towers';
import type { Command, Result, Tower } from '../../domain/model/types';
import type { World } from '../../domain/model/World';
import { canBuild } from '../queries/canBuild';
import { CommandType, GameEventType } from '../../domain/model/types';

export function build(world: World, cmd: Extract<Command, { c: CommandType.Build }>): Result {
  const r = canBuild(world, cmd.def, cmd.x, cmd.y);
  if (!r.ok) return r;
  const def = TOWERS[cmd.def];
  const t: Tower = {
    id: world.id(), def, x: cmd.x, y: cmd.y, cx: cmd.x + 1, cy: cmd.y + 1,
    cooldown: 0.2, targetMode: 'first', spent: def.cost,
    kills: 0, damage: 0, aim: -Math.PI / 2, fate: 'standing',
  };
  world.gold -= def.cost;
  world.towers.push(t);
  world.towerById.set(t.id, t);
  world.stats.towers.set(t.id, t);
  for (const i of world.grid.footprint(t.x, t.y)) world.grid.tower[i] = t.id;
  world.refreshPaths();
  world.stats.towersBuilt++;
  world.emit({ t: GameEventType.Built, towerId: t.id, x: t.cx, y: t.cy });
  return { ok: true, id: t.id };
}
