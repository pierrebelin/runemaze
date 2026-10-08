import type { CellKind, MapDef } from './types';

const KIND: Record<string, CellKind> = {
  '.': 'build', '#': 'rock', S: 'spawn', E: 'exit', '~': 'road', '*': 'ice',
  '1': 'checkpoint', '2': 'checkpoint', '3': 'checkpoint', '4': 'checkpoint', '5': 'checkpoint',
  '6': 'checkpoint', '7': 'checkpoint', '8': 'checkpoint', '9': 'checkpoint',
};

/** Grille logique : nature du terrain et occupation par les tours (2×2 cases). */
export class Grid {
  readonly w: number;
  readonly h: number;
  readonly kind: CellKind[];
  /** Identifiant de la tour occupant la case, 0 si libre. */
  readonly tower: Int32Array;
  readonly spawnCells: number[] = [];
  /** Cases des pierres runiques, indexées par ordre (`checkpoints[0]` = pierre 1). */
  readonly checkpoints: number[][] = [];
  readonly exitCells: number[] = [];

  constructor(map: MapDef) {
    this.w = map.width;
    this.h = map.height;
    this.kind = new Array(this.w * this.h);
    this.tower = new Int32Array(this.w * this.h);
    if (map.rows.length !== map.height) throw new Error('Hauteur de carte incohérente');
    map.rows.forEach((row, y) => {
      if (row.length !== map.width) throw new Error(`Ligne ${y} : largeur ${row.length} ≠ ${map.width}`);
      [...row].forEach((ch, x) => {
        const k = KIND[ch];
        if (!k) throw new Error(`Caractère de carte inconnu « ${ch} »`);
        const i = this.idx(x, y);
        this.kind[i] = k;
        if (k === 'spawn') this.spawnCells.push(i);
        if (k === 'checkpoint') {
          const n = Number(ch) - 1;
          (this.checkpoints[n] ??= []).push(i);
        }
        if (k === 'exit') this.exitCells.push(i);
      });
    });
  }

  idx(x: number, y: number): number {
    return y * this.w + x;
  }
  cx(i: number): number {
    return i % this.w;
  }
  cy(i: number): number {
    return (i / this.w) | 0;
  }
  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }
  walkable(i: number): boolean {
    return this.kind[i] !== 'rock' && this.tower[i] === 0;
  }
  buildable(i: number): boolean {
    return this.kind[i] === 'build' && this.tower[i] === 0;
  }
  /** Cases couvertes par une tour dont le coin haut-gauche est (x, y). */
  footprint(x: number, y: number): number[] {
    return [this.idx(x, y), this.idx(x + 1, y), this.idx(x, y + 1), this.idx(x + 1, y + 1)];
  }
  regionCenter(cells: number[]): { x: number; y: number } {
    let sx = 0;
    let sy = 0;
    for (const i of cells) {
      sx += this.cx(i) + 0.5;
      sy += this.cy(i) + 0.5;
    }
    return { x: sx / cells.length, y: sy / cells.length };
  }
}
