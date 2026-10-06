import type { World } from '../model/World';
import type { AttackDef, Creep } from '../model/types';
import { applyDamage } from './combat';
import { stunDuration } from '../rules/stun';

/** Poison, ralentissement, corrosion d'armure et régénération. */
export function updateStatuses(world: World, dt: number): void {
  for (const c of world.creeps) {
    if (!c.alive) continue;
    if (c.hitFlash > 0) c.hitFlash -= dt;
    if (c.slowTimer > 0) {
      c.slowTimer -= dt;
      if (c.slowTimer <= 0) c.slowPct = 0;
    }
    if (c.shredTimer > 0) {
      c.shredTimer -= dt;
      if (c.shredTimer <= 0) c.shred = 0;
    }
    if (c.frozen > 0) {
      c.frozen -= dt;
    } else if (c.freezeGuard > 0) {
      c.freezeGuard -= dt;
    }
    if (c.sprint > 0) {
      c.sprint -= dt;
      if (c.sprint <= 0) {
        c.sprint = 0;
        c.sprintCooldown = c.def.sprint!.cooldown;
      }
    } else if (c.sprintCooldown > 0) {
      c.sprintCooldown -= dt;
      if (c.sprintCooldown < 1e-9) c.sprintCooldown = 0;
    }
    if (c.def.regen) c.hp = Math.min(c.maxHp, c.hp + c.maxHp * c.def.regen * dt);
    for (const p of c.poisons) {
      p.t -= dt;
      if (!c.alive) break;
      applyDamage(world, c, p.dps * dt, 'normal', p.towerId, true);
    }
    c.poisons = c.poisons.filter((p) => p.t > 0);
  }
}

export function applyOnHit(world: World, c: Creep, a: AttackDef, towerId: number, defId: string): void {
  if (!c.alive) return;
  const canFreeze = !c.def.boss && !c.def.magicImmune && c.frozen <= 0 && c.freezeGuard <= 0;
  if (a.freeze && canFreeze && world.rng.next() < a.freeze.chance) {
    c.frozen = a.freeze.duration;
    c.freezeGuard = a.freeze.guard;
  }
  if (a.stun) c.frozen = Math.max(c.frozen, stunDuration(a.stun.duration, c.def));
  if (a.slow && !c.def.magicImmune) {
    if (a.slow.pct >= c.slowPct) {
      c.slowPct = a.slow.pct;
      c.slowTimer = Math.max(c.slowTimer, a.slow.duration);
    }
  }
  if (a.armorShred && a.armorShred.amount >= c.shred) {
    c.shred = a.armorShred.amount;
    c.shredTimer = Math.max(c.shredTimer, a.armorShred.duration);
  }
  if (a.poison) {
    const mine = c.poisons.filter((p) => p.defId === defId);
    if (mine.length < a.poison.maxStacks) {
      c.poisons.push({ dps: a.poison.dps, t: a.poison.duration, towerId, defId });
    } else {
      // Au maximum de cumuls : on rafraîchit la dose la plus ancienne.
      let oldest = mine[0];
      for (const p of mine) if (p.t < oldest.t) oldest = p;
      oldest.t = a.poison.duration;
      oldest.towerId = towerId;
    }
  }
}
