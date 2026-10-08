import { describe, expect, it } from 'vitest';
import { newWorld } from '../../support/helpers';
import { MAP_WORMHOLE, MAP_WORMHOLE_BOTH, MAP_WORMHOLE_USELESS } from '../../support/maps';
import type { MapDef } from '../../../src/domain/model/types';
import type { World } from '../../../src/domain/model/World';

/** Même carte, bouts de trou de ver remplacés par des rochers. */
function withRocks(map: MapDef): MapDef {
  return { ...map, rows: map.rows.map((r) => r.replace(/[aAbB]/g, '#')) };
}

/** Indices des cases de deux carrés 2×2 de trou de ver (coin haut-gauche). */
function square(w: World, x: number, y: number): number[] {
  return w.grid.footprint(x, y);
}

describe('FlowField', () => {
  it('[RM-08] raccourcit le trajet quand un trou de ver relie deux points éloignés du tronçon', () => {
    const avec = newWorld('normal', 42, MAP_WORMHOLE);
    const sans = newWorld('normal', 42, withRocks(MAP_WORMHOLE));

    expect(avec.mazeLength()).toBeLessThan(sans.mazeLength() * 0.7);
  });

  it('[RM-07] ne compte aucune distance pour le passage d’un bout à l’autre', () => {
    const w = newWorld('normal', 42, MAP_WORMHOLE);
    const dist = w.fields[0].dist;
    const entree = w.grid.idx(7, 4); // voisine du bout `a`
    const sortie = w.grid.idx(13, 4); // voisine du bout `A`

    // Un pas pour entrer dans le bout, un pas pour en ressortir : rien pour le passage.
    expect(dist[entree]).toBeLessThan(dist[sortie] + 3);
  });

  it('[RM-07] emprunte le trou de ver dans un sens au 1er tronçon et dans l’autre au 2nd', () => {
    const w = newWorld('normal', 42, MAP_WORMHOLE_BOTH);
    const ouest = new Set(square(w, 8, 4));
    const est = new Set(square(w, 11, 4));
    const [aller, retour] = w.groundRoute();
    const premier = (route: number[], bout: Set<number>) => route.findIndex((c) => bout.has(c));

    expect(premier(aller, ouest)).toBeGreaterThanOrEqual(0);
    expect(premier(aller, ouest)).toBeLessThan(premier(aller, est));
    expect(premier(retour, est)).toBeGreaterThanOrEqual(0);
    expect(premier(retour, est)).toBeLessThan(premier(retour, ouest));
  });

  it('[RM-08] contourne le bout comme un obstacle quand le raccourci ne paye pas', () => {
    const avec = newWorld('normal', 42, MAP_WORMHOLE_USELESS);
    const sans = newWorld('normal', 42, withRocks(MAP_WORMHOLE_USELESS));
    const bouts = new Set([...square(avec, 14, 3), ...square(avec, 1, 3)]);

    expect(avec.mazeLength()).toBe(sans.mazeLength());
    expect(avec.groundRoute().flat().some((c) => bouts.has(c))).toBe(false);
  });
});
