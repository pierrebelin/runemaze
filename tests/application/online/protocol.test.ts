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

  it('[RM-07] lit un ordre d\'envoi avec son id de créature', () => {
    const order = (cmd: unknown) => JSON.stringify({ t: 'order', tick: 5, cmd, fingerprint: 'abc' });

    expect(readClientMessage(order({ c: 'send', creep: 'grunt' }))).toEqual({
      t: 'order',
      tick: 5,
      cmd: { c: 'send', creep: 'grunt' },
      fingerprint: 'abc',
    });
    expect(readClientMessage(order({ c: 'send' }))).toBeNull();
    expect(readClientMessage(order({ c: 'send', creep: 3 }))).toBeNull();
  });

  it('[RM-12] lit un ordre d\'achat de glaneur reçu du client', () => {
    const raw = JSON.stringify({ t: 'order', tick: 5, cmd: { c: 'gleaner' }, fingerprint: 'abc' });

    expect(readClientMessage(raw)).toEqual({
      t: 'order',
      tick: 5,
      cmd: { c: 'gleaner' },
      fingerprint: 'abc',
    });
  });

  it('[RM-07] rejette un ordre de réception venu d\'un client', () => {
    const order = (cmd: unknown) => JSON.stringify({ t: 'order', tick: 5, cmd, fingerprint: 'abc' });

    expect(readClientMessage(order({ c: 'send', creep: 'grunt' }))).not.toBeNull();
    expect(readClientMessage(order({ c: 'receive', creep: 'grunt' }))).toBeNull();
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

describe('readClientMessage — salon', () => {
  it('[RM-16] lit la création d\'un salon avec pseudo, carte et difficulté', () => {
    const longNick = 'A'.repeat(20);
    const raw = JSON.stringify({ t: 'host', nick: longNick, map: MAP_TWO_STONES, difficulty: 'hard' });

    expect(readClientMessage(raw)).toEqual({
      t: 'host',
      nick: longNick,
      map: MAP_TWO_STONES,
      difficulty: 'hard',
    });

    expect(
      readClientMessage(JSON.stringify({ t: 'host', nick: 'Ada', map: MAP_TWO_STONES, difficulty: 'x' })),
    ).toBeNull();
    expect(
      readClientMessage(JSON.stringify({ t: 'host', nick: 'Ada', map: {}, difficulty: 'hard' })),
    ).toBeNull();
    expect(
      readClientMessage(JSON.stringify({ t: 'host', nick: 42, map: MAP_TWO_STONES, difficulty: 'hard' })),
    ).toBeNull();
  });

  it('[RM-16] lit la demande de rejoindre avec pseudo et code', () => {
    const raw = JSON.stringify({ t: 'join', nick: 'Bob', code: 'ABCDEF' });

    expect(readClientMessage(raw)).toEqual({ t: 'join', nick: 'Bob', code: 'ABCDEF' });
  });

  it('[RM-02] rejette un message de rejoindre qui porte une carte ou une difficulté', () => {
    expect(readClientMessage(JSON.stringify({ t: 'join', nick: 'Bob', code: 'ABCDEF' }))).toEqual({
      t: 'join',
      nick: 'Bob',
      code: 'ABCDEF',
    });
    expect(
      readClientMessage(JSON.stringify({ t: 'join', nick: 'Bob', code: 'ABCDEF', map: MAP_TWO_STONES })),
    ).toBeNull();
    expect(
      readClientMessage(JSON.stringify({ t: 'join', nick: 'Bob', code: 'ABCDEF', difficulty: 'hard' })),
    ).toBeNull();
  });

  it('[RM-03] rejette un code qui n\'a pas 6 lettres de l\'alphabet', () => {
    expect(readClientMessage(JSON.stringify({ t: 'join', nick: 'Bob', code: 'HJKNPZ' }))).toEqual({
      t: 'join',
      nick: 'Bob',
      code: 'HJKNPZ',
    });
    for (const code of ['ABCDE', 'ABCDEFG', 'abcdef', 'ABCDEI', 'ABCDEO', 'ABCD1F']) {
      expect(readClientMessage(JSON.stringify({ t: 'join', nick: 'Bob', code }))).toBeNull();
    }
    expect(readClientMessage(JSON.stringify({ t: 'join', nick: 'Bob', code: 123456 }))).toBeNull();
  });

  it('[RM-16] lit le départ du salon', () => {
    expect(readClientMessage(JSON.stringify({ t: 'leave' }))).toEqual({ t: 'leave' });
  });

  it('[CU-03] lit la demande de lancement', () => {
    expect(readClientMessage(JSON.stringify({ t: 'start' }))).toEqual({ t: 'start' });
  });

  it('[RM-08] lit la demande d\'appel à deux', () => {
    expect(readClientMessage(JSON.stringify({ t: 'ready' }))).toEqual({ t: 'ready' });
  });

  it('[CU-07] lit la demande de reprise avec code et jeton', () => {
    const raw = JSON.stringify({ t: 'rejoin', code: 'ABCDEF', token: 'tok-1' });

    expect(readClientMessage(raw)).toEqual({ t: 'rejoin', code: 'ABCDEF', token: 'tok-1' });
  });
});
