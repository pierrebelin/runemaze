import { describe, expect, it } from 'vitest';
import { newDuelWorld, newWorld } from './support/helpers';
import { CommandType, Phase } from '../src/domain/model/types';
import { playBot } from './support/bot';

// Un joueur automatique volontairement simple (labyrinthe fixe, aucune
// adaptation aux vagues) : il sert de plancher de difficulté.
describe('équilibrage', () => {
  it('[RM-17] gagne la campagne en Recrue sur trois graines', () => {
    const results = [1, 2, 3].map((seed) => playBot(newWorld('easy', seed)));
    console.log('easy', JSON.stringify(results));
    expect(results.every((r) => r.phase === Phase.Victory)).toBe(true);
  }, 120_000);

  it('[RM-17] gagne la campagne en Vétéran avec au moins 8 vies sur trois graines', () => {
    const results = [1, 2, 3].map((seed) => playBot(newWorld('normal', seed)));
    console.log('normal', JSON.stringify(results));
    expect(results.every((r) => r.phase === Phase.Victory && r.lives >= 8)).toBe(true);
  }, 120_000);

  it('[RM-04] gagne la campagne en duel en achetant des glaneurs et en envoyant contre de l’éther, sur trois graines en Recrue et au moins deux en Vétéran', () => {
    for (const difficulty of ['easy', 'normal'] as const) {
      const worlds = [1, 2, 3].map((seed) => newDuelWorld(difficulty, seed));
      const results = worlds.map((w) => playBot(w));
      console.log('duel', difficulty, JSON.stringify(results));
      const wins = results.filter((r) => r.phase === Phase.Victory).length;
      expect(wins).toBeGreaterThanOrEqual(difficulty === 'easy' ? 3 : 2);
      for (const w of worlds) {
        expect(w.log.some((e) => e.cmd.c === CommandType.Gleaner)).toBe(true);
        expect(w.log.some((e) => e.cmd.c === CommandType.Send)).toBe(true);
      }
    }
  }, 240_000);

  it('bot en hard', () => {
    const results = [1, 2, 3].map((seed) => playBot(newWorld('hard', seed)));
    console.log('hard', JSON.stringify(results));
  }, 120_000);
});
