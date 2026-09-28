import { dispatch } from '../dispatch';
import { restore } from '../../domain/model/snapshot';
import type { World } from '../../domain/model/World';
import type { WorldSnapshot } from '../../domain/model/snapshot';

/** Recalage : reprend l'instantané serveur, rejoue les ordres du joueur postérieurs, avance jusqu'au tick courant. */
export function realign(snap: WorldSnapshot, ownLog: World['log'], untilTick: number): World {
  const world = restore(snap);
  const containedAtSnapTick = snap.log.filter((e) => e.tick === snap.tick).length;
  let seenAtSnapTick = 0;
  const toReplay = ownLog.filter((e) => {
    if (e.tick > snap.tick) return true;
    if (e.tick === snap.tick) {
      seenAtSnapTick++;
      return seenAtSnapTick > containedAtSnapTick;
    }
    return false;
  });

  for (const entry of toReplay) {
    while (world.tick < entry.tick && !world.isOver()) {
      world.step();
    }
    dispatch(world, entry.cmd);
  }

  while (world.tick < untilTick && !world.isOver()) {
    world.step();
  }

  world.drainEvents();
  return world;
}
