import { describe, expect, it } from 'vitest';
import { dispatch } from '../../../src/application/dispatch';
import { breakerLosses, familyDamage, towerRanking, towerYield, waveCurve } from '../../../src/domain/rules/debrief';
import type { WaveTally } from '../../../src/domain/model/types';
import { newWorld } from '../../support/helpers';
import { CommandType } from '../../../src/domain/model/types';

describe('debrief', () => {
  it('[RM-01] classe les tours par dégâts effectifs décroissants, vendues comprises', () => {
    const w = newWorld();
    const a = dispatch(w, { c: CommandType.Build, def: 'archer', x: 10, y: 8 }) as { ok: true; id: number };
    const b = dispatch(w, { c: CommandType.Build, def: 'cannon', x: 12, y: 8 }) as { ok: true; id: number };
    w.towerById.get(a.id)!.damage = 50;
    w.towerById.get(b.id)!.damage = 200;
    dispatch(w, { c: CommandType.Sell, tower: b.id });

    const ranking = towerRanking(w.stats.towers.values());

    expect(ranking.map((t) => t.id)).toEqual([b.id, a.id]);
  });

  it('[RM-01] exclut les murs restés murs et garde un mur transformé en tour', () => {
    const w = newWorld();
    const wall = dispatch(w, { c: CommandType.Build, def: 'wall', x: 10, y: 8 }) as { ok: true; id: number };
    const transformed = dispatch(w, { c: CommandType.Build, def: 'wall', x: 12, y: 8 }) as { ok: true; id: number };
    dispatch(w, { c: CommandType.Upgrade, tower: transformed.id, def: 'archer' });
    w.towerById.get(transformed.id)!.damage = 30;

    const ranking = towerRanking(w.stats.towers.values());

    expect(ranking.map((t) => t.id)).toEqual([transformed.id]);
    expect(ranking.map((t) => t.id)).not.toContain(wall.id);
  });

  it('[RM-01] calcule le rendement en dégâts par pièce d\'or investie', () => {
    const w = newWorld();
    const a = dispatch(w, { c: CommandType.Build, def: 'archer', x: 10, y: 8 }) as { ok: true; id: number };
    const t = w.towerById.get(a.id)!;
    t.damage = 100;

    expect(towerYield(t)).toBe(100 / t.spent);
  });

  it('[RM-01] départage deux tours à dégâts égaux par ordre de pose', () => {
    const w = newWorld();
    const first = dispatch(w, { c: CommandType.Build, def: 'archer', x: 10, y: 8 }) as { ok: true; id: number };
    const second = dispatch(w, { c: CommandType.Build, def: 'cannon', x: 12, y: 8 }) as { ok: true; id: number };
    w.towerById.get(first.id)!.damage = 80;
    w.towerById.get(second.id)!.damage = 80;

    const ranking = towerRanking(w.stats.towers.values());

    expect(ranking.map((t) => t.id)).toEqual([first.id, second.id]);
  });

  it('[RM-03] somme les dégâts par famille avec leur part du total, triés par ordre décroissant', () => {
    const w = newWorld();
    const archer = dispatch(w, { c: CommandType.Build, def: 'archer', x: 10, y: 8 }) as { ok: true; id: number };
    const cannon = dispatch(w, { c: CommandType.Build, def: 'cannon', x: 12, y: 8 }) as { ok: true; id: number };
    w.towerById.get(archer.id)!.damage = 30;
    w.towerById.get(cannon.id)!.damage = 70;

    const result = familyDamage(w.stats.towers.values());

    expect(result).toEqual([
      { family: 'cannon', damage: 70, share: 0.7 },
      { family: 'archer', damage: 30, share: 0.3 },
    ]);
  });

  it("[RM-03] range une tour infusée dans les hybrides, dégâts d'avant l'infusion compris", () => {
    const w = newWorld();
    w.gold = 1000;
    const sniper = dispatch(w, { c: CommandType.Build, def: 'archer', x: 10, y: 8 }) as { ok: true; id: number };
    dispatch(w, { c: CommandType.Upgrade, tower: sniper.id, def: 'sniper' });
    w.towerById.get(sniper.id)!.damage = 40;
    const acid = dispatch(w, { c: CommandType.Build, def: 'venom', x: 12, y: 8 }) as { ok: true; id: number };
    dispatch(w, { c: CommandType.Upgrade, tower: acid.id, def: 'acid' });
    w.wave = 7;
    dispatch(w, { c: CommandType.Upgrade, tower: sniper.id, def: 'stinger' });
    w.towerById.get(sniper.id)!.damage += 25;

    const result = familyDamage(w.stats.towers.values());

    expect(result.find((r) => r.family === 'hybrid')).toEqual({ family: 'hybrid', damage: 65, share: 1 });
    expect(result.find((r) => r.family === 'archer')).toBeUndefined();
  });

  it("[RM-03] omet les familles sans dégâts et rend une liste vide quand aucun dégât n'a été infligé", () => {
    const w = newWorld();
    dispatch(w, { c: CommandType.Build, def: 'archer', x: 10, y: 8 });
    dispatch(w, { c: CommandType.Build, def: 'wall', x: 12, y: 8 });

    const result = familyDamage(w.stats.towers.values());

    expect(result).toEqual([]);
  });

  it('[RM-04] donne pour chaque vague lancée ses vies perdues et l\'or à sa fin', () => {
    const waves: WaveTally[] = [];
    waves[1] = { livesLost: 2, gold: 120 };
    waves[2] = { livesLost: 5, gold: 300 };

    const curve = waveCurve(waves, 999);

    expect(curve).toEqual([
      { wave: 1, livesLost: 2, gold: 120 },
      { wave: 2, livesLost: 5, gold: 300 },
    ]);
  });

  it('[RM-04] donne l\'or de fin de partie à une vague inachevée à la défaite', () => {
    const waves: WaveTally[] = [];
    waves[1] = { livesLost: 0, gold: 100 };
    waves[2] = { livesLost: 3, gold: null };

    const curve = waveCurve(waves, 45);

    expect(curve).toEqual([
      { wave: 1, livesLost: 0, gold: 100 },
      { wave: 2, livesLost: 3, gold: 45 },
    ]);
  });

  it('[RM-05] compte les tours détruites et l\'or qu\'elles avaient coûté', () => {
    const w = newWorld();
    const destroyed = dispatch(w, { c: CommandType.Build, def: 'archer', x: 10, y: 8 }) as { ok: true; id: number };
    const other = dispatch(w, { c: CommandType.Build, def: 'cannon', x: 12, y: 8 }) as { ok: true; id: number };
    const standing = dispatch(w, { c: CommandType.Build, def: 'wall', x: 14, y: 8 }) as { ok: true; id: number };
    w.towerById.get(destroyed.id)!.fate = 'destroyed';
    w.towerById.get(other.id)!.fate = 'destroyed';
    const expectedGold = w.towerById.get(destroyed.id)!.spent + w.towerById.get(other.id)!.spent;

    const result = breakerLosses(w.stats.towers.values());

    expect(w.towerById.get(standing.id)!.fate).toBe('standing');
    expect(result).toEqual({ count: 2, gold: expectedGold });
  });

  it('[RM-05] rend zéro perte quand aucune tour n\'a été détruite, vendues ignorées', () => {
    const w = newWorld();
    const sold = dispatch(w, { c: CommandType.Build, def: 'archer', x: 10, y: 8 }) as { ok: true; id: number };
    dispatch(w, { c: CommandType.Sell, tower: sold.id });
    dispatch(w, { c: CommandType.Build, def: 'cannon', x: 12, y: 8 });

    const result = breakerLosses(w.stats.towers.values());

    expect(result).toEqual({ count: 0, gold: 0 });
  });
});
