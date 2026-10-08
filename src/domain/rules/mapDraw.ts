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

/** Une disposition : repères (portail, pierres, porte dans l'ordre de `placed`) puis, selon la recette du biome, rochers, glace, trous de ver (`ends`) et cristaux, sans garantie de passage. */
function drawRows(rng: Rng, recipe: MapRecipe, biome: Biome, stones: number, wormholes: number): { rows: string[]; placed: Spot[]; ends: Spot[][] } {
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

  const ends: Spot[][] = [];
  const wormholesRecipe = recipe.biomes[biome].wormholes;
  if (wormholesRecipe) {
    // Bout de 2 × 2 : coin haut-gauche tiré par rejet tant qu'une des 4 cases n'est pas admise.
    const drawEnd = (far?: Spot): Spot => {
      for (;;) {
        const e = { x: 1 + rng.int(width - 2), y: 1 + rng.int(height - 2) };
        const fits = [0, 1].every((dy) => [0, 1].every((dx) => admissible(e.x + dx, e.y + dy, [])));
        if (fits && (!far || Math.hypot(far.x - e.x, far.y - e.y) >= wormholesRecipe.gap)) return e;
      }
    };
    for (let i = 0; i < wormholes; i++) {
      const pair = [drawEnd()];
      pair.push(drawEnd(pair[0]));
      ends.push(pair);
      pair.forEach((e, k) => {
        for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) grid[e.y + dy][e.x + dx] = 'aAbB'[i * 2 + k];
      });
    }
  }

  const crystalsRecipe = recipe.biomes[biome].crystals;
  if (crystalsRecipe) {
    const count = crystalsRecipe.count.min + rng.int(crystalsRecipe.count.max - crystalsRecipe.count.min + 1);
    const crystals: Spot[] = [];
    while (crystals.length < count) {
      const c = { x: 1 + rng.int(width - 2), y: 1 + rng.int(height - 2) };
      const m = recipe.landmarkMargin;
      const nearEnd = ends.some((pair) => pair.some((e) => c.x >= e.x - m && c.x <= e.x + 1 + m && c.y >= e.y - m && c.y <= e.y + 1 + m));
      if (!admissible(c.x, c.y, []) || nearEnd || crystals.some((o) => Math.hypot(o.x - c.x, o.y - c.y) < crystalsRecipe.gap)) continue;
      crystals.push(c);
      grid[c.y][c.x] = '+';
    }
  }

  return { rows: grid.map((r) => r.join('')), placed, ends };
}

/** Nombre de pierres tiré une fois (sinon le filtre des tronçons favorise 2 pierres), puis on recommence jusqu'à ce que chaque tronçon et le total respectent la recette. Les rejets sans FlowField reposent sur `shortcutLegs`, borne basse valide même avec des trous de ver. */
export function drawMap(seed: number, biome: Biome, recipe: MapRecipe): MapDef {
  const rng = new Rng(seed);
  const stones = 1 + rng.int(2);
  const wormholesRecipe = recipe.biomes[biome].wormholes;
  // Tiré une fois, comme les pierres : sinon le rejet des cartes à 2 trous de ver fausse la répartition.
  const wormholes = wormholesRecipe ? wormholesRecipe.count.min + rng.int(wormholesRecipe.count.max - wormholesRecipe.count.min + 1) : 0;
  for (;;) {
    const { rows, placed, ends } = drawRows(rng, recipe, biome, stones, wormholes);
    // Écarte sans FlowField les dispositions dont le trajet en ligne libre est déjà trop court (un rocher ne rallonge jamais assez un tronçon pour le sauver) ou trop long.
    const bound = shortcutLegs(placed, recipe.landmark, ends);
    if (bound.some((l) => l < recipe.minLeg) || bound.reduce((x, y) => x + y, 0) > recipe.route.max) continue;
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

/**
 * Borne basse de chaque tronçon quand on peut emprunter les trous de ver (bouts 2 × 2, passage gratuit d'un bout à l'autre) : plus court chemin à vol d'oiseau entre les boîtes.
 * Écarte sans FlowField les dispositions dont un trou de ver ramène un tronçon sous `minLeg`.
 */
function shortcutLegs(placed: Spot[], size: number, ends: Spot[][]): number[] {
  type Box = { x0: number; y0: number; x1: number; y1: number };
  const box = (s: Spot, n: number): Box => ({ x0: s.x, y0: s.y, x1: s.x + n - 1, y1: s.y + n - 1 });
  const dist = (a: Box, b: Box) => {
    const dx = Math.max(0, b.x0 - a.x1, a.x0 - b.x1);
    const dy = Math.max(0, b.y0 - a.y1, a.y0 - b.y1);
    return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
  };
  const holes = ends.map((pair) => pair.map((e) => box(e, 2)));
  return placed.slice(1).map((b, k) => {
    const a = placed[k];
    const from = k === 0 ? box({ x: a.x + 1, y: a.y + 1 }, 1) : box(a, size);
    const to = box(b, size);
    const nodes = [from, to, ...holes.flat()];
    const d = nodes.map((u) => nodes.map((v) => dist(u, v)));
    for (let i = 0; i < holes.length; i++) d[2 + 2 * i][3 + 2 * i] = d[3 + 2 * i][2 + 2 * i] = 0;
    for (let m = 0; m < nodes.length; m++)
      for (let i = 0; i < nodes.length; i++) for (let j = 0; j < nodes.length; j++) d[i][j] = Math.min(d[i][j], d[i][m] + d[m][j]);
    return d[0][1];
  });
}
