import { describe, expect, it } from 'vitest';
import { updateEmbers } from '../../../src/domain/systems/embers';
import { damageMultiplier } from '../../../src/domain/rules/Damage';
import type { Ember } from '../../../src/domain/model/types';
import type { World } from '../../../src/domain/model/World';
import { buildTowerChain, newWorld, run, spawnDummy } from '../../support/helpers';

/** Pose à la main une flaque de `seconds` s au point donné. */
function putEmber(w: World, x: number, y: number, over: Partial<Ember> = {}, seconds = 3): Ember {
  const e: Ember = { id: w.id(), towerId: 1, x, y, radius: 1, dps: 6, expires: w.tick + Math.round(seconds * 60), ...over };
  w.embers.push(e);
  return e;
}

describe('embers', () => {
  it('[RM-02] retire 6 PV par seconde à une créature au sol dans la flaque d\'un Brasero', () => {
    const w = newWorld('normal', 42, undefined, 'pyromancers');
    const t = buildTowerChain(w, ['brazier']);
    const c = spawnDummy(w, t.cx + 2, t.cy);

    // Vrai tir : on avance jusqu'à l'impact du projectile (borne 3 s).
    for (let i = 0; i < 180 && w.embers.length === 0; i++) w.step();

    expect(w.embers).toHaveLength(1);
    expect(w.embers[0]).toMatchObject({ towerId: t.id, x: c.x, y: c.y, radius: 1, dps: 6 });

    const hp0 = c.hp;
    run(w, 1);

    expect(hp0 - c.hp).toBeCloseTo(6 * damageMultiplier('normal', c.def, 0, true), 0);
  });

  it('[RM-02] épargne les volants au-dessus d\'une flaque', () => {
    const w = newWorld();
    const flyer = spawnDummy(w, 5, 5, true);
    const walker = spawnDummy(w, 5.2, 5);
    putEmber(w, 5, 5);

    run(w, 1);

    expect(walker.hp).toBeLessThan(walker.maxHp);
    expect(flyer.hp).toBe(flyer.maxHp);
  });

  it('[RM-02] n\'applique que la plus forte quand deux flaques se chevauchent', () => {
    const w = newWorld();
    const c = spawnDummy(w, 5, 5);
    putEmber(w, 5, 5, { dps: 6 });
    putEmber(w, 5.2, 5, { dps: 16 });

    run(w, 1);

    expect(c.maxHp - c.hp).toBeCloseTo(16 * damageMultiplier('normal', c.def, 0, true), 0);
  });

  it('[RM-02] la flaque disparaît au bout de sa durée', () => {
    const w = newWorld();
    const c = spawnDummy(w, 5, 5);
    putEmber(w, 5, 5, {}, 3);

    run(w, 4);

    expect(w.embers).toHaveLength(0);
    expect(c.maxHp - c.hp).toBeCloseTo(3 * 6 * damageMultiplier('normal', c.def, 0, true), 2);
  });

  it('[RM-02] Vapeur ralentit de 35 % la créature dans sa flaque', () => {
    const w = newWorld();
    const dedans = spawnDummy(w, 5, 5);
    const dehors = spawnDummy(w, 12, 12);
    putEmber(w, 5, 5, { radius: 1.5, dps: 12, slow: { pct: 0.35, duration: 0.5 } });

    run(w, 0.1);

    expect(dedans.slowPct).toBe(0.35);
    expect(dehors.slowPct).toBe(0);
  });

  it('[RM-02] Plasma laisse une flaque sous chaque cible au sol touchée par le rebond', () => {
    const w = newWorld('normal', 42, undefined, 'pyromancers');
    const t = buildTowerChain(w, ['brazier', 'blaze', 'plasma']);
    const a = spawnDummy(w, t.cx + 2, t.cy);
    const b = spawnDummy(w, t.cx + 3, t.cy);
    spawnDummy(w, t.cx + 2, t.cy + 1.5, true);

    // Le rebond est instantané : on s'arrête au premier tir (borne 3 s).
    for (let i = 0; i < 180 && w.embers.length === 0; i++) w.step();

    expect(w.embers).toHaveLength(2);
    const sorted = [...w.embers].sort((p, q) => p.x - q.x);
    expect(sorted.map((e) => [e.x, e.y])).toEqual([[a.x, a.y], [b.x, b.y]]);
    for (const e of sorted) expect(e).toMatchObject({ towerId: t.id, radius: 1, dps: 10 });
  });

  it('[RM-02] donne la mort par la flaque à la tour qui l\'a posée', () => {
    const w = newWorld('normal', 42, undefined, 'pyromancers');
    const t = buildTowerChain(w, ['brazier']);
    const c = spawnDummy(w, t.cx + 8, t.cy);
    c.hp = 1;
    putEmber(w, c.x, c.y, { towerId: t.id });

    updateEmbers(w, 1);

    expect(c.alive).toBe(false);
    expect(w.stats.towers.get(t.id)!.kills).toBe(1);
  });

  it('[RM-02] l\'Obus incendiaire laisse une seule flaque à l\'impact, même quand son éclat touche plusieurs créatures', () => {
    const w = newWorld('normal', 42, undefined, 'forge');
    const t = buildTowerChain(w, ['cannon', 'mortar', 'firebomb']);
    const a = spawnDummy(w, t.cx + 3, t.cy);
    spawnDummy(w, t.cx + 3.8, t.cy);

    for (let i = 0; i < 300 && w.embers.length === 0; i++) w.step();

    expect(w.embers).toHaveLength(1);
    expect(w.embers[0]).toMatchObject({ towerId: t.id, radius: 1.5, dps: 15 });
    expect(Math.abs(w.embers[0].x - a.x)).toBeLessThan(1);
    expect(w.embers[0].expires - w.tick).toBeLessThanOrEqual(3 * 60);
  });

  it('[RM-02] le Naphte empoisonne les créatures de son éclat et laisse une flaque', () => {
    const w = newWorld('normal', 42, undefined, 'sylve');
    const t = buildTowerChain(w, ['venom', 'plague', 'naphtha']);
    const a = spawnDummy(w, t.cx + 3, t.cy);
    const b = spawnDummy(w, t.cx + 3.8, t.cy);
    const far = spawnDummy(w, t.cx + 3, t.cy + 4);

    for (let i = 0; i < 300 && w.embers.length === 0; i++) w.step();

    expect(w.embers).toHaveLength(1);
    expect(w.embers[0]).toMatchObject({ towerId: t.id, radius: 1.5, dps: 8 });
    for (const c of [a, b]) expect(c.poisons.map((p) => p.dps)).toContain(14);
    expect(far.poisons).toHaveLength(0);
  });
});
