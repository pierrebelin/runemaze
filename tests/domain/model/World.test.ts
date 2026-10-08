import { describe, expect, it } from 'vitest';
import { dispatch } from '../../../src/application/dispatch';
import { builder } from '../../../src/domain/catalog/builders';
import { World } from '../../../src/domain/model/World';
import { BreakerPhase, CommandType, Phase } from '../../../src/domain/model/types';
import { launchWave, spawnCreep } from '../../../src/domain/systems/waves';
import { CREEPS } from '../../../src/domain/catalog/creeps';
import { creepSpeed } from '../../../src/domain/rules/speed';
import { newDuelWorld, newWorld, observeSpawns, run } from '../../support/helpers';
import { MAP_BENT_STONES, MAP_CORRIDOR, MAP_CROSSING, MAP_ICE, MAP_SEALS, MAP_SPIRAL, MAP_TWO_STONES } from '../../support/maps';

describe('World', () => {
  it('[RM-01] garde le bâtisseur choisi à la création de la partie', () => {
    const w = new World({ map: MAP_CROSSING, difficulty: 'normal', seed: 1, builder: 'forge' });
    expect(w.builder.id).toBe('forge');
    expect(w.builder).toBe(builder('forge'));
  });

  it('[RM-11] rejoue la même partie avec même graine, même bâtisseur et mêmes ordres', () => {
    const play = () => {
      const w = new World({ map: MAP_CROSSING, difficulty: 'normal', seed: 21, builder: 'forge' });
      w.gold = 1000;
      dispatch(w, { c: CommandType.Build, def: 'cannon', x: 8, y: 3 });
      dispatch(w, { c: CommandType.Build, def: 'anvil', x: 12, y: 3 });
      launchWave(w);
      run(w, 30);
      return { builder: w.builder?.id, gold: w.gold, kills: w.stats.kills, lives: w.lives, tick: w.tick };
    };
    const a = play();
    const b = play();
    expect(a).toEqual(b);
    expect(a.builder).toBe('forge');
  });

  it('fait passer les créatures par la pierre runique avant la sortie', () => {
    const w = newWorld();
    launchWave(w);
    let sawLeg1 = false;
    for (let i = 0; i < 60 * 90 && w.stats.leaked === 0; i++) {
      w.step();
      if (w.creeps.some((c) => c.leg === 1)) sawLeg1 = true;
    }
    expect(sawLeg1).toBe(true);
    expect(w.stats.leaked).toBeGreaterThan(0);
  });

  it('est déterministe : même graine et mêmes ordres, même partie', () => {
    const play = () => {
      const w = new World({ map: MAP_CROSSING, difficulty: 'normal', seed: 7, builder: 'bastion' });
      dispatch(w, { c: CommandType.Build, def: 'archer', x: 8, y: 3 });
      dispatch(w, { c: CommandType.Build, def: 'guard', x: 12, y: 5 });
      launchWave(w);
      run(w, 60);
      return { gold: w.gold, kills: w.stats.kills, lives: w.lives, tick: w.tick };
    };
    expect(play()).toEqual(play());
  });

  it('rejoue une partie à partir du journal de commandes', () => {
    const a = newWorld('normal', 99);
    dispatch(a, { c: CommandType.Build, def: 'archer', x: 8, y: 3 });
    run(a, a.nextWaveIn + 10);
    dispatch(a, { c: CommandType.Build, def: 'guard', x: 14, y: 3 });
    run(a, 30);

    const b = newWorld('normal', 99);
    const log = [...a.log];
    while (b.tick < a.tick) {
      while (log.length && log[0].tick === b.tick) dispatch(b, log.shift()!.cmd);
      b.step();
    }
    expect(b.gold).toBe(a.gold);
    expect(b.stats.kills).toBe(a.stats.kills);
    expect(b.creeps.map((c) => Math.round(c.hp))).toEqual(a.creeps.map((c) => Math.round(c.hp)));
  });

  it('[RM-10] rejoue à l’identique une partie avec Obus cryogénique quand la graine et le journal sont les mêmes', () => {
    const play = () => {
      const w = new World({ map: MAP_CROSSING, difficulty: 'normal', seed: 11, builder: 'forge' });
      w.gold = 1000;
      const cannon = dispatch(w, { c: CommandType.Build, def: 'cannon', x: 8, y: 3 }) as { ok: true; id: number };
      expect(cannon.ok).toBe(true);
      expect(dispatch(w, { c: CommandType.Upgrade, tower: cannon.id, def: 'mortar' }).ok).toBe(true);
      expect(dispatch(w, { c: CommandType.Upgrade, tower: cannon.id, def: 'cryoshell' }).ok).toBe(true);
      launchWave(w);
      const frozenIds = new Set<number>();
      for (let elapsed = 0; elapsed < 90; elapsed += 0.1) {
        run(w, 0.1);
        for (const c of w.creeps) if (c.frozen > 0) frozenIds.add(c.id);
      }
      return {
        gold: w.gold,
        lives: w.lives,
        frozenCount: frozenIds.size,
        creeps: w.creeps.map((c) => ({ x: c.x, y: c.y, hp: Math.round(c.hp * 100) / 100, frozen: c.frozen > 0 })),
      };
    };

    const a = play();
    const b = play();

    expect(a).toEqual(b);
    expect(a.frozenCount).toBeGreaterThan(0);
  });

  it('[RM-10] fait sortir les envois aux mêmes instants quand la même partie est rejouée', () => {
    const play = () => {
      const w = newDuelWorld('normal', 3);
      dispatch(w, { c: CommandType.Receive, creep: 'wolf', from: 0 });
      dispatch(w, { c: CommandType.Receive, creep: 'raider', from: 0 });
      launchWave(w);
      return observeSpawns(w, 10).filter((s) => s.id !== 'rat');
    };

    const a = play();
    const b = play();

    expect(a).toEqual(b);
    // Vague 0 : durée 8,8 s, 2 envois → premier à 0 s, second à 4,4 s.
    expect(a.map((s) => s.id)).toEqual(['wolf', 'raider']);
    expect(a[0].time).toBeLessThan(0.1);
    expect(Math.abs(a[1].time - 4.4)).toBeLessThan(0.1);
  });

  it('[RM-12] ralentit toutes les créatures touchées par les rebonds de la Grêle', () => {
    const w = new World({ map: MAP_CROSSING, difficulty: 'normal', seed: 11, builder: 'sanctuary' });
    w.gold = 1000;
    const frost = dispatch(w, { c: CommandType.Build, def: 'frost', x: 12, y: 3 }) as { ok: true; id: number };
    expect(frost.ok).toBe(true);
    expect(dispatch(w, { c: CommandType.Upgrade, tower: frost.id, def: 'glacier' }).ok).toBe(true);
    expect(dispatch(w, { c: CommandType.Upgrade, tower: frost.id, def: 'hail' }).ok).toBe(true);
    launchWave(w);

    let maxSlowedAtOnce = 0;
    for (let elapsed = 0; elapsed < 90; elapsed += 0.1) {
      run(w, 0.1);
      const slowedNow = w.creeps.filter((c) => c.slowPct > 0).length;
      if (slowedNow > maxSlowedAtOnce) maxSlowedAtOnce = slowedNow;
    }

    expect(maxSlowedAtOnce).toBeGreaterThanOrEqual(3);
  });

  it('[RM-04] note les vies perdues de la vague quand ses créatures s’échappent', () => {
    const w = newWorld();
    launchWave(w);
    const before = w.lives;
    for (let i = 0; i < 60 * 90 && w.stats.leaked === 0; i++) w.step();
    expect(w.stats.waves[0].livesLost).toBe(before - w.lives);
  });

  it('[RM-04] note l’or possédé après prime et intérêts quand la vague se termine', () => {
    const w = newWorld();
    launchWave(w);
    for (let i = 0; i < 60 * 300 && w.stats.waves[0]?.gold === null; i++) w.step();
    expect(w.stats.waves[0].gold).toBe(w.gold);
  });

  it('[RM-04] impute l’évasion à la vague de la créature quand deux vagues se chevauchent', () => {
    const w = newWorld();
    launchWave(w);
    launchWave(w);
    w.lives = 1_000_000;
    const before = w.lives;
    for (let i = 0; i < 60 * 600 && (w.pending.has(0) || w.pending.has(1)); i++) w.step();
    expect(w.pending.has(0)).toBe(false);
    expect(w.pending.has(1)).toBe(false);
    expect(w.stats.waves[0].livesLost).toBeGreaterThan(0);
    expect(w.stats.waves[1].livesLost).toBeGreaterThan(0);
    expect(w.stats.waves[0].livesLost + w.stats.waves[1].livesLost).toBe(before - w.lives);
  });

  it('[RM-04] laisse l’or non renseigné et garde les vies perdues quand la vague est en cours à la défaite', () => {
    const w = newWorld();
    launchWave(w);
    w.lives = 1;
    for (let i = 0; i < 60 * 90 && w.phase !== Phase.Defeat; i++) w.step();
    expect(w.phase).toBe(Phase.Defeat);
    expect(w.stats.waves[0].gold).toBeNull();
    expect(w.stats.waves[0].livesLost).toBeGreaterThan(0);
  });

  it('[RM-06] produit le même registre de tours et le même décompte de vagues quand la partie est rejouée depuis le journal', () => {
    const a = newWorld('normal', 99);
    const archer = dispatch(a, { c: CommandType.Build, def: 'archer', x: 8, y: 3 }) as { ok: true; id: number };
    expect(archer.ok).toBe(true);
    const guard = dispatch(a, { c: CommandType.Build, def: 'guard', x: 12, y: 3 }) as { ok: true; id: number };
    expect(guard.ok).toBe(true);
    run(a, a.nextWaveIn + 60);
    expect(dispatch(a, { c: CommandType.Upgrade, tower: guard.id, def: 'champion' }).ok).toBe(true);
    expect(dispatch(a, { c: CommandType.Sell, tower: archer.id }).ok).toBe(true);
    run(a, 400);

    const toRegistry = (w: World) =>
      [...w.stats.towers.entries()]
        .sort(([idA], [idB]) => idA - idB)
        .map(([id, t]) => ({ id, fate: t.fate, name: t.def.name, damage: Math.round(t.damage), kills: t.kills, spent: t.spent }));

    const aRegistry = toRegistry(a);
    const aWaves = a.stats.waves;
    expect(aRegistry.length).toBeGreaterThan(0);
    expect(aRegistry.some((t) => t.fate === 'sold')).toBe(true);
    expect(aRegistry.some((t) => t.damage > 0)).toBe(true);
    expect(aWaves.length).toBeGreaterThan(0);
    expect(aWaves.some((w) => w.livesLost > 0)).toBe(true);
    expect(aWaves.some((w) => w.gold !== null)).toBe(true);

    const b = newWorld('normal', 99);
    const log = [...a.log];
    while (b.tick < a.tick) {
      while (log.length && log[0].tick === b.tick) dispatch(b, log.shift()!.cmd);
      b.step();
    }

    expect(toRegistry(b)).toEqual(aRegistry);
    expect(b.stats.waves).toEqual(aWaves);
  });

  it('[RM-04] ne compte pas plus de vies perdues que les vies restantes', () => {
    // Vies ne changent rien au déroulement (défaite mise à part) : on peut donc
    // chercher, sur une partie sans défaite, le premier tick où une fuite coûte
    // plus d'une vie, puis reproduire ce tick avec 1 seule vie restante.
    const probe = newWorld();
    probe.lives = 1_000_000;
    let before = probe.lives;
    let targetTick = -1;
    let leak = 0;
    for (let i = 0; i < 60 * 20000 && targetTick < 0; i++) {
      probe.step();
      const delta = before - probe.lives;
      if (delta > 1) {
        targetTick = probe.tick;
        leak = delta;
      }
      before = probe.lives;
    }
    expect(targetTick).toBeGreaterThan(0);
    expect(leak).toBeGreaterThan(1);

    const w = newWorld();
    w.lives = 1_000_000;
    while (w.tick < targetTick - 1) w.step();
    w.lives = 1;
    const totalBefore = w.stats.waves.reduce((sum, t) => sum + t.livesLost, 0);
    w.step();
    const totalAfter = w.stats.waves.reduce((sum, t) => sum + t.livesLost, 0);

    expect(totalAfter - totalBefore).toBe(1);
  });

  it('[RM-04] ne compte aucune vie perdue au-delà de la défaite quand plusieurs créatures s’échappent au même tick', () => {
    const w = newWorld();
    launchWave(w);
    for (let i = 0; i < 60 * 5 && w.creeps.length === 0; i++) w.step();
    // Place trois créatures pile sur la case de sortie : elles s'échappent
    // toutes au même tick, quelle que soit leur vitesse.
    const proto = w.creeps[0];
    const exitCell = w.grid.exitCells[0];
    proto.leg = 1;
    proto.tx = w.grid.cx(exitCell);
    proto.ty = w.grid.cy(exitCell);
    proto.x = proto.tx + 0.5;
    proto.y = proto.ty + 0.5;
    for (let k = 0; k < 2; k++) w.creeps.push({ ...proto, id: w.id(), alive: true });

    w.lives = 1;
    const leakedBefore = w.stats.leaked;
    const sum = () => w.stats.waves.reduce((s, t) => s + t.livesLost, 0);
    const totalBefore = sum();

    w.step();

    expect(w.stats.leaked - leakedBefore).toBeGreaterThanOrEqual(3);
    expect(sum() - totalBefore).toBe(1);
  });

  it('[RM-11] ne scinde pas un Limon qui atteint la sortie', () => {
    const w = newWorld();
    const c = spawnCreep(w, 'slime', 0);
    const exitCell = w.grid.exitCells[0];
    c.leg = 1;
    c.tx = w.grid.cx(exitCell);
    c.ty = w.grid.cy(exitCell);
    c.x = c.tx + 0.5;
    c.y = c.ty + 0.5;
    const leakedBefore = w.stats.leaked;

    w.step();

    expect(w.stats.leaked).toBeGreaterThan(leakedBefore);
    expect(w.creeps.some((cr) => cr.def.id === 'slimelet')).toBe(false);
    expect(w.offspring).toHaveLength(0);
  });

  it('[RM-16] détruit les mêmes tours au même instant quand la graine et le journal sont les mêmes', () => {
    const play = () => {
      const w = newWorld('normal', 5);
      dispatch(w, { c: CommandType.Build, def: 'wall', x: 15, y: 9 });
      dispatch(w, { c: CommandType.Build, def: 'wall', x: 19, y: 9 });
      const sapper = spawnCreep(w, 'sapper', 0);
      sapper.x = 18;
      sapper.y = 10;
      sapper.breaker = { phase: BreakerPhase.Armed, timer: 1 / 60 / 2 };

      let destroyedAt: { tick: number; id: number } | null = null;
      for (let i = 0; i < 60 * 5 && destroyedAt === null; i++) {
        w.step();
        for (const [id, t] of w.stats.towers) {
          if (t.fate === 'destroyed') destroyedAt = { tick: w.tick, id };
        }
      }
      return destroyedAt;
    };

    const a = play();
    const b = play();

    expect(a).toEqual(b);
    expect(a).not.toBeNull();
  });

  it('[RM-01] fait passer une créature terrestre par la pierre 1 puis la pierre 2 avant la sortie', () => {
    const w = newWorld('normal', 42, MAP_CORRIDOR);
    launchWave(w);
    const legs: number[] = [];
    for (let i = 0; i < 60 * 60 && w.stats.leaked === 0; i++) {
      w.step();
      const leg = w.creeps[0]?.leg;
      if (leg !== undefined && legs[legs.length - 1] !== leg) legs.push(leg);
    }
    expect(legs).toEqual([0, 1, 2]);
    expect(w.stats.leaked).toBeGreaterThan(0);
  });

  it('[RM-01] ne compte pas la pierre 2 quand la créature la traverse avant la pierre 1', () => {
    const w = newWorld('normal', 42, MAP_CORRIDOR);
    launchWave(w);
    const stone2Cell = w.grid.idx(3, 1);
    let legAtCrossing: number | null = null;
    for (let i = 0; i < 60 * 60 && legAtCrossing === null; i++) {
      w.step();
      const c = w.creeps[0];
      if (c && w.grid.idx(c.tx, c.ty) === stone2Cell) legAtCrossing = c.leg;
    }
    expect(legAtCrossing).toBe(0);
  });

  it('[RM-01] mesure le labyrinthe sur les trois tronçons quand la carte a deux pierres', () => {
    const w = newWorld('normal', 42, MAP_CORRIDOR);
    // Couloir 1D : spawn(2,1)→pierre 1(4,1) = 2 cases, pierre1→pierre2(3,1) = 1 case,
    // pierre2→sortie(1,1) = 2 cases.
    expect(w.mazeLength()).toBe(5);
  });

  it('[RM-03] mesure le même trajet avec ou sans glace', () => {
    const sansGlace = { ...MAP_ICE, rows: MAP_ICE.rows.map((r) => r.replaceAll('*', '.')) };
    expect(newWorld('normal', 42, MAP_ICE).mazeLength()).toBe(newWorld('normal', 42, sansGlace).mazeLength());
  });

  it("[RM-07] rejoue à l'identique une partie à deux pierres quand carte, graine et journal sont les mêmes", () => {
    const play = () => {
      const w = newWorld('normal', 17, MAP_TWO_STONES);
      dispatch(w, { c: CommandType.Build, def: 'archer', x: 2, y: 2 });
      launchWave(w);
      run(w, 20);
      return {
        gold: w.gold,
        kills: w.stats.kills,
        lives: w.lives,
        tick: w.tick,
        creeps: w.creeps.map((c) => ({ x: c.x, y: c.y, hp: Math.round(c.hp) })),
      };
    };
    expect(play()).toEqual(play());
  });

  it('[RM-07] démarre la partie sur la carte passée en paramètre', () => {
    const spiral = new World({ map: MAP_SPIRAL, difficulty: 'normal', seed: 1, builder: 'bastion' });
    expect(spiral.grid.w).toBe(MAP_SPIRAL.width);
    expect(spiral.grid.h).toBe(MAP_SPIRAL.height);
    expect(spiral.grid.checkpoints).toHaveLength(1);
    expect(spiral.grid.spawnCells.length).toBeGreaterThan(0);
    expect(spiral.grid.exitCells.length).toBeGreaterThan(0);

    const seals = new World({ map: MAP_SEALS, difficulty: 'normal', seed: 1, builder: 'bastion' });
    expect(seals.grid.w).toBe(MAP_SEALS.width);
    expect(seals.grid.h).toBe(MAP_SEALS.height);
    expect(seals.grid.checkpoints).toHaveLength(2);
    expect(seals.grid.spawnCells.length).toBeGreaterThan(0);
    expect(seals.grid.exitCells.length).toBeGreaterThan(0);
  });

  it('[RM-02] fait survoler au volant la pierre 1 puis la pierre 2 avant la porte', () => {
    const w = newWorld('normal', 42, MAP_TWO_STONES);
    const harpy = spawnCreep(w, 'harpy', 0);
    expect(CREEPS.harpy.air).toBe(true);
    const stone1 = w.grid.regionCenter(w.grid.checkpoints[0]);
    const stone2 = w.grid.regionCenter(w.grid.checkpoints[1]);
    const legs: number[] = [0];
    const positionsAtLegChange: { x: number; y: number }[] = [];
    for (let i = 0; i < 60 * 30 && harpy.alive; i++) {
      w.step();
      if (harpy.leg !== legs[legs.length - 1]) {
        legs.push(harpy.leg);
        positionsAtLegChange.push({ x: harpy.x, y: harpy.y });
      }
    }
    expect(legs).toEqual([0, 1, 2]);
    const tickDistance = creepSpeed(harpy) / 60;
    const stoneGap = Math.hypot(stone2.x - stone1.x, stone2.y - stone1.y);
    const distToStone1 = Math.hypot(positionsAtLegChange[0].x - stone1.x, positionsAtLegChange[0].y - stone1.y);
    const distToStone2 = Math.hypot(positionsAtLegChange[1].x - stone2.x, positionsAtLegChange[1].y - stone2.y);
    expect(distToStone1).toBeLessThanOrEqual(tickDistance);
    expect(distToStone2).toBeLessThanOrEqual(tickDistance);
    expect(distToStone1).toBeLessThan(stoneGap);
    expect(distToStone2).toBeLessThan(stoneGap);
  });

  it("[RM-02] estime la distance restante d'un volant comme la somme des lignes droites jusqu'à la porte", () => {
    const w = newWorld('normal', 42, MAP_BENT_STONES);
    const harpy = spawnCreep(w, 'harpy', 0);
    const stone1 = w.grid.regionCenter(w.grid.checkpoints[0]);
    const stone2 = w.grid.regionCenter(w.grid.checkpoints[1]);
    const exit = w.grid.regionCenter(w.grid.exitCells);

    w.step();
    expect(harpy.leg).toBe(0);
    const expectedAtLeg0 =
      Math.hypot(stone1.x - harpy.x, stone1.y - harpy.y) +
      Math.hypot(stone2.x - stone1.x, stone2.y - stone1.y) +
      Math.hypot(exit.x - stone2.x, exit.y - stone2.y);
    expect(harpy.remaining).toBeCloseTo(expectedAtLeg0, 6);

    for (let i = 0; i < 60 * 5 && harpy.leg < 1; i++) w.step();
    expect(harpy.leg).toBe(1);
    const expectedAtLeg1 = Math.hypot(stone2.x - harpy.x, stone2.y - harpy.y) + Math.hypot(exit.x - stone2.x, exit.y - stone2.y);
    expect(harpy.remaining).toBeCloseTo(expectedAtLeg1, 6);
  });
});
