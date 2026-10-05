import { MAP_CROSSING } from '../../src/domain/catalog/map';
import { World } from '../../src/domain/model/World';
import type { Difficulty, MapDef } from '../../src/domain/model/types';

export function newWorld(difficulty: Difficulty = 'normal', seed = 42, map: MapDef = MAP_CROSSING): World {
  return new World({ map, difficulty, seed });
}

export function newDuelWorld(difficulty: Difficulty = 'normal', seed = 42, map: MapDef = MAP_CROSSING): World {
  return new World({ map, difficulty, seed, duel: true });
}

export function run(world: World, seconds: number): void {
  const ticks = Math.round(seconds * 60);
  for (let i = 0; i < ticks; i++) world.step();
}

/** Tue instantanément toutes les créatures en vie, via le moyen existant du moteur (`creepGone`). */
export function killAllCreeps(world: World): void {
  for (const c of world.creeps) {
    c.alive = false;
    world.creepGone(c);
  }
  world.creeps = world.creeps.filter((c) => c.alive);
}
