import { describe, expect, it } from 'vitest';
import { MAPS } from '../../../src/domain/catalog/map';
import { World } from '../../../src/domain/model/World';
import type { Difficulty } from '../../../src/domain/model/types';
import { launchWave } from '../../../src/domain/systems/waves';

describe('MAPS', () => {
  describe.each(MAPS)('$name', (map) => {
    it("[RM-05] trouve un chemin pour chaque tronçon quand la carte n'a aucune tour", () => {
      const w = new World({ map, difficulty: 'normal', seed: 1, builder: 'bastion' });
      expect(w.fields[0].reachable(w.spawnCell)).toBe(true);
      for (let k = 0; k < w.grid.checkpoints.length; k++) {
        const reached = w.grid.checkpoints[k].some((i) => w.fields[k + 1].reachable(i));
        expect(reached).toBe(true);
      }
    });

    it('[RM-05] rend non constructibles le portail, les pierres et la porte', () => {
      const g = new World({ map, difficulty: 'normal', seed: 1, builder: 'bastion' }).grid;
      for (const i of g.spawnCells) expect(g.buildable(i)).toBe(false);
      for (const cells of g.checkpoints) for (const i of cells) expect(g.buildable(i)).toBe(false);
      for (const i of g.exitCells) expect(g.buildable(i)).toBe(false);
    });

    it('[RM-05] numérote les pierres sans trou à partir de 1', () => {
      const g = new World({ map, difficulty: 'normal', seed: 1, builder: 'bastion' }).grid;
      const stoneCount = new Set(map.rows.join('').split('').filter((ch) => /[1-9]/.test(ch))).size;
      expect(g.checkpoints).toHaveLength(stoneCount);
      for (const entry of g.checkpoints) expect(entry.length).toBeGreaterThan(0);
    });
  });

  it("[CU-01] présélectionne Le Gué des Runes quand le joueur n'a rien choisi", () => {
    expect(MAPS[0].id).toBe('crossing');
  });

  it('propose Le Gué des Runes, La Spirale et Les Deux Sceaux aux tailles et nombres de pierres prévus', () => {
    expect(MAPS.map((m) => m.name)).toEqual(['Le Gué des Runes', 'La Spirale', 'Les Deux Sceaux']);
    const [crossing, spiral, seals] = MAPS;
    expect(crossing.width).toBe(36);
    expect(crossing.height).toBe(24);
    expect(new World({ map: crossing, difficulty: 'normal', seed: 1, builder: 'bastion' }).grid.checkpoints).toHaveLength(1);

    expect(spiral.width).toBe(36);
    expect(spiral.height).toBe(24);
    expect(new World({ map: spiral, difficulty: 'normal', seed: 1, builder: 'bastion' }).grid.checkpoints).toHaveLength(1);

    expect(seals.width).toBe(40);
    expect(seals.height).toBe(24);
    expect(new World({ map: seals, difficulty: 'normal', seed: 1, builder: 'bastion' }).grid.checkpoints).toHaveLength(2);
  });

  it('[CU-02] fait sortir une créature des Deux Sceaux après la pierre 1 puis la pierre 2', () => {
    const seals = MAPS.find((m) => m.id === 'seals')!;
    const w = new World({ map: seals, difficulty: 'normal', seed: 42, builder: 'bastion' });
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

  const DIFFICULTIES: Difficulty[] = ['easy', 'normal', 'hard'];

  it.each(DIFFICULTIES)(
    '[RM-08] démarre avec le même or et les mêmes vies sur chaque carte quand la difficulté est %s',
    (difficulty) => {
      const worlds = MAPS.map((map) => new World({ map, difficulty, seed: 7, builder: 'bastion' }));
      const [reference, ...others] = worlds;
      for (const w of others) {
        expect(w.gold).toBe(reference.gold);
        expect(w.lives).toBe(reference.lives);
      }
    },
  );

  it('[RM-08] lance la même première vague sur chaque carte', () => {
    const worlds = MAPS.map((map) => new World({ map, difficulty: 'normal', seed: 7, builder: 'bastion' }));
    const compositions = worlds.map((w) => {
      launchWave(w);
      for (let i = 0; i < 60 * 60 && w.spawners.length > 0; i++) w.step();
      return w.creeps
        .map((c) => ({ def: c.def.id, maxHp: c.maxHp }))
        .sort((a, b) => (a.def === b.def ? a.maxHp - b.maxHp : a.def.localeCompare(b.def)));
    });
    const [reference, ...others] = compositions;
    expect(reference.length).toBeGreaterThan(0);
    for (const composition of others) expect(composition).toEqual(reference);
  });
});
