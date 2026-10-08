import { beforeAll, describe, expect, it } from 'vitest';
import { drawMap, emptyLegs } from '../../../src/domain/rules/mapDraw';
import { Grid } from '../../../src/domain/model/Grid';
import { wormholesOpen } from '../../../src/domain/rules/wormhole';
import { MAP_RECIPE } from '../../../src/domain/catalog/map';
import { MAP_BENT_STONES, MAP_WALLED } from '../../support/maps';
import { newWorld } from '../../support/helpers';

const SEEDS = Array.from({ length: 200 }, (_, i) => i + 1);

type Biome = 'earth' | 'snow' | 'space';

/** Cartes des graines SEEDS par biome, tirées une seule fois (une carte coûte jusqu'à ~30 ms). */
const mapCache = new Map<string, ReturnType<typeof drawMap>>();
function drawnMap(seed: number, biome: Biome): ReturnType<typeof drawMap> {
  const key = `${biome}:${seed}`;
  let map = mapCache.get(key);
  if (!map) {
    map = drawMap(seed, biome, MAP_RECIPE);
    mapCache.set(key, map);
  }
  return map;
}
function earthMap(seed: number): ReturnType<typeof drawMap> {
  return drawnMap(seed, 'earth');
}

/** Cases (x, y) portant l'un des caractères donnés. */
function cellsOf(rows: string[], chars: string): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (chars.includes(ch)) out.push({ x, y });
    });
  });
  return out;
}

/** Vrai si les cases forment exactement un carré 3 × 3 entièrement à l'intérieur de la bordure. */
function isInnerSquare(cells: { x: number; y: number }[], width: number, height: number): boolean {
  if (cells.length !== 9) return false;
  const x0 = Math.min(...cells.map((c) => c.x));
  const y0 = Math.min(...cells.map((c) => c.y));
  const full = cells.every((c) => c.x >= x0 && c.x < x0 + 3 && c.y >= y0 && c.y < y0 + 3);
  return full && x0 >= 1 && y0 >= 1 && x0 + 2 <= width - 2 && y0 + 2 <= height - 2;
}

function stoneDigits(rows: string[]): string[] {
  return [...new Set(rows.join('').match(/[1-9]/g) ?? [])].sort();
}

/** Cases de chaque repère (portail, pierres, porte), un tableau par repère. */
function landmarks(rows: string[]): { x: number; y: number }[][] {
  const chars = ['S', ...stoneDigits(rows), 'E'];
  return chars.map((ch) => cellsOf(rows, ch));
}

function centerOf(cells: { x: number; y: number }[]): { x: number; y: number } {
  const xs = cells.map((c) => c.x);
  const ys = cells.map((c) => c.y);
  return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
}

/** Composantes de cases `*`, reliées par 4 côtés ou par 8 voisins (diagonales comprises). */
function iceComponents(rows: string[], links: 4 | 8): { x: number; y: number }[][] {
  const left = new Map(cellsOf(rows, '*').map((c) => [`${c.x},${c.y}`, c]));
  const out: { x: number; y: number }[][] = [];
  while (left.size > 0) {
    const [first] = left.values();
    left.delete(`${first.x},${first.y}`);
    const stack = [first];
    const patch: { x: number; y: number }[] = [];
    while (stack.length > 0) {
      const c = stack.pop()!;
      patch.push(c);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if ((dx === 0 && dy === 0) || (links === 4 && dx !== 0 && dy !== 0)) continue;
          const n = left.get(`${c.x + dx},${c.y + dy}`);
          if (n) {
            left.delete(`${n.x},${n.y}`);
            stack.push(n);
          }
        }
      }
    }
    out.push(patch);
  }
  return out;
}

/** Grille minimale (36 × 24) ne portant que les cases données en `*`. */
function patchRows(cells: { x: number; y: number }[]): string[] {
  const rows = Array.from({ length: 24 }, () => '.'.repeat(36).split(''));
  for (const c of cells) rows[c.y][c.x] = '*';
  return rows.map((r) => r.join(''));
}

describe('mapDraw', () => {
  // Remplit le cache une fois : aucun `it` ne paie le tirage (lent sous charge).
  beforeAll(() => {
    for (const biome of ['earth', 'snow', 'space'] as const) {
      for (const seed of SEEDS) drawnMap(seed, biome);
    }
  }, 60_000);

  it('[RM-02] rend exactement la même carte quand la graine est la même', () => {
    for (const seed of SEEDS) {
      expect(drawMap(seed, 'earth', MAP_RECIPE)).toEqual(earthMap(seed));
    }
  });

  it('[RM-09] rend une autre carte quand la graine change', () => {
    const layouts = new Set(SEEDS.map((seed) => earthMap(seed).rows.join('\n')));

    expect(layouts.size).toBeGreaterThan(SEEDS.length * 0.9);
  });

  it('[RM-03] trace une carte de 36 × 24 cases entourée de rochers', () => {
    for (const seed of SEEDS) {
      const map = earthMap(seed);

      expect(map.width).toBe(36);
      expect(map.height).toBe(24);
      expect(map.rows).toHaveLength(24);
      expect(map.rows.every((r) => r.length === 36)).toBe(true);
      expect(map.rows[0]).toBe('#'.repeat(36));
      expect(map.rows[23]).toBe('#'.repeat(36));
      expect(map.rows.every((r) => r[0] === '#' && r[35] === '#')).toBe(true);
    }
  });

  it('[RM-03] place un portail et une porte de 3 × 3 cases à l’intérieur de la bordure', () => {
    for (const seed of SEEDS) {
      const { rows, width, height } = earthMap(seed);

      expect(isInnerSquare(cellsOf(rows, 'S'), width, height)).toBe(true);
      expect(isInnerSquare(cellsOf(rows, 'E'), width, height)).toBe(true);
    }
  });

  it('[RM-03] place 1 ou 2 pierres runiques de 3 × 3 cases, chaque nombre dans environ la moitié des tirages', () => {
    let twoStones = 0;
    for (const seed of SEEDS) {
      const { rows, width, height } = earthMap(seed);
      const digits = stoneDigits(rows);

      expect(['1', '1,2']).toContain(digits.join(','));
      for (const d of digits) expect(isInnerSquare(cellsOf(rows, d), width, height)).toBe(true);
      if (digits.length === 2) twoStones++;
    }

    expect(twoStones).toBeGreaterThanOrEqual(60);
    expect(twoStones).toBeLessThanOrEqual(140);
  });

  it('[RM-04] écarte le centre de chaque repère d’au moins 10 cases de tous les autres', () => {
    for (const seed of SEEDS) {
      const centers = landmarks(earthMap(seed).rows).map(centerOf);

      for (let i = 0; i < centers.length; i++) {
        for (let j = i + 1; j < centers.length; j++) {
          const dist = Math.hypot(centers[i].x - centers[j].x, centers[i].y - centers[j].y);
          expect(dist, `graine ${seed}, repères ${i} et ${j}`).toBeGreaterThanOrEqual(MAP_RECIPE.landmarkGap);
        }
      }
    }
  });

  it('[RM-04] place parfois un repère contre la bordure et parfois au centre de la carte', () => {
    let againstBorder = 0;
    let atCenter = 0;
    for (const seed of SEEDS) {
      const { rows, width, height } = earthMap(seed);
      for (const cells of landmarks(rows)) {
        const c = centerOf(cells);
        if (cells.some((p) => p.x === 1 || p.y === 1 || p.x === width - 2 || p.y === height - 2)) againstBorder++;
        if (Math.abs(c.x - (width - 1) / 2) <= 4 && Math.abs(c.y - (height - 1) / 2) <= 3) atCenter++;
      }
    }

    expect(againstBorder).toBeGreaterThan(0);
    expect(atCenter).toBeGreaterThan(0);
  });

  it('[RM-01] sème de 12 à 24 rochers intérieurs d’1 ou 2 cases quand le biome est Terre', () => {
    for (const seed of SEEDS) {
      const { rows, width, height } = earthMap(seed);
      const inner = cellsOf(rows, '#').filter((c) => c.x >= 1 && c.y >= 1 && c.x <= width - 2 && c.y <= height - 2);
      const key = (c: { x: number; y: number }) => `${c.x},${c.y}`;
      const left = new Map(inner.map((c) => [key(c), c]));
      const sizes: number[] = [];

      while (left.size > 0) {
        const [first] = left.values();
        left.delete(key(first));
        const stack = [first];
        let size = 0;
        while (stack.length > 0) {
          const c = stack.pop()!;
          size++;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const n = left.get(`${c.x + dx},${c.y + dy}`);
              if (n) {
                left.delete(key(n));
                stack.push(n);
              }
            }
          }
        }
        sizes.push(size);
      }

      expect(sizes.length, `graine ${seed}`).toBeGreaterThanOrEqual(12);
      expect(sizes.length, `graine ${seed}`).toBeLessThanOrEqual(24);
      expect(sizes.every((s) => s === 1 || s === 2), `graine ${seed}`).toBe(true);
    }
  });

  it('[RM-01] laisse un anneau de 2 cases sans rocher autour de chaque repère quand le biome est Terre', () => {
    const m = MAP_RECIPE.landmarkMargin;
    expect(m).toBe(2);
    for (const seed of SEEDS) {
      const { rows, width, height } = earthMap(seed);
      const rocks = cellsOf(rows, '#').filter((c) => c.x >= 1 && c.y >= 1 && c.x <= width - 2 && c.y <= height - 2);

      expect(rocks.length, `graine ${seed}`).toBeGreaterThan(0);
      for (const cells of landmarks(rows)) {
        const x0 = Math.min(...cells.map((c) => c.x)) - m;
        const x1 = Math.max(...cells.map((c) => c.x)) + m;
        const y0 = Math.min(...cells.map((c) => c.y)) - m;
        const y1 = Math.max(...cells.map((c) => c.y)) + m;
        const inside = rocks.filter((r) => r.x >= x0 && r.x <= x1 && r.y >= y0 && r.y <= y1);

        expect(inside, `graine ${seed}`).toEqual([]);
      }
    }
  });

  it('[RM-01] ne pose aucun rocher hors de la bordure quand le biome est Neige ou Espace', () => {
    for (const seed of SEEDS) {
      for (const biome of ['snow', 'space'] as const) {
        const { rows, width, height } = drawnMap(seed, biome);
        const inner = cellsOf(rows, '#').filter((c) => c.x >= 1 && c.y >= 1 && c.x <= width - 2 && c.y <= height - 2);

        expect(inner, `graine ${seed}, biome ${biome}`).toEqual([]);
      }
    }
  });

  it('[RM-11] dessine une autre disposition pour la même graine quand le biome change', () => {
    for (const seed of SEEDS) {
      const snow = drawnMap(seed, 'snow');

      expect(snow.biome).toBe('snow');
      expect(snow.rows, `graine ${seed}`).not.toEqual(earthMap(seed).rows);
    }
  });

  it('[RM-02] pose de 5 à 7 plaques de 5 à 9 cases reliées par un côté quand le biome est Neige', () => {
    for (const seed of SEEDS) {
      const patches = iceComponents(drawnMap(seed, 'snow').rows, 8);

      expect(patches.length, `graine ${seed}`).toBeGreaterThanOrEqual(5);
      expect(patches.length, `graine ${seed}`).toBeLessThanOrEqual(7);
      for (const patch of patches) {
        expect(patch.length, `graine ${seed}`).toBeGreaterThanOrEqual(5);
        expect(patch.length, `graine ${seed}`).toBeLessThanOrEqual(9);
        expect(iceComponents(patchRows(patch), 4), `graine ${seed}`).toHaveLength(1);
      }
    }
  });

  it('[RM-02] ne pose aucune case de glace à moins de 2 cases d’un repère', () => {
    const m = MAP_RECIPE.landmarkMargin;
    for (const seed of SEEDS) {
      const { rows } = drawnMap(seed, 'snow');
      const ice = cellsOf(rows, '*');

      expect(ice.length, `graine ${seed}`).toBeGreaterThan(0);
      for (const cells of landmarks(rows)) {
        const x0 = Math.min(...cells.map((c) => c.x)) - m;
        const x1 = Math.max(...cells.map((c) => c.x)) + m;
        const y0 = Math.min(...cells.map((c) => c.y)) - m;
        const y1 = Math.max(...cells.map((c) => c.y)) + m;

        expect(ice.filter((c) => c.x >= x0 && c.x <= x1 && c.y >= y0 && c.y <= y1), `graine ${seed}`).toEqual([]);
      }
    }
  });

  it('[RM-02] sépare les plaques d’au moins une case, diagonales comprises', () => {
    for (const seed of SEEDS) {
      const patches = iceComponents(drawnMap(seed, 'snow').rows, 4);

      expect(patches.length, `graine ${seed}`).toBeGreaterThan(0);
      for (let i = 0; i < patches.length; i++) {
        for (let j = i + 1; j < patches.length; j++) {
          for (const a of patches[i]) {
            for (const b of patches[j]) {
              expect(Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)), `graine ${seed}`).toBeGreaterThanOrEqual(2);
            }
          }
        }
      }
    }
  });

  // Vert d'office aujourd'hui : garde contre une glace qui fuirait vers Terre ou Espace.
  it('[RM-02] ne pose aucune glace quand le biome est Terre ou Espace', () => {
    for (const seed of SEEDS) {
      for (const biome of ['earth', 'space'] as const) {
        expect(cellsOf(drawnMap(seed, biome).rows, '*'), `graine ${seed}, biome ${biome}`).toEqual([]);
      }
    }
  });

  it('[RM-04] pose de 4 à 6 cristaux d’une case quand le biome est Espace', () => {
    for (const seed of SEEDS) {
      const crystals = cellsOf(drawnMap(seed, 'space').rows, '+');

      expect(crystals.length, `graine ${seed}`).toBeGreaterThanOrEqual(4);
      expect(crystals.length, `graine ${seed}`).toBeLessThanOrEqual(6);
    }
  });

  it('[RM-04] écarte chaque cristal d’au moins 2 cases de tout repère et d’au moins 3 cases des autres cristaux', () => {
    const m = MAP_RECIPE.landmarkMargin;
    const gap = 3;
    for (const seed of SEEDS) {
      const { rows } = drawnMap(seed, 'space');
      const crystals = cellsOf(rows, '+');

      expect(crystals.length, `graine ${seed}`).toBeGreaterThan(0);
      for (const cells of landmarks(rows)) {
        const x0 = Math.min(...cells.map((c) => c.x)) - m;
        const x1 = Math.max(...cells.map((c) => c.x)) + m;
        const y0 = Math.min(...cells.map((c) => c.y)) - m;
        const y1 = Math.max(...cells.map((c) => c.y)) + m;

        expect(crystals.filter((c) => c.x >= x0 && c.x <= x1 && c.y >= y0 && c.y <= y1), `graine ${seed}`).toEqual([]);
      }
      for (let i = 0; i < crystals.length; i++) {
        for (let j = i + 1; j < crystals.length; j++) {
          const dist = Math.hypot(crystals[i].x - crystals[j].x, crystals[i].y - crystals[j].y);
          expect(dist, `graine ${seed}`).toBeGreaterThanOrEqual(gap);
        }
      }
    }
  });

  it('[RM-04] écarte chaque cristal d’au moins 2 cases de tout bout', () => {
    const m = MAP_RECIPE.landmarkMargin;
    let ends = 0;
    for (const seed of SEEDS) {
      const { rows } = drawnMap(seed, 'space');
      const crystals = cellsOf(rows, '+');

      expect(crystals.length, `graine ${seed}`).toBeGreaterThan(0);
      for (const ch of 'aAbB') {
        const cells = cellsOf(rows, ch);
        if (cells.length === 0) continue;
        ends++;
        const x0 = Math.min(...cells.map((c) => c.x)) - m;
        const x1 = Math.max(...cells.map((c) => c.x)) + m;
        const y0 = Math.min(...cells.map((c) => c.y)) - m;
        const y1 = Math.max(...cells.map((c) => c.y)) + m;

        expect(
          crystals.filter((c) => c.x >= x0 && c.x <= x1 && c.y >= y0 && c.y <= y1),
          `graine ${seed}, bout ${ch}`,
        ).toEqual([]);
      }
    }

    expect(ends).toBeGreaterThan(0);
  });

  // Vert d'office aujourd'hui : garde contre des cristaux qui fuiraient vers Terre ou Neige.
  it('[RM-04] ne pose aucun cristal quand le biome est Terre ou Neige', () => {
    for (const seed of SEEDS) {
      for (const biome of ['earth', 'snow'] as const) {
        expect(cellsOf(drawnMap(seed, biome).rows, '+'), `graine ${seed}, biome ${biome}`).toEqual([]);
      }
    }
  });

  it('[RM-12] rend exactement la même carte Neige quand la graine est la même', () => {
    for (const seed of SEEDS) {
      const first = drawnMap(seed, 'snow');

      expect(cellsOf(first.rows, '*').length, `graine ${seed}`).toBeGreaterThan(0);
      expect(drawMap(seed, 'snow', MAP_RECIPE)).toEqual(first);
    }
  });

  it('[RM-06] pose 1 ou 2 trous de ver, chaque nombre dans environ la moitié des tirages', () => {
    let twoWormholes = 0;
    for (const seed of SEEDS) {
      const { rows } = drawnMap(seed, 'space');
      const ends = [...new Set(rows.join('').match(/[aAbB]/g) ?? [])].sort().join('');

      expect(['Aa', 'ABab'], `graine ${seed}`).toContain(ends);
      if (ends === 'ABab') twoWormholes++;
    }

    expect(twoWormholes).toBeGreaterThanOrEqual(60);
    expect(twoWormholes).toBeLessThanOrEqual(140);
  });

  it('[RM-06] fait chaque bout de 2 × 2 cases, à au moins 2 cases de tout repère', () => {
    const m = MAP_RECIPE.landmarkMargin;
    for (const seed of SEEDS) {
      const { rows } = drawnMap(seed, 'space');
      let present = 0;

      for (const ch of 'aAbB') {
        const cells = cellsOf(rows, ch);
        if (cells.length === 0) continue;
        present++;
        const x0 = Math.min(...cells.map((c) => c.x));
        const y0 = Math.min(...cells.map((c) => c.y));

        expect(cells, `graine ${seed}, bout ${ch}`).toHaveLength(4);
        expect(
          cells.every((c) => c.x >= x0 && c.x <= x0 + 1 && c.y >= y0 && c.y <= y0 + 1),
          `graine ${seed}, bout ${ch}`,
        ).toBe(true);
        for (const lm of landmarks(rows)) {
          const lx0 = Math.min(...lm.map((c) => c.x)) - m;
          const lx1 = Math.max(...lm.map((c) => c.x)) + m;
          const ly0 = Math.min(...lm.map((c) => c.y)) - m;
          const ly1 = Math.max(...lm.map((c) => c.y)) + m;

          expect(
            cells.filter((c) => c.x >= lx0 && c.x <= lx1 && c.y >= ly0 && c.y <= ly1),
            `graine ${seed}, bout ${ch}`,
          ).toEqual([]);
        }
      }
      expect(present, `graine ${seed}`).toBeGreaterThanOrEqual(2);
    }
  });

  it('[RM-06] écarte les deux bouts d’un trou de ver d’au moins 12 cases de centre à centre', () => {
    for (const seed of SEEDS) {
      const { rows } = drawnMap(seed, 'space');

      expect(cellsOf(rows, 'a').length, `graine ${seed}`).toBeGreaterThan(0);
      for (const [one, other] of [['a', 'A'], ['b', 'B']]) {
        const first = cellsOf(rows, one);
        if (first.length === 0) continue;
        const c1 = centerOf(first);
        const c2 = centerOf(cellsOf(rows, other));

        expect(Math.hypot(c1.x - c2.x, c1.y - c2.y), `graine ${seed}, trou ${one}`).toBeGreaterThanOrEqual(12);
      }
    }
  });

  // Vert d'office aujourd'hui : garde contre des trous de ver qui fuiraient vers Terre ou Neige.
  it('[RM-06] ne pose aucun trou de ver quand le biome est Terre ou Neige', () => {
    for (const seed of SEEDS) {
      for (const biome of ['earth', 'snow'] as const) {
        expect(cellsOf(drawnMap(seed, biome).rows, 'aAbB'), `graine ${seed}, biome ${biome}`).toEqual([]);
      }
    }
  });

  it('[RM-12] rend exactement la même carte Espace quand la graine est la même', () => {
    // Le déterminisme n'a pas besoin des 200 graines, et le tirage Espace est lent.
    for (const seed of SEEDS.slice(0, 20)) {
      const first = drawnMap(seed, 'space');

      expect(cellsOf(first.rows, 'a').length, `graine ${seed}`).toBeGreaterThan(0);
      expect(drawMap(seed, 'space', MAP_RECIPE)).toEqual(first);
    }
  });

  it('[RM-06] mesure un tronçon par étape dont la somme vaut le trajet terrestre de la partie', () => {
    const legs = emptyLegs(MAP_BENT_STONES);

    expect(legs).toHaveLength(3);
    expect(legs.reduce((a, b) => a + b, 0)).toBe(newWorld('normal', 42, MAP_BENT_STONES).mazeLength());
  });

  it('[RM-06] relie portail, pierres et porte sans construction, chaque tronçon faisant au moins 14 cases', () => {
    for (const seed of SEEDS) {
      const legs = emptyLegs(earthMap(seed));

      for (const leg of legs) {
        expect(Number.isFinite(leg), `graine ${seed}`).toBe(true);
        expect(leg, `graine ${seed}`).toBeGreaterThanOrEqual(MAP_RECIPE.minLeg);
      }
    }
  });

  it('[RM-06] tire un trajet à vide total compris entre 50 et 80 cases', () => {
    for (const seed of SEEDS) {
      const total = emptyLegs(earthMap(seed)).reduce((a, b) => a + b, 0);

      expect(total, `graine ${seed}`).toBeGreaterThanOrEqual(MAP_RECIPE.route.min);
      expect(total, `graine ${seed}`).toBeLessThanOrEqual(MAP_RECIPE.route.max);
    }
  });

  /** Tronçons à vide de la carte Espace sans ses trous de ver (bouts remplacés par des rochers). */
  function legsWithoutWormholes(map: ReturnType<typeof drawMap>): number[] {
    return emptyLegs({ ...map, rows: map.rows.map((r) => r.replace(/[aAbB]/g, '#')) });
  }

  /** Vrai si, sur au moins une graine, un trou de ver raccourcit strictement un tronçon. */
  function someWormholeShortensALeg(): boolean {
    return SEEDS.some((seed) => {
      const map = drawnMap(seed, 'space');
      const without = legsWithoutWormholes(map);
      return emptyLegs(map).some((leg, i) => leg < without[i]);
    });
  }

  // Vert d'office aujourd'hui : garde contre un tirage qui ignorerait les trous de ver (2000 graines essayées, 0 échec).
  it('[RM-10] garde chaque tronçon d’au moins 14 cases en comptant les trous de ver', () => {
    expect(someWormholeShortensALeg()).toBe(true);
    for (const seed of SEEDS) {
      for (const leg of emptyLegs(drawnMap(seed, 'space'))) {
        expect(Number.isFinite(leg), `graine ${seed}`).toBe(true);
        expect(leg, `graine ${seed}`).toBeGreaterThanOrEqual(MAP_RECIPE.minLeg);
      }
    }
  });

  // Vert d'office aujourd'hui : garde contre un tirage qui ignorerait les trous de ver (2000 graines essayées, 0 échec).
  it('[RM-10] tire un trajet à vide entre 50 et 80 cases en comptant les trous de ver', () => {
    expect(someWormholeShortensALeg()).toBe(true);
    for (const seed of SEEDS) {
      const total = emptyLegs(drawnMap(seed, 'space')).reduce((a, b) => a + b, 0);

      expect(total, `graine ${seed}`).toBeGreaterThanOrEqual(MAP_RECIPE.route.min);
      expect(total, `graine ${seed}`).toBeLessThanOrEqual(MAP_RECIPE.route.max);
    }
  });

  // Vert d'office aujourd'hui : garde contre un tirage qui ignorerait les trous de ver (2000 graines essayées, 0 échec).
  it('[RM-13] laisse chaque bout accessible à pied depuis le portail sur la carte tirée', () => {
    expect(someWormholeShortensALeg()).toBe(true);
    for (const seed of SEEDS) {
      expect(wormholesOpen(new Grid(drawnMap(seed, 'space')), new Set()), `graine ${seed}`).toBe(true);
    }
  });

  it('[RM-06] mesure un tronçon infini quand des rochers ferment le passage', () => {
    expect(emptyLegs(MAP_WALLED)[0]).toBe(Infinity);
  });
});
