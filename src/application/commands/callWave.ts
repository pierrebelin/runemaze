import type { Result } from '../../domain/model/types';
import type { World } from '../../domain/model/World';
import { launchWave } from '../../domain/systems/waves';

export function callWave(world: World): Result {
  const early = Math.floor(Math.max(0, world.nextWaveIn) * 0.5);
  if (early > 0) world.addGold(early);
  launchWave(world);
  return { ok: true };
}
