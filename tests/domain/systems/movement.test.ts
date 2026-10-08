import { describe, expect, it } from 'vitest';
import { updateMovement } from '../../../src/domain/systems/movement';
import { spawnCreep } from '../../../src/domain/systems/waves';
import { newWorld } from '../../support/helpers';
import { MAP_ICE, MAP_TWO_STONES } from '../../support/maps';
import { dispatch } from '../../../src/application/dispatch';
import { CommandType } from '../../../src/domain/model/types';

describe('movement', () => {
  it('[RM-12] parcourt deux fois plus de chemin pendant le sprint', () => {
    const w = newWorld();
    const c = spawnCreep(w, 'dunerunner', 0);
    updateMovement(w, 0);
    c.sprint = 1;
    const remaining0 = c.remaining;

    const wTemoin = newWorld();
    const cTemoin = spawnCreep(wTemoin, 'dunerunner', 0);
    updateMovement(wTemoin, 0);
    const remaining0Temoin = cTemoin.remaining;

    updateMovement(w, 0.05);
    updateMovement(wTemoin, 0.05);

    const distance = remaining0 - c.remaining;
    const distanceTemoin = remaining0Temoin - cTemoin.remaining;

    expect(distance).toBeCloseTo(distanceTemoin * 2, 5);
  });

  it('[RM-13] parcourt 1,5 fois plus de chemin quand l\'Ogre est sous 50 % de ses PV max', () => {
    const w = newWorld();
    const c = spawnCreep(w, 'ogre', 0);
    updateMovement(w, 0);
    c.hp = c.maxHp * 0.4;
    const remaining0 = c.remaining;

    const wTemoin = newWorld();
    const cTemoin = spawnCreep(wTemoin, 'ogre', 0);
    updateMovement(wTemoin, 0);
    const remaining0Temoin = cTemoin.remaining;

    updateMovement(w, 0.05);
    updateMovement(wTemoin, 0.05);

    const distance = remaining0 - c.remaining;
    const distanceTemoin = remaining0Temoin - cTemoin.remaining;

    expect(distance).toBeCloseTo(distanceTemoin * 1.5, 5);
  });
});

describe('movement : glace', () => {
  const MAP_NO_ICE = { ...MAP_ICE, rows: MAP_ICE.rows.map((r) => r.replaceAll('*', '.')) };
  const DT = 1 / 60;

  /** Ticks pour qu'un rat sorte du monde par la porte (la plaque est sur son plus court chemin S → pierre 1). */
  const ticksToExit = (map: typeof MAP_ICE) => {
    const w = newWorld('normal', 42, map);
    const c = spawnCreep(w, 'rat', 0);
    let ticks = 0;
    while (c.alive && ticks < 60 * 60) {
      updateMovement(w, DT);
      ticks++;
    }
    return ticks;
  };

  it('[RM-03] atteint la sortie plus tôt quand le trajet traverse la glace', () => {
    expect(ticksToExit(MAP_ICE)).toBeLessThan(ticksToExit(MAP_NO_ICE));
  });

  it('[RM-03] laisse un volant à la même vitesse au-dessus de la glace', () => {
    const fly = (map: typeof MAP_ICE) => {
      const w = newWorld('normal', 42, map);
      const c = spawnCreep(w, 'rat', 0);
      c.def = { ...c.def, air: true };
      for (let i = 0; i < 120; i++) updateMovement(w, DT);
      return { x: c.x, y: c.y };
    };
    expect(fly(MAP_ICE)).toEqual(fly(MAP_NO_ICE));
  });
});

describe('movement : cap retenu', () => {
  /** Rat du dernier tronçon dévié vers le haut par un mur en (9, 3) : cap retenu vers la droite. */
  const deviatedRat = () => {
    const w = newWorld('normal', 42, MAP_TWO_STONES);
    const c = spawnCreep(w, 'rat', 0);
    c.leg = 2;
    c.tx = 8;
    c.ty = 3;
    c.x = 7.6;
    c.y = 3.5;
    dispatch(w, { c: CommandType.Build, def: 'wall', x: 9, y: 3 });
    return { w, c };
  };

  it('garde le cap pendant le pas de côté', () => {
    const { w, c } = deviatedRat();

    while (c.ty === 3) w.step();

    expect([c.tx, c.ty]).toEqual([8, 2]);
    expect(c.heading).toBeDefined();
  });

  it('oublie le cap quand la créature reprend sa direction', () => {
    const { w, c } = deviatedRat();

    while (c.tx === 8) w.step();

    expect([c.tx, c.ty]).toEqual([9, 2]);
    expect(c.heading).toBeUndefined();
  });

  it('oublie le cap en changeant de tronçon', () => {
    const w = newWorld('normal', 42, MAP_TWO_STONES);
    const c = spawnCreep(w, 'rat', 0);
    c.leg = 1;
    c.tx = 7;
    c.ty = 1;
    c.x = 6.5;
    c.y = 1.5;
    c.heading = { x: 0, y: 1 };

    while (c.leg === 1) w.step();

    expect(c.heading).toBeUndefined();
  });
});
