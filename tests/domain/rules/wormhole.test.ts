import { describe, expect, it } from 'vitest';
import { wormholesOpen } from '../../../src/domain/rules/wormhole';
import { Grid } from '../../../src/domain/model/Grid';
import { MAP_WORMHOLE, MAP_WORMHOLE_ISLAND, MAP_WORMHOLE_POCKET } from '../../support/maps';

describe('wormhole', () => {
  it('[RM-13] est vrai quand chaque bout touche par un côté une case atteinte à pied depuis le portail', () => {
    const grid = new Grid(MAP_WORMHOLE);

    expect(wormholesOpen(grid, new Set())).toBe(true);
  });

  it('[RM-13] est faux quand un bout n’a plus de case voisine praticable', () => {
    const grid = new Grid(MAP_WORMHOLE);
    // Les six cases qui touchent `A` (11..12, 4..5) par un côté ; la colonne 10 est déjà du roc.
    const blocked = new Set([
      grid.idx(13, 4), grid.idx(13, 5),
      grid.idx(11, 3), grid.idx(12, 3),
      grid.idx(11, 6), grid.idx(12, 6),
    ]);

    expect(wormholesOpen(grid, blocked)).toBe(false);
  });

  it('[RM-13] est vrai quand un bout n’est joignable à pied que depuis une pierre ou la porte', () => {
    // Mur plein : `A`, la pierre 1 et la porte sont du côté est, séparés du portail.
    const grid = new Grid(MAP_WORMHOLE_POCKET);

    expect(wormholesOpen(grid, new Set())).toBe(true);
  });

  it('[RM-13] est faux quand un bout n’est atteint qu’en passant par l’autre bout', () => {
    // `A` est dans une salle close sans repère : seul le trou de ver y mène.
    const grid = new Grid(MAP_WORMHOLE_ISLAND);

    expect(wormholesOpen(grid, new Set())).toBe(false);
  });
});
