import { describe, expect, it } from 'vitest';
import { dispatch } from '../../../src/application/dispatch';
import { spawnCreep } from '../../../src/domain/systems/waves';
import { newWorld } from '../../support/helpers';
import { MAP_GATED_STONES } from '../../support/maps';
import { CommandType } from '../../../src/domain/model/types';

describe('build', () => {
  it('allonge le trajet quand on construit un mur en travers', () => {
    const w = newWorld();
    const before = w.mazeLength();
    // Un rideau de murs vertical de y=1 à y=20, colonne 10 : les créatures doivent contourner par le bas.
    for (let y = 1; y <= 19; y += 2) expect(dispatch(w, { c: CommandType.Build, def: 'wall', x: 10, y }).ok).toBe(true);
    expect(w.mazeLength()).toBeGreaterThan(before + 10);
  });

  it('refuse toute construction qui fermerait le passage', () => {
    const w = newWorld('easy');
    w.gold = 10_000;
    // Mur complet sur la colonne 20 sauf la dernière case : le dernier bloc doit être refusé.
    const results = [];
    for (let y = 1; y <= 21; y += 2) results.push(dispatch(w, { c: CommandType.Build, def: 'wall', x: 20, y }));
    const last = results[results.length - 1];
    expect(last.ok).toBe(false);
    expect(Number.isFinite(w.mazeLength())).toBe(true);
  });

  it('[RM-01] inscrit la tour posée au registre, en place', () => {
    const w = newWorld();
    const built = dispatch(w, { c: CommandType.Build, def: 'archer', x: 10, y: 8 }) as { ok: true; id: number };

    expect(w.stats.towers.size).toBe(1);
    const entry = w.stats.towers.get(built.id)!;
    expect(entry.fate).toBe('standing');
    expect(entry.def.name).toBe("Tour d'archers");
  });

  it('[RM-03] refuse la construction quand elle fermerait le tronçon de la pierre 2 à la porte', () => {
    const w = newWorld('normal', 42, MAP_GATED_STONES);
    const gold = w.gold;

    const r = dispatch(w, { c: CommandType.Build, def: 'wall', x: 15, y: 1 });

    expect(r).toEqual({ ok: false, reason: 'Impossible de bloquer le chemin.' });
    expect(w.towers).toHaveLength(0);
    expect(w.gold).toBe(gold);
  });

  it('[RM-03] refuse la construction quand elle fermerait le tronçon de la pierre 1 à la pierre 2', () => {
    const w = newWorld('normal', 42, MAP_GATED_STONES);
    const gold = w.gold;

    const r = dispatch(w, { c: CommandType.Build, def: 'wall', x: 10, y: 1 });

    expect(r).toEqual({ ok: false, reason: 'Impossible de bloquer le chemin.' });
    expect(w.towers).toHaveLength(0);
    expect(w.gold).toBe(gold);
  });

  it('[RM-03] refuse la construction quand elle enfermerait une créature en route vers la porte après la pierre 2', () => {
    const w = newWorld('normal', 42, MAP_GATED_STONES);
    // Poche en cul-de-sac (colonnes 12-15, ligne 4) accessible uniquement
    // par le col en colonnes 12-13 : la créature s'y trouve déjà, en route
    // vers la porte (leg 2), sans jamais fermer le tronçon général
    // pierre 2 → porte (colonnes 15-16, lignes 1-2, resté ouvert).
    const c = spawnCreep(w, 'rat', 0);
    c.leg = 2;
    c.tx = 14;
    c.ty = 4;
    c.x = 14.5;
    c.y = 4.5;
    const gold = w.gold;

    const r = dispatch(w, { c: CommandType.Build, def: 'wall', x: 12, y: 3 });

    expect(r).toEqual({ ok: false, reason: 'Impossible de bloquer le chemin.' });
    expect(w.towers).toHaveLength(0);
    expect(w.gold).toBe(gold);
  });

  it('[RM-03] accepte la construction quand tous les tronçons restent ouverts', () => {
    const w = newWorld('normal', 42, MAP_GATED_STONES);
    const gold = w.gold;

    const r = dispatch(w, { c: CommandType.Build, def: 'wall', x: 1, y: 1 });

    expect(r.ok).toBe(true);
    expect(w.towers).toHaveLength(1);
    expect(w.gold).toBe(gold - 3);
  });
});
