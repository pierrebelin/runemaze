import { bountyFor, CREEPS, waveAt } from '../../domain/catalog/creeps';
import type { World } from '../../domain/model/World';
import type { CreepDef } from '../../domain/model/types';
import { creepHp } from '../../domain/systems/waves';

export interface WaveBriefingGroup {
  creep: CreepDef;
  count: number;
  /** PV d'une créature du groupe. */
  hp: number;
  bounty: number;
}

export interface WaveBriefing {
  wave: number;
  groups: WaveBriefingGroup[];
}

export interface SendGroup {
  creep: CreepDef;
  count: number;
}

export function groupSends(creeps: string[]): SendGroup[] {
  // Map garde l'ordre d'insertion : premier achat en premier.
  const counts = new Map<string, number>();
  for (const id of creeps) counts.set(id, (counts.get(id) ?? 0) + 1);
  return [...counts].map(([id, count]) => ({ creep: CREEPS[id], count }));
}

/** Ce qui attend le joueur à la prochaine vague. */
export function waveBriefing(world: World, wave = world.wave + 1): WaveBriefing {
  const groups = waveAt(wave).groups
    .map((g) => {
      const creep = CREEPS[g.creep];
      return { creep, count: g.count, hp: creepHp(world, creep, wave), bounty: bountyFor(wave, creep) };
    })
    // Chef en premier ; tri stable, les autres groupes gardent leur ordre.
    .sort((a, b) => Number(!!b.creep.boss) - Number(!!a.creep.boss));
  return { wave, groups };
}
