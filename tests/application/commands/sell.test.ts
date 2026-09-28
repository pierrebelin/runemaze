import { describe, expect, it } from 'vitest';
import { dispatch } from '../../../src/application/dispatch';
import { newWorld } from '../../support/helpers';
import { CommandType } from '../../../src/domain/model/types';

describe('sell', () => {
  it('[RM-01] crédite la moitié de l\'or investi quand le joueur vend une tour améliorée', () => {
    const w = newWorld();
    const built = dispatch(w, { c: CommandType.Build, def: 'archer', x: 10, y: 8 }) as { ok: true; id: number };
    dispatch(w, { c: CommandType.Upgrade, tower: built.id, def: 'sniper' });
    const gold = w.gold;

    const r = dispatch(w, { c: CommandType.Sell, tower: built.id });

    expect(r.ok).toBe(true);
    expect(w.gold - gold).toBe(25);
  });

  it('[RM-01] garde la tour vendue au registre, marquée vendue, avec ses dégâts et éliminations', () => {
    const w = newWorld();
    const built = dispatch(w, { c: CommandType.Build, def: 'archer', x: 10, y: 8 }) as { ok: true; id: number };
    const t = w.towerById.get(built.id)!;
    t.damage = 123;
    t.kills = 4;

    dispatch(w, { c: CommandType.Sell, tower: built.id });

    expect(w.stats.towers.size).toBe(1);
    const entry = w.stats.towers.get(built.id)!;
    expect(entry.fate).toBe('sold');
    expect(entry.damage).toBe(123);
    expect(entry.kills).toBe(4);
  });
});
