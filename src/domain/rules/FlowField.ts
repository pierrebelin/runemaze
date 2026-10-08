import type { Grid } from '../model/Grid';

const SQRT2 = Math.SQRT2;
const DIRS: [number, number, number][] = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, SQRT2], [1, -1, SQRT2], [-1, 1, SQRT2], [-1, -1, SQRT2],
];

/**
 * Champ de flux : distance de chaque case à une région cible (Dijkstra,
 * déplacements en 8 directions sans couper les coins) et case suivante à
 * prendre. Une seule passe sert toutes les créatures d'un même trajet, quel
 * que soit leur nombre : c'est ce qui rend le labyrinthe dynamique bon marché.
 */
export class FlowField {
  readonly dist: Float64Array;
  readonly next: Int32Array;
  /** Pour une case d'arrivée d'un trou de ver : la case praticable où l'on repart. */
  readonly exit: Int32Array;

  constructor(
    private readonly grid: Grid,
    private readonly targets: number[],
    private readonly wormholes = true,
  ) {
    this.dist = new Float64Array(grid.w * grid.h);
    this.next = new Int32Array(grid.w * grid.h);
    this.exit = new Int32Array(grid.w * grid.h);
    this.compute();
  }

  /** `extraBlocked` permet de tester une construction sans modifier la grille. */
  compute(extraBlocked?: ReadonlySet<number>): void {
    const g = this.grid;
    const n = g.w * g.h;
    const dist = this.dist;
    dist.fill(Infinity);
    this.next.fill(-1);
    this.exit.fill(-1);
    const end = (i: number) => this.wormholes && g.kind[i] === 'wormhole';
    // Meilleure arrivée connue, par bout d'entrée (cases où l'on entre pour y ressortir).
    const arrival = new Map<number[], { d: number; j: number }>();
    const open = (i: number) => g.walkable(i) && !(extraBlocked && extraBlocked.has(i));

    const heap = new MinHeap();
    for (const t of this.targets) {
      if (!open(t)) continue;
      dist[t] = 0;
      heap.push(t, 0);
    }
    while (heap.size > 0) {
      const [i, d] = heap.pop();
      if (d > dist[i]) continue;
      const x = g.cx(i);
      const y = g.cy(i);
      for (const [dx, dy, cost] of DIRS) {
        const nx = x + dx;
        const ny = y + dy;
        if (!g.inBounds(nx, ny)) continue;
        const j = g.idx(nx, ny);
        const isEnd = end(j) && !end(i);
        if (!open(j) && !isEnd) continue;
        if (dx !== 0 && dy !== 0 && (!open(g.idx(x + dx, y)) || !open(g.idx(x, y + dy)))) continue;
        const nd = d + cost;
        if (isEnd) {
          // Sortir par `j` revient à être entré par l'autre bout, sans coût de passage.
          const entries = g.partner(j)!;
          if (nd < (arrival.get(entries)?.d ?? Infinity)) {
            arrival.set(entries, { d: nd, j });
            this.exit[j] = i;
            for (const e of entries) {
              dist[e] = nd;
              heap.push(e, nd);
            }
          }
        } else if (nd < dist[j]) {
          dist[j] = nd;
          heap.push(j, nd);
        }
      }
    }

    // Case suivante : le voisin accessible qui minimise distance + coût du pas.
    for (let i = 0; i < n; i++) {
      if (!Number.isFinite(dist[i]) || dist[i] === 0 || end(i)) continue;
      const x = g.cx(i);
      const y = g.cy(i);
      let best = -1;
      let bestD = Infinity;
      for (const [dx, dy, cost] of DIRS) {
        const nx = x + dx;
        const ny = y + dy;
        if (!g.inBounds(nx, ny)) continue;
        const j = g.idx(nx, ny);
        if (!open(j) && !end(j)) continue;
        if (dx !== 0 && dy !== 0 && (!open(g.idx(x + dx, y)) || !open(g.idx(x, y + dy)))) continue;
        const cand = dist[j] + cost;
        if (cand < bestD - 1e-6) {
          bestD = cand;
          best = j;
        }
      }
      this.next[i] = best;
    }
    for (const [entries, a] of arrival) for (const e of entries) this.next[e] = a.j;
  }

  reachable(i: number): boolean {
    return Number.isFinite(this.dist[i]);
  }

  /** Suit le champ depuis `from` jusqu'à la région cible. */
  trace(from: number): number[] {
    const out: number[] = [];
    let i = from;
    let guard = this.dist.length;
    while (i >= 0 && guard-- > 0) {
      out.push(i);
      if (this.dist[i] === 0) break;
      if (this.grid.kind[i] === 'wormhole') {
        // Entrée dans un bout : on ressort à l'arrivée de l'autre, puis on repart.
        const arrive = this.next[i];
        out.push(arrive);
        i = this.exit[arrive];
      } else i = this.next[i];
    }
    return out;
  }
}

class MinHeap {
  private ids: number[] = [];
  private keys: number[] = [];
  get size(): number {
    return this.ids.length;
  }
  push(id: number, key: number): void {
    const ids = this.ids;
    const keys = this.keys;
    let k = ids.length;
    ids.push(id);
    keys.push(key);
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (keys[p] <= key) break;
      ids[k] = ids[p];
      keys[k] = keys[p];
      k = p;
    }
    ids[k] = id;
    keys[k] = key;
  }
  pop(): [number, number] {
    const ids = this.ids;
    const keys = this.keys;
    const top: [number, number] = [ids[0], keys[0]];
    const lastId = ids.pop()!;
    const lastKey = keys.pop()!;
    const n = ids.length;
    if (n > 0) {
      let k = 0;
      for (;;) {
        const l = 2 * k + 1;
        if (l >= n) break;
        const r = l + 1;
        const c = r < n && keys[r] < keys[l] ? r : l;
        if (keys[c] >= lastKey) break;
        ids[k] = ids[c];
        keys[k] = keys[c];
        k = c;
      }
      ids[k] = lastId;
      keys[k] = lastKey;
    }
    return top;
  }
}
