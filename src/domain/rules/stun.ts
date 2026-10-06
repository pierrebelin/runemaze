import type { CreepDef } from '../model/types';

/** Durée d'étourdissement effective : les immunisés à la magie y échappent, les boss le subissent à moitié. */
export function stunDuration(duration: number, def: CreepDef): number {
  if (def.magicImmune) return 0;
  return def.boss ? duration / 2 : duration;
}
