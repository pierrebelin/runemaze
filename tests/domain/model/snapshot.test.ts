import { describe, expect, it } from 'vitest';
import { dispatch } from '../../../src/application/dispatch';
import { snapshot, restore } from '../../../src/domain/model/snapshot';
import { MAP_CROSSING } from '../../support/maps';
import { World } from '../../../src/domain/model/World';
import { launchWave, spawnCreep } from '../../../src/domain/systems/waves';
import { buildTowerChain, newDuelWorld, newWorld, run, spawnDummy } from '../../support/helpers';
import { CommandType } from '../../../src/domain/model/types';

describe('snapshot', () => {
  it('[RM-01] rend le même bâtisseur après un instantané', () => {
    const w = new World({ map: MAP_CROSSING, difficulty: 'normal', seed: 42, builder: 'sylve' });

    const restored = restore(snapshot(w));
    const viaJson = restore(JSON.parse(JSON.stringify(snapshot(w))));

    expect(restored.builder.id).toBe('sylve');
    expect(viaJson.builder.id).toBe('sylve');
  });

  it('[RM-06] continue à l’identique quand la partie est restaurée en pleine vague', () => {
    const w = newWorld('normal', 42);
    dispatch(w, { c: CommandType.Build, def: 'archer', x: 8, y: 3 });
    dispatch(w, { c: CommandType.Build, def: 'cannon', x: 12, y: 5 });
    launchWave(w);
    run(w, 10);

    const snap = snapshot(w);
    const restored = restore(snap);

    run(w, 30);
    run(restored, 30);

    expect(snapshot(restored)).toEqual(snapshot(w));
  });

  it('[RM-06] reste identique après un passage par JSON', () => {
    const w = newWorld('normal', 42);
    dispatch(w, { c: CommandType.Build, def: 'archer', x: 8, y: 3 });
    launchWave(w);
    run(w, 10);

    const restored = restore(JSON.parse(JSON.stringify(snapshot(w))));

    run(w, 30);
    run(restored, 30);

    expect(snapshot(restored)).toEqual(snapshot(w));
  });

  it('[RM-06] garde les tours vendues et détruites du bilan quand la partie est restaurée', () => {
    const w = newWorld('normal', 42);
    const archer = dispatch(w, { c: CommandType.Build, def: 'archer', x: 8, y: 3 }) as { ok: true; id: number };
    dispatch(w, { c: CommandType.Sell, tower: archer.id });

    const restored = restore(snapshot(w));

    expect(restored.stats.towers.get(archer.id)?.fate).toBe('sold');
    const stillPresent = restored.towers.find((t) => t.id === archer.id);
    // La tour vendue n'est plus dans `towers`, seulement dans `stats.towers`.
    expect(stillPresent).toBeUndefined();
  });

  it('[RM-06] garde une même référence pour une tour présente à la fois dans towers et stats.towers', () => {
    const w = newWorld('normal', 42);
    const archer = dispatch(w, { c: CommandType.Build, def: 'archer', x: 8, y: 3 }) as { ok: true; id: number };

    const restored = restore(snapshot(w));

    const inTowers = restored.towers.find((t) => t.id === archer.id);
    const inStats = restored.stats.towers.get(archer.id);
    expect(inTowers).toBe(inStats);
  });

  it('[RM-04] accepte les ordres suivants comme la partie d’origine quand la partie est restaurée', () => {
    const w = newWorld('normal', 42);
    const archer = dispatch(w, { c: CommandType.Build, def: 'archer', x: 8, y: 3 }) as { ok: true; id: number };
    launchWave(w);
    run(w, 5);

    const restored = restore(snapshot(w));

    const refusedOriginal = dispatch(w, { c: CommandType.Build, def: 'cannon', x: 8, y: 3 });
    const refusedRestored = dispatch(restored, { c: CommandType.Build, def: 'cannon', x: 8, y: 3 });
    expect(refusedRestored).toEqual(refusedOriginal);

    const upgradeOriginal = dispatch(w, { c: CommandType.Upgrade, tower: archer.id, def: 'sniper' });
    const upgradeRestored = dispatch(restored, { c: CommandType.Upgrade, tower: archer.id, def: 'sniper' });
    expect(upgradeRestored).toEqual(upgradeOriginal);

    const sellOriginal = dispatch(w, { c: CommandType.Sell, tower: archer.id });
    const sellRestored = dispatch(restored, { c: CommandType.Sell, tower: archer.id });
    expect(sellRestored).toEqual(sellOriginal);

    run(w, 5);
    run(restored, 5);
    expect(snapshot(restored)).toEqual(snapshot(w));
  });

  it('[RM-06] restaure l’état de l’instantané quand la partie d’origine a continué avec des créatures empoisonnées', () => {
    const w = newWorld('normal', 42);
    dispatch(w, { c: CommandType.Build, def: 'venom', x: 8, y: 3 });
    launchWave(w);
    run(w, 5);

    const beforeRun = JSON.parse(JSON.stringify(snapshot(w)));
    const s = snapshot(w);
    run(w, 30);
    const restored = restore(s);

    expect(snapshot(restored)).toEqual(beforeRun);
  });

  it('[RM-06] restaure l’état de l’instantané quand la partie d’origine a continué avec un Sapeur gobelin', () => {
    const w = newWorld('normal', 7);
    launchWave(w);
    run(w, 1);
    spawnCreep(w, 'sapper', w.wave);
    run(w, 4);

    const beforeRun = JSON.parse(JSON.stringify(snapshot(w)));
    const s = snapshot(w);
    run(w, 5);
    const restored = restore(s);

    expect(snapshot(restored)).toEqual(beforeRun);
  });

  it('[RM-04] continue à l’identique après un passage par JSON quand un rejeton vient de naître', () => {
    const w = newWorld('normal', 42);
    dispatch(w, { c: CommandType.Build, def: 'archer', x: 8, y: 3 });
    launchWave(w);
    spawnCreep(w, 'slime', w.wave);

    let found = false;
    for (let i = 0; i < 1200 && !found; i++) {
      w.step();
      found = w.creeps.some((c) => c.def.id === 'slimelet' && c.remaining === Infinity);
    }
    expect(found).toBe(true);

    const restored = restore(JSON.parse(JSON.stringify(snapshot(w))));

    run(w, 60);
    run(restored, 60);

    expect(JSON.stringify(snapshot(restored))).toBe(JSON.stringify(snapshot(w)));
  });

  it('[RM-01] continue à l’identique après un passage par JSON au-delà de la vague 30', () => {
    const w = newWorld('normal', 42);
    w.lives = 1e6;
    while (w.wave < 30) launchWave(w);
    launchWave(w);
    run(w, 3);
    expect(Number.isFinite(w.nextWaveIn)).toBe(true);

    const restored = restore(JSON.parse(JSON.stringify(snapshot(w))));

    run(w, 60);
    run(restored, 60);

    expect(JSON.stringify(snapshot(restored))).toBe(JSON.stringify(snapshot(w)));
  });

  it('[RM-06] donne deux parties identiques quand le même instantané est restauré deux fois', () => {
    const w = newWorld('normal', 7);
    dispatch(w, { c: CommandType.Build, def: 'venom', x: 8, y: 3 });
    launchWave(w);
    run(w, 1);
    spawnCreep(w, 'sapper', w.wave);
    run(w, 4);

    const s = snapshot(w);
    const copie = JSON.parse(JSON.stringify(s));

    const r1 = restore(s);
    run(r1, 20);

    const r2 = restore(s);

    expect(snapshot(r2)).toEqual(copie);
  });

  it('[RM-08] garde le mode duel et le revenu quand la partie est restaurée après un passage par JSON', () => {
    const w = newDuelWorld('normal', 42);
    w.income = 5;

    const restored = restore(JSON.parse(JSON.stringify(snapshot(w))));

    expect(restored.duel).toBe(true);
    expect(restored.income).toBe(5);
  });

  it('[RM-08] garde les envois en attente quand la partie est restaurée après un passage par JSON', () => {
    const w = newDuelWorld('normal', 42);
    dispatch(w, { c: CommandType.Receive, creep: 'wolf', from: 0 });
    dispatch(w, { c: CommandType.Receive, creep: 'rat', from: 0 });
    expect(w.sends).toEqual([{ creep: 'wolf', from: 0 }, { creep: 'rat', from: 0 }]);

    const restored = restore(JSON.parse(JSON.stringify(snapshot(w))));

    expect(restored.sends).toEqual([{ creep: 'wolf', from: 0 }, { creep: 'rat', from: 0 }]);

    launchWave(w);
    launchWave(restored);
    run(w, 15);
    run(restored, 15);

    expect(restored.sends).toEqual([]);
    expect(JSON.stringify(snapshot(restored))).toBe(JSON.stringify(snapshot(w)));
  });

  it('[RM-09] la montée d\'un Pylône survit à un instantané', () => {
    const w = newWorld('normal', 42, undefined, 'arcanists');
    const t = buildTowerChain(w, ['pylon']);
    spawnDummy(w, t.cx + 1, t.cy);
    run(w, 5);
    expect(t.ramp).toBeGreaterThan(4);

    const restored = restore(JSON.parse(JSON.stringify(snapshot(w))));

    expect(restored.towerById.get(t.id)!.ramp).toBe(t.ramp);
  });

  it('[RM-12] restaure l\'éther et le tick d\'achat de chaque glaneur depuis un instantané', () => {
    const w = newDuelWorld('normal', 42);
    w.gold = 1000;
    dispatch(w, { c: CommandType.Gleaner });
    run(w, 1);
    dispatch(w, { c: CommandType.Gleaner });
    run(w, 5);
    expect(w.ether).toBeGreaterThan(0);
    expect(w.gleaners).toHaveLength(2);

    const restored = restore(JSON.parse(JSON.stringify(snapshot(w))));

    expect(restored.ether).toBe(w.ether);
    expect(restored.gleaners).toEqual(w.gleaners);

    run(w, 10);
    run(restored, 10);

    expect(restored.ether).toBe(w.ether);
    expect(restored.gleaners).toEqual(w.gleaners);
  });

  it('[RM-12] restaure les niveaux de Tir et de Remparts et la recharge du Tir depuis un instantané', () => {
    const w = newDuelWorld('normal', 42);
    w.ether = 100;
    dispatch(w, { c: CommandType.Gate, upgrade: 'shot' });
    dispatch(w, { c: CommandType.Gate, upgrade: 'shot' });
    dispatch(w, { c: CommandType.Gate, upgrade: 'ramparts' });
    w.gate.cooldown = 1.5;

    const restored = restore(JSON.parse(JSON.stringify(snapshot(w))));

    expect(restored.gate.shot).toBe(2);
    expect(restored.gate.ramparts).toBe(1);
    expect(restored.gate.cooldown).toBe(1.5);
  });

  it('[RM-05] conserve les envois achetés et ceux de la vague à travers un instantané', () => {
    const w = newDuelWorld('normal', 42);
    w.sent = [{ creep: 'wolf', to: 0 }, { creep: 'rat', to: 0 }];
    w.waveSends = { sent: [{ creep: 'wolf', to: 0 }], received: [{ creep: 'rat', from: 0 }, { creep: 'rat', from: 0 }] };

    const snap = snapshot(w);
    const restored = restore(JSON.parse(JSON.stringify(snap)));
    const restoredDirect = restore(snap);

    w.sent.push({ creep: 'bat', to: 0 });
    w.waveSends.sent.push({ creep: 'bat', to: 0 });
    w.waveSends.received.push({ creep: 'bat', from: 0 });

    expect(restored.sent).toEqual([{ creep: 'wolf', to: 0 }, { creep: 'rat', to: 0 }]);
    expect(restored.waveSends).toEqual({ sent: [{ creep: 'wolf', to: 0 }], received: [{ creep: 'rat', from: 0 }, { creep: 'rat', from: 0 }] });
    expect(restoredDirect.sent).toEqual([{ creep: 'wolf', to: 0 }, { creep: 'rat', to: 0 }]);
    expect(restoredDirect.waveSends).toEqual({ sent: [{ creep: 'wolf', to: 0 }], received: [{ creep: 'rat', from: 0 }, { creep: 'rat', from: 0 }] });
  });

  it('[RM-12] garde le nombre d\'adversaires quand la partie est restaurée après un passage par JSON', () => {
    const w = new World({ map: MAP_CROSSING, difficulty: 'normal', seed: 42, duel: true, rivals: 2, builder: 'bastion' });

    const restored = restore(JSON.parse(JSON.stringify(snapshot(w))));

    expect(restored.rivals).toBe(2);
  });

  it('[RM-12] tire le même adversaire que l\'original sur le même envoi après restauration', () => {
    const w = new World({ map: MAP_CROSSING, difficulty: 'normal', seed: 42, duel: true, rivals: 2, builder: 'bastion' });
    w.ether = 1000;
    const restored = restore(JSON.parse(JSON.stringify(snapshot(w))));

    for (let i = 0; i < 5; i++) {
      dispatch(w, { c: CommandType.Send, creep: 'rat' });
      dispatch(restored, { c: CommandType.Send, creep: 'rat' });
    }

    expect(restored.sent).toEqual(w.sent);
    expect(restored.rng.state).toBe(w.rng.state);
    expect(JSON.stringify(snapshot(restored))).toBe(JSON.stringify(snapshot(w)));
  });

  it('garde le cap retenu d’une créature, sans partager l’objet', () => {
    const w = newWorld('normal', 42);
    const c = spawnCreep(w, 'rat', 0);
    c.heading = { x: 1, y: 0 };

    const restored = restore(snapshot(w));

    expect(restored.creeps[0].heading).toEqual({ x: 1, y: 0 });
    expect(restored.creeps[0].heading).not.toBe(c.heading);
  });
});
