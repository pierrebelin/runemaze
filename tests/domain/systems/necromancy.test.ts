import { describe, expect, it } from 'vitest';
import { dispatch } from '../../../src/application/dispatch';
import { canBuild } from '../../../src/application/queries/canBuild';
import { previewRoute } from '../../../src/application/queries/previewRoute';
import { snapshot } from '../../../src/domain/model/snapshot';
import { nearestStep } from '../../../src/domain/systems/necromancy';
import { CommandType } from '../../../src/domain/model/types';
import type { Tower } from '../../../src/domain/model/types';
import type { World } from '../../../src/domain/model/World';
import { applyDamage } from '../../../src/domain/systems/combat';
import { launchWave, spawnCreep } from '../../../src/domain/systems/waves';
import { newWorld, run, spawnDummy } from '../../support/helpers';
import { MAP_CRYSTAL } from '../../support/maps';

describe('necromancy', () => {
  it('[RM-06] laisse un cadavre à l\'endroit de la mort d\'une créature au sol', () => {
    const w = newWorld();
    const c = spawnDummy(w, 5.3, 6.1);

    applyDamage(w, c, 1e7, 'normal', 0, true);

    expect(c.alive).toBe(false);
    expect(w.corpses).toHaveLength(1);
    expect(w.corpses[0]).toMatchObject({ x: 5.3, y: 6.1 });
  });

  it('[RM-06] le cadavre disparaît au bout de 5 s', () => {
    const w = newWorld();
    launchWave(w);
    const c = spawnDummy(w, 5, 5);
    applyDamage(w, c, 1e7, 'normal', 0, true);

    run(w, 4.9);
    expect(w.corpses).toHaveLength(1);

    run(w, 0.2);
    expect(w.corpses).toHaveLength(0);
  });

  it('[RM-06] ne laisse pas de cadavre quand un volant meurt', () => {
    const w = newWorld();
    const flyer = spawnDummy(w, 5, 5, true);
    const walker = spawnDummy(w, 9, 9);

    applyDamage(w, flyer, 1e7, 'normal', 0, true);
    applyDamage(w, walker, 1e7, 'normal', 0, true);

    expect(flyer.alive).toBe(false);
    expect(w.corpses.map((k) => [k.x, k.y])).toEqual([[9, 9]]);
  });

  it('[RM-06] ne laisse pas de cadavre quand une créature s\'échappe', () => {
    const w = newWorld();
    launchWave(w);
    const runner = spawnCreep(w, 'rat', 0);
    const last = w.fields.length - 1;
    const exit = w.grid.exitCells[0];
    runner.leg = last;
    runner.tx = w.grid.cx(exit);
    runner.ty = w.grid.cy(exit);
    runner.x = runner.tx + 0.5;
    runner.y = runner.ty + 0.5;
    const walker = spawnDummy(w, 9, 9);
    applyDamage(w, walker, 1e7, 'normal', 0, true);

    run(w, 0.1);

    expect(runner.alive).toBe(false);
    expect(w.stats.leaked).toBe(1);
    expect(w.corpses.map((k) => [k.x, k.y])).toEqual([[9, 9]]);
  });

  it('[RM-06] un chef tué laisse un cadavre', () => {
    const w = newWorld();
    const boss = spawnCreep(w, 'ogre', 0);
    boss.x = 7;
    boss.y = 8;
    boss.frozen = 1e6;

    applyDamage(w, boss, 1e9, 'normal', 0, true);

    expect(boss.alive).toBe(false);
    expect(w.corpses).toHaveLength(1);
    expect(w.corpses[0]).toMatchObject({ x: 7, y: 8 });
  });

  it('[RM-07] l\'Autel consomme le cadavre le plus proche à sa portée et gagne un cumul', () => {
    const w = newWorld('normal', 42, undefined, 'necromancers');
    const t = buildAltar(w, 10, 8);
    launchWave(w);
    const far = dropCorpse(w, t.cx + 3, t.cy);
    const near = dropCorpse(w, t.cx + 1, t.cy);
    const out = dropCorpse(w, t.cx + 8, t.cy);

    run(w, 0.1);

    expect(t.offerings).toHaveLength(1);
    expect(w.corpses.map((k) => k.id).sort()).toEqual([far, out].sort());
    expect(w.corpses.map((k) => k.id)).not.toContain(near);
  });

  it('[RM-05] ramasse un cadavre à 1,1 × la portée quand l’Autel est sur un cristal', () => {
    // Cristaux en (5,3) et (5,4) : l'Autel posé en (5,3) les recouvre, en (5,6) non.
    const make = (y: number) => {
      const w = newWorld('normal', 42, MAP_CRYSTAL, 'necromancers');
      const t = buildAltar(w, 5, y);
      launchWave(w);
      dropCorpse(w, t.cx + t.def.attack!.range * 1.1, t.cy);
      run(w, 0.1);
      return { w, t };
    };
    const crystal = make(3);
    const plain = make(6);

    expect(crystal.t.rangeBonus).toBe(0.2);
    expect(crystal.t.offerings).toHaveLength(1);
    expect(crystal.w.corpses).toHaveLength(0);
    expect(plain.t.offerings).toHaveLength(0);
    expect(plain.w.corpses).toHaveLength(1);
  });

  it('[RM-07] l\'Autel consomme au plus un cadavre par seconde', () => {
    const w = newWorld('normal', 42, undefined, 'necromancers');
    const t = buildAltar(w, 10, 8);
    launchWave(w);
    dropCorpse(w, t.cx + 1, t.cy);
    dropCorpse(w, t.cx + 2, t.cy);
    dropCorpse(w, t.cx + 3, t.cy);

    run(w, 0.5);
    expect(t.offerings).toHaveLength(1);
    expect(w.corpses).toHaveLength(2);

    run(w, 1);
    expect(t.offerings).toHaveLength(2);
    expect(w.corpses).toHaveLength(1);
  });

  it('[RM-07] l\'Autel ne dépasse pas 10 cumuls', () => {
    const w = newWorld('normal', 42, undefined, 'necromancers');
    const t = buildAltar(w, 10, 8);
    launchWave(w);
    t.offerings = Array.from({ length: 9 }, () => w.tick + 600);
    dropCorpse(w, t.cx + 1, t.cy);
    dropCorpse(w, t.cx + 2, t.cy);

    run(w, 2.5);

    expect(t.offerings).toHaveLength(10);
    expect(w.corpses).toHaveLength(1);
  });

  it('[RM-07] chaque cumul expire 8 s après la consommation de son cadavre', () => {
    const w = newWorld('normal', 42, undefined, 'necromancers');
    const t = buildAltar(w, 10, 8);
    launchWave(w);
    dropCorpse(w, t.cx + 1, t.cy);
    run(w, 3);
    dropCorpse(w, t.cx + 1, t.cy);

    run(w, 4.9);
    expect(t.offerings).toHaveLength(2);

    run(w, 0.2);
    expect(t.offerings).toHaveLength(1);

    run(w, 2.8);
    expect(t.offerings).toHaveLength(1);

    run(w, 0.3);
    expect(t.offerings).toHaveLength(0);
  });

  it('[RM-09] le premier Autel construit prend le cadavre quand deux Autels le veulent', () => {
    const w = newWorld('normal', 42, undefined, 'necromancers');
    const first = buildAltar(w, 10, 8);
    const second = buildAltar(w, 12, 8);
    expect(w.towers).toEqual([first, second]);
    launchWave(w);
    dropCorpse(w, (first.cx + second.cx) / 2, first.cy);

    run(w, 0.1);

    expect(first.offerings).toHaveLength(1);
    expect(second.offerings).toHaveLength(0);
    expect(w.corpses).toHaveLength(0);
  });

  it('[RM-08] le Charnier relève toutes les 4 s le cadavre le plus proche à sa portée', () => {
    const w = newWorld('normal', 42, undefined, 'necromancers');
    const t = buildCharnel(w, 10, 8);
    launchWave(w);
    const far = dropCorpse(w, t.cx + 3, t.cy);
    const near = dropCorpse(w, t.cx + 1, t.cy);
    const out = dropCorpse(w, t.cx + 8, t.cy);

    run(w, 1 / 60);

    expect(w.skeletons).toHaveLength(1);
    expect(w.skeletons[0]).toMatchObject({ towerId: t.id, damage: 60, radius: 1 });
    expect(Math.hypot(w.skeletons[0].x - (t.cx + 1), w.skeletons[0].y - t.cy)).toBeLessThan(0.1);
    expect(w.corpses.map((k) => k.id).sort()).toEqual([far, out].sort());
    expect(w.corpses.map((k) => k.id)).not.toContain(near);

    run(w, 3.7);
    expect(w.skeletons).toHaveLength(1);
    expect(w.corpses).toHaveLength(2);

    run(w, 0.4);
    expect(w.skeletons).toHaveLength(2);
    expect(w.skeletons[1]).toMatchObject({ towerId: t.id });
    expect(Math.hypot(w.skeletons[1].x - (t.cx + 3), w.skeletons[1].y - t.cy)).toBeLessThan(0.5);
    expect(w.corpses.map((k) => k.id)).toEqual([out]);
  });

  it('[RM-09] l\'Autel construit avant le Charnier prend le cadavre', () => {
    const w = newWorld('normal', 42, undefined, 'necromancers');
    const altar = buildAltar(w, 10, 8);
    const charnel = buildCharnel(w, 12, 8);
    expect(w.towers).toEqual([altar, charnel]);
    launchWave(w);
    dropCorpse(w, (altar.cx + charnel.cx) / 2, altar.cy);
    // Hors de portée de l'Autel : seul le Charnier peut le relever (prouve qu'il était actif).
    dropCorpse(w, charnel.cx + 3.5, charnel.cy);

    run(w, 1 / 60);

    expect(altar.offerings).toHaveLength(1);
    expect(w.skeletons).toHaveLength(1);
    expect(Math.hypot(w.skeletons[0].x - (charnel.cx + 3.5), w.skeletons[0].y - charnel.cy)).toBeLessThan(0.1);
    expect(w.corpses).toHaveLength(0);
  });
  it('[RM-08] le squelette remonte le tracé vers le portail', () => {
    const w = newWorld('normal', 42, undefined, 'necromancers');
    // Charnier près du portail, pour que le squelette l'atteigne en moins de 8 s.
    const start = w.route[6];
    const t = buildCharnel(w, Math.floor(w.grid.cx(start)) + 1, Math.floor(w.grid.cy(start)) + 1);
    launchWave(w);
    const cell = w.route[6];
    dropCorpse(w, w.grid.cx(cell), w.grid.cy(cell));
    const portal = w.route[0];

    run(w, 1 / 60);
    expect(w.skeletons).toHaveLength(1);
    const sk = w.skeletons[0];
    let last = sk.step;
    for (let i = 0; i < 28 && w.skeletons.length > 0; i++) {
      run(w, 0.25);
      if (w.skeletons.length === 0) break;
      expect(sk.step).toBeLessThanOrEqual(last);
      last = sk.step;
      expect(w.route).toContain(w.grid.idx(Math.floor(sk.x), Math.floor(sk.y)));
    }

    expect(last).toBeLessThan(w.route.indexOf(nearestRouteCell(w, t.cx, t.cy)) + 1);
    expect(portal).toBe(w.route[0]);
    expect(w.skeletons).toHaveLength(0);
  });

  it('[RM-08] survoler une case pour construire ne déplace pas les squelettes', () => {
    // Squelette entre deux cases, au-delà de la moitié : la case la plus proche n'est plus `step`.
    const make = () => {
      const w = newWorld('normal', 42, undefined, 'necromancers');
      const t = buildCharnel(w, 10, 8);
      launchWave(w);
      const cell = nearestRouteCell(w, t.cx, t.cy);
      dropCorpse(w, w.grid.cx(cell), w.grid.cy(cell));
      run(w, 1 / 60);
      expect(w.skeletons).toHaveLength(1);
      for (let i = 0; i < 120 && nearestStep(w, w.skeletons[0].x, w.skeletons[0].y) === w.skeletons[0].step; i++) run(w, 1 / 60);
      return w;
    };
    const w = make();
    const twin = make();
    const sk = w.skeletons[0];
    expect(nearestStep(w, sk.x, sk.y)).not.toBe(sk.step);
    const before = { step: sk.step, x: sk.x, y: sk.y };

    canBuild(w, 'wall', 2, 2);
    previewRoute(w, 2, 2);

    expect(w.skeletons).toHaveLength(1);
    expect({ step: sk.step, x: sk.x, y: sk.y }).toEqual(before);
    run(w, 1);
    run(twin, 1);
    expect(JSON.stringify(snapshot(w))).toBe(JSON.stringify(snapshot(twin)));
  });

  it('[RM-08] le squelette disparaît sans exploser au bout de 8 s', () => {
    const w = newWorld('normal', 42, undefined, 'necromancers');
    const t = buildCharnel(w, 10, 8);
    launchWave(w);
    dropCorpse(w, t.cx + 1, t.cy);

    run(w, 7.9);
    expect(w.skeletons).toHaveLength(1);

    run(w, 0.2);
    expect(w.skeletons).toHaveLength(0);
  });

  it('[RM-08] le squelette repart de la case la plus proche quand une construction change le tracé', () => {
    const w = newWorld('normal', 42, undefined, 'necromancers');
    const t = buildCharnel(w, 10, 8);
    launchWave(w);
    const cell = nearestRouteCell(w, t.cx, t.cy);
    dropCorpse(w, w.grid.cx(cell), w.grid.cy(cell));
    run(w, 0.1);
    const sk = w.skeletons[0];
    const before = [...w.route];
    let built = false;
    for (const c of before.slice(4)) {
      if (dispatch(w, { c: CommandType.Build, def: 'wall', x: w.grid.cx(c) - 1, y: w.grid.cy(c) - 1 }).ok) {
        built = true;
        break;
      }
    }
    expect(built).toBe(true);
    expect(w.route).not.toEqual(before);
    run(w, 0.05);

    const d = (i: number) => Math.hypot(sk.x - w.grid.cx(w.route[i]), sk.y - w.grid.cy(w.route[i]));
    const best = Math.min(...w.route.map((_, i) => d(i)));
    expect(d(sk.step)).toBeLessThanOrEqual(best + 0.1);
    const step = sk.step;
    run(w, 1);
    expect(sk.step).toBeLessThan(step);
  });

  it('[RM-08] le squelette explose au contact de la première créature au sol et blesse celles à 1 case', () => {
    const w = newWorld('normal', 42, undefined, 'necromancers');
    const t = buildCharnel(w, 10, 8);
    launchWave(w);
    const step = 10;
    const sx = w.grid.cx(w.route[step]);
    const sy = w.grid.cy(w.route[step]);
    w.skeletons.push({ id: w.id(), towerId: t.id, x: sx, y: sy, step, damage: 60, radius: 1, expires: w.tick + 480 });
    const hit = spawnDummy(w, sx + 0.4, sy);
    const near = spawnDummy(w, sx, sy + 0.8);
    const far = spawnDummy(w, sx, sy - 1.6);
    const flyer = spawnDummy(w, sx - 0.3, sy, true);
    const hp = (c: { hp: number }) => c.hp;
    const before = [hit, near, far, flyer].map(hp);

    run(w, 1 / 60);

    expect(w.skeletons).toHaveLength(0);
    expect(before[0] - hit.hp).toBe(60);
    expect(before[1] - near.hp).toBe(60);
    expect(far.hp).toBe(before[2]);
    expect(flyer.hp).toBe(before[3]);
  });

  it('[RM-08] une créature croisée par un squelette garde son trajet et sa vitesse', () => {
    const make = (withSkeleton: boolean) => {
      const w = newWorld('normal', 42, undefined, 'necromancers');
      const t = buildCharnel(w, 10, 8);
      const step = 10;
      const x = w.grid.cx(w.route[step]);
      const y = w.grid.cy(w.route[step]);
      const c = spawnCreep(w, 'rat', 0);
      c.x = x;
      c.y = y;
      c.hp = c.maxHp = 1e6;
      if (withSkeleton) w.skeletons.push({ id: w.id(), towerId: t.id, x, y, step, damage: 60, radius: 1, expires: w.tick + 480 });
      return { w, c };
    };
    const a = make(true);
    const b = make(false);

    run(a.w, 1.5);
    run(b.w, 1.5);

    expect(a.w.skeletons).toHaveLength(0);
    expect(a.c.hp).toBeLessThan(a.c.maxHp);
    expect(a.c.x).toBeCloseTo(b.c.x, 6);
    expect(a.c.y).toBeCloseTo(b.c.y, 6);
    expect(a.c.leg).toBe(b.c.leg);
    expect(a.c.slowPct).toBe(0);
  });
});

function nearestRouteCell(w: World, x: number, y: number): number {
  return w.route.reduce((a, b) =>
    Math.hypot(w.grid.cx(b) - x, w.grid.cy(b) - y) < Math.hypot(w.grid.cx(a) - x, w.grid.cy(a) - y) ? b : a);
}

function buildCharnel(w: World, x: number, y: number): Tower {
  w.gold = 100000;
  const r = dispatch(w, { c: CommandType.Build, def: 'ossuary', x, y }) as { ok: true; id: number };
  expect(r.ok).toBe(true);
  expect(dispatch(w, { c: CommandType.Upgrade, tower: r.id, def: 'charnel' }).ok).toBe(true);
  return w.towerById.get(r.id)!;
}

function buildAltar(w: World, x: number, y: number): Tower {
  const r = dispatch(w, { c: CommandType.Build, def: 'altar', x, y }) as { ok: true; id: number };
  expect(r.ok).toBe(true);
  return w.towerById.get(r.id)!;
}

/** Tue une créature immobile en (x, y) et renvoie l'id du cadavre laissé. */
function dropCorpse(w: World, x: number, y: number): number {
  const before = new Set(w.corpses.map((k) => k.id));
  applyDamage(w, spawnDummy(w, x, y), 1e7, 'normal', 0, true);
  return w.corpses.find((k) => !before.has(k.id))!.id;
}
