import { damageMultiplier } from '../rules/Damage';
import { auraBonus } from '../rules/aura';
import { attackCooldown, rampBonus } from '../rules/attackSpeed';
import type { World } from '../model/World';
import type { AttackDef, AttackType, Creep, TargetMode, Tower } from '../model/types';
import { applyOnHit } from './status';
import { spawnOffspring } from './waves';
import { GameEventType } from '../model/types';

export function canTarget(a: AttackDef, c: Creep): boolean {
  if (!c.alive) return false;
  if (a.targets === 'both') return true;
  return a.targets === 'air' ? !!c.def.air : !c.def.air;
}

function score(mode: TargetMode, t: Pick<Tower, 'cx' | 'cy'>, c: Creep): number {
  switch (mode) {
    case 'first': return c.remaining;
    case 'last': return -c.remaining;
    case 'strong': return -c.hp;
    case 'weak': return c.hp;
    case 'close': return Math.hypot(c.x - t.cx, c.y - t.cy);
  }
}

function isTargetInRange(t: Pick<Tower, 'cx' | 'cy'>, a: AttackDef, c: Creep): boolean {
  return canTarget(a, c) && Math.hypot(c.x - t.cx, c.y - t.cy) <= a.range + c.def.radius;
}

export function acquireTargets(world: World, t: Pick<Tower, 'cx' | 'cy' | 'targetMode'>, a: AttackDef, n: number): Creep[] {
  const inRange: Creep[] = [];
  for (const c of world.creeps) {
    if (isTargetInRange(t, a, c)) inRange.push(c);
  }
  inRange.sort((p, q) => score(t.targetMode, t, p) - score(t.targetMode, t, q) || p.id - q.id);
  return inRange.slice(0, n);
}

function hasTargetInRange(world: World, t: Tower, a: AttackDef): boolean {
  for (const c of world.creeps) {
    if (isTargetInRange(t, a, c)) return true;
  }
  return false;
}

function updateRamp(world: World, t: Tower, a: AttackDef, dt: number): void {
  if (world.creeps.length === 0) t.ramp = 0;
  else if (hasTargetInRange(world, t, a)) t.ramp += dt;
}

export function updateCombat(world: World, dt: number): void {
  for (const t of world.towers) {
    const a = t.def.attack;
    if (!a) continue;
    if (a.rampUp) updateRamp(world, t, a, dt);
    t.cooldown -= dt;
    if (t.cooldown > 0) continue;
    const targets = acquireTargets(world, t, a, a.area ? Infinity : a.multishot ?? 1);
    if (targets.length === 0) {
      t.cooldown = 0;
      continue;
    }
    const bonus = auraBonus(t, world.towers);
    t.cooldown = attackCooldown(a.cooldown, bonus.attackSpeed + (a.rampUp ? rampBonus(t.ramp, a.rampUp.max) : 0));
    t.aim = Math.atan2(targets[0].y - t.cy, targets[0].x - t.cx);
    world.emit({ t: GameEventType.Fire, towerId: t.id, family: t.def.family });
    for (const target of targets) {
      const roll = world.rng.range(a.dmg[0], a.dmg[1]);
      const crit = !!a.crit && world.rng.next() < a.crit.chance;
      const dmg = (crit ? roll * a.crit!.mult : roll) * (1 + bonus.damage);
      if (a.projectileSpeed === 0) {
        if (a.chain) fireChain(world, t, a, target, dmg);
        else if (a.area) hitCreep(world, t.id, t.def.id, a, target, dmg);
        else {
          hitCreep(world, t.id, t.def.id, a, target, dmg);
          world.emit({ t: GameEventType.Chain, points: [{ x: t.cx, y: t.cy - 0.6 }, { x: target.x, y: target.y }] });
        }
      } else {
        world.projectiles.push({
          id: world.id(), towerId: t.id, attack: a, defId: t.def.id, family: t.def.family,
          x: t.cx, y: t.cy - 0.5, sx: t.cx, sy: t.cy - 0.5,
          targetId: target.id, tx: target.x, ty: target.y, dmgRoll: dmg, crit, alive: true,
        });
      }
    }
    if (a.area) world.emit({ t: GameEventType.Hit, x: t.cx, y: t.cy, family: t.def.family, splash: a.range, crit: false, dmg: 0 });
  }
}

function fireChain(world: World, t: Tower, a: AttackDef, first: Creep, dmg: number): void {
  const chain = a.chain!;
  const hit = new Set<number>();
  const points = [{ x: t.cx, y: t.cy - 0.6 }];
  let cur: Creep | undefined = first;
  let d = dmg;
  for (let i = 0; i < chain.bounces && cur; i++) {
    hit.add(cur.id);
    points.push({ x: cur.x, y: cur.y });
    hitCreep(world, t.id, t.def.id, a, cur, d);
    d *= chain.decay;
    const from: Creep = cur;
    let best: Creep | undefined;
    let bestD = chain.range;
    for (const c of world.creeps) {
      if (hit.has(c.id) || !canTarget(a, c)) continue;
      const dd = Math.hypot(c.x - from.x, c.y - from.y);
      if (dd <= bestD) {
        bestD = dd;
        best = c;
      }
    }
    cur = best;
  }
  world.emit({ t: GameEventType.Chain, points });
}

export function updateProjectiles(world: World, dt: number): void {
  for (const p of world.projectiles) {
    if (!p.alive) continue;
    const target = world.creeps.find((c) => c.id === p.targetId && c.alive);
    if (target) {
      p.tx = target.x;
      p.ty = target.y;
    }
    const dx = p.tx - p.x;
    const dy = p.ty - p.y;
    const d = Math.hypot(dx, dy);
    const step = p.attack.projectileSpeed * dt;
    if (d > step) {
      p.x += (dx / d) * step;
      p.y += (dy / d) * step;
      continue;
    }
    p.alive = false;
    p.x = p.tx;
    p.y = p.ty;
    const a = p.attack;
    if (a.splash) {
      for (const c of world.creeps) {
        if (!canTarget(a, c)) continue;
        const dist = Math.hypot(c.x - p.x, c.y - p.y);
        if (dist > a.splash.radius + c.def.radius) continue;
        const fall = c === target ? 1 : 1 - a.splash.falloff * Math.min(1, dist / a.splash.radius);
        hitCreep(world, p.towerId, p.defId, a, c, p.dmgRoll * fall);
      }
    } else if (target) {
      hitCreep(world, p.towerId, p.defId, a, target, p.dmgRoll);
    }
    world.emit({ t: GameEventType.Hit, x: p.x, y: p.y, family: p.family, splash: a.splash?.radius ?? 0, crit: p.crit, dmg: Math.round(p.dmgRoll) });
  }
}

export function hitCreep(world: World, towerId: number, defId: string, a: AttackDef, c: Creep, raw: number): void {
  if (c.shield > 0) {
    c.shield--;
    return;
  }
  applyOnHit(world, c, a, towerId, defId);
  if (c.def.sprint && c.frozen <= 0 && c.sprint <= 0 && c.sprintCooldown <= 0) c.sprint = c.def.sprint.duration;
  applyDamage(world, c, raw, a.type, towerId, false);
}

export function applyDamage(world: World, c: Creep, raw: number, type: AttackType, towerId: number, ignoreArmorValue: boolean): number {
  if (!c.alive) return 0;
  const dmg = raw * damageMultiplier(type, c.def, c.shred, ignoreArmorValue);
  if (dmg <= 0) return 0;
  c.hp -= dmg;
  if (!ignoreArmorValue) c.hitFlash = 0.08;
  const tower = world.stats.towers.get(towerId);
  if (tower) tower.damage += Math.min(dmg, dmg + c.hp);
  if (c.def.brood) {
    // Seuils décroissants : dès qu'un seuil n'est pas franchi, les suivants (plus bas) non plus.
    for (let i = c.brood; i < c.def.brood.below.length && c.hp < c.def.brood.below[i] * c.maxHp; i++) {
      spawnOffspring(world, c, c.def.brood.creep, c.def.brood.count);
      c.brood++;
    }
  }
  if (c.hp <= 0) {
    c.alive = false;
    c.hp = 0;
    world.addGold(c.bounty);
    world.stats.kills++;
    if (tower) tower.kills++;
    world.creepGone(c);
    if (c.def.split) spawnOffspring(world, c, c.def.split.creep, c.def.split.count);
    world.emit({ t: GameEventType.Kill, x: c.x, y: c.y, bounty: c.bounty, creepId: c.id, boss: !!c.def.boss });
  }
  return dmg;
}
