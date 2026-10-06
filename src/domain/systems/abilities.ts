import type { World } from '../model/World';
import { nearestTowers } from '../rules/breaker';
import { GameEventType, BreakerPhase } from '../model/types';

/** Capacités actives des créatures (soin du Chaman, etc). */
export function updateAbilities(world: World, dt: number): void {
  for (const c of world.creeps) {
    if (!c.alive || !c.def.heal || c.frozen > 0) continue;
    c.healTimer -= dt;
    if (c.healTimer > 1e-9) continue;
    c.healTimer += c.def.heal.every;
    const amount = c.maxHp * c.def.heal.pct;
    for (const other of world.creeps) {
      if (!other.alive || other === c) continue;
      const dx = other.x - c.x;
      const dy = other.y - c.y;
      if (Math.sqrt(dx * dx + dy * dy) > c.def.heal.radius) continue;
      other.hp = Math.min(other.maxHp, other.hp + amount);
    }
  }

  for (const c of world.creeps) {
    if (!c.alive || !c.def.breaker || !c.breaker) continue;
    if (c.frozen > 0) continue;
    c.breaker.timer -= dt;
    if (c.breaker.timer > 1e-9) continue;
    if (c.breaker.phase === BreakerPhase.Charge) {
      c.breaker.phase = BreakerPhase.Armed;
      c.breaker.timer = world.rng.range(0, c.def.breaker.armed);
    } else if (c.breaker.phase === BreakerPhase.Armed) {
      const targets = nearestTowers(world.towers, c.x, c.y, c.def.breaker.range);
      if (targets.length) {
        const t = targets.length > 1 ? targets[world.rng.int(targets.length)] : targets[0];
        t.fate = 'destroyed';
        world.removeTower(t);
        world.emit({ t: GameEventType.Destroyed, x: t.cx, y: t.cy });
      }
      c.breaker.phase = BreakerPhase.Cooldown;
      c.breaker.timer = c.def.breaker.cooldown;
    } else {
      c.breaker.phase = BreakerPhase.Charge;
      c.breaker.timer = c.def.breaker.charge;
    }
  }
}
