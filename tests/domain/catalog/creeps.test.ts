import { describe, expect, it } from 'vitest';
import { CREEPS, WAVES } from '../../../src/domain/catalog/creeps';
import type { WaveGroup } from '../../../src/domain/model/types';

const G = (creep: string, count: number, interval = 0.8, delay = 0): WaveGroup => ({ creep, count, interval, delay });

describe('creeps', () => {
  it('[RM-01] garde les vagues 1 à 5 inchangées', () => {
    expect(WAVES[0]).toEqual({ groups: [G('rat', 12)] });
    expect(WAVES[1]).toEqual({ groups: [G('wolf', 12, 0.7)] });
    expect(WAVES[2]).toEqual({ groups: [G('raider', 12)] });
    expect(WAVES[3]).toEqual({ groups: [G('golem', 10, 1.1)] });
    expect(WAVES[4]).toEqual({ groups: [G('harpy', 12)] });
  });

  it('[RM-01] compose les vagues 6 à 30 des groupes et nombres de la table', () => {
    const table: [string, number][][] = [
      [['dunerunner', 14]],
      [['knight', 10]],
      [['troll', 12], ['wolf', 10]],
      [['wraith', 12]],
      [['ogre', 1], ['raider', 6]],
      [['runeguard', 14]],
      [['wyvern', 12], ['raider', 12]],
      [['slime', 12]],
      [['rat', 30], ['shaman', 4]],
      [['wraith', 14], ['golem', 8]],
      [['sapper', 8]],
      [['knight', 14], ['shaman', 5]],
      [['harpy', 18], ['dunerunner', 14]],
      [['runeguard', 14], ['slime', 10]],
      [['hydra', 1]],
      [['golem', 16], ['sapper', 4]],
      [['wyvern', 16], ['wraith', 12]],
      [['knight', 16], ['runeguard', 10]],
      [['slime', 16], ['shaman', 5]],
      [['troll', 20], ['sapper', 6]],
      [['dunerunner', 26], ['wolf', 20]],
      [['harpy', 22], ['wyvern', 10]],
      [['golem', 18], ['shaman', 6], ['sapper', 4]],
      [['knight', 20], ['runeguard', 12], ['dunerunner', 12]],
      [['ashlord', 1], ['shaman', 4]],
    ];

    expect(WAVES).toHaveLength(30);

    table.forEach((groups, i) => {
      const wave = WAVES[5 + i];
      const actual = wave.groups.map((g) => [g.creep, g.count]);
      expect(actual, `vague ${6 + i}`).toEqual(groups);
    });
  });

  it("[RM-01] ne fait paraître chaque nouvelle créature seule qu'avant ses mélanges", () => {
    // Le Chaman est exclu : la table le fait paraître d'abord avec des Rats, vague 14.
    for (const creep of ['dunerunner', 'runeguard', 'slime', 'sapper']) {
      const firstIndex = WAVES.findIndex((w) => w.groups.some((g) => g.creep === creep));
      expect(firstIndex, creep).toBeGreaterThanOrEqual(0);
      expect(WAVES[firstIndex].groups, creep).toHaveLength(1);
    }
  });

  it('[CU-01] rend envoyables rat, loup, maraudeur, harpie, golem et spectre aux prix et gains de la table, et aucun chef', () => {
    const sendable = Object.values(CREEPS)
      .filter((c) => c.send !== undefined)
      .map((c) => [c.id, c.send]);

    expect(sendable).toEqual([
      ['rat', { cost: 7, income: 1 }],
      ['wolf', { cost: 14, income: 2 }],
      ['raider', { cost: 25, income: 3 }],
      ['golem', { cost: 90, income: 8 }],
      ['harpy', { cost: 45, income: 5 }],
      ['wraith', { cost: 110, income: 9 }],
    ]);
  });
});
