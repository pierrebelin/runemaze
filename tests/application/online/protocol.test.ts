import { describe, expect, it } from 'vitest';
import { readClientMessage } from '../../../src/application/online/protocol';
import { MAP_TWO_STONES } from '../../support/maps';

describe('readClientMessage', () => {
  it('[CU-02] lit un ordre de construction bien formé', () => {
    const raw = JSON.stringify({
      t: 'order',
      tick: 12,
      cmd: { c: 'build', def: 'archer', x: 3, y: 4 },
      fingerprint: 'abc',
    });

    expect(readClientMessage(raw)).toEqual({
      t: 'order',
      tick: 12,
      cmd: { c: 'build', def: 'archer', x: 3, y: 4 },
      fingerprint: 'abc',
    });
  });

  it('rejette un message qui n\'est pas du JSON', () => {
    expect(readClientMessage('pas du json')).toBeNull();
    expect(readClientMessage('{')).toBeNull();
  });

  it('rejette un message de type inconnu ou aux champs manquants', () => {
    expect(readClientMessage(JSON.stringify({ t: 'inconnu' }))).toBeNull();
    expect(
      readClientMessage(JSON.stringify({ t: 'order', tick: 1, cmd: { c: 'callWave' } })),
    ).toBeNull();
    expect(
      readClientMessage(
        JSON.stringify({ t: 'order', tick: '1', cmd: { c: 'callWave' }, fingerprint: 'abc' }),
      ),
    ).toBeNull();
    expect(
      readClientMessage(
        JSON.stringify({ t: 'order', tick: 1, cmd: { c: 'inconnu' }, fingerprint: 'abc' }),
      ),
    ).toBeNull();
    expect(
      readClientMessage(
        JSON.stringify({ t: 'order', tick: 1, cmd: { c: 'build', def: 'archer', y: 4 }, fingerprint: 'abc' }),
      ),
    ).toBeNull();
    expect(readClientMessage('42')).toBeNull();
    expect(readClientMessage('null')).toBeNull();
  });

  it('[RM-10] rejette un message de rythme dont la vitesse n\'est pas 1, 2 ou 3', () => {
    expect(readClientMessage(JSON.stringify({ t: 'pace', tick: 1, paused: false, speed: 4 }))).toBeNull();
    expect(readClientMessage(JSON.stringify({ t: 'pace', tick: 1, paused: false, speed: 0 }))).toBeNull();
    expect(readClientMessage(JSON.stringify({ t: 'pace', tick: 1, paused: false, speed: 1.5 }))).toBeNull();
    expect(readClientMessage(JSON.stringify({ t: 'pace', tick: 1, paused: false, speed: 2 }))).toEqual({
      t: 'pace',
      tick: 1,
      paused: false,
      speed: 2,
    });
  });

  it('[CU-01] rejette une ouverture de partie à difficulté inconnue ou carte mal formée', () => {
    expect(
      readClientMessage(JSON.stringify({ t: 'open', map: MAP_TWO_STONES, difficulty: 'x' })),
    ).toBeNull();
    expect(readClientMessage(JSON.stringify({ t: 'open', map: {}, difficulty: 'easy' }))).toBeNull();
    expect(
      readClientMessage(
        JSON.stringify({
          t: 'open',
          map: { id: 'a', name: 'A', width: 3, height: 3 },
          difficulty: 'easy',
        }),
      ),
    ).toBeNull();
    expect(
      readClientMessage(
        JSON.stringify({
          t: 'open',
          map: { id: 'a', name: 'A', width: -1, height: 3, rows: ['###'] },
          difficulty: 'easy',
        }),
      ),
    ).toBeNull();
    expect(
      readClientMessage(
        JSON.stringify({
          t: 'open',
          map: { id: 'a', name: 'A', width: 3.5, height: 3, rows: ['###'] },
          difficulty: 'easy',
        }),
      ),
    ).toBeNull();
    expect(
      readClientMessage(
        JSON.stringify({
          t: 'open',
          map: { id: 'a', name: 'A', width: 3, height: 3, rows: ['###', 42, '###'] },
          difficulty: 'easy',
        }),
      ),
    ).toBeNull();

    expect(readClientMessage(JSON.stringify({ t: 'open', map: MAP_TWO_STONES, difficulty: 'easy' }))).toEqual({
      t: 'open',
      map: MAP_TWO_STONES,
      difficulty: 'easy',
    });
  });

  it('[CU-04] lit l\'ancienne partie à abandonner d\'une ouverture', () => {
    const raw = JSON.stringify({
      t: 'open',
      map: MAP_TWO_STONES,
      difficulty: 'normal',
      previous: { id: 'a', token: 'tok-a' },
    });

    expect(readClientMessage(raw)).toEqual({
      t: 'open',
      map: MAP_TWO_STONES,
      difficulty: 'normal',
      previous: { id: 'a', token: 'tok-a' },
    });
  });

  it('[CU-04] rejette une ouverture dont l\'ancienne partie est mal formée', () => {
    expect(
      readClientMessage(
        JSON.stringify({ t: 'open', map: MAP_TWO_STONES, difficulty: 'normal', previous: 'a' }),
      ),
    ).toBeNull();
    expect(
      readClientMessage(
        JSON.stringify({ t: 'open', map: MAP_TWO_STONES, difficulty: 'normal', previous: { id: 'a' } }),
      ),
    ).toBeNull();
    expect(
      readClientMessage(
        JSON.stringify({
          t: 'open',
          map: MAP_TWO_STONES,
          difficulty: 'normal',
          previous: { id: 1, token: 'x' },
        }),
      ),
    ).toBeNull();
  });
});
