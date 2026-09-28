import { describe, expect, it } from 'vitest';
import { dispatch } from '../../../src/application/dispatch';
import { snapshot, restore } from '../../../src/domain/model/snapshot';
import { spawnCreep } from '../../../src/domain/systems/waves';
import { newWorld, run } from '../../support/helpers';
import { CommandType } from '../../../src/domain/model/types';

describe('snapshot', () => {
  it('[RM-06] continue à l’identique quand la partie est restaurée en pleine vague', () => {
    const w = newWorld('normal', 42);
    dispatch(w, { c: CommandType.Build, def: 'archer', x: 8, y: 3 });
    dispatch(w, { c: CommandType.Build, def: 'cannon', x: 12, y: 5 });
    dispatch(w, { c: CommandType.CallWave });
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
    dispatch(w, { c: CommandType.CallWave });
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
    dispatch(w, { c: CommandType.CallWave });
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
    dispatch(w, { c: CommandType.CallWave });
    run(w, 5);

    const beforeRun = JSON.parse(JSON.stringify(snapshot(w)));
    const s = snapshot(w);
    run(w, 30);
    const restored = restore(s);

    expect(snapshot(restored)).toEqual(beforeRun);
  });

  it('[RM-06] restaure l’état de l’instantané quand la partie d’origine a continué avec un Sapeur gobelin', () => {
    const w = newWorld('normal', 7);
    dispatch(w, { c: CommandType.CallWave });
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
    dispatch(w, { c: CommandType.CallWave });
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

  it('[RM-04] continue à l’identique après un passage par JSON quand la dernière vague est lancée', () => {
    const w = newWorld('normal', 42);
    while (w.wave + 1 < w.campaignLength) {
      dispatch(w, { c: CommandType.CallWave });
    }
    run(w, 3);
    expect(w.nextWaveIn).toBe(Infinity);

    const restored = restore(JSON.parse(JSON.stringify(snapshot(w))));

    run(w, 60);
    run(restored, 60);

    expect(JSON.stringify(snapshot(restored))).toBe(JSON.stringify(snapshot(w)));
  });

  it('[RM-06] donne deux parties identiques quand le même instantané est restauré deux fois', () => {
    const w = newWorld('normal', 7);
    dispatch(w, { c: CommandType.Build, def: 'venom', x: 8, y: 3 });
    dispatch(w, { c: CommandType.CallWave });
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
});
