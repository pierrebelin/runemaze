import { describe, expect, it } from 'vitest';
import { dispatch } from '../../../src/application/dispatch';
import { goldForecast } from '../../../src/application/queries/goldForecast';
import { clearBonus } from '../../../src/domain/catalog/creeps';
import { CommandType, GameEventType } from '../../../src/domain/model/types';
import { launchWave } from '../../../src/domain/systems/waves';
import { killAllCreeps, newDuelWorld, newWorld } from '../../support/helpers';

describe('goldForecast', () => {
  it('[RM-05] le gain prévu égale l\'or réellement versé quand la vague en cours se termine sans autre dépense', () => {
    const w = newWorld();
    w.gold = 400;
    launchWave(w);
    w.nextWaveIn = 1e9;
    while (w.spawners.length > 0) w.step();
    killAllCreeps(w);
    const forecast = goldForecast(w);
    const gold = w.gold;
    w.drainEvents();

    w.step();

    const cleared = w.drainEvents().find((e) => e.t === GameEventType.WaveCleared);
    expect(cleared).toMatchObject({ bonus: forecast.bonus, interest: forecast.interest, income: forecast.income });
    expect(w.gold - gold).toBe(forecast.bonus + forecast.interest + forecast.income);
  });

  it('[RM-05] le gain prévu baisse aussitôt quand le joueur construit une tour', () => {
    const w = newWorld();
    w.gold = 400;
    launchWave(w);
    const before = goldForecast(w);

    const r = dispatch(w, { c: CommandType.Build, def: 'archer', x: 10, y: 8 });
    const after = goldForecast(w);

    expect(r.ok).toBe(true);
    expect(after.interest).toBe(Math.floor(w.gold * 0.04));
    expect(after.interest).toBeLessThan(before.interest);
  });

  it('[RM-05] le gain prévu porte sur la prochaine vague quand aucune vague n\'est en cours', () => {
    const w = newWorld();
    w.wave = 3;

    const forecast = goldForecast(w);

    expect(w.pending.size).toBe(0);
    expect(forecast.bonus).toBe(clearBonus(4));
  });

  it('[RM-05] le gain prévu compte le revenu et pas d\'intérêts quand la partie est un duel', () => {
    const w = newDuelWorld();
    w.gold = 500;
    w.income = 7;

    const forecast = goldForecast(w);

    expect(forecast).toEqual({ bonus: clearBonus(0), interest: 0, income: 7, capped: false });
  });
});
