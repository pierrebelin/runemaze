import { describe, expect, it } from 'vitest';
import { Duel, Seat } from '../../../src/application/online/duel';
import { World } from '../../../src/domain/model/World';
import { dispatch } from '../../../src/application/dispatch';
import { fingerprint } from '../../../src/domain/rules/fingerprint';
import { snapshot } from '../../../src/domain/model/snapshot';
import { MAP_SPIRAL } from '../../../src/domain/catalog/map';
import { CommandType, Phase } from '../../../src/domain/model/types';
import type { Command } from '../../../src/domain/model/types';
import { ServerMessageType, Verdict } from '../../../src/application/online/protocol';
import type { ServerMessage } from '../../../src/application/online/protocol';
import { LOST_LIMIT_MS } from '../../../src/application/online/heldGame';
import { Mode } from '../../../src/application/online/protocol';
import { clearBonus } from '../../../src/domain/catalog/creeps';
import { killAllCreeps, run } from '../../support/helpers';

describe('Duel', () => {
  it('[RM-01] crée les deux mondes avec la même empreinte au lancement', () => {
    const duel = new Duel(
      { map: MAP_SPIRAL, difficulty: 'normal', seed: 7, nicks: ['A', 'B'], tokens: ['th', 'tg'], builders: ['bastion', 'bastion'] },
      0,
    );

    const attendu = fingerprint(new World({ map: MAP_SPIRAL, difficulty: 'normal', seed: 7, duel: true, builder: 'bastion' }));

    expect(fingerprint(duel.worlds[0])).toBe(attendu);
    expect(fingerprint(duel.worlds[1])).toBe(attendu);
  });

  it('[RM-11] donne à chaque siège une carte au bâtisseur de son joueur', () => {
    const duel = new Duel(
      { map: MAP_SPIRAL, difficulty: 'normal', seed: 7, nicks: ['A', 'B'], tokens: ['th', 'tg'], builders: ['forge', 'sylve'] },
      0,
    );

    expect(duel.worlds[Seat.Host].builder.id).toBe('forge');
    expect(duel.worlds[Seat.Guest].builder.id).toBe('sylve');
  });

  it('[RM-07] avance les deux cartes de 60 ticks par seconde, 15 ticks derrière l\'horloge', () => {
    const duel = new Duel(
      { map: MAP_SPIRAL, difficulty: 'normal', seed: 7, nicks: ['A', 'B'], tokens: ['th', 'tg'], builders: ['bastion', 'bastion'] },
      0,
    );

    duel.advance(1000);
    expect(duel.worlds[0].tick).toBe(45);
    expect(duel.worlds[1].tick).toBe(45);

    duel.advance(2000);
    expect(duel.worlds[0].tick).toBe(105);
    expect(duel.worlds[1].tick).toBe(105);
  });

  it('[CU-04] construit sur la carte de l\'hôte sans écart quand son empreinte concorde', () => {
    const witness = new World({ map: MAP_SPIRAL, difficulty: 'normal', seed: 7, duel: true, builder: 'bastion' });
    run(witness, 45 / 60);
    const cmd = { c: CommandType.Build, def: 'wall', x: 10, y: 1 } as const;
    expect(dispatch(witness, cmd).ok).toBe(true);
    const fp = fingerprint(witness);

    const duel = new Duel(
      { map: MAP_SPIRAL, difficulty: 'normal', seed: 7, nicks: ['A', 'B'], tokens: ['th', 'tg'], builders: ['bastion', 'bastion'] },
      0,
    );
    duel.advance(1000);

    const res = duel.order(Seat.Host, { tick: 45, cmd, fingerprint: fp }, 1000);

    expect(res).toBeNull();
    expect(duel.worlds[Seat.Host].towers).toHaveLength(1);
  });

  it('[RM-01] laisse or et tours de l\'invité intacts quand l\'hôte construit', () => {
    const freshGold = new World({ map: MAP_SPIRAL, difficulty: 'normal', seed: 7, duel: true, builder: 'bastion' }).gold;

    const witness = new World({ map: MAP_SPIRAL, difficulty: 'normal', seed: 7, duel: true, builder: 'bastion' });
    run(witness, 45 / 60);
    const cmd = { c: CommandType.Build, def: 'wall', x: 10, y: 1 } as const;
    expect(dispatch(witness, cmd).ok).toBe(true);
    const fp = fingerprint(witness);

    const duel = new Duel(
      { map: MAP_SPIRAL, difficulty: 'normal', seed: 7, nicks: ['A', 'B'], tokens: ['th', 'tg'], builders: ['bastion', 'bastion'] },
      0,
    );
    duel.advance(1000);
    duel.order(Seat.Host, { tick: 45, cmd, fingerprint: fp }, 1000);

    expect(duel.worlds[Seat.Guest].gold).toBe(freshGold);
    expect(duel.worlds[Seat.Guest].towers).toHaveLength(0);
  });

  it('[RM-09] arrête les deux cartes et annonce victoire et défaite dès qu\'un joueur est éliminé', () => {
    const duel = new Duel(
      { map: MAP_SPIRAL, difficulty: 'normal', seed: 7, nicks: ['A', 'B'], tokens: ['th', 'tg'], builders: ['bastion', 'bastion'] },
      0,
    );
    duel.advance(1000);
    duel.worlds[Seat.Host].lives = 0;
    duel.worlds[Seat.Host].phase = Phase.Defeat;

    const messages = duel.advance(2000);

    expect(messages).toHaveLength(2);
    const host = messages.find((m) => m.seat === Seat.Host)?.msg;
    const guest = messages.find((m) => m.seat === Seat.Guest)?.msg;
    expect(host?.t).toBe(ServerMessageType.DuelOver);
    expect(guest?.t).toBe(ServerMessageType.DuelOver);
    expect(host && 'verdict' in host && host.verdict).toBe(Verdict.Defeat);
    expect(guest && 'verdict' in guest && guest.verdict).toBe(Verdict.Victory);
    expect(duel.isOver()).toBe(true);

    const guestTickBefore = duel.worlds[Seat.Guest].tick;
    const later = duel.advance(5000);

    expect(duel.worlds[Seat.Guest].tick).toBe(guestTickBefore);
    expect(later).toHaveLength(0);
  });

  it('[RM-07] avance aussi la carte adverse jusqu\'au tick annoncé par un ordre', () => {
    const duel = new Duel(
      { map: MAP_SPIRAL, difficulty: 'normal', seed: 7, nicks: ['A', 'B'], tokens: ['th', 'tg'], builders: ['bastion', 'bastion'] },
      0,
    );
    duel.advance(1000);
    expect(duel.worlds[Seat.Guest].tick).toBe(45);

    const witness = new World({ map: MAP_SPIRAL, difficulty: 'normal', seed: 7, duel: true, builder: 'bastion' });
    run(witness, 55 / 60);
    const cmd = { c: CommandType.Build, def: 'wall', x: 10, y: 1 } as const;
    expect(dispatch(witness, cmd).ok).toBe(true);
    const fp = fingerprint(witness);

    duel.order(Seat.Host, { tick: 55, cmd, fingerprint: fp }, 1000);

    expect(duel.worlds[Seat.Guest].tick).toBe(55);
  });

  it('[RM-14] joint au verdict les instantanés des deux cartes', () => {
    const duel = new Duel(
      { map: MAP_SPIRAL, difficulty: 'normal', seed: 7, nicks: ['A', 'B'], tokens: ['th', 'tg'], builders: ['bastion', 'bastion'] },
      0,
    );
    duel.advance(1000);
    duel.worlds[Seat.Host].lives = 0;
    duel.worlds[Seat.Host].phase = Phase.Defeat;

    const messages = duel.advance(2000);

    const host = messages.find((m) => m.seat === Seat.Host)?.msg;
    const guest = messages.find((m) => m.seat === Seat.Guest)?.msg;
    expect(host && 'snapshot' in host && host.snapshot).toEqual(snapshot(duel.worlds[Seat.Host]));
    expect(host && 'rival' in host && host.rival).toEqual({ ...snapshot(duel.worlds[Seat.Guest]), ether: 0 });
    expect(guest && 'snapshot' in guest && guest.snapshot).toEqual(snapshot(duel.worlds[Seat.Guest]));
    expect(guest && 'rival' in guest && guest.rival).toEqual({ ...snapshot(duel.worlds[Seat.Host]), ether: 0 });
  });

  it('[RM-07] ne garde pas les événements de rendu du serveur d\'un pas à l\'autre', () => {
    const witness = new World({ map: MAP_SPIRAL, difficulty: 'normal', seed: 7, duel: true, builder: 'bastion' });
    run(witness, 45 / 60);
    const cmd = { c: CommandType.Build, def: 'archer', x: 10, y: 1 } as const;
    expect(dispatch(witness, cmd).ok).toBe(true);
    const fp = fingerprint(witness);

    const duel = new Duel(
      { map: MAP_SPIRAL, difficulty: 'normal', seed: 7, nicks: ['A', 'B'], tokens: ['th', 'tg'], builders: ['bastion', 'bastion'] },
      0,
    );
    duel.advance(1000);
    duel.order(Seat.Host, { tick: 45, cmd, fingerprint: fp }, 1000);

    duel.advance(60000);

    expect(duel.worlds[Seat.Host].events).toEqual([]);
    expect(duel.worlds[Seat.Guest].events).toEqual([]);
  });

  it('[CU-05] envoie à l\'hôte l\'instantané de la carte de l\'invité, tours comprises', () => {
    const duel = new Duel(
      { map: MAP_SPIRAL, difficulty: 'normal', seed: 7, nicks: ['A', 'B'], tokens: ['th', 'tg'], builders: ['bastion', 'bastion'] },
      0,
    );
    duel.advance(1000);

    const witness = new World({ map: MAP_SPIRAL, difficulty: 'normal', seed: 7, duel: true, builder: 'bastion' });
    run(witness, 45 / 60);
    const cmd = { c: CommandType.Build, def: 'wall', x: 10, y: 1 } as const;
    expect(dispatch(witness, cmd).ok).toBe(true);
    const fp = fingerprint(witness);
    const res = duel.order(Seat.Guest, { tick: 45, cmd, fingerprint: fp }, 1000);
    expect(res).toBeNull();

    const messages = duel.advance(1200);
    const host = messages.find((m) => m.seat === Seat.Host && m.msg.t === ServerMessageType.Rival)?.msg;
    const guest = messages.find((m) => m.seat === Seat.Guest && m.msg.t === ServerMessageType.Rival)?.msg;

    expect(host && 'snapshot' in host && host.snapshot).toEqual(snapshot(duel.worlds[Seat.Guest]));
    expect(guest && 'snapshot' in guest && guest.snapshot).toEqual(snapshot(duel.worlds[Seat.Host]));
    expect(host && 'snapshot' in host && host.snapshot.towers).toEqual([
      expect.objectContaining({ x: 10, y: 1 }),
    ]);
    expect(guest && 'snapshot' in guest && guest.snapshot.towers).toEqual([]);
  });

  it('[RM-11] porte le pseudo, les vies et l\'or adverses dans chaque envoi', () => {
    const duel = new Duel(
      { map: MAP_SPIRAL, difficulty: 'normal', seed: 7, nicks: ['Alice', 'Bob'], tokens: ['th', 'tg'], builders: ['bastion', 'bastion'] },
      0,
    );
    duel.advance(1000);

    const messages = duel.advance(1200);
    const host = messages.find((m) => m.seat === Seat.Host && m.msg.t === ServerMessageType.Rival)?.msg;
    const guest = messages.find((m) => m.seat === Seat.Guest && m.msg.t === ServerMessageType.Rival)?.msg;

    expect(host && 'nick' in host && host.nick).toBe('Bob');
    expect(guest && 'nick' in guest && guest.nick).toBe('Alice');
    expect(host && 'snapshot' in host && host.snapshot.lives).toBe(duel.worlds[Seat.Guest].lives);
    expect(host && 'snapshot' in host && host.snapshot.gold).toBe(duel.worlds[Seat.Guest].gold);
    expect(guest && 'snapshot' in guest && guest.snapshot.lives).toBe(duel.worlds[Seat.Host].lives);
    expect(guest && 'snapshot' in guest && guest.snapshot.gold).toBe(duel.worlds[Seat.Host].gold);
  });

  it('[CU-05] n\'envoie la carte adverse qu\'une fois par 200 ms', () => {
    const duel = new Duel(
      { map: MAP_SPIRAL, difficulty: 'normal', seed: 7, nicks: ['A', 'B'], tokens: ['th', 'tg'], builders: ['bastion', 'bastion'] },
      0,
    );
    duel.advance(1000);

    const second = duel.advance(1150);
    expect(second.some((m) => m.seat === Seat.Host && m.msg.t === ServerMessageType.Rival)).toBe(false);

    const troisieme = duel.advance(1200);
    expect(troisieme.some((m) => m.seat === Seat.Host && m.msg.t === ServerMessageType.Rival)).toBe(true);
  });

  it('[RM-12] n\'avance plus aucune des deux cartes pendant la coupure d\'un joueur', () => {
    const duel = new Duel(
      { map: MAP_SPIRAL, difficulty: 'normal', seed: 7, nicks: ['A', 'B'], tokens: ['th', 'tg'], builders: ['bastion', 'bastion'] },
      0,
    );
    duel.advance(1000);
    expect(duel.worlds[Seat.Host].tick).toBeGreaterThan(0);
    expect(duel.worlds[Seat.Guest].tick).toBeGreaterThan(0);

    duel.lose(Seat.Guest, 1000);
    const hostTick = duel.worlds[Seat.Host].tick;
    const guestTick = duel.worlds[Seat.Guest].tick;

    duel.advance(11_000);

    expect(duel.worlds[Seat.Host].tick).toBe(hostTick);
    expect(duel.worlds[Seat.Guest].tick).toBe(guestTick);
  });

  it('[RM-12] ignore la coupure d\'un duel déjà terminé', () => {
    const duel = new Duel(
      { map: MAP_SPIRAL, difficulty: 'normal', seed: 7, nicks: ['A', 'B'], tokens: ['th', 'tg'], builders: ['bastion', 'bastion'] },
      0,
    );
    duel.advance(1000);
    duel.worlds[Seat.Host].lives = 0;
    duel.worlds[Seat.Host].phase = Phase.Defeat;
    duel.advance(2000);
    expect(duel.isOver()).toBe(true);

    const messages = duel.lose(Seat.Guest, 3000);

    expect(messages).toEqual([]);
    expect(duel.isOver()).toBe(true);
  });

  it('[CU-07] prévient le joueur resté que l\'adversaire est déconnecté pour 30 s', () => {
    const duel = new Duel(
      { map: MAP_SPIRAL, difficulty: 'normal', seed: 7, nicks: ['A', 'B'], tokens: ['th', 'tg'], builders: ['bastion', 'bastion'] },
      0,
    );
    duel.advance(1000);

    const messages = duel.lose(Seat.Guest, 1000);

    expect(messages.filter((m) => m.seat === Seat.Host).map((m) => m.msg)).toEqual([
      { t: ServerMessageType.Frozen, remainingMs: LOST_LIMIT_MS },
    ]);
    expect(messages.some((m) => m.seat === Seat.Guest)).toBe(false);
  });

  it('[RM-12] donne la victoire par forfait au joueur resté après 30 s de coupure', () => {
    const duel = new Duel(
      { map: MAP_SPIRAL, difficulty: 'normal', seed: 7, nicks: ['A', 'B'], tokens: ['th', 'tg'], builders: ['bastion', 'bastion'] },
      0,
    );
    duel.advance(1000);
    const t = 1000;
    duel.lose(Seat.Guest, t);

    const pile = duel.advance(t + LOST_LIMIT_MS);
    expect(pile.some((m) => m.msg.t === ServerMessageType.DuelOver)).toBe(false);
    expect(duel.isOver()).toBe(false);

    const messages = duel.advance(t + LOST_LIMIT_MS + 1);

    expect(messages).toHaveLength(1);
    expect(messages[0]).toEqual({
      seat: Seat.Host,
      msg: {
        t: ServerMessageType.DuelOver,
        verdict: Verdict.Forfeit,
        snapshot: snapshot(duel.worlds[Seat.Host]),
        rival: { ...snapshot(duel.worlds[Seat.Guest]), ether: 0 },
      },
    });
    expect(messages.some((m) => m.seat === Seat.Guest)).toBe(false);
    expect(duel.isOver()).toBe(true);

    const later = duel.advance(t + LOST_LIMIT_MS + 5000);
    expect(later.some((m) => m.msg.t === ServerMessageType.DuelOver)).toBe(false);
  });

  it('[RM-12] refuse les ordres et n\'avance aucune carte pendant la coupure d\'un joueur', () => {
    const witness = new World({ map: MAP_SPIRAL, difficulty: 'normal', seed: 7, duel: true, builder: 'bastion' });
    run(witness, 45 / 60);
    const cmd = { c: CommandType.Build, def: 'wall', x: 10, y: 1 } as const;
    expect(dispatch(witness, cmd).ok).toBe(true);
    const fp = fingerprint(witness);

    const duel = new Duel(
      { map: MAP_SPIRAL, difficulty: 'normal', seed: 7, nicks: ['A', 'B'], tokens: ['th', 'tg'], builders: ['bastion', 'bastion'] },
      0,
    );
    duel.advance(1000);
    const t = 1000;
    duel.lose(Seat.Guest, t);
    const hostTick = duel.worlds[Seat.Host].tick;
    const guestTick = duel.worlds[Seat.Guest].tick;

    const res = duel.order(Seat.Host, { tick: 45, cmd, fingerprint: fp }, t + 1_000);

    expect(res).toEqual({ t: ServerMessageType.Drift, snapshot: snapshot(duel.worlds[Seat.Host]) });
    expect(duel.worlds[Seat.Host].towers).toHaveLength(0);
    expect(duel.worlds[Seat.Host].tick).toBe(hostTick);
    expect(duel.worlds[Seat.Guest].tick).toBe(guestTick);

    const checked = duel.check(Seat.Host, { tick: hostTick + 1_000, fingerprint: 'quelconque' }, t + 1_000);

    expect(checked).toEqual({ t: ServerMessageType.Drift, snapshot: snapshot(duel.worlds[Seat.Host]) });
    expect(duel.worlds[Seat.Host].tick).toBe(hostTick);
    expect(duel.worlds[Seat.Guest].tick).toBe(guestTick);
  });

  it('[RM-12] ignore une seconde coupure pendant le gel : le délai reste celui de la première', () => {
    const duel = new Duel(
      { map: MAP_SPIRAL, difficulty: 'normal', seed: 7, nicks: ['A', 'B'], tokens: ['th', 'tg'], builders: ['bastion', 'bastion'] },
      0,
    );
    duel.advance(1000);
    const t = 1000;

    const premiere = duel.lose(Seat.Guest, t);
    expect(premiere).toEqual([{ seat: Seat.Host, msg: { t: ServerMessageType.Frozen, remainingMs: LOST_LIMIT_MS } }]);

    const seconde = duel.lose(Seat.Host, t + 1_000);
    expect(seconde).toEqual([]);

    const messages = duel.advance(t + LOST_LIMIT_MS + 1);

    expect(messages).toHaveLength(1);
    expect(messages[0].seat).toBe(Seat.Host);
    expect(messages[0].msg).toMatchObject({ t: ServerMessageType.DuelOver, verdict: Verdict.Forfeit });
  });

  const config = {
    map: MAP_SPIRAL,
    difficulty: 'normal' as const,
    seed: 7,
    nicks: ['A', 'B'] as [string, string],
    tokens: ['th', 'tg'] as [string, string],
    builders: ['bastion', 'bastion'] as [string, string],
  };
  const sendWolf = { c: CommandType.Send, creep: 'wolf' } as const;

  const WOLF_ETHER = 16;

  const witnessSend = () => {
    const witness = new World({ map: MAP_SPIRAL, difficulty: 'normal', seed: 7, duel: true, builder: 'bastion' });
    run(witness, 45 / 60);
    witness.ether = WOLF_ETHER;
    expect(dispatch(witness, sendWolf).ok).toBe(true);
    return witness;
  };

  it('[CU-01] débite l\'hôte et met l\'envoi en attente chez l\'invité quand l\'hôte envoie un loup', () => {
    const witness = witnessSend();
    const duel = new Duel(config, 0);
    duel.advance(1000);
    duel.worlds[Seat.Host].ether = WOLF_ETHER;

    const res = duel.order(Seat.Host, { tick: 45, cmd: sendWolf, fingerprint: fingerprint(witness) }, 1000);

    expect(res).toBeNull();
    expect(duel.worlds[Seat.Host].ether).toBe(witness.ether);
    expect(duel.worlds[Seat.Guest].sends).toEqual(['wolf']);
    expect(duel.worlds[Seat.Guest].log.some((e) => e.cmd.c === CommandType.Receive)).toBe(true);
  });

  it('[RM-06] pousse un recalage à l\'invité seul à la prochaine annonce quand il reçoit un envoi', () => {
    const witness = witnessSend();
    const duel = new Duel(config, 0);
    duel.advance(1000);
    duel.worlds[Seat.Host].ether = WOLF_ETHER;
    duel.order(Seat.Host, { tick: 45, cmd: sendWolf, fingerprint: fingerprint(witness) }, 1000);

    const messages = duel.advance(1200);

    const guest = messages.find((m) => m.seat === Seat.Guest && m.msg.t === ServerMessageType.Drift)?.msg;
    expect(guest).toEqual({ t: ServerMessageType.Drift, snapshot: snapshot(duel.worlds[Seat.Guest]) });
    expect(messages.some((m) => m.seat === Seat.Host && m.msg.t === ServerMessageType.Drift)).toBe(false);
  });

  it('[RM-07] laisse la carte de l\'invité intacte quand l\'envoi de l\'hôte est refusé', () => {
    const witness = witnessSend();
    const duel = new Duel(config, 0);
    duel.advance(1000);
    duel.worlds[Seat.Host].ether = WOLF_ETHER;
    duel.order(Seat.Host, { tick: 45, cmd: sendWolf, fingerprint: fingerprint(witness) }, 1000);
    duel.advance(1200);
    duel.worlds[Seat.Host].ether = 0;
    const logBefore = duel.worlds[Seat.Guest].log.length;

    duel.order(Seat.Host, { tick: 57, cmd: sendWolf, fingerprint: fingerprint(duel.worlds[Seat.Host]) }, 1200);
    const messages = duel.advance(1400);

    expect(duel.worlds[Seat.Guest].sends).toEqual(['wolf']);
    expect(duel.worlds[Seat.Guest].log).toHaveLength(logBefore);
    expect(messages.some((m) => m.seat === Seat.Guest && m.msg.t === ServerMessageType.Drift)).toBe(false);
  });

  it('[RM-08] rejoue chaque carte à l\'identique depuis son journal, envois compris', () => {
    const witness = witnessSend();
    const duel = new Duel(config, 0);
    duel.advance(1000);
    duel.worlds[Seat.Host].ether = WOLF_ETHER;
    duel.order(Seat.Host, { tick: 45, cmd: sendWolf, fingerprint: fingerprint(witness) }, 1000);
    duel.advance(3000);

    for (const seat of [Seat.Host, Seat.Guest]) {
      const original = duel.worlds[seat];
      const replay = new World({ map: MAP_SPIRAL, difficulty: 'normal', seed: 7, duel: true, builder: 'bastion' });
      replay.ether = seat === Seat.Host ? WOLF_ETHER : 0;
      for (const entry of original.log) {
        while (replay.tick < entry.tick) replay.step();
        expect(dispatch(replay, entry.cmd).ok).toBe(true);
      }
      while (replay.tick < original.tick) replay.step();

      expect(fingerprint(replay)).toBe(fingerprint(original));
    }
  });

  const enrich = (world: World) => {
    world.ether = 40;
    world.income = 5;
    world.gleaners = [1];
    world.gate = { shot: 2, ramparts: 1, cooldown: 5 };
  };

  it('[RM-11] envoie l\'instantané adverse avec revenu, glaneurs et niveaux de Porte mais l\'éther à 0', () => {
    const duel = new Duel(config, 0);
    duel.advance(1000);
    enrich(duel.worlds[Seat.Guest]);

    const messages = duel.advance(1200);
    const host = messages.find((m) => m.seat === Seat.Host && m.msg.t === ServerMessageType.Rival)?.msg;

    expect(host && 'snapshot' in host && host.snapshot).toEqual({ ...snapshot(duel.worlds[Seat.Guest]), ether: 0 });
    expect(host && 'snapshot' in host && host.snapshot.income).not.toBe(0);
    expect(host && 'snapshot' in host && host.snapshot.gleaners.length).toBeGreaterThan(0);
    expect(host && 'snapshot' in host && host.snapshot.gate.shot).toBeGreaterThan(0);
    expect(host && 'snapshot' in host && host.snapshot.gate.ramparts).toBeGreaterThan(0);
  });

  it('[RM-11] laisse l\'éther du monde serveur intact après l\'envoi de la vue adverse', () => {
    const duel = new Duel(config, 0);
    duel.advance(1000);
    enrich(duel.worlds[Seat.Guest]);
    enrich(duel.worlds[Seat.Host]);

    const messages = duel.advance(1200);
    const rivals = messages.filter((m) => m.msg.t === ServerMessageType.Rival);

    expect(rivals).toHaveLength(2);
    for (const m of rivals) expect(m.msg && 'snapshot' in m.msg && m.msg.snapshot.ether).toBe(0);
    expect(duel.worlds[Seat.Guest].ether).toBeGreaterThan(0);
    expect(duel.worlds[Seat.Host].ether).toBeGreaterThan(0);
  });

  it('[RM-11] masque l\'éther adverse à la reprise et au verdict', () => {
    const duel = new Duel(config, 0);
    duel.advance(1000);
    enrich(duel.worlds[Seat.Guest]);
    enrich(duel.worlds[Seat.Host]);
    duel.lose(Seat.Guest, 1000);

    const thawed = duel.back(Seat.Guest, 'tg', 2000) as { seat: Seat; msg: ServerMessage }[];

    for (const m of thawed) {
      expect(m.msg.t).toBe(ServerMessageType.Thawed);
      expect(m.msg).toMatchObject({ rival: { ether: 0 } });
    }
    expect(duel.worlds[Seat.Host].ether).toBeGreaterThan(0);

    duel.worlds[Seat.Host].lives = 0;
    duel.worlds[Seat.Host].phase = Phase.Defeat;
    const over = duel.advance(3000);

    expect(over).toHaveLength(2);
    for (const m of over) {
      expect(m.msg.t).toBe(ServerMessageType.DuelOver);
      expect(m.msg).toMatchObject({ rival: { ether: 0 } });
    }
  });

  const coop = { ...config, mode: Mode.Coop };

  it('[RM-04] donne prime et intérêts sans revenu à chaque carte quand une vague est vidée en coopération', () => {
    const duel = new Duel(coop, 0);
    duel.advance(37_000);
    for (const world of duel.worlds) {
      world.gold = 500;
      world.income = 5;
      world.pending.set(0, 0);
    }

    duel.advance(37_100);

    // intérêts : min(4 % de 500, 20 + 0 × 2) = 20
    for (const world of duel.worlds) expect(world.gold).toBe(500 + clearBonus(0) + 20);
  });

  it('[RM-06] démarre les deux cartes avec la réserve commune en coopération', () => {
    const duel = new Duel({ ...coop, difficulty: 'normal' }, 0);

    expect(duel.worlds.map((w) => w.lives)).toEqual([42, 42]);
    expect(duel.worlds.map((w) => w.duel)).toEqual([false, false]);
  });

  it('[RM-03] lance chaque vague au même tick sur les deux cartes en coopération', () => {
    const duel = new Duel(coop, 0);

    duel.advance(36_000);

    expect(duel.worlds.map((w) => w.duel)).toEqual([false, false]);
    expect(duel.worlds.map((w) => w.wave)).toEqual([0, 0]);
    expect(duel.worlds[Seat.Host].tick).toBe(duel.worlds[Seat.Guest].tick);
  });

  const refusedInCoop = (cmd: Command) => {
    const duel = new Duel(coop, 0);
    duel.advance(1000);
    duel.worlds[Seat.Host].ether = 100;
    duel.worlds[Seat.Host].gold = 500;
    const host = duel.worlds[Seat.Host];
    const guest = duel.worlds[Seat.Guest];
    const before = { ether: host.ether, gold: host.gold, income: host.income, hostLog: host.log.length, guestLog: guest.log.length };

    const res = duel.order(Seat.Host, { tick: 45, cmd, fingerprint: fingerprint(host) }, 1000);
    const expected = { t: ServerMessageType.Drift, snapshot: snapshot(host) };
    const messages = duel.advance(1200);

    expect(res).toEqual(expected);
    expect(host.ether).toBe(before.ether);
    expect(host.gold).toBe(before.gold);
    expect(host.income).toBe(before.income);
    expect(host.log).toHaveLength(before.hostLog);
    expect(guest.log).toHaveLength(before.guestLog);
    expect(guest.sends).toEqual([]);
    expect(messages.some((m) => m.seat === Seat.Guest && m.msg.t === ServerMessageType.Drift)).toBe(false);
    return { host, guest };
  };

  it('[RM-05] recale sans rien envoyer quand un joueur envoie une créature en coopération', () => {
    const { host } = refusedInCoop(sendWolf);

    expect(host.sent).toEqual([]);
  });

  it('[RM-05] recale sans glaneur quand un joueur en achète un en coopération', () => {
    const { host, guest } = refusedInCoop({ c: CommandType.Gleaner });

    expect(host.gleaners).toEqual([]);
    expect(guest.gleaners).toEqual([]);
  });

  it('[RM-05] recale sans amélioration quand un joueur améliore la Porte en coopération', () => {
    const { host } = refusedInCoop({ c: CommandType.Gate, upgrade: 'shot' });

    expect(host.gate.shot).toBe(0);
  });

  const startLives = 42;

  /** Avance par pas de 100 ms jusqu'à `until` ; `spare` retire les créatures de la carte invitée pour qu'elle ne fuie pas. */
  const advanceUntilLeak = (duel: Duel, spare: boolean, extraMs = 0) => {
    const messages: { seat: Seat; msg: ServerMessage }[] = [];
    let now = 0;
    let leakedAt: number | undefined;
    while (now < 300_000 && (leakedAt === undefined || now < leakedAt + extraMs)) {
      now += 100;
      messages.push(...duel.advance(now));
      if (spare) killAllCreeps(duel.worlds[Seat.Guest]);
      if (leakedAt === undefined && duel.worlds.some((w) => w.stats.leaked > 0)) leakedAt = now;
    }
    expect(leakedAt).toBeDefined();
    return messages;
  };

  it('[RM-06] montre la même réserve sur les deux cartes, baissée des fuites des deux joueurs, en coopération', () => {
    const duel = new Duel(coop, 0);

    advanceUntilLeak(duel, false, 20_000);

    const [host, guest] = duel.worlds;
    expect(host.lives).toBe(guest.lives);
    expect(host.lives).toBeLessThan(startLives);
    // chaque fuite coûte au moins 1 vie, sur la carte qui fuit comme sur l'autre
    expect(host.lives).toBeLessThanOrEqual(startLives - (host.stats.leaked + guest.stats.leaked));
  });

  it('[RM-06] recale la carte du partenaire quand une fuite baisse la réserve', () => {
    const duel = new Duel(coop, 0);

    const messages = advanceUntilLeak(duel, true);

    const host = duel.worlds[Seat.Host];
    const guest = duel.worlds[Seat.Guest];
    expect(guest.stats.leaked).toBe(0);
    expect(host.stats.leaked).toBeGreaterThan(0);
    expect(guest.lives).toBe(host.lives);
    const drifts = messages.filter((m) => m.seat === Seat.Guest && m.msg.t === ServerMessageType.Drift);
    expect(drifts.length).toBeGreaterThan(0);
    const last = drifts[drifts.length - 1].msg;
    expect(last.t === ServerMessageType.Drift && last.snapshot.lives).toBe(host.lives);
    expect(host.lives).toBeLessThan(startLives);
  });

  it('[RM-03] rejoue une carte coopérative à l\'identique depuis sa graine et son journal', () => {
    const duel = new Duel(coop, 0);
    advanceUntilLeak(duel, false, 1000);

    for (const seat of [Seat.Host, Seat.Guest]) {
      const original = duel.worlds[seat];
      expect(original.log.some((e) => e.cmd.c === CommandType.ReserveLoss)).toBe(true);
      const replay = new World({ map: MAP_SPIRAL, difficulty: 'normal', seed: 7, builder: 'bastion', lives: startLives });
      for (const entry of original.log) {
        while (replay.tick < entry.tick) replay.step();
        expect(dispatch(replay, entry.cmd).ok).toBe(true);
      }
      while (replay.tick < original.tick) replay.step();

      expect(replay.lives).toBe(original.lives);
      expect(fingerprint(replay)).toBe(fingerprint(original));
    }
  });

  it('[RM-02] laisse chaque carte perdre ses seules vies quand le mode est Duel', () => {
    const duel = new Duel(config, 0);

    advanceUntilLeak(duel, true, 1000);

    const [host, guest] = duel.worlds;
    expect(host.lives).toBeLessThan(guest.lives);
    expect(guest.log.some((e) => e.cmd.c === CommandType.ReserveLoss)).toBe(false);
  });

  /** Réserve ramenée à 1 vie sur les deux cartes, puis avance jusqu'à la fin de la partie (fuites sans tours). */
  const drainReserve = (duel: Duel) => {
    duel.advance(1000);
    for (const world of duel.worlds) world.lives = 1;
    const messages: { seat: Seat; msg: ServerMessage }[] = [];
    let now = 1000;
    while (now < 300_000 && !duel.isOver()) {
      now += 100;
      messages.push(...duel.advance(now));
    }
    expect(duel.isOver()).toBe(true);
    return { messages, now };
  };

  it('[RM-07] arrête les deux cartes au même tick quand la réserve tombe à 0', () => {
    const duel = new Duel(coop, 0);

    const { now } = drainReserve(duel);

    const [host, guest] = duel.worlds;
    expect(host.phase).toBe(Phase.Defeat);
    expect(guest.phase).toBe(Phase.Defeat);
    expect(host.lives).toBe(0);
    expect(guest.lives).toBe(0);
    expect(host.tick).toBe(guest.tick);

    const tick = host.tick;
    duel.advance(now + 5000);

    expect(host.tick).toBe(tick);
    expect(guest.tick).toBe(tick);
  });

  it('[RM-07] annonce une défaite à chaque joueur, sans vainqueur, en coopération', () => {
    const duel = new Duel(coop, 0);

    const { messages } = drainReserve(duel);

    const over = messages.filter((m) => m.msg.t === ServerMessageType.DuelOver);
    expect(over.map((m) => m.seat).sort()).toEqual([Seat.Host, Seat.Guest]);
    for (const m of over) expect(m.msg).toMatchObject({ verdict: Verdict.Defeat });
  });

  it('[RM-08] gèle les deux cartes et prévient le partenaire resté quand un joueur se coupe en coopération', () => {
    const duel = new Duel(coop, 0);
    duel.advance(1000);

    const messages = duel.lose(Seat.Guest, 1000);

    expect(messages).toEqual([{ seat: Seat.Host, msg: { t: ServerMessageType.Frozen, remainingMs: LOST_LIMIT_MS } }]);
    const ticks = duel.worlds.map((w) => w.tick);

    duel.advance(11_000);

    expect(duel.worlds.map((w) => w.tick)).toEqual(ticks);
  });

  it('[RM-08] reprend la partie quand le joueur revient dans les 30 s en coopération', () => {
    const duel = new Duel(coop, 0);
    duel.advance(1000);
    duel.lose(Seat.Guest, 1000);
    const ticks = duel.worlds.map((w) => w.tick);

    const thawed = duel.back(Seat.Guest, 'tg', 11_000) as { seat: Seat; msg: ServerMessage }[];

    expect(thawed.map((m) => m.seat)).toEqual([Seat.Host, Seat.Guest]);
    for (const m of thawed) expect(m.msg.t).toBe(ServerMessageType.Thawed);
    expect(duel.worlds.map((w) => w.tick)).toEqual(ticks);

    duel.advance(12_000);

    expect(duel.worlds.map((w) => w.tick)).toEqual(ticks.map((t) => t + 60));
  });

  it('[RM-08] annonce une défaite au partenaire resté, pas un forfait, quand la coupure dépasse 30 s en coopération', () => {
    const duel = new Duel(coop, 0);
    duel.advance(1000);
    duel.lose(Seat.Guest, 1000);

    const messages = duel.advance(1000 + LOST_LIMIT_MS + 1);

    expect(messages).toHaveLength(1);
    expect(messages[0].seat).toBe(Seat.Host);
    expect(messages[0].msg).toMatchObject({ t: ServerMessageType.DuelOver, verdict: Verdict.Defeat });
    expect(duel.isOver()).toBe(true);
  });
});
