import { TOWERS } from '../../domain/catalog/towers';
import type { Command, Result, Tower } from '../../domain/model/types';
import type { World } from '../../domain/model/World';
import { TERRAIN } from '../../domain/catalog/map';
import { crystalBonus } from '../../domain/rules/crystal';
import { canBuild, nextSteps } from '../queries/canBuild';
import { motion } from '../../domain/rules/heading';
import { CommandType, GameEventType } from '../../domain/model/types';

export function build(world: World, cmd: Extract<Command, { c: CommandType.Build }>): Result {
  const r = canBuild(world, cmd.def, cmd.x, cmd.y);
  if (!r.ok) return r;
  const def = TOWERS[cmd.def];
  const t: Tower = {
    id: world.id(), def, x: cmd.x, y: cmd.y, cx: cmd.x + 1, cy: cmd.y + 1,
    cooldown: 0.2, targetMode: 'first', spent: def.cost,
    kills: 0, damage: 0, aim: -Math.PI / 2, rangeBonus: crystalBonus(world.grid, world.grid.footprint(cmd.x, cmd.y), TERRAIN.crystal.range), ramp: 0, offerings: [], fate: 'standing',
  };
  const ground = world.creeps.filter((c) => c.alive && !c.def.air);
  const nextBefore = nextSteps(world, ground);
  world.gold -= def.cost;
  world.towers.push(t);
  world.towerById.set(t.id, t);
  world.stats.towers.set(t.id, t);
  for (const i of world.grid.footprint(t.x, t.y)) world.grid.tower[i] = t.id;
  world.refreshPaths();
  // Une créature déviée retient son cap d'avant la déviation (règle anti-demi-tour, voir `canBuild`).
  nextSteps(world, ground).forEach((next, k) => {
    const c = ground[k];
    const m = motion(c);
    if (next !== nextBefore[k] && !c.heading && (m.x !== 0 || m.y !== 0)) c.heading = m;
  });
  world.stats.towersBuilt++;
  world.emit({ t: GameEventType.Built, towerId: t.id, x: t.cx, y: t.cy });
  return { ok: true, id: t.id };
}
