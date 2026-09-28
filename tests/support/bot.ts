import { TOWERS } from '../../src/domain/catalog/towers';
import { dispatch } from '../../src/application/dispatch';
import { upgradeCost } from '../../src/domain/rules/pricing';
import type { World } from '../../src/domain/model/World';
import type { Tower } from '../../src/domain/model/types';
import { CommandType, Phase } from '../../src/domain/model/types';

/** Plan de labyrinthe en chicanes : une barrière centrale, puis des cloisons alternées. */
export function mazePlan(): [number, number][] {
  const plan: [number, number][] = [];
  // Barrière centrale (lignes 14-15) : sépare l'aller (en haut) du retour (en bas).
  for (let x = 1; x <= 29; x += 2) plan.push([x, 14]);
  [7, 11, 15, 19, 23, 27].forEach((x, k) => {
    const ys = k % 2 === 0 ? [1, 3, 5, 7, 9] : [4, 6, 8, 10, 12];
    for (const y of ys) plan.push([x, y]);
  });
  [27, 23, 19, 15, 11, 7].forEach((x, k) => {
    const ys = k % 2 === 0 ? [16, 18] : [19, 21];
    for (const y of ys) plan.push([x, y]);
  });
  return plan;
}

const FAMILY_CYCLE = ['archer', 'cannon', 'frost', 'storm', 'venom', 'archer', 'cannon', 'storm'];
const BRANCH: Record<string, string[]> = {
  archer: ['volley', 'sniper'], cannon: ['mortar', 'mortar', 'flak'], frost: ['glacier', 'iceshard'],
  storm: ['tempest', 'obelisk'], venom: ['acid', 'plague'],
};

export class Bot {
  private plan = mazePlan();
  private planIdx = 0;
  private towerCount = 0;
  constructor(private w: World) {}

  private coverage(t: Tower): number {
    const route = this.w.groundRoute().flat();
    let n = 0;
    for (const i of route) {
      const x = this.w.grid.cx(i) + 0.5;
      const y = this.w.grid.cy(i) + 0.5;
      if (Math.hypot(x - t.cx, y - t.cy) <= 4.5) n++;
    }
    return n;
  }

  act(): void {
    const w = this.w;
    for (let guard = 0; guard < 20; guard++) {
      const attackers = w.towers.filter((t) => t.def.attack).length;
      const wantAttackers = 3 + Math.floor((w.wave + 1) * 0.9);
      const walls = w.towers.filter((t) => t.def.family === 'wall');
      if (attackers < wantAttackers && walls.length) {
        const fam = FAMILY_CYCLE[this.towerCount % FAMILY_CYCLE.length];
        const best = walls.map((t) => [t, this.coverage(t)] as const).sort((a, b) => b[1] - a[1])[0][0];
        if (w.gold < upgradeCost(best.def, TOWERS[fam])) return;
        dispatch(w, { c: CommandType.Upgrade, tower: best.id, def: fam });
        this.towerCount++;
        continue;
      }
      if (this.planIdx < this.plan.length) {
        if (w.gold < 3) return;
        const [x, y] = this.plan[this.planIdx];
        const r = dispatch(w, { c: CommandType.Build, def: 'wall', x, y });
        if (r.ok || !/créature/.test(r.reason)) this.planIdx++;
        else return;
        continue;
      }
      // Plan épuisé : une case déjà bâtie a pu être libérée par un briseur, on la rebâtit.
      const gap = this.plan.find(([x, y]) => w.grid.tower[w.grid.idx(x, y)] === 0);
      if (gap && w.gold >= 3) {
        const r = dispatch(w, { c: CommandType.Build, def: 'wall', x: gap[0], y: gap[1] });
        if (r.ok) continue;
      }
      // Améliorations : la tour la moins avancée d'abord.
      const up = w.towers
        .filter((t) => t.def.attack && t.def.upgrades.length)
        .sort((a, b) => a.def.tier - b.def.tier || b.kills - a.kills)[0];
      if (!up) return;
      const opts = up.def.upgrades;
      const next = up.def.tier === 1 ? BRANCH[up.def.family][up.id % BRANCH[up.def.family].length] : opts[0];
      const cost = upgradeCost(up.def, TOWERS[next]);
      if (w.gold < cost) return;
      dispatch(w, { c: CommandType.Upgrade, tower: up.id, def: next });
    }
  }
}

export function playBot(w: World, maxWave = 30): { wave: number; lives: number; phase: string; maze: number; gold: number } {
  const bot = new Bot(w);
  let ticks = 0;
  while ((w.phase === Phase.Prep || w.phase === Phase.Playing) && ticks < 60 * 60 * 60) {
    if (ticks % 30 === 0) bot.act();
    w.step();
    ticks++;
    if (w.wave >= maxWave) break;
  }
  return { wave: w.wave + 1, lives: w.lives, phase: w.phase, maze: Math.round(w.mazeLength()), gold: w.gold };
}
