import { describe, expect, it } from 'vitest';
import * as catalog from '../../../src/domain/catalog/map';
import { BIOMES, MAP_RECIPE } from '../../../src/domain/catalog/map';
import { World } from '../../../src/domain/model/World';
import type { Difficulty } from '../../../src/domain/model/types';
import { drawMap } from '../../../src/domain/rules/mapDraw';
import { launchWave } from '../../../src/domain/systems/waves';
import { MAP_ICE, MAP_SEALS } from '../../support/maps';

const SEEDS = [1, 2, 3, 4, 5, 6];
const DIFFICULTIES: Difficulty[] = ['easy', 'normal', 'hard'];

describe('catalogue des cartes', () => {
  describe.each(SEEDS)('carte tirée de graine %i', (seed) => {
    const map = drawMap(seed, 'earth', MAP_RECIPE);
    const newMapWorld = () => new World({ map, difficulty: 'normal', seed: 1, builder: 'bastion' });

    it("[RM-06] trouve un chemin pour chaque tronçon quand la carte n'a aucune tour", () => {
      const w = newMapWorld();
      expect(w.fields[0].reachable(w.spawnCell)).toBe(true);
      for (let k = 0; k < w.grid.checkpoints.length; k++) {
        const reached = w.grid.checkpoints[k].some((i) => w.fields[k + 1].reachable(i));
        expect(reached).toBe(true);
      }
    });

    it('rend non constructibles le portail, les pierres et la porte', () => {
      const g = newMapWorld().grid;
      for (const i of g.spawnCells) expect(g.buildable(i)).toBe(false);
      for (const cells of g.checkpoints) for (const i of cells) expect(g.buildable(i)).toBe(false);
      for (const i of g.exitCells) expect(g.buildable(i)).toBe(false);
    });

    it('numérote les pierres sans trou à partir de 1', () => {
      const g = newMapWorld().grid;
      const digits = [...new Set(map.rows.join('').match(/[1-9]/g) ?? [])].sort();
      expect(digits).toEqual(digits.map((_, k) => String(k + 1)));
      expect(g.checkpoints).toHaveLength(digits.length);
      for (const entry of g.checkpoints) expect(entry.length).toBeGreaterThan(0);
    });
  });

  it.each(DIFFICULTIES)(
    '[RM-08] lance la même première vague avec le même or et les mêmes vies quel que soit le biome en difficulté %s',
    (difficulty) => {
      const states = BIOMES.map((biome) => {
        const map = drawMap(3, biome, MAP_RECIPE);
        const w = new World({ map, difficulty, seed: 7, builder: 'bastion' });
        launchWave(w);
        return {
          gold: w.gold,
          lives: w.lives,
          groups: w.spawners.map((s) => ({ creep: s.creep, left: s.left })),
        };
      });
      expect(states).toHaveLength(3);
      expect(states[0].groups.length).toBeGreaterThan(0);
      for (const s of states.slice(1)) expect(s).toEqual(states[0]);
    },
  );

  it('[RM-02] lit la glace comme une case praticable non constructible', () => {
    const g = new World({ map: MAP_ICE, difficulty: 'normal', seed: 1, builder: 'bastion' }).grid;
    const i = g.idx(5, 3);

    expect(g.kind[i]).toBe('ice');
    expect(g.walkable(i)).toBe(true);
    expect(g.buildable(i)).toBe(false);
  });

  it('[RM-04] lit le cristal comme une case constructible et praticable', () => {
    const map = {
      id: 'crystal',
      name: 'Cristal',
      width: 5,
      height: 3,
      rows: ['#####', 'S.+1E', '#####'],
    };
    const g = new World({ map, difficulty: 'normal', seed: 1, builder: 'bastion' }).grid;
    const i = g.idx(2, 1);

    expect(g.kind[i]).toBe('crystal');
    expect(g.walkable(i)).toBe(true);
    expect(g.buildable(i)).toBe(true);
  });

  it('[CU-01] propose Terre, Neige et Espace, Terre en premier', () => {
    expect(BIOMES).toEqual(['earth', 'snow', 'space']);
  });

  it('[RM-01] ne propose plus aucune carte faite à la main', () => {
    const exported = Object.keys(catalog);
    for (const name of ['MAPS', 'MAP_CROSSING', 'MAP_SPIRAL', 'MAP_SEALS']) expect(exported).not.toContain(name);
  });

  it('fait sortir une créature des Deux Sceaux après la pierre 1 puis la pierre 2', () => {
    const w = new World({ map: MAP_SEALS, difficulty: 'normal', seed: 42, builder: 'bastion' });
    launchWave(w);
    const legs: number[] = [];
    for (let i = 0; i < 60 * 60 && w.stats.leaked === 0; i++) {
      w.step();
      const leg = w.creeps[0]?.leg;
      if (leg !== undefined && legs[legs.length - 1] !== leg) legs.push(leg);
    }
    expect(legs).toEqual([0, 1, 2]);
    expect(w.stats.leaked).toBeGreaterThan(0);
  });

  // Vert d'office aujourd'hui : le passage par trou de ver est déjà livré dans `moveGround` (F3). Garde-fou sur cartes tirées.
  it('[CU-03] lance une partie Espace dont les créatures atteignent la porte', () => {
    let shortcuts = 0;
    for (const seed of SEEDS) {
      const map = drawMap(seed, 'space', MAP_RECIPE);
      const closed = { ...map, rows: map.rows.map((r) => r.replace(/[aAbB]/g, '#')) };
      const w = new World({ map, difficulty: 'normal', seed: 1, builder: 'bastion' });
      const without = new World({ map: closed, difficulty: 'normal', seed: 1, builder: 'bastion' });
      if (w.mazeLength() < without.mazeLength()) shortcuts++;

      launchWave(w);
      for (let i = 0; i < 60 * 60 && w.stats.leaked === 0; i++) w.step();

      expect(w.stats.leaked, `graine ${seed}`).toBeGreaterThan(0);
    }
    expect(shortcuts).toBeGreaterThan(0);
  });
});
