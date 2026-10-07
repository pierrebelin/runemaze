import { MAP_CROSSING } from './maps';
import { World } from '../../src/domain/model/World';
import { dispatch } from '../../src/application/dispatch';
import { spawnCreep } from '../../src/domain/systems/waves';
import { CommandType } from '../../src/domain/model/types';
import type { Creep, Difficulty, MapDef, Tower } from '../../src/domain/model/types';

export function newWorld(difficulty: Difficulty = 'normal', seed = 42, map: MapDef = MAP_CROSSING, builder = 'bastion'): World {
  return new World({ map, difficulty, seed, builder });
}

export function newDuelWorld(difficulty: Difficulty = 'normal', seed = 42, map: MapDef = MAP_CROSSING, builder = 'bastion'): World {
  return new World({ map, difficulty, seed, duel: true, builder });
}

export function run(world: World, seconds: number): void {
  const ticks = Math.round(seconds * 60);
  for (let i = 0; i < ticks; i++) world.step();
}

/** Instants (w.time) de première apparition de chaque créature sur `seconds` secondes. */
export function observeSpawns(w: World, seconds: number): { id: string; time: number }[] {
  const seen = new Set<number>();
  const spawns: { id: string; time: number }[] = [];
  for (let i = 0; i < seconds * 60; i++) {
    w.step();
    for (const c of w.creeps) {
      if (!seen.has(c.id)) {
        seen.add(c.id);
        spawns.push({ id: c.def.id, time: w.time });
      }
    }
  }
  return spawns;
}

/** Tue instantanément toutes les créatures en vie, via le moyen existant du moteur (`creepGone`). */
export function killAllCreeps(world: World): void {
  for (const c of world.creeps) {
    c.alive = false;
    world.creepGone(c);
  }
  world.creeps = world.creeps.filter((c) => c.alive);
}

/** Bâtit un mur en (10, 8) puis l'améliore dans l'ordre des ids donnés ; renvoie la tour. */
export function buildTowerChain(world: World, chain: string[], x = 10, y = 8): Tower {
  world.gold = 100000;
  const built = dispatch(world, { c: CommandType.Build, def: 'wall', x, y }) as { ok: true; id: number };
  for (const def of chain) dispatch(world, { c: CommandType.Upgrade, tower: built.id, def });
  return world.towerById.get(built.id)!;
}

/** Fait apparaître une créature immobile (gelée), très résistante, à la position donnée. */
export function spawnDummy(world: World, x: number, y: number, air = false): Creep {
  const c = spawnCreep(world, 'rat', 0);
  c.x = x;
  c.y = y;
  c.hp = c.maxHp = 1e6;
  c.frozen = 1e6;
  if (air) c.def = { ...c.def, air: true };
  return c;
}
