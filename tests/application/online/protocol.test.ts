import { describe, expect, it } from 'vitest';
import { ClientMessageType, Mode, Team, readClientMessage, validNick } from '../../../src/application/online/protocol';
import { MAP_RECIPE } from '../../../src/domain/catalog/map';
import { drawMap } from '../../../src/domain/rules/mapDraw';
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

  it('[RM-12] lit un ordre d\'amélioration de Porte reçu du client et rejette une amélioration inconnue', () => {
    const order = (cmd: unknown) => JSON.stringify({ t: 'order', tick: 5, cmd, fingerprint: 'abc' });

    expect(readClientMessage(order({ c: 'gate', upgrade: 'shot' }))).toEqual({
      t: 'order',
      tick: 5,
      cmd: { c: 'gate', upgrade: 'shot' },
      fingerprint: 'abc',
    });
    expect(readClientMessage(order({ c: 'gate', upgrade: 'ramparts' }))).toEqual({
      t: 'order',
      tick: 5,
      cmd: { c: 'gate', upgrade: 'ramparts' },
      fingerprint: 'abc',
    });
    expect(readClientMessage(order({ c: 'gate', upgrade: 'moat' }))).toBeNull();
    expect(readClientMessage(order({ c: 'gate' }))).toBeNull();
  });

  it('[RM-07] rejette un ordre de réception venu d\'un client', () => {
    const order = (cmd: unknown) => JSON.stringify({ t: 'order', tick: 5, cmd, fingerprint: 'abc' });

    expect(readClientMessage(order({ c: 'send', creep: 'grunt' }))).not.toBeNull();
    expect(readClientMessage(order({ c: 'receive', creep: 'grunt' }))).toBeNull();
  });

  it('[RM-06] rejette un ordre de perte de réserve envoyé par un joueur', () => {
    const raw = JSON.stringify({ t: 'order', tick: 5, cmd: { c: 'reserveLoss', lives: 3 }, fingerprint: 'abc' });

    expect(readClientMessage(raw)).toBeNull();
  });

  it('[RM-08] accepte l\'ordre d\'abandon reçu du client', () => {
    const raw = JSON.stringify({ t: 'order', tick: 5, cmd: { c: 'resign' }, fingerprint: 'abc' });

    expect(readClientMessage(raw)).toEqual({
      t: 'order',
      tick: 5,
      cmd: { c: 'resign' },
      fingerprint: 'abc',
    });
  });

  it('[RM-04] ignore l\'ordre de mode infini venu du réseau', () => {
    const raw = JSON.stringify({ t: 'order', tick: 5, cmd: { c: 'endless' }, fingerprint: 'abc' });

    expect(readClientMessage(raw)).toBeNull();
  });

  it('rejette un message qui n\'est pas du JSON', () => {
    expect(readClientMessage('pas du json')).toBeNull();
    expect(readClientMessage('{')).toBeNull();
  });

  it('rejette un message de type inconnu ou aux champs manquants', () => {
    expect(readClientMessage(JSON.stringify({ t: 'inconnu' }))).toBeNull();
    expect(
      readClientMessage(JSON.stringify({ t: 'order', tick: 1, cmd: { c: 'build', def: 'wall', x: 1, y: 1 } })),
    ).toBeNull();
    expect(
      readClientMessage(
        JSON.stringify({ t: 'order', tick: '1', cmd: { c: 'build', def: 'wall', x: 1, y: 1 }, fingerprint: 'abc' }),
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

  it('[RM-10] lit un message de rythme sans vitesse de jeu', () => {
    expect(readClientMessage(JSON.stringify({ t: 'pace', tick: 1, paused: false }))).toEqual({
      t: 'pace',
      tick: 1,
      paused: false,
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

    expect(
      readClientMessage(JSON.stringify({ t: 'open', map: MAP_TWO_STONES, difficulty: 'easy', builder: 'bastion' })),
    ).toEqual({
      t: 'open',
      map: MAP_TWO_STONES,
      difficulty: 'easy',
      builder: 'bastion',
    });
  });

  it('[CU-01] accepte l\'ouverture d\'une partie sur une carte tirée avec son biome', () => {
    const map = drawMap(7, 'snow', MAP_RECIPE);

    const read = readClientMessage(JSON.stringify({ t: 'open', map, difficulty: 'easy', builder: 'bastion' }));

    expect(read).not.toBeNull();
    expect(read).toMatchObject({ t: 'open', map: { biome: 'snow' } });
  });

  it('[RM-08] refuse une carte dont le biome est inconnu', () => {
    const map = { ...drawMap(7, 'snow', MAP_RECIPE), biome: 'lave' };

    expect(
      readClientMessage(JSON.stringify({ t: 'open', map, difficulty: 'easy', builder: 'bastion' })),
    ).toBeNull();
  });

  it('[RM-08] accepte une carte sans biome', () => {
    expect(
      readClientMessage(JSON.stringify({ t: 'open', map: MAP_TWO_STONES, difficulty: 'easy', builder: 'bastion' })),
    ).not.toBeNull();
  });

  it('[RM-01] lit une ouverture qui porte un bâtisseur connu', () => {
    const raw = JSON.stringify({ t: 'open', map: MAP_TWO_STONES, difficulty: 'easy', builder: 'sylve' });

    expect(readClientMessage(raw)).toMatchObject({ t: 'open', builder: 'sylve' });
  });

  it('[RM-01] rejette une ouverture sans bâtisseur ou avec un bâtisseur inconnu', () => {
    expect(readClientMessage(JSON.stringify({ t: 'open', map: MAP_TWO_STONES, difficulty: 'easy' }))).toBeNull();
    expect(
      readClientMessage(JSON.stringify({ t: 'open', map: MAP_TWO_STONES, difficulty: 'easy', builder: 'inconnu' })),
    ).toBeNull();
  });

  it('[CU-02] lit un choix de bâtisseur connu et rejette un inconnu', () => {
    expect(readClientMessage(JSON.stringify({ t: 'chooseBuilder', builder: 'forge' }))).toEqual({
      t: ClientMessageType.ChooseBuilder,
      builder: 'forge',
    });
    expect(readClientMessage(JSON.stringify({ t: 'chooseBuilder', builder: 'inconnu' }))).toBeNull();
    expect(readClientMessage(JSON.stringify({ t: 'chooseBuilder' }))).toBeNull();
  });

  it('[CU-04] lit l\'ancienne partie à abandonner d\'une ouverture', () => {
    const raw = JSON.stringify({
      t: 'open',
      map: MAP_TWO_STONES,
      difficulty: 'normal',
      builder: 'bastion',
      previous: { id: 'a', token: 'tok-a' },
    });

    expect(readClientMessage(raw)).toEqual({
      t: 'open',
      map: MAP_TWO_STONES,
      difficulty: 'normal',
      builder: 'bastion',
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

describe('validNick', () => {
  it('[RM-05] accepte un pseudo de 2 à 32 caractères une fois les espaces de bord retirés', () => {
    expect(validNick('Bo')).toBe('Bo');
    expect(validNick('  Ada ')).toBe('Ada');
    expect(validNick('A'.repeat(32))).toBe('A'.repeat(32));
    expect(validNick('')).toBeNull();
    expect(validNick(' A ')).toBeNull();
    expect(validNick('A'.repeat(33))).toBeNull();
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
      mode: Mode.Duel,
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

  it('[RM-01] lit le mode Coopération d\'une demande de création', () => {
    const raw = JSON.stringify({ t: 'host', nick: 'Ada', map: MAP_TWO_STONES, difficulty: 'hard', mode: 'coop' });

    expect(readClientMessage(raw)).toEqual({
      t: 'host',
      nick: 'Ada',
      map: MAP_TWO_STONES,
      difficulty: 'hard',
      mode: Mode.Coop,
    });
  });

  it('[RM-01] retient le mode Duel quand la demande de création n\'en donne pas', () => {
    const raw = JSON.stringify({ t: 'host', nick: 'Ada', map: MAP_TWO_STONES, difficulty: 'hard' });

    expect(readClientMessage(raw)).toMatchObject({ t: 'host', mode: Mode.Duel });
  });

  it('[RM-01] rejette une demande de création au mode inconnu', () => {
    const raw = JSON.stringify({ t: 'host', nick: 'Ada', map: MAP_TWO_STONES, difficulty: 'hard', mode: 'battle' });

    expect(readClientMessage(raw)).toBeNull();
  });

  it('[CU-01] lit le mode 2 contre 2 dans la demande de création de salon', () => {
    const raw = JSON.stringify({ t: 'host', nick: 'Ada', map: MAP_TWO_STONES, difficulty: 'hard', mode: 'teams' });

    expect(readClientMessage(raw)).toEqual({
      t: ClientMessageType.Host,
      nick: 'Ada',
      map: MAP_TWO_STONES,
      difficulty: 'hard',
      mode: Mode.Teams,
    });
  });

  it('[RM-09] ignore un ordre de don d\'or ou d\'éther', () => {
    const order = (cmd: unknown) => JSON.stringify({ t: 'order', tick: 5, cmd, fingerprint: 'abc' });

    expect(readClientMessage(JSON.stringify({ t: 'gift', to: 2, gold: 10 }))).toBeNull();
    expect(readClientMessage(JSON.stringify({ t: 'gift', to: 2, ether: 5 }))).toBeNull();
    expect(readClientMessage(order({ c: 'give', to: 2, gold: 10 }))).toBeNull();
    expect(readClientMessage(order({ c: 'gift', to: 2, ether: 5 }))).toBeNull();
  });

  it('[CU-02] lit le choix d\'équipe A ou B et rejette toute autre valeur', () => {
    expect(readClientMessage(JSON.stringify({ t: 'chooseTeam', team: 'a' }))).toEqual({
      t: ClientMessageType.ChooseTeam,
      team: Team.A,
    });
    expect(readClientMessage(JSON.stringify({ t: 'chooseTeam', team: 'b' }))).toEqual({
      t: ClientMessageType.ChooseTeam,
      team: Team.B,
    });
    expect(readClientMessage(JSON.stringify({ t: 'chooseTeam', team: 'c' }))).toBeNull();
    expect(readClientMessage(JSON.stringify({ t: 'chooseTeam' }))).toBeNull();
    expect(readClientMessage(JSON.stringify({ t: 'chooseTeam', team: 1 }))).toBeNull();
  });

  it('[CU-02] lit le changement de carte de l\'hôte avec son biome', () => {
    const map = drawMap(7, 'snow', MAP_RECIPE);

    const read = readClientMessage(JSON.stringify({ t: 'chooseMap', map }));

    expect(read).toEqual({ t: ClientMessageType.ChooseMap, map });
    expect(read).toMatchObject({ map: { biome: 'snow' } });
  });

  it('[RM-12] accepte une carte Neige transmise au salon', () => {
    const map = drawMap(7, 'snow', MAP_RECIPE);

    expect(map.rows.join('')).toContain('*');
    expect(readClientMessage(JSON.stringify({ t: 'chooseMap', map }))).toEqual({
      t: ClientMessageType.ChooseMap,
      map,
    });
  });

  it('[CU-02] refuse un changement de carte sans carte valide', () => {
    expect(readClientMessage(JSON.stringify({ t: 'chooseMap', map: MAP_TWO_STONES }))).not.toBeNull();
    expect(readClientMessage(JSON.stringify({ t: 'chooseMap' }))).toBeNull();
    expect(
      readClientMessage(JSON.stringify({ t: 'chooseMap', map: { ...MAP_TWO_STONES, biome: 'lave' } })),
    ).toBeNull();
    expect(readClientMessage(JSON.stringify({ t: 'chooseMap', map: {} }))).toBeNull();
    expect(readClientMessage(JSON.stringify({ t: 'chooseMap', map: null }))).toBeNull();
  });

  it("lit le changement de difficulté de l'hôte au salon", () => {
    expect(readClientMessage(JSON.stringify({ t: 'chooseDifficulty', difficulty: 'hard' }))).toEqual({
      t: ClientMessageType.ChooseDifficulty,
      difficulty: 'hard',
    });
  });

  it('refuse un changement de difficulté inconnue', () => {
    expect(readClientMessage(JSON.stringify({ t: 'chooseDifficulty', difficulty: 'cauchemar' }))).toBeNull();
    expect(readClientMessage(JSON.stringify({ t: 'chooseDifficulty' }))).toBeNull();
  });

  it('[RM-05] refuse de créer ou rejoindre une partie sans pseudo de 2 à 32 caractères', () => {
    for (const nick of ['', '   ', 'A', ' B ', 'A'.repeat(33)]) {
      expect(readClientMessage(JSON.stringify({ t: 'host', nick, map: MAP_TWO_STONES, difficulty: 'hard' }))).toBeNull();
      expect(readClientMessage(JSON.stringify({ t: 'join', nick, code: 'ABCDEF' }))).toBeNull();
    }
  });

  it('[RM-05] garde le pseudo sans ses espaces de bord quand il fait de 2 à 32 caractères', () => {
    expect(readClientMessage(JSON.stringify({ t: 'join', nick: '  Bo  ', code: 'ABCDEF' }))).toEqual({ t: 'join', nick: 'Bo', code: 'ABCDEF' });
    expect(readClientMessage(JSON.stringify({ t: 'host', nick: 'A'.repeat(32), map: MAP_TWO_STONES, difficulty: 'hard' }))).toMatchObject({ nick: 'A'.repeat(32) });
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

  it('rejette l\'appel de vague, retiré du jeu, en solo comme à deux', () => {
    expect(readClientMessage(JSON.stringify({ t: 'ready' }))).toBeNull();
    expect(
      readClientMessage(JSON.stringify({ t: 'order', tick: 1, cmd: { c: 'callWave' }, fingerprint: 'abc' })),
    ).toBeNull();
  });

  it('[CU-07] lit la demande de reprise avec code et jeton', () => {
    const raw = JSON.stringify({ t: 'rejoin', code: 'ABCDEF', token: 'tok-1' });

    expect(readClientMessage(raw)).toEqual({ t: 'rejoin', code: 'ABCDEF', token: 'tok-1' });
  });
});
