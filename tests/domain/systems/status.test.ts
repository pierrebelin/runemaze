import { describe, expect, it } from 'vitest';
import { updateMovement } from '../../../src/domain/systems/movement';
import { applyOnHit, updateStatuses } from '../../../src/domain/systems/status';
import { hitCreep } from '../../../src/domain/systems/combat';
import { spawnCreep } from '../../../src/domain/systems/waves';
import { dispatch } from '../../../src/application/dispatch';
import type { AttackDef } from '../../../src/domain/model/types';
import { TOWERS } from '../../../src/domain/catalog/towers';
import { newWorld } from '../../support/helpers';
import { CommandType } from '../../../src/domain/model/types';

const PLAIN_ATTACK: AttackDef = {
  type: 'normal',
  dmg: [10, 10],
  cooldown: 1,
  range: 1,
  projectileSpeed: 0,
  targets: 'ground',
};

const POISON_ATTACK: AttackDef = {
  type: 'normal',
  dmg: [0, 0],
  cooldown: 1,
  range: 1,
  projectileSpeed: 0,
  targets: 'ground',
  poison: { dps: 5, duration: 2, maxStacks: 1 },
};

const FREEZE_ATTACK: AttackDef = {
  type: 'magic',
  dmg: [0, 0],
  cooldown: 1,
  range: 1,
  projectileSpeed: 0,
  targets: 'ground',
  freeze: { chance: 1, duration: 0.6, guard: 1.5 },
};

const TICK = 1 / 60;

function advance(world: ReturnType<typeof newWorld>, seconds: number): void {
  const ticks = Math.round(seconds * 60);
  for (let i = 0; i < ticks; i++) {
    updateStatuses(world, TICK);
    updateMovement(world, TICK);
  }
}

describe('status', () => {
  it('[RM-07] immobilise la créature pendant la durée du gel quand la touche gèle', () => {
    const w = newWorld();
    const c = spawnCreep(w, 'rat', 0);
    const remaining0 = c.remaining;
    applyOnHit(w, c, FREEZE_ATTACK, 1, 'frost');

    advance(w, 0.3);

    expect(c.remaining).toBe(remaining0);
  });

  it('[RM-07] rend sa vitesse à la créature quand le gel expire', () => {
    const w = newWorld();
    const c = spawnCreep(w, 'rat', 0);
    const remaining0 = c.remaining;
    applyOnHit(w, c, FREEZE_ATTACK, 1, 'frost');

    advance(w, 0.7);

    expect(c.remaining).toBeLessThan(remaining0);
  });

  it('[RM-07] ne prolonge pas le gel quand une nouvelle touche arrive pendant le gel', () => {
    const w = newWorld();
    const c = spawnCreep(w, 'rat', 0);
    const remaining0 = c.remaining;
    applyOnHit(w, c, FREEZE_ATTACK, 1, 'frost');

    advance(w, 0.4);
    applyOnHit(w, c, FREEZE_ATTACK, 1, 'frost');
    advance(w, 0.3);

    expect(c.remaining).toBeLessThan(remaining0);
  });

  it('[RM-08] refuse de regeler la créature quand le répit n’est pas écoulé', () => {
    const w = newWorld();
    const c = spawnCreep(w, 'rat', 0);
    applyOnHit(w, c, FREEZE_ATTACK, 1, 'frost');

    advance(w, 0.7);
    const remainingAtThaw = c.remaining;

    applyOnHit(w, c, FREEZE_ATTACK, 1, 'frost');
    advance(w, 0.3);

    expect(c.remaining).toBeLessThan(remainingAtThaw);
  });

  it('[RM-08] regèle la créature quand le répit est écoulé', () => {
    const w = newWorld();
    const c = spawnCreep(w, 'rat', 0);
    applyOnHit(w, c, FREEZE_ATTACK, 1, 'frost');

    advance(w, 0.7);
    advance(w, 1.7);
    const remainingAtGuardEnd = c.remaining;

    applyOnHit(w, c, FREEZE_ATTACK, 1, 'frost');
    advance(w, 0.2);

    expect(c.remaining).toBe(remainingAtGuardEnd);
  });

  it('[RM-09] ne gèle jamais un chef', () => {
    const w = newWorld();
    const c = spawnCreep(w, 'ogre', 0);
    advance(w, 1 / 60);
    const remaining0 = c.remaining;
    applyOnHit(w, c, FREEZE_ATTACK, 1, 'frost');

    advance(w, 0.3);

    expect(c.remaining).toBeLessThan(remaining0);
    expect(remaining0 - c.remaining).toBeGreaterThan(0.01);
  });

  it('[RM-09] ne gèle jamais une créature immunisée à la magie', () => {
    const w = newWorld();
    const c = spawnCreep(w, 'wraith', 0);
    advance(w, 1 / 60);
    const remaining0 = c.remaining;
    applyOnHit(w, c, FREEZE_ATTACK, 1, 'frost');

    advance(w, 0.3);

    expect(c.remaining).toBeLessThan(remaining0);
    expect(remaining0 - c.remaining).toBeGreaterThan(0.01);
  });

  it('[RM-10] laisse la suite aléatoire intacte quand l’attaque ne gèle pas', () => {
    const NO_FREEZE_ATTACK: AttackDef = { ...FREEZE_ATTACK, freeze: undefined };

    const wOrdinaireTemoin = newWorld();
    spawnCreep(wOrdinaireTemoin, 'rat', 0);
    const wOrdinaire = newWorld();
    const cOrdinaire = spawnCreep(wOrdinaire, 'rat', 0);
    applyOnHit(wOrdinaire, cOrdinaire, NO_FREEZE_ATTACK, 1, 'frost');
    expect(wOrdinaire.rng.next()).toBe(wOrdinaireTemoin.rng.next());

    const wBossTemoin = newWorld();
    spawnCreep(wBossTemoin, 'ogre', 0);
    const wBoss = newWorld();
    const cBoss = spawnCreep(wBoss, 'ogre', 0);
    applyOnHit(wBoss, cBoss, FREEZE_ATTACK, 1, 'frost');
    expect(wBoss.rng.next()).toBe(wBossTemoin.rng.next());

    const wImmuneTemoin = newWorld();
    spawnCreep(wImmuneTemoin, 'wraith', 0);
    const wImmune = newWorld();
    const cImmune = spawnCreep(wImmune, 'wraith', 0);
    applyOnHit(wImmune, cImmune, FREEZE_ATTACK, 1, 'frost');
    expect(wImmune.rng.next()).toBe(wImmuneTemoin.rng.next());
  });

  it('[RM-02] crédite la tour vendue des dégâts de son poison encore actif', () => {
    const w = newWorld();
    const built = dispatch(w, { c: CommandType.Build, def: 'archer', x: 10, y: 8 }) as { ok: true; id: number };
    const t = w.towerById.get(built.id)!;
    const c = spawnCreep(w, 'rat', 0);
    applyOnHit(w, c, POISON_ATTACK, t.id, t.def.id);

    dispatch(w, { c: CommandType.Sell, tower: t.id });
    updateStatuses(w, 1);

    expect(w.towerById.has(t.id)).toBe(false);
    expect(w.stats.towers.get(t.id)!.damage).toBeCloseTo(5);
  });

  it('[RM-02] crédite la tour vendue de l’élimination faite par son poison', () => {
    const w = newWorld();
    const built = dispatch(w, { c: CommandType.Build, def: 'archer', x: 10, y: 8 }) as { ok: true; id: number };
    const t = w.towerById.get(built.id)!;
    const c = spawnCreep(w, 'rat', 0);
    c.hp = 3;
    applyOnHit(w, c, POISON_ATTACK, t.id, t.def.id);

    dispatch(w, { c: CommandType.Sell, tower: t.id });
    updateStatuses(w, 1);

    expect(w.stats.towers.get(t.id)!.kills).toBe(1);
  });

  it('[RM-01] ne compte pas le surplus de dégâts au-delà des PV restants', () => {
    const w = newWorld();
    const built = dispatch(w, { c: CommandType.Build, def: 'archer', x: 10, y: 8 }) as { ok: true; id: number };
    const t = w.towerById.get(built.id)!;
    const c = spawnCreep(w, 'rat', 0);
    c.hp = 2;
    applyOnHit(w, c, POISON_ATTACK, t.id, t.def.id);

    dispatch(w, { c: CommandType.Sell, tower: t.id });
    updateStatuses(w, 1);

    expect(w.stats.towers.get(t.id)!.damage).toBe(2);
  });

  it('[RM-08] une créature étourdie ne déclenche pas son sprint quand elle est touchée', () => {
    const w = newWorld();
    const c = spawnCreep(w, 'rat', 0);
    c.def = { ...c.def, sprint: { mult: 2, duration: 1, cooldown: 4 } };
    c.frozen = 1;

    hitCreep(w, 1, 'archer', PLAIN_ATTACK, c, 10);

    expect(c.sprint).toBe(0);
  });

  it('[RM-08] le coup qui étourdit ne déclenche pas le sprint', () => {
    const w = newWorld();
    const c = spawnCreep(w, 'rat', 0);
    c.def = { ...c.def, sprint: { mult: 2, duration: 1, cooldown: 4 } };
    expect(c.frozen).toBe(0);

    hitCreep(w, 1, 'gong', TOWERS.gong.attack!, c, 10);

    expect(c.frozen).toBeGreaterThan(0);
    expect(c.sprint).toBe(0);
  });

  it('[RM-12] ne relance pas le sprint quand il se recharge encore 4 s après sa fin', () => {
    const w = newWorld();
    const c = spawnCreep(w, 'rat', 0);
    c.def = { ...c.def, sprint: { mult: 2, duration: 1, cooldown: 4 } };

    hitCreep(w, 1, 'archer', PLAIN_ATTACK, c, 0);
    advance(w, 1);

    expect(c.sprint).toBe(0);
    expect(c.sprintCooldown).toBeCloseTo(4, 1);

    hitCreep(w, 1, 'archer', PLAIN_ATTACK, c, 0);

    expect(c.sprint).toBe(0);

    advance(w, 4);

    hitCreep(w, 1, 'archer', PLAIN_ATTACK, c, 0);

    expect(c.sprint).toBe(1);
  });

  it('[RM-01] l\'Hydre regagne 0,5 % de ses PV max en une seconde quand elle est blessée', () => {
    const w = newWorld();
    const c = spawnCreep(w, 'hydra', 0);
    c.hp = c.maxHp / 2;
    const hp0 = c.hp;

    advance(w, 1);

    expect((c.hp - hp0) / c.maxHp).toBeCloseTo(0.005, 5);
  });

  it('[RM-01] l\'Hydre ne dépasse jamais ses PV max quand elle régénère à pleine vie', () => {
    const w = newWorld();
    const c = spawnCreep(w, 'hydra', 0);
    c.hp = c.maxHp;

    advance(w, 1);

    expect(c.hp).toBe(c.maxHp);
  });
});
