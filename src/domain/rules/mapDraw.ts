import { Rng } from '../Rng';
import { Grid } from '../model/Grid';
import { FlowField } from './FlowField';
import type { Biome, MapDef, MapRecipe } from '../model/types';

interface Spot {
  x: number;
  y: number;
}

/** Tire un coin haut-gauche à l'intérieur de la bordure, par rejet tant que son centre est trop proche de celui d'un autre repère. */
function drawSpot(rng: Rng, recipe: MapRecipe, placed: Spot[]): Spot {
  const size = recipe.landmark;
  for (;;) {
    const x = 1 + rng.int(recipe.width - 2 - size + 1);
    const y = 1 + rng.int(recipe.height - 2 - size + 1);
    if (!placed.some((p) => Math.hypot(p.x - x, p.y - y) < recipe.landmarkGap)) return { x, y };
  }
}

/** Une disposition : repères (portail, pierres, porte dans l'ordre de `placed`) puis rochers, sans garantie de passage. */
function drawRows(rng: Rng, recipe: MapRecipe, biome: Biome, stones: number): { rows: string[]; placed: Spot[] } {
  const { width, height, landmark } = recipe;
  const grid: string[][] = Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => (x === 0 || y === 0 || x === width - 1 || y === height - 1 ? '#' : '.')),
  );
  const placed: Spot[] = [];
  const stamp = (char: string) => {
    const spot = drawSpot(rng, recipe, placed);
    placed.push(spot);
    for (let dy = 0; dy < landmark; dy++) for (let dx = 0; dx < landmark; dx++) grid[spot.y + dy][spot.x + dx] = char;
  };

  stamp('S');
  for (let i = 1; i <= stones; i++) stamp(String(i));
  stamp('E');

  const solid = new Set<string>();
  const key = (x: number, y: number) => `${x},${y}`;
  // Une case est admise si elle est intérieure, libre, hors de la marge des repères, et ne touche aucun rocher ni aucune plaque posés (diagonales comprises).
  const admissible = (x: number, y: number, own: Spot[]) => {
    if (x < 1 || y < 1 || x > width - 2 || y > height - 2 || grid[y][x] !== '.') return false;
    const m = recipe.landmarkMargin;
    if (placed.some((p) => x >= p.x - m && x <= p.x + landmark - 1 + m && y >= p.y - m && y <= p.y + landmark - 1 + m)) return false;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++)
        if (solid.has(key(x + dx, y + dy)) && !own.some((o) => o.x === x + dx && o.y === y + dy)) return false;
    return true;
  };
  const rocksRecipe = recipe.biomes[biome].rocks;
  if (rocksRecipe) {
    const count = rocksRecipe.min + rng.int(rocksRecipe.max - rocksRecipe.min + 1);
    for (let i = 0; i < count; i++) {
      let first: Spot;
      do first = { x: 1 + rng.int(width - 2), y: 1 + rng.int(height - 2) };
      while (!admissible(first.x, first.y, []));
      const cells = [first];
      if (rng.int(2) === 1) {
        const [dx, dy] = [[1, 0], [-1, 0], [0, 1], [0, -1]][rng.int(4)];
        const second = { x: first.x + dx, y: first.y + dy };
        if (admissible(second.x, second.y, cells)) cells.push(second);
      }
      for (const c of cells) {
        grid[c.y][c.x] = '#';
        solid.add(key(c.x, c.y));
      }
    }
  }

  const iceRecipe = recipe.biomes[biome].ice;
  if (iceRecipe) {
    const patches = iceRecipe.patches.min + rng.int(iceRecipe.patches.max - iceRecipe.patches.min + 1);
    for (let i = 0; i < patches; i++) {
      let cells: Spot[];
      do {
        const size = iceRecipe.size.min + rng.int(iceRecipe.size.max - iceRecipe.size.min + 1);
        let first: Spot;
        do first = { x: 1 + rng.int(width - 2), y: 1 + rng.int(height - 2) };
        while (!admissible(first.x, first.y, []));
        cells = [first];
        while (cells.length < size) {
          const next = cells
            .flatMap((c) => [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ x: c.x + dx, y: c.y + dy })))
            .filter((c, k, all) => !cells.some((o) => o.x === c.x && o.y === c.y) && all.findIndex((a) => a.x === c.x && a.y === c.y) === k)
            .filter((c) => admissible(c.x, c.y, cells));
          if (next.length === 0) break;
          cells.push(next[rng.int(next.length)]);
        }
      } while (cells.length < iceRecipe.size.min);
      for (const c of cells) {
        grid[c.y][c.x] = '*';
        solid.add(key(c.x, c.y));
      }
    }
  }

  return { rows: grid.map((r) => r.join('')), placed };
}

/** Nombre de pierres tiré une fois (sinon le filtre des tronçons favorise 2 pierres), puis on recommence jusqu'à ce que chaque tronçon et le total respectent la recette. */
export function drawMap(seed: number, biome: Biome, recipe: MapRecipe): MapDef {
  const rng = new Rng(seed);
  const stones = 1 + rng.int(2);
  for (;;) {
    const { rows, placed } = drawRows(rng, recipe, biome, stones);
    // Écarte sans FlowField les dispositions dont le trajet en ligne libre est déjà trop court (un rocher ne rallonge jamais assez un tronçon pour le sauver) ou trop long.
    const straight = straightLegs(placed, recipe.landmark);
    if (straight.some((l) => l < recipe.minLeg) || straight.reduce((a, b) => a + b, 0) > recipe.route.max) continue;
    const map: MapDef = {
      id: `tirage-${seed}`,
      name: 'Carte tirée',
      width: recipe.width,
      height: recipe.height,
      rows,
      biome,
    };
    const legs = emptyLegs(map, recipe.minLeg);
    const total = legs.reduce((a, b) => a + b, 0);
    if (legs.every((l) => l >= recipe.minLeg) && total >= recipe.route.min && total <= recipe.route.max) return map;
  }
}

/** Distance à vol d'oiseau (8 directions) de chaque tronçon : de la case centrale du portail à la 1re pierre, puis entre cases les plus proches des repères suivants. */
function straightLegs(placed: Spot[], size: number): number[] {
  const octile = (dx: number, dy: number) => Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
  const gap = (a: number, b: number) => Math.max(0, b - (a + size - 1), a - (b + size - 1));
  return placed.slice(1).map((b, k) => {
    const a = placed[k];
    if (k > 0) return octile(gap(a.x, b.x), gap(a.y, b.y));
    const cx = a.x + 1;
    const cy = a.y + 1;
    return octile(Math.max(0, b.x - cx, cx - (b.x + size - 1)), Math.max(0, b.y - cy, cy - (b.y + size - 1)));
  });
}

/** Longueur de chaque tronçon (portail → pierres → porte) sur la carte sans construction ; Infinity si fermé. S'arrête au premier tronçon fermé ou < `minLeg` : la liste est alors tronquée. */
export function emptyLegs(map: MapDef, minLeg = 0): number[] {
  const grid = new Grid(map);
  const targets = [...grid.checkpoints, grid.exitCells];
  const c = grid.regionCenter(grid.spawnCells);
  const legs: number[] = [];
  let from = [grid.idx(Math.floor(c.x), Math.floor(c.y))];
  for (const cells of targets) {
    const dist = new FlowField(grid, cells).dist;
    const leg = Math.min(...from.map((i) => dist[i]));
    legs.push(leg);
    if (!(leg >= minLeg && Number.isFinite(leg))) break;
    from = cells;
  }
  return legs;
}
