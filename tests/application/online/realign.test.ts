import { describe, expect, it } from 'vitest';
import { dispatch } from '../../../src/application/dispatch';
import { realign } from '../../../src/application/online/realign';
import { restore, snapshot } from '../../../src/domain/model/snapshot';
import { fingerprint } from '../../../src/domain/rules/fingerprint';
import { newWorld, run } from '../../support/helpers';
import { CommandType } from '../../../src/domain/model/types';

describe('realign', () => {
  it('[RM-06] remet l\'or du joueur à celui du serveur quand les parties divergent', () => {
    const server = newWorld();
    server.gold = 95;
    const snap = snapshot(server);

    const result = realign(snap, [], snap.tick);

    expect(result.gold).toBe(95);
  });

  it('[RM-06] rejoue les ordres du joueur postérieurs à l\'instantané jusqu\'à son tick courant', () => {
    const server = newWorld();
    run(server, 30 / 60);
    const snap = snapshot(server);
    const s = snap.tick;
    const cmd = { c: CommandType.Build, def: 'wall', x: 10, y: 1 } as const;
    const ownLog = [{ tick: s + 10, cmd }];

    const result = realign(snap, ownLog, s + 30);

    const ref = restore(snap);
    run(ref, 10 / 60);
    expect(dispatch(ref, cmd).ok).toBe(true);
    run(ref, 20 / 60);

    expect(result.tick).toBe(s + 30);
    expect(result.towers).toHaveLength(1);
    expect(result.log).toContainEqual({ tick: s + 10, cmd });
    expect(fingerprint(result)).toBe(fingerprint(ref));
  });

  it('[RM-06] ignore les ordres du joueur déjà contenus dans l\'instantané', () => {
    const server = newWorld();
    run(server, 10 / 60);
    const early = { c: CommandType.Build, def: 'wall', x: 5, y: 1 } as const;
    dispatch(server, early);
    run(server, 20 / 60);
    const s = server.tick;
    const cmdA = { c: CommandType.Build, def: 'wall', x: 10, y: 1 } as const;
    dispatch(server, cmdA);
    const snap = snapshot(server);
    const ownLog = [{ tick: s - 5, cmd: early }, { tick: s, cmd: cmdA }];

    const result = realign(snap, ownLog, s + 10);

    expect(result.tick).toBe(s + 10);
    expect(result.towers).toHaveLength(snap.towers.length);
    expect(result.gold).toBe(snap.gold);
    expect(result.log).toEqual(snap.log);
  });

  it('[RM-06] rejoue les ordres du joueur au tick de l\'instantané absents du journal du serveur', () => {
    const server = newWorld();
    run(server, 30 / 60);
    const s = server.tick;
    const cmdA = { c: CommandType.Build, def: 'wall', x: 10, y: 1 } as const;
    dispatch(server, cmdA);
    const snap = snapshot(server);
    const cmdB = { c: CommandType.Build, def: 'wall', x: 12, y: 1 } as const;
    const ownLog = [{ tick: s, cmd: cmdA }, { tick: s, cmd: cmdB }];

    const result = realign(snap, ownLog, s + 10);

    expect(result.towers).toHaveLength(2);
    expect(result.log).toEqual([...snap.log, { tick: s, cmd: cmdB }]);
    expect(result.log.filter((e) => e.cmd.c === CommandType.Build && (e.cmd as typeof cmdA).x === 10)).toHaveLength(1);
  });

  it('[RM-06] rend un monde recalé sans les événements des ticks rejoués', () => {
    const server = newWorld();
    const cmd = { c: CommandType.CallWave } as const;
    const ownLog = [{ tick: server.tick, cmd }];
    const snap = snapshot(server);
    const s = snap.tick;

    const ref = restore(snap);
    expect(dispatch(ref, cmd).ok).toBe(true);
    run(ref, 120 / 60);
    expect(ref.events.length).toBeGreaterThan(0);

    const result = realign(snap, ownLog, s + 120);

    expect(result.events).toEqual([]);
  });
});
