import { describe, expect, it } from 'vitest';
import { drawMap, emptyLegs } from '../../../src/domain/rules/mapDraw';
import { MAP_RECIPE } from '../../../src/domain/catalog/map';
import { MAP_BENT_STONES, MAP_WALLED } from '../../support/maps';
import { newWorld } from '../../support/helpers';

const SEEDS = Array.from({ length: 200 }, (_, i) => i + 1);

/** Cartes 'earth' des graines SEEDS, tirées une seule fois (une carte coûte jusqu'à ~30 ms). */
const earthCache = new Map<number, ReturnType<typeof drawMap>>();
function earthMap(seed: number): ReturnType<typeof drawMap> {
  let map = earthCache.get(seed);
  if (!map) {
    map = drawMap(seed, 'earth', MAP_RECIPE);
    earthCache.set(seed, map);
  }
  return map;
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

describe('mapDraw', () => {
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

  it('[RM-05] sème de 12 à 24 rochers intérieurs d’1 ou 2 cases chacun', () => {
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

      expect(sizes.length, `graine ${seed}`).toBeGreaterThanOrEqual(MAP_RECIPE.rocks.min);
      expect(sizes.length, `graine ${seed}`).toBeLessThanOrEqual(MAP_RECIPE.rocks.max);
      expect(sizes.every((s) => s === 1 || s === 2), `graine ${seed}`).toBe(true);
    }
  });

  it('[RM-05] laisse un anneau de 2 cases sans rocher autour de chaque repère', () => {
    const m = MAP_RECIPE.rockMargin;
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

  it('[RM-08] garde le biome demandé sans changer la disposition', () => {
    for (const seed of SEEDS) {
      const earth = earthMap(seed);
      const snow = drawMap(seed, 'snow', MAP_RECIPE);
      const space = drawMap(seed, 'space', MAP_RECIPE);

      expect(snow.biome).toBe('snow');
      expect(space.biome).toBe('space');
      expect(snow.rows).toEqual(earth.rows);
      expect(space.rows).toEqual(earth.rows);
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

  it('[RM-06] mesure un tronçon infini quand des rochers ferment le passage', () => {
    expect(emptyLegs(MAP_WALLED)[0]).toBe(Infinity);
  });
});
