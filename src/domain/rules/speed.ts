import type { Creep } from '../model/types';

/** Vitesse effective d'une créature : sprint, ralentissement, fureur, puis bonus du sol (1 = neutre). */
export function creepSpeed(c: Pick<Creep, 'def' | 'hp' | 'maxHp' | 'slowPct' | 'sprint'>, ground = 1): number {
  let speed = c.def.speed;
  if (c.sprint > 0) speed *= c.def.sprint!.mult;
  if (c.def.fury && c.hp < c.def.fury.below * c.maxHp) speed *= c.def.fury.mult;
  return speed * (1 - c.slowPct) * ground;
}
