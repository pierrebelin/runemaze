import type { World } from '../model/World';
import type { Creep } from '../model/types';
import { GameEventType } from '../model/types';
import { realigns } from '../rules/heading';
import { creepSpeed } from '../rules/speed';

export function updateMovement(world: World, dt: number): void {
  for (const c of world.creeps) {
    if (!c.alive || c.frozen > 0) continue;
    const speed = creepSpeed(c);
    if (c.def.air) moveAir(world, c, speed * dt);
    else moveGround(world, c, speed * dt);
  }
}

function moveAir(world: World, c: Creep, budget: number): void {
  while (budget > 0 && c.alive) {
    const wp = world.waypoints[c.leg];
    const dx = wp.x - c.x;
    const dy = wp.y - c.y;
    const d = Math.hypot(dx, dy);
    if (d <= budget) {
      c.x = wp.x;
      c.y = wp.y;
      budget -= d;
      if (!advanceLeg(world, c)) return;
    } else {
      c.x += (dx / d) * budget;
      c.y += (dy / d) * budget;
      budget = 0;
    }
  }
  const wp = world.waypoints[c.leg];
  c.remaining = Math.hypot(wp.x - c.x, wp.y - c.y) + world.airRest[c.leg];
}

function moveGround(world: World, c: Creep, budget: number): void {
  const g = world.grid;
  let guard = 8;
  while (budget > 0 && c.alive && guard-- > 0) {
    const txc = c.tx + 0.5;
    const tyc = c.ty + 0.5;
    const dx = txc - c.x;
    const dy = tyc - c.y;
    const d = Math.hypot(dx, dy);
    if (d <= budget) {
      c.x = txc;
      c.y = tyc;
      budget -= d;
      const cell = g.idx(c.tx, c.ty);
      const field = world.fields[c.leg];
      if (field.dist[cell] === 0) {
        if (!advanceLeg(world, c)) return;
        continue;
      }
      const nxt = field.next[cell];
      if (nxt < 0) return; // Aucun chemin : impossible en jeu normal (constructions validées).
      if (c.heading && realigns(c.heading, { x: g.cx(nxt) - c.tx, y: g.cy(nxt) - c.ty })) c.heading = undefined;
      c.tx = g.cx(nxt);
      c.ty = g.cy(nxt);
    } else {
      c.x += (dx / d) * budget;
      c.y += (dy / d) * budget;
      budget = 0;
    }
  }
  const field = world.fields[c.leg];
  const cell = g.idx(c.tx, c.ty);
  c.remaining = field.dist[cell] + Math.hypot(c.tx + 0.5 - c.x, c.ty + 0.5 - c.y) + world.legRest[c.leg];
}

/** Passe au tronçon suivant ; renvoie false si la créature a atteint la sortie. */
function advanceLeg(world: World, c: Creep): boolean {
  const lastLeg = world.fields.length - 1;
  if (c.leg < lastLeg) {
    c.leg++;
    c.heading = undefined;
    return true;
  }
  c.alive = false;
  const tally = world.stats.waves[c.wave];
  if (tally) tally.livesLost += Math.max(0, Math.min(c.def.leak, world.lives));
  world.stats.leaked++;
  world.creepGone(c);
  world.emit({ t: GameEventType.Leak, lives: c.def.leak, boss: !!c.def.boss });
  world.loseLives(c.def.leak);
  return false;
}
