import { clearBonus } from '../../domain/catalog/creeps';
import type { World } from '../../domain/model/World';
import { waveReward } from '../../domain/rules/waveReward';
import type { WaveReward } from '../../domain/rules/waveReward';

/** Gain de la plus ancienne vague en cours (sinon la prochaine), sur l'or actuel. */
export function goldForecast(world: World): WaveReward {
  const wave = world.pending.size > 0 ? Math.min(...world.pending.keys()) : world.wave + 1;
  return waveReward(clearBonus(wave), wave, world.gold, world.income, world.duel);
}
