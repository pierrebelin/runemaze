import { describe, expect, it } from 'vitest';
import { dispatch } from '../../../src/application/dispatch';
import { previewRoute } from '../../../src/application/queries/previewRoute';
import { newWorld } from '../../support/helpers';
import { MAP_TWO_STONES } from '../../support/maps';
import { CommandType } from '../../../src/domain/model/types';

describe('previewRoute', () => {
  it('[RM-04] renvoie trois tronçons enchaînés du portail à la porte quand la carte a deux pierres', () => {
    const w = newWorld('normal', 42, MAP_TWO_STONES);

    // Mur contournable sur le tronçon pierre 2 → porte (champ ouvert en dessous).
    const { route } = previewRoute(w, 9, 1);

    expect(route).toHaveLength(3);
    expect(route[0][0]).toBe(w.spawnCell);
    expect(route[1][0]).toBe(route[0][route[0].length - 1]);
    expect(route[2][0]).toBe(route[1][route[1].length - 1]);
    expect(w.grid.checkpoints[0]).toContain(route[1][0]);
    expect(w.grid.checkpoints[1]).toContain(route[2][0]);
    expect(route[2][route[2].length - 1]).toBe(w.grid.exitCells[0]);
    const wallCells = new Set(w.grid.footprint(9, 1));
    expect(route[2].some((c) => wallCells.has(c))).toBe(false);

    const built = dispatch(w, { c: CommandType.Build, def: 'wall', x: 9, y: 1 });
    expect(built.ok).toBe(true);
    expect(route[2]).toEqual(w.groundRoute()[2]);
  });

  it('[RM-04] donne la longueur du trajet complet avec le mur prévisualisé', () => {
    const w = newWorld('normal', 42, MAP_TWO_STONES);

    const { length } = previewRoute(w, 5, 1);
    const built = dispatch(w, { c: CommandType.Build, def: 'wall', x: 5, y: 1 });

    expect(built.ok).toBe(true);
    expect(length).toBe(w.mazeLength());
  });

  it("laisse le labyrinthe inchangé après l'aperçu", () => {
    const w = newWorld('normal', 42, MAP_TWO_STONES);
    const before = w.mazeLength();
    const beforeRoute = w.groundRoute();

    previewRoute(w, 9, 1);

    expect(w.mazeLength()).toBe(before);
    expect(w.groundRoute()).toEqual(beforeRoute);
  });
});
