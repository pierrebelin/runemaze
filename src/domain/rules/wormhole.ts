import type { Grid } from '../model/Grid';
import { FlowField } from './FlowField';

const SIDES: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** Vrai si chaque bout de trou de ver touche, par un côté, une case atteinte à pied (sans emprunter de trou de ver) depuis le portail, une pierre runique ou la porte. */
export function wormholesOpen(grid: Grid, blocked: ReadonlySet<number>): boolean {
  if (grid.wormholes.length === 0) return true; // Terre, Neige : aucun calcul de chemin.
  const field = new FlowField(grid, [...grid.spawnCells, ...grid.checkpoints.flat(), ...grid.exitCells], false);
  field.compute(blocked);
  const touchesReached = (end: number[]) =>
    end.some((i) =>
      SIDES.some(([dx, dy]) => {
        const x = grid.cx(i) + dx;
        const y = grid.cy(i) + dy;
        return grid.inBounds(x, y) && field.reachable(grid.idx(x, y));
      }),
    );
  return grid.wormholes.every((pair) => pair.every(touchesReached));
}
