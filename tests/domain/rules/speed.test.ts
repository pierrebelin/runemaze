import { describe, expect, it } from 'vitest';
import { creepSpeed } from '../../../src/domain/rules/speed';
import { CREEPS } from '../../../src/domain/catalog/creeps';

const RUNNER_DEF = { ...CREEPS.wolf, sprint: { mult: 2, duration: 1, cooldown: 4 } };

describe('creepSpeed', () => {
  it('[RM-12] double la vitesse pendant le sprint', () => {
    const c = { def: RUNNER_DEF, hp: 10, maxHp: 10, slowPct: 0, sprint: 0.5 };

    expect(creepSpeed(c)).toBe(RUNNER_DEF.speed * 2);
  });

  it('[RM-12] applique le ralentissement à la vitesse doublée', () => {
    const c = { def: RUNNER_DEF, hp: 10, maxHp: 10, slowPct: 0.3, sprint: 0.5 };

    expect(creepSpeed(c)).toBeCloseTo(RUNNER_DEF.speed * 2 * 0.7, 6);
  });

  it("[RM-13] multiplie la vitesse par 1,5 quand l'Ogre est sous 50 % de ses PV max", () => {
    const c = { def: CREEPS.ogre, hp: 49, maxHp: 100, slowPct: 0, sprint: 0 };

    expect(creepSpeed(c)).toBeCloseTo(CREEPS.ogre.speed * 1.5, 6);
  });

  it("[RM-13] rend la vitesse normale quand l'Ogre repasse à 50 % ou plus", () => {
    const c = { def: CREEPS.ogre, hp: 49, maxHp: 100, slowPct: 0, sprint: 0 };
    expect(creepSpeed(c)).toBeCloseTo(CREEPS.ogre.speed * 1.5, 6);

    c.hp = 50;
    expect(creepSpeed(c)).toBeCloseTo(CREEPS.ogre.speed, 6);
  });

  it('[RM-03] vaut 2,24 quand une créature de vitesse 2 ralentie de 20 % est sur la glace', () => {
    const c = { def: { ...CREEPS.wolf, speed: 2 }, hp: 10, maxHp: 10, slowPct: 0.2, sprint: 0 };

    expect(creepSpeed(c, 1.4)).toBeCloseTo(2.24, 6);
  });

  it('[RM-03] multiplie le sprint et la fureur par le bonus de glace', () => {
    const sprinting = { def: RUNNER_DEF, hp: 10, maxHp: 10, slowPct: 0, sprint: 0.5 };
    const furious = { def: CREEPS.ogre, hp: 49, maxHp: 100, slowPct: 0, sprint: 0 };

    expect(creepSpeed(sprinting, 1.4)).toBeCloseTo(creepSpeed(sprinting) * 1.4, 6);
    expect(creepSpeed(furious, 1.4)).toBeCloseTo(creepSpeed(furious) * 1.4, 6);
  });
});
