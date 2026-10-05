import { bountyFor, CREEPS, waveAt } from '../../domain/catalog/creeps';
import type { World } from '../../domain/model/World';
import type { CreepDef } from '../../domain/model/types';
import { canLaunchNext, creepHp } from '../../domain/systems/waves';

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
  /** Envois reçus de l'adversaire, en approche. */
  incoming: number;
}

/** Ce qui attend le joueur à la prochaine vague, ou null s'il n'y en a plus. */
export function waveBriefing(world: World): WaveBriefing | null {
  if (!canLaunchNext(world)) return null;
  const wave = world.wave + 1;
  const groups = waveAt(wave).groups
    .map((g) => {
      const creep = CREEPS[g.creep];
      return { creep, count: g.count, hp: creepHp(world, creep, wave), bounty: bountyFor(wave, creep) };
    })
    // Chef en premier ; tri stable, les autres groupes gardent leur ordre.
    .sort((a, b) => Number(!!b.creep.boss) - Number(!!a.creep.boss));
  return { wave, groups, incoming: world.sends.length };
}
