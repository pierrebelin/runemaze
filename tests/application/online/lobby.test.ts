import { describe, expect, it } from 'vitest';
import { DUEL_CODE_ALPHABET, duelCode, nickname, Lobby } from '../../../src/application/online/lobby';
import { Mode, ServerMessageType, Team } from '../../../src/application/online/protocol';
import { CODE_TAKEN_MSG, Seat } from '../../../src/application/online/duel';
import { LOST_LIMIT_MS } from '../../../src/application/online/heldGame';
import { BIOMES } from '../../../src/domain/catalog/map';
import { MAP_SPIRAL } from '../../support/maps';
import { snapshot } from '../../../src/domain/model/snapshot';

describe('lobby', () => {
  it('[RM-03] forme un code de 6 lettres majuscules sans I ni O quels que soient les tirages', () => {
    const jeux = [
      [0, 1, 2, 3, 4, 5],
      [100, 200, 300, 400, 500, 600],
      [8, 14, 23, 47, 8, 14],
      [999_999, 0, 8, 14, 1_000_000, 123_456],
    ];

    for (const draws of jeux) {
      const code = duelCode(draws);
      expect(code).toHaveLength(6);
      for (const letter of code) {
        expect(DUEL_CODE_ALPHABET).toContain(letter);
      }
      expect(code).not.toMatch(/I|O/);
    }

    expect(duelCode([0, 8, 14, 23, 24, 25])).toBe('AJQZAB');
  });

  it('[CU-01] ouvre un salon en attente avec la carte et la difficulté de l\'hôte', () => {
    const lobby = new Lobby();

    const addressed = lobby.host({ code: 'ABCDEF', nick: 'Zig', map: MAP_SPIRAL, difficulty: 'hard', key: 'k1' });

    expect(addressed).toEqual([
      {
        key: 'k1',
        msg: {
          t: ServerMessageType.Hosted,
          code: 'ABCDEF',
          host: 'Zig',
          map: MAP_SPIRAL,
          difficulty: 'hard',
          mode: Mode.Duel,
        },
      },
    ]);
  });

  it('[RM-01] annonce le mode choisi à l\'hôte à la création', () => {
    const lobby = new Lobby();

    const addressed = lobby.host({ code: 'ABCDEF', nick: 'Zig', map: MAP_SPIRAL, difficulty: 'hard', key: 'k1', mode: Mode.Coop });

    expect(addressed).toEqual([
      { key: 'k1', msg: expect.objectContaining({ t: ServerMessageType.Hosted, mode: Mode.Coop }) },
    ]);
  });

  it('[RM-01] montre le mode de l\'hôte à l\'invité qui rejoint', () => {
    const lobby = new Lobby();
    lobby.host({ code: 'ABCDEF', nick: 'Ada', map: MAP_SPIRAL, difficulty: 'hard', key: 'h', mode: Mode.Coop });

    const addressed = lobby.join({ code: 'ABCDEF', nick: 'Bob', key: 'g' });

    expect(addressed).toContainEqual({
      key: 'g',
      msg: expect.objectContaining({ t: ServerMessageType.Room, mode: Mode.Coop }),
    });
  });

  it('[RM-05] garde le pseudo saisi quand il fait de 1 à 12 caractères', () => {
    expect(nickname('A', 'Hôte')).toBe('A');
    expect(nickname('Douze_lettre', 'Hôte')).toBe('Douze_lettre');
    expect(nickname('Douze_lettre', 'Hôte')).toHaveLength(12);
  });

  it('[RM-05] nomme « Hôte » l\'hôte au pseudo vide et tronque au-delà de 12 caractères', () => {
    const lobby = new Lobby();

    const vide = lobby.host({ code: 'AAAAAA', nick: '', map: MAP_SPIRAL, difficulty: 'easy', key: 'k2' });
    const blanc = lobby.host({ code: 'BBBBBB', nick: '   ', map: MAP_SPIRAL, difficulty: 'easy', key: 'k3' });
    const long = lobby.host({
      code: 'CCCCCC',
      nick: 'Quinze_lettres!',
      map: MAP_SPIRAL,
      difficulty: 'easy',
      key: 'k4',
    });

    expect(vide).toEqual([{ key: 'k2', msg: expect.objectContaining({ host: 'Hôte' }) }]);
    expect(blanc).toEqual([{ key: 'k3', msg: expect.objectContaining({ host: 'Hôte' }) }]);
    expect(long).toEqual([{ key: 'k4', msg: expect.objectContaining({ host: 'Quinze_lettr' }) }]);
    expect(long[0].msg).toMatchObject({});
    if ('host' in (long[0].msg as { host?: string })) {
      expect((long[0].msg as { host: string }).host).toHaveLength(12);
    }
  });

  it('[RM-03] signale un code déjà pris pour qu\'un autre soit tiré', () => {
    const lobby = new Lobby();
    expect(lobby.taken('DDDDDD')).toBe(false);

    lobby.host({ code: 'DDDDDD', nick: 'Zig', map: MAP_SPIRAL, difficulty: 'normal', key: 'k5' });

    expect(lobby.taken('DDDDDD')).toBe(true);
    expect(lobby.taken('EEEEEE')).toBe(false);
  });

  it('[CU-02] fait entrer l\'invité et lui montre le pseudo de l\'hôte, la carte et la difficulté', () => {
    const lobby = new Lobby();
    lobby.host({ code: 'FFFFFF', nick: 'Ada', map: MAP_SPIRAL, difficulty: 'hard', key: 'h' });

    const addressed = lobby.join({ code: 'FFFFFF', nick: 'Bob', key: 'g' });

    expect(addressed).toContainEqual({
      key: 'g',
      msg: { t: ServerMessageType.Room, host: 'Ada', guest: 'Bob', map: MAP_SPIRAL, difficulty: 'hard', mode: Mode.Duel, picked: { host: false, guest: false } },
    });
  });

  it('[CU-01] annonce le pseudo de l\'invité à l\'hôte quand il arrive', () => {
    const lobby = new Lobby();
    lobby.host({ code: 'GGGGGG', nick: 'Ada', map: MAP_SPIRAL, difficulty: 'hard', key: 'h' });

    const addressed = lobby.join({ code: 'GGGGGG', nick: 'Bob', key: 'g' });

    expect(addressed).toContainEqual({
      key: 'h',
      msg: { t: ServerMessageType.Room, host: 'Ada', guest: 'Bob', map: MAP_SPIRAL, difficulty: 'hard', mode: Mode.Duel, picked: { host: false, guest: false } },
    });
  });

  it('[RM-05] nomme « Invité » l\'invité au pseudo vide', () => {
    const lobby = new Lobby();
    lobby.host({ code: 'HHHHHH', nick: 'Ada', map: MAP_SPIRAL, difficulty: 'hard', key: 'h' });

    const addressed = lobby.join({ code: 'HHHHHH', nick: '  ', key: 'g' });

    for (const a of addressed) {
      expect(a.msg).toMatchObject({ guest: 'Invité' });
    }
  });

  it('[RM-04] refuse un troisième joueur avec « Code invalide ou partie déjà commencée. »', () => {
    const lobby = new Lobby();
    lobby.host({ code: 'IIIIII', nick: 'Ada', map: MAP_SPIRAL, difficulty: 'hard', key: 'h' });
    lobby.join({ code: 'IIIIII', nick: 'Bob', key: 'g' });

    const addressed = lobby.join({ code: 'IIIIII', nick: 'Cid', key: 'c' });

    expect(addressed).toEqual([
      { key: 'c', msg: { t: ServerMessageType.Refused, reason: 'Code invalide ou partie déjà commencée.' } },
    ]);
  });

  it('[CU-02] refuse un code inconnu avec « Code invalide ou partie déjà commencée. »', () => {
    const lobby = new Lobby();

    const addressed = lobby.join({ code: 'ZZZZZZ', nick: 'Bob', key: 'g' });

    expect(addressed).toEqual([
      { key: 'g', msg: { t: ServerMessageType.Refused, reason: 'Code invalide ou partie déjà commencée.' } },
    ]);
  });

  it('[RM-03] annule le code quand l\'hôte quitte le salon et prévient l\'invité', () => {
    const lobby = new Lobby();
    lobby.host({ code: 'ABCDEF', nick: 'Ada', map: MAP_SPIRAL, difficulty: 'hard', key: 'h' });
    lobby.join({ code: 'ABCDEF', nick: 'Bob', key: 'g' });

    const addressed = lobby.leave('h', 0);

    expect(addressed).toEqual([{ key: 'g', msg: { t: ServerMessageType.Cancelled } }]);
    expect(lobby.taken('ABCDEF')).toBe(false);
  });

  it('[RM-03] refuse de rejoindre un code annulé', () => {
    const lobby = new Lobby();
    lobby.host({ code: 'JJJJJJ', nick: 'Ada', map: MAP_SPIRAL, difficulty: 'hard', key: 'h' });

    expect(lobby.leave('h', 0)).toEqual([]);

    const addressed = lobby.join({ code: 'JJJJJJ', nick: 'Bob', key: 'g' });

    expect(addressed).toEqual([
      { key: 'g', msg: { t: ServerMessageType.Refused, reason: 'Code invalide ou partie déjà commencée.' } },
    ]);
  });

  it('[CU-01] remet le salon en attente quand l\'invité le quitte', () => {
    const lobby = new Lobby();
    lobby.host({ code: 'KKKKKK', nick: 'Ada', map: MAP_SPIRAL, difficulty: 'hard', key: 'h' });
    lobby.join({ code: 'KKKKKK', nick: 'Bob', key: 'g' });

    const addressed = lobby.leave('g', 0);

    expect(addressed).toEqual([
      {
        key: 'h',
        msg: { t: ServerMessageType.Room, host: 'Ada', guest: null, map: MAP_SPIRAL, difficulty: 'hard', mode: Mode.Duel, picked: { host: false, guest: false } },
      },
    ]);

    const rejoin = lobby.join({ code: 'KKKKKK', nick: 'Cy', key: 'z' });

    expect(rejoin).toContainEqual({
      key: 'z',
      msg: { t: ServerMessageType.Room, host: 'Ada', guest: 'Cy', map: MAP_SPIRAL, difficulty: 'hard', mode: Mode.Duel, picked: { host: false, guest: false } },
    });
  });

  it('[RM-03] annule le premier code quand la même connexion crée un second salon', () => {
    const lobby = new Lobby();
    lobby.host({ code: 'ABCDEF', nick: 'Ada', map: MAP_SPIRAL, difficulty: 'hard', key: 'h' });

    lobby.host({ code: 'GHJKLM', nick: 'Ada', map: MAP_SPIRAL, difficulty: 'hard', key: 'h' });

    expect(lobby.taken('ABCDEF')).toBe(false);
    expect(lobby.taken('GHJKLM')).toBe(true);

    const addressed = lobby.join({ code: 'ABCDEF', nick: 'Bob', key: 'g' });
    expect(addressed).toEqual([
      { key: 'g', msg: { t: ServerMessageType.Refused, reason: 'Code invalide ou partie déjà commencée.' } },
    ]);

    lobby.leave('h', 0);
    expect(lobby.taken('GHJKLM')).toBe(false);
  });

  it('[RM-04] retire l\'invité de son salon quand la même connexion rejoint ou crée un autre salon', () => {
    const lobby = new Lobby();
    lobby.host({ code: 'ABCDEF', nick: 'Ada', map: MAP_SPIRAL, difficulty: 'hard', key: 'ha' });
    lobby.host({ code: 'GHJKLM', nick: 'Bea', map: MAP_SPIRAL, difficulty: 'hard', key: 'hb' });
    lobby.join({ code: 'ABCDEF', nick: 'Gus', key: 'g' });

    const addressed = lobby.join({ code: 'GHJKLM', nick: 'Gus', key: 'g' });

    expect(addressed).toContainEqual({
      key: 'ha',
      msg: { t: ServerMessageType.Room, host: 'Ada', guest: null, map: MAP_SPIRAL, difficulty: 'hard', mode: Mode.Duel, picked: { host: false, guest: false } },
    });
    expect(addressed).toContainEqual({
      key: 'hb',
      msg: { t: ServerMessageType.Room, host: 'Bea', guest: 'Gus', map: MAP_SPIRAL, difficulty: 'hard', mode: Mode.Duel, picked: { host: false, guest: false } },
    });
    expect(addressed).toContainEqual({
      key: 'g',
      msg: { t: ServerMessageType.Room, host: 'Bea', guest: 'Gus', map: MAP_SPIRAL, difficulty: 'hard', mode: Mode.Duel, picked: { host: false, guest: false } },
    });

    const rejoinA = lobby.join({ code: 'ABCDEF', nick: 'Zoe', key: 'z' });
    expect(rejoinA).toContainEqual({
      key: 'z',
      msg: { t: ServerMessageType.Room, host: 'Ada', guest: 'Zoe', map: MAP_SPIRAL, difficulty: 'hard', mode: Mode.Duel, picked: { host: false, guest: false } },
    });

    lobby.host({ code: 'NPQRST', nick: 'Zoe', map: MAP_SPIRAL, difficulty: 'hard', key: 'z' });

    const rejoinA2 = lobby.join({ code: 'ABCDEF', nick: 'Zoe2', key: 'z2' });
    expect(rejoinA2).toContainEqual({
      key: 'z2',
      msg: { t: ServerMessageType.Room, host: 'Ada', guest: 'Zoe2', map: MAP_SPIRAL, difficulty: 'hard', mode: Mode.Duel, picked: { host: false, guest: false } },
    });
  });

  it('[RM-04] prévient l\'hôte, ou annule le code chez l\'invité, quand la même connexion crée un autre salon', () => {
    const lobby = new Lobby();
    lobby.host({ code: 'ABCDEF', nick: 'Ada', map: MAP_SPIRAL, difficulty: 'hard', key: 'ha' });
    lobby.join({ code: 'ABCDEF', nick: 'Gus', key: 'g' });

    const addressed = lobby.host({ code: 'GHJKLM', nick: 'Gus', map: MAP_SPIRAL, difficulty: 'hard', key: 'g' });

    expect(addressed).toContainEqual({
      key: 'ha',
      msg: { t: ServerMessageType.Room, host: 'Ada', guest: null, map: MAP_SPIRAL, difficulty: 'hard', mode: Mode.Duel, picked: { host: false, guest: false } },
    });
    expect(addressed).toContainEqual({
      key: 'g',
      msg: { t: ServerMessageType.Hosted, code: 'GHJKLM', host: 'Gus', map: MAP_SPIRAL, difficulty: 'hard', mode: Mode.Duel },
    });

    const lobby2 = new Lobby();
    lobby2.host({ code: 'NPQRST', nick: 'Ada', map: MAP_SPIRAL, difficulty: 'hard', key: 'h2' });
    lobby2.join({ code: 'NPQRST', nick: 'Bob', key: 'b' });

    const addressed2 = lobby2.host({ code: 'UVWXYZ', nick: 'Ada', map: MAP_SPIRAL, difficulty: 'hard', key: 'h2' });

    expect(addressed2).toContainEqual({ key: 'b', msg: { t: ServerMessageType.Cancelled } });
    expect(addressed2).toContainEqual({
      key: 'h2',
      msg: { t: ServerMessageType.Hosted, code: 'UVWXYZ', host: 'Ada', map: MAP_SPIRAL, difficulty: 'hard', mode: Mode.Duel },
    });
  });

  it('[RM-04] refuse à l\'hôte de rejoindre son propre salon', () => {
    const lobby = new Lobby();
    lobby.host({ code: 'ABCDEF', nick: 'Ada', map: MAP_SPIRAL, difficulty: 'hard', key: 'ha' });

    const addressed = lobby.join({ code: 'ABCDEF', nick: 'Ada', key: 'ha' });

    expect(addressed).toEqual([
      { key: 'ha', msg: { t: ServerMessageType.Refused, reason: 'Code invalide ou partie déjà commencée.' } },
    ]);
    expect(lobby.taken('ABCDEF')).toBe(true);

    const rejoin = lobby.join({ code: 'ABCDEF', nick: 'Gus', key: 'g' });
    expect(rejoin).toContainEqual({
      key: 'g',
      msg: { t: ServerMessageType.Room, host: 'Ada', guest: 'Gus', map: MAP_SPIRAL, difficulty: 'hard', mode: Mode.Duel, picked: { host: false, guest: false } },
    });
  });

  it('[CU-03] donne aux deux joueurs la même carte, même or, mêmes vies et même compte à rebours', () => {
    const lobby = new Lobby();
    lobby.host({ code: 'ABCDEF', nick: 'Ada', map: MAP_SPIRAL, difficulty: 'hard', key: 'k1' });
    lobby.join({ code: 'ABCDEF', nick: 'Bob', key: 'k2' });

    lobby.choose('k1', 'bastion');
    lobby.choose('k2', 'bastion');
    const addressed = lobby.start('k1', 7, ['th', 'tg'], 0);

    const forHost = addressed.find((a) => a.key === 'k1')?.msg;
    const forGuest = addressed.find((a) => a.key === 'k2')?.msg;

    expect(forHost?.t).toBe(ServerMessageType.DuelStarted);
    expect(forGuest?.t).toBe(ServerMessageType.DuelStarted);

    const host = forHost as { t: ServerMessageType.DuelStarted; seat: Seat; token: string; snapshot: { gold: number; lives: number; map: unknown; nextWaveIn: number }; others: { seat: number; nick: string; snapshot: { gold: number; lives: number; map: unknown; nextWaveIn: number } }[] };
    const guest = forGuest as typeof host;

    expect(host.seat).toBe(Seat.Host);
    expect(host.token).toBe('th');
    expect(host.others[0].nick).toBe('Bob');
    expect(guest.seat).toBe(Seat.Guest);
    expect(guest.token).toBe('tg');
    expect(guest.others[0].nick).toBe('Ada');

    for (const snap of [host.snapshot, host.others[0].snapshot, guest.snapshot, guest.others[0].snapshot]) {
      expect(snap.gold).toBe(host.snapshot.gold);
      expect(snap.lives).toBe(host.snapshot.lives);
      expect(snap.map).toEqual(MAP_SPIRAL);
      expect(snap.nextWaveIn).toBe(host.snapshot.nextWaveIn);
    }
  });

  it('[RM-03] refuse de rejoindre un code dont le duel est lancé', () => {
    const lobby = new Lobby();
    lobby.host({ code: 'ABCDEF', nick: 'Ada', map: MAP_SPIRAL, difficulty: 'hard', key: 'k1' });
    lobby.join({ code: 'ABCDEF', nick: 'Bob', key: 'k2' });
    lobby.choose('k1', 'bastion');
    lobby.choose('k2', 'bastion');
    lobby.start('k1', 7, ['th', 'tg'], 0);

    const addressed = lobby.join({ code: 'ABCDEF', nick: 'Cid', key: 'k3' });

    expect(addressed).toEqual([
      { key: 'k3', msg: { t: ServerMessageType.Refused, reason: 'Code invalide ou partie déjà commencée.' } },
    ]);
    expect(lobby.duel('ABCDEF')).toBeDefined();
  });

  it('[CU-03] refuse de lancer tant qu\'aucun invité n\'est présent', () => {
    const lobby = new Lobby();
    lobby.host({ code: 'ABCDEF', nick: 'Ada', map: MAP_SPIRAL, difficulty: 'hard', key: 'k1' });

    lobby.choose('k1', 'bastion');
    lobby.choose('k2', 'bastion');
    const addressed = lobby.start('k1', 7, ['th', 'tg'], 0);

    expect(addressed).toHaveLength(1);
    expect(addressed[0].key).toBe('k1');
    expect(addressed[0].msg.t).toBe(ServerMessageType.Refused);
    expect(lobby.duel('ABCDEF')).toBeUndefined();
  });

  it('[CU-03] refuse le lancement demandé par l\'invité', () => {
    const lobby = new Lobby();
    lobby.host({ code: 'ABCDEF', nick: 'Ada', map: MAP_SPIRAL, difficulty: 'hard', key: 'k1' });
    lobby.join({ code: 'ABCDEF', nick: 'Bob', key: 'k2' });

    const addressed = lobby.start('k2', 7, ['th', 'tg'], 0);

    expect(addressed).toContainEqual(expect.objectContaining({ key: 'k2', msg: expect.objectContaining({ t: ServerMessageType.Refused }) }));
    expect(lobby.duel('ABCDEF')).toBeUndefined();
  });

  it('[RM-03] tient pour pris le code d\'un duel en cours', () => {
    const lobby = new Lobby();
    lobby.host({ code: 'ABCDEF', nick: 'Ada', map: MAP_SPIRAL, difficulty: 'hard', key: 'k1' });
    lobby.join({ code: 'ABCDEF', nick: 'Bob', key: 'k2' });

    lobby.choose('k1', 'bastion');
    lobby.choose('k2', 'bastion');
    lobby.start('k1', 7, ['th', 'tg'], 0);

    expect(lobby.taken('ABCDEF')).toBe(true);
  });

  it('[RM-13] gèle le duel quand un joueur quitte volontairement', () => {
    const lobby = new Lobby();
    lobby.host({ code: 'ABCDEF', nick: 'Ada', map: MAP_SPIRAL, difficulty: 'hard', key: 'h' });
    lobby.join({ code: 'ABCDEF', nick: 'Bob', key: 'g' });
    lobby.choose('h', 'bastion');
    lobby.choose('g', 'bastion');
    lobby.start('h', 7, ['th', 'tg'], 0);
    const duel = lobby.duel('ABCDEF')!;
    duel.advance(5_000);

    const addressed = lobby.leave('g', 6_000);

    expect(addressed).toEqual([{ key: 'h', msg: { t: ServerMessageType.Frozen, remainingMs: LOST_LIMIT_MS } }]);
    const ticks = duel.worlds.map((w) => w.tick);

    lobby.duel('ABCDEF')!.advance(16_000);

    expect(duel.worlds.map((w) => w.tick)).toEqual(ticks);
  });

  function duelCoupe() {
    const lobby = new Lobby();
    lobby.host({ code: 'ABCDEF', nick: 'Ada', map: MAP_SPIRAL, difficulty: 'hard', key: 'h' });
    lobby.join({ code: 'ABCDEF', nick: 'Bob', key: 'g' });
    lobby.choose('h', 'bastion');
    lobby.choose('g', 'bastion');
    lobby.start('h', 7, ['th', 'tg'], 0);
    const duel = lobby.duel('ABCDEF')!;
    duel.advance(5_000);
    lobby.leave('g', 6_000);
    return { lobby, duel, t: 6_000, code: 'ABCDEF' };
  }

  it('[CU-07] rend au joueur revenu sa carte dans l\'état exact de la coupure', () => {
    const { lobby, duel, t, code } = duelCoupe();
    const guestSnap = snapshot(duel.worlds[Seat.Guest]);
    const hostSnap = snapshot(duel.worlds[Seat.Host]);

    const addressed = lobby.rejoin({ code, token: 'tg', key: 'g2' }, t + 5_000);

    expect(addressed.filter((a) => a.key === 'g2').map((a) => a.msg)).toEqual([
      { t: ServerMessageType.Thawed, seat: Seat.Guest, snapshot: guestSnap, others: [{ seat: Seat.Host, nick: expect.any(String), snapshot: hostSnap }] },
    ]);
  });

  it('[RM-12] relance les deux cartes et prévient l\'autre joueur au retour', () => {
    const { lobby, duel, t, code } = duelCoupe();
    const guestSnap = snapshot(duel.worlds[Seat.Guest]);
    const hostSnap = snapshot(duel.worlds[Seat.Host]);

    const addressed = lobby.rejoin({ code, token: 'tg', key: 'g2' }, t + 5_000);

    expect(addressed).toContainEqual({
      key: 'h',
      msg: { t: ServerMessageType.Thawed, seat: Seat.Host, snapshot: hostSnap, others: [{ seat: Seat.Guest, nick: expect.any(String), snapshot: guestSnap }] },
    });

    const before = duel.worlds.map((w) => w.tick);
    lobby.duel(code)!.advance(t + 5_000 + 10_000);

    duel.worlds.forEach((w, i) => {
      expect(Math.abs(w.tick - before[i] - 600)).toBeLessThanOrEqual(2);
    });
  });

  it('[CU-07] refuse la reprise avec le bon code et un jeton étranger', () => {
    const { lobby, duel, t, code } = duelCoupe();
    const ticks = duel.worlds.map((w) => w.tick);

    const addressed = lobby.rejoin({ code, token: 'mauvais', key: 'x' }, t + 5_000);

    expect(addressed).toEqual([
      { key: 'x', msg: { t: ServerMessageType.Refused, reason: 'Code invalide ou partie déjà commencée.' } },
    ]);

    lobby.duel(code)!.advance(t + 15_000);

    expect(duel.worlds.map((w) => w.tick)).toEqual(ticks);
  });

  it('[CU-07] répond « La partie est terminée. » à une reprise après le délai', () => {
    const { lobby, t, code } = duelCoupe();

    const addressed = lobby.rejoin({ code, token: 'tg', key: 'g2' }, t + LOST_LIMIT_MS + 1);

    expect(addressed).toEqual([
      { key: 'g2', msg: { t: ServerMessageType.Refused, reason: 'La partie est terminée.' } },
    ]);
    expect(addressed.some((a) => a.key === 'h')).toBe(false);
  });

  it('[CU-07] répond « La partie est terminée. » à une reprise sur un duel retiré', () => {
    const { lobby, duel, t, code } = duelCoupe();
    const fin = t + LOST_LIMIT_MS + 1;
    duel.advance(fin);
    lobby.sweep(fin);
    expect(lobby.duel(code)).toBeUndefined();

    const addressed = lobby.rejoin({ code, token: 'tg', key: 'g2' }, fin + 10_000);

    expect(addressed).toEqual([
      { key: 'g2', msg: { t: ServerMessageType.Refused, reason: 'La partie est terminée.' } },
    ]);
  });

  it('[RM-03] libère le code d\'un duel fini', () => {
    const lobby = new Lobby();
    lobby.host({ code: 'ABCDEF', nick: 'Ada', map: MAP_SPIRAL, difficulty: 'hard', key: 'h' });
    lobby.join({ code: 'ABCDEF', nick: 'Bob', key: 'g' });
    lobby.choose('h', 'bastion');
    lobby.choose('g', 'bastion');
    lobby.start('h', 7, ['th', 'tg'], 0);
    lobby.sweep(1_000);
    expect(lobby.taken('ABCDEF')).toBe(true);
    expect(lobby.duel('ABCDEF')).toBeDefined();

    lobby.leave('g', 6_000);
    const fin = 6_000 + LOST_LIMIT_MS + 1;
    lobby.duel('ABCDEF')!.advance(fin);
    lobby.sweep(fin);

    expect(lobby.taken('ABCDEF')).toBe(false);
    expect(lobby.duel('ABCDEF')).toBeUndefined();
  });

  it('[RM-12] libère le code d\'un duel dont la coupure a expiré quand aucun joueur n\'est resté', () => {
    const { lobby, t, code } = duelCoupe();
    lobby.leave('h', t + 1_000);

    lobby.sweep(t + 2_000);

    expect(lobby.taken(code)).toBe(true);
    expect(lobby.duel(code)).toBeDefined();

    lobby.sweep(t + 1_000 + LOST_LIMIT_MS + 1);

    expect(lobby.taken(code)).toBe(false);
    expect(lobby.duel(code)).toBeUndefined();
  });

  it('[CU-07] rend sa place au joueur coupé quand l\'autre part pendant le gel', () => {
    const { lobby, code } = duelCoupe();

    expect(lobby.leave('h', 7_000)).toEqual([]);

    const addressed = lobby.rejoin({ code, token: 'tg', key: 'g2' }, 10_000);

    expect(addressed.filter((a) => a.key === 'g2').map((a) => a.msg)).toEqual([
      expect.objectContaining({ t: ServerMessageType.Thawed, seat: Seat.Guest }),
      { t: ServerMessageType.Frozen, remainingMs: expect.any(Number) },
    ]);
  });

  function salonPret() {
    const lobby = new Lobby();
    lobby.host({ code: 'ABCDEF', nick: 'Ada', map: MAP_SPIRAL, difficulty: 'hard', key: 'h' });
    lobby.join({ code: 'ABCDEF', nick: 'Bob', key: 'g' });
    return lobby;
  }

  const WAITING_BUILDERS_MSG = 'En attente du choix des bâtisseurs.';

  it('[CU-02] annonce aux deux joueurs qu\'un joueur a choisi sans dire lequel', () => {
    const lobby = salonPret();

    const addressed = lobby.choose('h', 'forge');

    const room = {
      t: ServerMessageType.Room,
      host: 'Ada',
      guest: 'Bob',
      map: MAP_SPIRAL,
      difficulty: 'hard',
      mode: Mode.Duel,
      picked: { host: true, guest: false },
    };
    expect(addressed).toContainEqual({ key: 'h', msg: room });
    expect(addressed).toContainEqual({ key: 'g', msg: room });
    expect(JSON.stringify(addressed)).not.toContain('forge');
  });

  it('[CU-02] lance le duel avec le bâtisseur choisi par chaque joueur', () => {
    const lobby = salonPret();
    lobby.choose('h', 'forge');
    lobby.choose('g', 'sylve');

    lobby.start('h', 7, ['th', 'tg'], 0);

    const duel = lobby.duel('ABCDEF')!;
    expect(duel.worlds[Seat.Host].builder.id).toBe('forge');
    expect(duel.worlds[Seat.Guest].builder.id).toBe('sylve');
  });

  it('[RM-04] révèle à chaque joueur le bâtisseur adverse au lancement', () => {
    const lobby = salonPret();
    lobby.choose('h', 'forge');
    lobby.choose('g', 'sylve');

    const addressed = lobby.start('h', 7, ['th', 'tg'], 0);

    const forHost = addressed.find((a) => a.key === 'h')!.msg as { others: { snapshot: { builder: string } }[] };
    const forGuest = addressed.find((a) => a.key === 'g')!.msg as { others: { snapshot: { builder: string } }[] };
    expect(forHost.others[0].snapshot.builder).toBe('sylve');
    expect(forGuest.others[0].snapshot.builder).toBe('forge');
  });

  it('[CU-02] lance le duel quand les deux joueurs ont choisi le même bâtisseur', () => {
    const lobby = salonPret();
    lobby.choose('h', 'forge');
    lobby.choose('g', 'forge');

    const addressed = lobby.start('h', 7, ['th', 'tg'], 0);

    expect(addressed.map((a) => [a.key, a.msg.t])).toEqual([
      ['h', ServerMessageType.DuelStarted],
      ['g', ServerMessageType.DuelStarted],
    ]);
    const duel = lobby.duel('ABCDEF')!;
    expect(duel.worlds.map((w) => w.builder.id)).toEqual(['forge', 'forge']);
  });

  it('[RM-01] refuse le lancement tant qu\'un joueur n\'a pas choisi son bâtisseur', () => {
    const lobby = salonPret();
    lobby.choose('h', 'forge');

    const addressed = lobby.start('h', 7, ['th', 'tg'], 0);

    expect(addressed).toEqual([{ key: 'h', msg: { t: ServerMessageType.Refused, reason: WAITING_BUILDERS_MSG } }]);
    expect(lobby.duel('ABCDEF')).toBeUndefined();
  });

  it('[RM-01] garde le dernier choix d\'un joueur qui change d\'avis dans le salon', () => {
    const lobby = salonPret();
    lobby.choose('h', 'forge');
    lobby.choose('h', 'sylve');
    lobby.choose('g', 'bastion');

    lobby.start('h', 7, ['th', 'tg'], 0);

    expect(lobby.duel('ABCDEF')!.worlds[Seat.Host].builder.id).toBe('sylve');
  });

  it('[RM-04] oublie le choix de l\'invité qui quitte le salon', () => {
    const lobby = salonPret();
    lobby.choose('g', 'sylve');
    lobby.leave('g', 0);

    const addressed = lobby.join({ code: 'ABCDEF', nick: 'Cy', key: 'z' });

    expect(addressed).toContainEqual({
      key: 'z',
      msg: expect.objectContaining({ t: ServerMessageType.Room, guest: 'Cy', picked: { host: false, guest: false } }),
    });
    lobby.choose('h', 'forge');
    expect(lobby.start('h', 7, ['th', 'tg'], 0)).toEqual([
      { key: 'h', msg: { t: ServerMessageType.Refused, reason: WAITING_BUILDERS_MSG } },
    ]);
  });

  it('[CU-01] lance une partie coopérative quand l\'hôte a choisi la Coopération', () => {
    const lobby = new Lobby();
    lobby.host({ code: 'ABCDEF', nick: 'Ada', map: MAP_SPIRAL, difficulty: 'hard', key: 'h', mode: Mode.Coop });
    lobby.join({ code: 'ABCDEF', nick: 'Bob', key: 'g' });
    lobby.choose('h', 'forge');
    lobby.choose('g', 'sylve');

    lobby.start('h', 7, ['th', 'tg'], 0);

    const duel = lobby.duel('ABCDEF')!;
    expect(duel.worlds.map((w) => w.duel)).toEqual([false, false]);
    expect(duel.worlds.map((w) => w.lives)).toEqual([20, 20]);
  });

  it('[CU-01] place l\'hôte dans l\'équipe A quand il crée un salon 2 contre 2', () => {
    const lobby = new Lobby();

    const addressed = lobby.host({ code: 'ABCDEF', nick: 'Ada', map: MAP_SPIRAL, difficulty: 'hard', key: 'h', mode: Mode.Teams });

    expect(addressed).toEqual([
      { key: 'h', msg: { t: ServerMessageType.Hosted, code: 'ABCDEF', host: 'Ada', map: MAP_SPIRAL, difficulty: 'hard', mode: Mode.Teams } },
      {
        key: 'h',
        msg: {
          t: ServerMessageType.TeamRoom,
          host: 'Ada',
          map: MAP_SPIRAL,
          difficulty: 'hard',
          teams: { a: [{ nick: 'Ada', picked: false }], b: [] },
          waiting: [],
        },
      },
    ]);
  });

  function teamsRoom() {
    const lobby = new Lobby();
    lobby.host({ code: 'ABCDEF', nick: 'Ada', map: MAP_SPIRAL, difficulty: 'hard', key: 'h', mode: Mode.Teams });
    return lobby;
  }

  function teamRoom(a: string[], b: string[], waiting: string[]) {
    return {
      t: ServerMessageType.TeamRoom,
      host: 'Ada',
      map: MAP_SPIRAL,
      difficulty: 'hard',
      teams: { a: a.map((nick) => ({ nick, picked: false })), b: b.map((nick) => ({ nick, picked: false })) },
      waiting,
    };
  }

  it('[CU-02] montre à tout le salon les deux équipes et le joueur arrivé, encore sans équipe', () => {
    const lobby = teamsRoom();

    const addressed = lobby.join({ code: 'ABCDEF', nick: 'Bob', key: 'g' });

    const msg = teamRoom(['Ada'], [], ['Bob']);
    expect(addressed).toHaveLength(2);
    expect(addressed).toContainEqual({ key: 'h', msg });
    expect(addressed).toContainEqual({ key: 'g', msg });
  });

  it('[CU-02] place le joueur dans l\'équipe choisie et l\'annonce à tout le salon', () => {
    const lobby = teamsRoom();
    lobby.join({ code: 'ABCDEF', nick: 'Bob', key: 'g' });

    const addressed = lobby.pickTeam('g', Team.B);

    const msg = teamRoom(['Ada'], ['Bob'], []);
    expect(addressed).toHaveLength(2);
    expect(addressed).toContainEqual({ key: 'h', msg });
    expect(addressed).toContainEqual({ key: 'g', msg });
  });

  it('[CU-02] fait changer d\'équipe un joueur déjà placé quand l\'autre a une place libre', () => {
    const lobby = teamsRoom();
    lobby.join({ code: 'ABCDEF', nick: 'Bob', key: 'g' });
    lobby.pickTeam('g', Team.B);

    const addressed = lobby.pickTeam('g', Team.A);

    const msg = teamRoom(['Ada', 'Bob'], [], []);
    expect(addressed).toContainEqual({ key: 'h', msg });
    expect(addressed).toContainEqual({ key: 'g', msg });
  });

  it('[CU-02] refuse l\'équipe déjà à 2 joueurs et laisse le joueur où il était', () => {
    const lobby = teamsRoom();
    lobby.join({ code: 'ABCDEF', nick: 'Cy', key: 'c' });
    lobby.pickTeam('c', Team.A);
    lobby.join({ code: 'ABCDEF', nick: 'Bob', key: 'g' });
    lobby.pickTeam('g', Team.B);

    const addressed = lobby.pickTeam('g', Team.A);

    expect(addressed).toEqual([{ key: 'g', msg: { t: ServerMessageType.Refused, reason: 'Cette équipe est complète.' } }]);
    const after = lobby.leave('c', 0);
    expect(after).toContainEqual({ key: 'h', msg: teamRoom(['Ada'], ['Bob'], []) });
  });

  it('[RM-01] refuse un cinquième joueur avec « Code invalide ou partie déjà commencée. »', () => {
    const lobby = teamsRoom();
    lobby.join({ code: 'ABCDEF', nick: 'Bob', key: 'g' });
    lobby.join({ code: 'ABCDEF', nick: 'Cy', key: 'c' });
    const fourth = lobby.join({ code: 'ABCDEF', nick: 'Di', key: 'd' });
    expect(fourth).toContainEqual({ key: 'd', msg: teamRoom(['Ada'], [], ['Bob', 'Cy', 'Di']) });

    const addressed = lobby.join({ code: 'ABCDEF', nick: 'Eve', key: 'e' });

    expect(addressed).toEqual([
      { key: 'e', msg: { t: ServerMessageType.Refused, reason: CODE_TAKEN_MSG } },
    ]);
  });

  it('[CU-02] libère la place du joueur qui quitte le salon et l\'annonce aux autres', () => {
    const lobby = teamsRoom();
    lobby.join({ code: 'ABCDEF', nick: 'Bob', key: 'g' });
    lobby.pickTeam('g', Team.B);

    const addressed = lobby.leave('g', 0);

    expect(addressed).toEqual([{ key: 'h', msg: teamRoom(['Ada'], [], []) }]);
  });

  it('[CU-02] annule le salon chez les trois autres quand l\'hôte le quitte', () => {
    const lobby = teamsRoom();
    for (const [nick, key] of [['Bob', 'g'], ['Cy', 'c'], ['Di', 'd']]) {
      lobby.join({ code: 'ABCDEF', nick, key });
    }

    const addressed = lobby.leave('h', 0);

    expect(addressed).toHaveLength(3);
    for (const key of ['g', 'c', 'd']) {
      expect(addressed).toContainEqual({ key, msg: { t: ServerMessageType.Cancelled } });
    }
  });

  /** Arrivée : Ada (h, A), Bob (g, B), Cy (c, A), Di (d, B) ; sièges : Ada, Cy, Bob, Di. */
  function fourPlayerRoom() {
    const lobby = teamsRoom();
    lobby.join({ code: 'ABCDEF', nick: 'Bob', key: 'g' });
    lobby.pickTeam('g', Team.B);
    lobby.join({ code: 'ABCDEF', nick: 'Cy', key: 'c' });
    lobby.pickTeam('c', Team.A);
    lobby.join({ code: 'ABCDEF', nick: 'Di', key: 'd' });
    lobby.pickTeam('d', Team.B);
    return lobby;
  }

  const TOKENS = ['t0', 't1', 't2', 't3'];
  const WAITING_TEAMS_MSG = 'En attente de deux joueurs par équipe.';

  function chooseAll(lobby: Lobby) {
    lobby.choose('h', 'forge');
    lobby.choose('c', 'sylve');
    lobby.choose('g', 'bastion');
    lobby.choose('d', 'forge');
  }

  it('[CU-03] lance une partie à quatre sièges, équipe A puis équipe B, quand les équipes sont complètes et les bâtisseurs choisis', () => {
    const lobby = fourPlayerRoom();
    chooseAll(lobby);

    lobby.start('h', 7, TOKENS, 0);

    const duel = lobby.duel('ABCDEF')!;
    expect(duel.worlds).toHaveLength(4);
    expect(duel.worlds.map((w) => w.builder.id)).toEqual(['forge', 'sylve', 'bastion', 'forge']);
  });

  it('[CU-03] donne à chaque joueur son siège, son jeton et les trois autres cartes au lancement', () => {
    const lobby = fourPlayerRoom();
    chooseAll(lobby);

    const addressed = lobby.start('h', 7, TOKENS, 0);

    const duel = lobby.duel('ABCDEF')!;
    const nicks = ['Ada', 'Cy', 'Bob', 'Di'];
    expect(addressed).toHaveLength(4);
    ['h', 'c', 'g', 'd'].forEach((key, seat) => {
      const msg = addressed.find((a) => a.key === key)!.msg as {
        t: ServerMessageType; seat: number; token: string; snapshot: unknown; others: { seat: number; nick: string }[];
      };
      expect(msg.t).toBe(ServerMessageType.DuelStarted);
      expect(msg.seat).toBe(seat);
      expect(msg.token).toBe(TOKENS[seat]);
      expect(msg.snapshot).toEqual(snapshot(duel.worlds[seat]));
      const otherSeats = [0, 1, 2, 3].filter((s) => s !== seat);
      expect(msg.others.map((o) => [o.seat, o.nick])).toEqual(otherSeats.map((s) => [s, nicks[s]]));
    });
  });

  it('[RM-02] refuse le lancement tant qu\'une équipe a moins de 2 joueurs', () => {
    const lobby = teamsRoom();
    lobby.join({ code: 'ABCDEF', nick: 'Bob', key: 'g' });
    lobby.pickTeam('g', Team.B);
    lobby.join({ code: 'ABCDEF', nick: 'Cy', key: 'c' });
    lobby.pickTeam('c', Team.A);
    lobby.join({ code: 'ABCDEF', nick: 'Di', key: 'd' });
    chooseAll(lobby);

    const addressed = lobby.start('h', 7, TOKENS, 0);

    expect(addressed).toEqual([{ key: 'h', msg: { t: ServerMessageType.Refused, reason: WAITING_TEAMS_MSG } }]);
    expect(lobby.duel('ABCDEF')).toBeUndefined();
  });

  it('[RM-02] refuse le lancement tant qu\'un des quatre joueurs n\'a pas choisi son bâtisseur', () => {
    const lobby = fourPlayerRoom();
    lobby.choose('h', 'forge');
    lobby.choose('c', 'sylve');
    lobby.choose('g', 'bastion');

    const addressed = lobby.start('h', 7, TOKENS, 0);

    expect(addressed).toEqual([{ key: 'h', msg: { t: ServerMessageType.Refused, reason: WAITING_BUILDERS_MSG } }]);
    expect(lobby.duel('ABCDEF')).toBeUndefined();
  });

  it('[CU-03] annonce à tout le salon qui a choisi son bâtisseur, sans dire lequel', () => {
    const lobby = fourPlayerRoom();

    const addressed = lobby.choose('c', 'sylve');

    const msg = {
      t: ServerMessageType.TeamRoom,
      host: 'Ada',
      map: MAP_SPIRAL,
      difficulty: 'hard',
      teams: {
        a: [{ nick: 'Ada', picked: false }, { nick: 'Cy', picked: true }],
        b: [{ nick: 'Bob', picked: false }, { nick: 'Di', picked: false }],
      },
      waiting: [],
    };
    expect(addressed).toHaveLength(4);
    for (const key of ['h', 'g', 'c', 'd']) {
      expect(addressed).toContainEqual({ key, msg });
    }
    expect(JSON.stringify(addressed)).not.toContain('sylve');
  });

  it('[CU-06] laisse chacun des deux absents reprendre sa place avec son jeton', () => {
    const lobby = fourPlayerRoom();
    chooseAll(lobby);
    lobby.start('h', 7, TOKENS, 0);
    lobby.duel('ABCDEF')!.advance(5_000);
    lobby.leave('c', 6_000);
    lobby.leave('d', 7_000);

    const second = lobby.rejoin({ code: 'ABCDEF', token: 't3', key: 'd2' }, 8_000);

    expect(second.some((a) => a.msg.t === ServerMessageType.Refused)).toBe(false);
    expect(second.filter((a) => a.key === 'd2').map((a) => a.msg)).toContainEqual(
      expect.objectContaining({ t: ServerMessageType.Thawed, seat: 3 }),
    );

    const first = lobby.rejoin({ code: 'ABCDEF', token: 't1', key: 'c2' }, 9_000);

    expect(first.some((a) => a.msg.t === ServerMessageType.Refused)).toBe(false);
    expect(first.filter((a) => a.key === 'c2').map((a) => a.msg)).toContainEqual(
      expect.objectContaining({ t: ServerMessageType.Thawed, seat: 1 }),
    );
    for (const key of ['h', 'c2', 'g', 'd2']) {
      expect(first.filter((a) => a.key === key).map((a) => a.msg.t)).toContain(ServerMessageType.Thawed);
    }
  });

  it('[CU-02] laisse l\'hôte passer en équipe B et lui donne le siège de son rang d\'arrivée au lancement', () => {
    const lobby = teamsRoom();
    lobby.join({ code: 'ABCDEF', nick: 'Bob', key: 'g' });
    lobby.pickTeam('g', Team.A);
    lobby.pickTeam('h', Team.B);
    lobby.join({ code: 'ABCDEF', nick: 'Cy', key: 'c' });
    lobby.pickTeam('c', Team.A);
    lobby.join({ code: 'ABCDEF', nick: 'Di', key: 'd' });
    lobby.pickTeam('d', Team.B);
    chooseAll(lobby);

    const addressed = lobby.start('h', 7, TOKENS, 0);

    const seatOf = (key: string) => (addressed.find((a) => a.key === key)!.msg as { seat: number }).seat;
    expect(addressed).toHaveLength(4);
    expect(['g', 'c', 'h', 'd'].map(seatOf)).toEqual([0, 1, 2, 3]);
  });

  const AUTRE_CARTE = { ...MAP_SPIRAL, id: 'tirage-1', name: 'Carte tirée', biome: BIOMES[0] };

  it('[CU-02] diffuse la nouvelle carte à tout le salon quand l\'hôte retire', () => {
    const lobby = salonPret();

    const addressed = lobby.chooseMap('h', AUTRE_CARTE);

    expect(addressed).toHaveLength(2);
    for (const key of ['h', 'g']) {
      expect(addressed).toContainEqual({
        key,
        msg: expect.objectContaining({ t: ServerMessageType.Room, map: AUTRE_CARTE }),
      });
    }
    expect(AUTRE_CARTE.biome).toBeDefined();
  });

  it('[CU-02] diffuse la nouvelle carte aux deux équipes quand l\'hôte d\'un 2 contre 2 retire', () => {
    const lobby = fourPlayerRoom();

    const addressed = lobby.chooseMap('h', AUTRE_CARTE);

    expect(addressed).toHaveLength(4);
    for (const key of ['h', 'g', 'c', 'd']) {
      expect(addressed).toContainEqual({
        key,
        msg: expect.objectContaining({ t: ServerMessageType.TeamRoom, map: AUTRE_CARTE }),
      });
    }
  });

  it('[CU-02] refuse le changement de carte quand il vient d\'un invité', () => {
    const lobby = salonPret();

    const addressed = lobby.chooseMap('g', AUTRE_CARTE);

    expect(addressed).toEqual([
      { key: 'g', msg: { t: ServerMessageType.Refused, reason: 'Seul l\'hôte peut changer la carte.' } },
    ]);
    const after = lobby.choose('h', 'forge');
    expect(after).toContainEqual({ key: 'g', msg: expect.objectContaining({ t: ServerMessageType.Room, map: MAP_SPIRAL }) });
  });

  type Started = { t: ServerMessageType; snapshot: { map: unknown }; others: { snapshot: { map: unknown } }[] };

  it('[RM-07] lance chaque siège sur la carte et le biome choisis en dernier par l\'hôte', () => {
    const lobby = salonPret();
    const carteB = { ...MAP_SPIRAL, id: 'tirage-2', name: 'Carte B', biome: BIOMES[1] };
    lobby.chooseMap('h', AUTRE_CARTE);
    lobby.chooseMap('h', carteB);
    lobby.choose('h', 'forge');
    lobby.choose('g', 'sylve');

    const addressed = lobby.start('h', 7, ['th', 'tg'], 0);

    expect(carteB.biome).not.toBe('earth');
    expect(addressed).toHaveLength(2);
    for (const { msg } of addressed) {
      const started = msg as Started;
      expect(started.t).toBe(ServerMessageType.DuelStarted);
      expect(started.snapshot.map).toEqual(carteB);
      expect(started.others[0].snapshot.map).toEqual(carteB);
    }
  });

  it('[RM-07] lance les quatre sièges d\'un 2 contre 2 sur la même carte et le même biome', () => {
    const lobby = fourPlayerRoom();
    const carteB = { ...MAP_SPIRAL, id: 'tirage-2', name: 'Carte B', biome: BIOMES[2] };
    lobby.chooseMap('h', carteB);
    chooseAll(lobby);

    const addressed = lobby.start('h', 7, TOKENS, 0);

    expect(addressed).toHaveLength(4);
    for (const { msg } of addressed) {
      const started = msg as Started;
      expect(started.t).toBe(ServerMessageType.DuelStarted);
      expect(started.snapshot.map).toEqual(carteB);
      for (const other of started.others) expect(other.snapshot.map).toEqual(carteB);
    }
  });
});
