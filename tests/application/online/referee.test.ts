import { describe, expect, it } from 'vitest';
import { dispatch } from '../../../src/application/dispatch';
import { Referee } from '../../../src/application/online/referee';
import { ServerMessageType, Verdict } from '../../../src/application/online/protocol';
import { DIFFICULTY } from '../../../src/domain/catalog/creeps';
import { World } from '../../../src/domain/model/World';
import { CommandType, Phase } from '../../../src/domain/model/types';
import { fingerprint } from '../../../src/domain/rules/fingerprint';
import { MAP_CROSSING } from '../../../src/domain/catalog/map';
import { snapshot } from '../../../src/domain/model/snapshot';
import { CAMPAIGN_LENGTH } from '../../../src/domain/catalog/creeps';
import { killAllCreeps } from '../../support/helpers';

describe('Referee', () => {
  it('[RM-02] ouvre la partie à la carte, la difficulté et la graine fixées par le serveur', () => {
    const referee = new Referee();

    referee.open({ map: MAP_CROSSING, difficulty: 'hard', seed: 7, id: 'a', token: 'tok-a', builder: 'bastion' }, 0);

    const held = referee.game('a');
    const expected = new World({ map: MAP_CROSSING, difficulty: 'hard', seed: 7, builder: 'bastion' });
    expect(held?.world.map).toBe(MAP_CROSSING);
    expect(held?.world.difficulty).toBe('hard');
    expect(held && fingerprint(held.world)).toBe(fingerprint(expected));
  });

  it('[RM-02] rend l\'instantané de départ au tick 0 avec l\'or et les vies de la difficulté', () => {
    const referee = new Referee();

    const msg = referee.open({ map: MAP_CROSSING, difficulty: 'easy', seed: 1, id: 'b', token: 'tok-b', builder: 'bastion' }, 0);

    expect(msg).toMatchObject({ t: ServerMessageType.Opened, id: 'b', token: 'tok-b' });
    if (msg.t !== ServerMessageType.Opened) throw new Error('message inattendu');
    expect(msg.snapshot.tick).toBe(0);
    expect(msg.snapshot.gold).toBe(DIFFICULTY.easy.gold);
    expect(msg.snapshot.lives).toBe(DIFFICULTY.easy.lives);
  });

  it('[RM-01] ouvre la partie avec le bâtisseur demandé', () => {
    const referee = new Referee();

    const msg = referee.open({ map: MAP_CROSSING, difficulty: 'normal', seed: 1, id: 'a', token: 'tok-a', builder: 'forge' }, 0);

    if (msg.t !== ServerMessageType.Opened) throw new Error('message inattendu');
    expect(msg.snapshot.builder).toBe('forge');
    expect(referee.game('a')?.world.builder.id).toBe('forge');
  });

  it('[CU-01] tient plusieurs parties sans qu\'un ordre de l\'une touche l\'autre', () => {
    const referee = new Referee();
    referee.open({ map: MAP_CROSSING, difficulty: 'normal', seed: 3, id: 'a', token: 'tok-a', builder: 'bastion' }, 0);
    referee.open({ map: MAP_CROSSING, difficulty: 'normal', seed: 3, id: 'b', token: 'tok-b', builder: 'bastion' }, 0);

    const goldB = referee.game('b')!.world.gold;
    dispatch(referee.game('a')!.world, { c: CommandType.Build, def: 'archer', x: 10, y: 8 });

    expect(referee.game('b')!.world.gold).toBe(goldB);
    expect(referee.game('b')!.world.towers).toHaveLength(0);
  });

  it('[RM-07] gèle la partie du serveur quand la connexion du joueur tombe', () => {
    const referee = new Referee();
    referee.open({ map: MAP_CROSSING, difficulty: 'normal', seed: 3, id: 'c', token: 'tok-c', builder: 'bastion' }, 0);
    referee.game('c')!.advance(1000);
    expect(referee.game('c')!.world.tick).toBe(45);

    referee.lose('c', 1000);
    referee.game('c')!.advance(20_000);

    expect(referee.game('c')!.world.tick).toBe(45);
  });

  it('[CU-03] rend l\'instantané du serveur quand le joueur revient dans les 30 s', () => {
    const referee = new Referee();
    referee.open({ map: MAP_CROSSING, difficulty: 'normal', seed: 3, id: 'd', token: 'tok-d', builder: 'bastion' }, 0);
    referee.game('d')!.advance(1000);
    referee.lose('d', 1000);

    const msg = referee.resume('d', 'tok-d', 15_000);

    expect(msg.t).toBe(ServerMessageType.Resumed);
    if (msg.t !== ServerMessageType.Resumed) throw new Error('message inattendu');
    expect(msg.snapshot).toEqual(snapshot(referee.game('d')!.world));
  });

  it('[CU-04] rend la pause et la vitesse d\'avant la coupure quand le joueur reprend', () => {
    const referee = new Referee();
    referee.open({ map: MAP_CROSSING, difficulty: 'normal', seed: 3, id: 'e', token: 'tok-e', builder: 'bastion' }, 0);
    referee.game('e')!.advance(1000);
    referee.game('e')!.pace({ tick: 45, paused: true, speed: 2 }, 1000);
    referee.lose('e', 1000);

    const msg = referee.resume('e', 'tok-e', 15_000);

    expect(msg.t).toBe(ServerMessageType.Resumed);
    if (msg.t !== ServerMessageType.Resumed) throw new Error('message inattendu');
    expect(msg.paused).toBe(true);
    expect(msg.speed).toBe(2);
  });

  it('[RM-07] reprend l\'horloge au tick du gel quand le joueur revient', () => {
    const referee = new Referee();
    referee.open({ map: MAP_CROSSING, difficulty: 'normal', seed: 3, id: 'f', token: 'tok-f', builder: 'bastion' }, 0);
    referee.game('f')!.advance(1000);
    referee.lose('f', 1000);

    referee.resume('f', 'tok-f', 11_000);
    referee.game('f')!.advance(12_000);

    expect(referee.game('f')!.world.tick).toBe(105);
  });

  it('[RM-07] termine la partie en défaite par abandon quand 30 s passent sans retour', () => {
    const referee = new Referee();
    referee.open({ map: MAP_CROSSING, difficulty: 'normal', seed: 3, id: 'a', token: 'tok-a', builder: 'bastion' }, 0);
    referee.open({ map: MAP_CROSSING, difficulty: 'normal', seed: 3, id: 'g', token: 'tok-g', builder: 'bastion' }, 0);
    referee.lose('a', 1000);

    expect(referee.sweep(31_000)).toEqual([]);
    expect(referee.game('a')).toBeDefined();

    expect(referee.sweep(31_001)).toEqual(['a']);
    expect(referee.game('a')).toBeUndefined();
    expect(referee.game('g')).toBeDefined();
  });

  it('[RM-07] rend la défaite par abandon et le bilan du serveur quand le joueur revient après 30 s', () => {
    const referee = new Referee();
    referee.open({ map: MAP_CROSSING, difficulty: 'normal', seed: 3, id: 'h', token: 'tok-h', builder: 'bastion' }, 0);
    referee.game('h')!.advance(1000);
    referee.lose('h', 1000);

    const msg = referee.resume('h', 'tok-h', 31_001);

    expect(msg).toMatchObject({ t: ServerMessageType.Over, verdict: Verdict.Abandon });
    if (msg.t !== ServerMessageType.Over) throw new Error('message inattendu');
    expect(msg.snapshot).toEqual(snapshot(referee.game('h')!.world));

    const after = referee.resume('h', 'tok-h', 31_002);
    expect(after.t).not.toBe(ServerMessageType.Resumed);
  });

  it('[RM-07] annonce la fin quand la partie est inconnue du serveur', () => {
    const referee = new Referee();

    const msg = referee.resume('inconnue', 'tok', 0);

    expect(msg).toEqual({ t: ServerMessageType.Ended });
  });

  it('[RM-08] retire au balayage les parties finies', () => {
    const referee = new Referee();
    referee.open({ map: MAP_CROSSING, difficulty: 'hard', seed: 1, id: 'a', token: 'tok-a', builder: 'bastion' }, 0);
    const held = referee.game('a')!;
    let now = 0;
    for (let i = 0; i < 200 && held.world.phase !== Phase.Defeat; i++) {
      now += 5000;
      held.advance(now);
    }
    expect(held.world.phase).toBe(Phase.Defeat);

    expect(referee.sweep(now)).toEqual(['a']);
    expect(referee.game('a')).toBeUndefined();
  });

  it('[RM-10] garde au balayage la partie passée en mode infini après la victoire', () => {
    const referee = new Referee();
    referee.open({ map: MAP_CROSSING, difficulty: 'easy', seed: 1, id: 'a', token: 'tok-a', builder: 'bastion' }, 0);
    const held = referee.game('a')!;
    const world = held.world;
    let now = 0;
    for (let w = 0; w < CAMPAIGN_LENGTH; w++) {
      expect(dispatch(world, { c: CommandType.CallWave }).ok).toBe(true);
      for (let guard = 0; guard < 60 * 60 && (world.spawners.length > 0 || world.creeps.length > 0 || world.pending.size > 0); guard++) {
        world.step();
        killAllCreeps(world);
      }
    }
    now += 1000;
    const res = held.advance(now);
    expect(res?.t).toBe(ServerMessageType.Over);
    expect(world.phase).toBe(Phase.Victory);

    dispatch(world, { c: CommandType.Endless });

    expect(referee.sweep(now)).toEqual([]);
    expect(referee.game('a')).toBeDefined();
  });

  it('[CU-04] propose la reprise quand le jeton correspond et que la coupure date de moins de 30 s', () => {
    const referee = new Referee();
    referee.open({ map: MAP_CROSSING, difficulty: 'normal', seed: 3, id: 'a', token: 'tok-a', builder: 'bastion' }, 0);
    referee.lose('a', 1000);

    expect(referee.resumable('a', 'tok-a', 31_000)).toBe(true);
    expect(referee.resumable('a', 'tok-a', 31_001)).toBe(false);
    expect(referee.resumable('inconnue', 'tok-a', 1000)).toBe(false);
  });

  it('[RM-09] refuse la reprise quand le jeton ne correspond pas', () => {
    const referee = new Referee();
    referee.open({ map: MAP_CROSSING, difficulty: 'normal', seed: 3, id: 'a', token: 'tok-a', builder: 'bastion' }, 0);
    referee.lose('a', 1000);

    expect(referee.resumable('a', 'autre', 2000)).toBe(false);
    expect(referee.resume('a', 'autre', 2000)).toEqual({ t: ServerMessageType.Ended });

    const msg = referee.resume('a', 'tok-a', 3000);
    expect(msg.t).toBe(ServerMessageType.Resumed);
  });

  it('[CU-04] termine l\'ancienne partie par abandon quand le joueur en lance une nouvelle', () => {
    const referee = new Referee();
    referee.open({ map: MAP_CROSSING, difficulty: 'normal', seed: 3, id: 'a', token: 'tok-a', builder: 'bastion' }, 0);

    referee.open(
      { map: MAP_CROSSING, difficulty: 'normal', seed: 3, id: 'b', token: 'tok-b', builder: 'bastion', previous: { id: 'a', token: 'tok-a' } },
      1000,
    );

    expect(referee.game('a')).toBeUndefined();
    expect(referee.game('b')).toBeDefined();

    referee.open(
      { map: MAP_CROSSING, difficulty: 'normal', seed: 3, id: 'c', token: 'tok-c', builder: 'bastion', previous: { id: 'b', token: 'faux' } },
      2000,
    );

    expect(referee.game('b')).toBeDefined();
  });
});
