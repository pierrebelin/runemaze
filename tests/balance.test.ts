import { describe, expect, it } from 'vitest';
import { newWorld } from './support/helpers';
import { Phase } from '../src/domain/model/types';
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

  it('bot en hard', () => {
    const results = [1, 2, 3].map((seed) => playBot(newWorld('hard', seed)));
    console.log('hard', JSON.stringify(results));
  }, 120_000);
});
