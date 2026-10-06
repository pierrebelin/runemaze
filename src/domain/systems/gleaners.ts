import { GLEANER } from '../catalog/ether';
import { TICK, type World } from '../model/World';

/** Chaque glaneur produit 1 éther à chaque multiple de la période écoulé depuis son achat. */
export function updateGleaners(world: World): void {
  const period = Math.round(GLEANER.period / TICK);
  for (const boughtAt of world.gleaners) {
    const age = world.tick - boughtAt;
    if (age > 0 && age % period === 0) world.ether++;
  }
}
