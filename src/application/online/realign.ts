import { dispatch } from '../dispatch';
import { CommandType } from '../../domain/model/types';
import { restore } from '../../domain/model/snapshot';
import type { World } from '../../domain/model/World';
import type { WorldSnapshot } from '../../domain/model/snapshot';

/** Recalage : reprend l'instantané serveur, rejoue les ordres du joueur postérieurs, avance jusqu'au tick courant. */
export function realign(snap: WorldSnapshot, ownLog: World['log'], untilTick: number): World {
  const world = restore(snap);
  // Les réceptions viennent du serveur : jamais rejouées, jamais comptées.
  const isOrder = (e: World['log'][number]) => e.cmd.c !== CommandType.Receive;
  const containedAtSnapTick = snap.log.filter((e) => e.tick === snap.tick && isOrder(e)).length;
  let seenAtSnapTick = 0;
  const toReplay = ownLog.filter((e) => {
    if (!isOrder(e)) return false;
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
