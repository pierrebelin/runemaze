import { describe, expect, it } from 'vitest';
import { dispatch } from '../../../src/application/dispatch';
import { HeldGame } from '../../../src/application/online/heldGame';
import { fingerprint } from '../../../src/domain/rules/fingerprint';
import { restore, snapshot } from '../../../src/domain/model/snapshot';
import { ServerMessageType, Verdict } from '../../../src/application/online/protocol';
import type { ServerMessage } from '../../../src/application/online/protocol';
import { newWorld, run } from '../../support/helpers';
import { CommandType, Phase } from '../../../src/domain/model/types';

describe('HeldGame', () => {
  it('[CU-02] avance de 60 ticks par seconde en restant 15 ticks derrière son horloge', () => {
    const held = new HeldGame(newWorld(), 'tok', 0);

    held.advance(1000);
    expect(held.world.tick).toBe(45);

    held.advance(2000);
    expect(held.world.tick).toBe(105);
  });

  it('[RM-10] n\'avance plus quand le joueur met en pause, quelle que soit la durée', () => {
    const held = new HeldGame(newWorld(), 'tok', 0);

    held.pace({ tick: 0, paused: true }, 0);
    held.advance(3_600_000);
    expect(held.world.tick).toBe(0);

    held.pace({ tick: 0, paused: false }, 3_600_000);
    held.advance(3_601_000);
    expect(held.world.tick).toBe(45);
  });

  it('[RM-10] se cale 15 ticks derrière le tick du joueur quand la pause ou la vitesse change', () => {
    const held = new HeldGame(newWorld(), 'tok', 0);
    held.advance(1000);
    expect(held.world.tick).toBe(45);

    held.pace({ tick: 70, paused: false }, 1000);
    expect(held.world.tick).toBe(55);

    held.pace({ tick: 10, paused: false }, 1000);
    expect(held.world.tick).toBe(55);
  });

  it('[RM-10] ne cale pas son horloge au-delà de sa marge quand le joueur annonce un tick trop en avance', () => {
    const held = new HeldGame(newWorld(), 'tok', 0);
    held.advance(1000);
    expect(held.world.tick).toBe(45);

    held.pace({ tick: 1_000_000, paused: false }, 1000);

    expect(held.world.tick).toBe(60);
  });

  it('[RM-04] applique l\'ordre au tick du joueur sans écart quand les deux parties sont identiques', () => {
    const player = newWorld();
    run(player, 45 / 60);
    const cmd = { c: CommandType.Build, def: 'wall', x: 10, y: 1 } as const;
    expect(dispatch(player, cmd).ok).toBe(true);
    const fp = fingerprint(player);

    const held = new HeldGame(newWorld(), 'tok', 0);
    held.advance(1000);

    const res = held.order({ tick: 45, cmd, fingerprint: fp }, 1000);

    expect(res).toBeNull();
    expect(held.world.log).toContainEqual({ tick: 45, cmd });
    expect(fingerprint(held.world)).toBe(fp);
  });

  it('[RM-04] applique sans écart l\'ordre d\'un joueur qui suit le temps réel après un changement de rythme', () => {
    const held = new HeldGame(newWorld(), 'tok', 0);
    held.pace({ tick: 0, paused: false }, 0);

    const player = newWorld();
    run(player, 88 / 60);
    expect(player.tick).toBe(88);
    const cmd = { c: CommandType.Build, def: 'wall', x: 10, y: 1 } as const;
    expect(dispatch(player, cmd).ok).toBe(true);
    const fp = fingerprint(player);

    const res = held.order({ tick: 88, cmd, fingerprint: fp }, 1500);

    expect(res).toBeNull();
    expect(held.world.log).toContainEqual({ tick: 88, cmd });
    expect(fingerprint(held.world)).toBe(fp);
  });

  it('[RM-05] signale un écart avec l\'instantané du serveur quand l\'empreinte du joueur diffère', () => {
    const held = new HeldGame(newWorld(), 'tok', 0);
    held.advance(1000);
    const cmd = { c: CommandType.Build, def: 'wall', x: 10, y: 1 } as const;

    const res = held.order({ tick: 45, cmd, fingerprint: 'empreinte-fausse' }, 1000);

    expect(res?.t).toBe(ServerMessageType.Drift);
    const drift = res as { t: ServerMessageType.Drift; snapshot: ReturnType<typeof snapshot> };
    expect(fingerprint(restore(drift.snapshot))).toBe(fingerprint(held.world));
  });

  it('[RM-05] signale un écart quand le serveur refuse un ordre accepté par le joueur', () => {
    const cmd = { c: CommandType.Build, def: 'wall', x: 10, y: 1 } as const;

    const held = new HeldGame(newWorld(), 'tok', 0);
    held.advance(1000);
    expect(dispatch(held.world, cmd).ok).toBe(true);
    const logLengthAvant = held.world.log.length;

    const player = newWorld();
    run(player, 45 / 60);
    expect(dispatch(player, cmd).ok).toBe(true);
    const fp = fingerprint(player);

    const res = held.order({ tick: 45, cmd, fingerprint: fp }, 1000);

    expect(res?.t).toBe(ServerMessageType.Drift);
    expect(held.world.log).toHaveLength(logLengthAvant);
  });

  it('[RM-05] applique l\'ordre au tick courant et signale un écart quand il arrive après la marge de 250 ms', () => {
    const held = new HeldGame(newWorld(), 'tok', 0);
    held.advance(2000);
    expect(held.world.tick).toBe(105);
    const cmd = { c: CommandType.Build, def: 'wall', x: 10, y: 1 } as const;

    const res = held.order({ tick: 50, cmd, fingerprint: 'peu-importe' }, 2000);

    expect(res?.t).toBe(ServerMessageType.Drift);
    expect(held.world.log).toContainEqual({ tick: 105, cmd });
  });

  it('[RM-05] applique l\'ordre à la borne de son horloge et signale un écart quand le tick du joueur la dépasse', () => {
    const held = new HeldGame(newWorld(), 'tok', 0);
    held.advance(1000);
    expect(held.world.tick).toBe(45);
    const cmd = { c: CommandType.Build, def: 'wall', x: 10, y: 1 } as const;

    const res = held.order({ tick: 1_000_000, cmd, fingerprint: 'peu-importe' }, 1000);

    expect(res?.t).toBe(ServerMessageType.Drift);
    expect(held.world.log).toContainEqual({ tick: 75, cmd });
    expect(held.world.tick).toBe(75);
  });

  it('[RM-08] annonce la défaite avec son instantané quand sa partie tombe à 0 vie', () => {
    const held = new HeldGame(newWorld('hard', 1), 'tok', 0);
    const messages: ServerMessage[] = [];
    let now = 0;
    for (let i = 0; i < 200 && held.world.phase !== Phase.Defeat; i++) {
      now += 5000;
      const r = held.advance(now);
      if (r) messages.push(r);
    }

    const over = messages.find((m) => m.t === ServerMessageType.Over) as { t: ServerMessageType.Over; verdict: string; snapshot: ReturnType<typeof snapshot> } | undefined;
    expect(over?.verdict).toBe(Verdict.Defeat);
    expect(over?.snapshot.phase).toBe(Phase.Defeat);
    expect(over?.snapshot.lives).toBeLessThanOrEqual(0);
  });

  it('[RM-05] signale un écart quand le joueur déclare une fin que le serveur n\'atteint pas au même tick', () => {
    const held = new HeldGame(newWorld('hard', 1), 'tok', 0);
    held.advance(1000);

    const player = newWorld('hard', 1);
    run(player, held.world.tick / 60);
    player.phase = Phase.Defeat;
    player.lives = 0;
    const fp = fingerprint(player);

    const res = held.check({ tick: player.tick, fingerprint: fp }, 1000);

    expect(res?.t).toBe(ServerMessageType.Drift);
    const drift = res as { t: ServerMessageType.Drift; snapshot: ReturnType<typeof snapshot> };
    expect(drift.snapshot.phase).not.toBe(Phase.Defeat);
  });

  it('[RM-08] n\'annonce la fin qu\'une seule fois quand la partie reste finie', () => {
    const held = new HeldGame(newWorld('hard', 1), 'tok', 0);
    let now = 0;
    let overCount = 0;
    for (let i = 0; i < 200 && held.world.phase !== Phase.Defeat; i++) {
      now += 5000;
      const r = held.advance(now);
      if (r?.t === ServerMessageType.Over) overCount++;
    }
    expect(overCount).toBe(1);

    now += 5000;
    expect(held.advance(now)).toBeNull();
    now += 5000;
    expect(held.advance(now)).toBeNull();
  });

  it('[RM-08] annonce une défaite quand le joueur abandonne une partie solo tenue par le serveur', () => {
    const held = new HeldGame(newWorld(), 'tok', 0);
    held.advance(1000);
    const player = newWorld();
    run(player, 45 / 60);
    const cmd = { c: CommandType.Resign } as const;
    expect(dispatch(player, cmd).ok).toBe(true);

    held.order({ tick: 45, cmd, fingerprint: fingerprint(player) }, 1000);
    const over = held.advance(1000) as { t: ServerMessageType.Over; verdict: string; snapshot: ReturnType<typeof snapshot> } | null;

    expect(over?.t).toBe(ServerMessageType.Over);
    expect(over?.verdict).toBe(Verdict.Defeat);
    expect(over?.snapshot.phase).toBe(Phase.Defeat);
  });
});
