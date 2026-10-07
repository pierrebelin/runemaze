import { Rng } from '../Rng';
import { DIFFICULTY } from '../catalog/creeps';
import { builder } from '../catalog/builders';
import { FlowField } from '../rules/FlowField';
import { Grid } from './Grid';
import { updateAbilities } from '../systems/abilities';
import { updateGleaners } from '../systems/gleaners';
import { updateGate } from '../systems/gate';
import { updateCombat, updateProjectiles } from '../systems/combat';
import { updateMovement } from '../systems/movement';
import { updateStatuses } from '../systems/status';
import { updateWaves, type Spawner } from '../systems/waves';
import { GameEventType, Phase } from './types';
import type { BuilderDef, Command, Creep, Difficulty, GameEvent, MapDef, Projectile, Tower, WaveTally } from './types';

export const TICK = 1 / 60;
export const FIRST_WAVE_DELAY = 35;

export interface WorldOptions {
  map: MapDef;
  difficulty: Difficulty;
  seed: number;
  duel?: boolean;
  rivals?: number;
  lives?: number;
  builder: string;
}

export interface Stats {
  kills: number;
  leaked: number;
  goldEarned: number;
  towersBuilt: number;
  longestMaze: number;
  towers: Map<number, Tower>;
  waves: WaveTally[];
}

/**
 * État complet d'une partie. Avance par pas fixes de 1/60 s et ne reçoit
 * d'ordres que par `dispatch` : à graine et journal de commandes identiques,
 * la partie se rejoue à l'identique (base d'un replay ou d'un mode en ligne).
 */
export class World {
  readonly grid: Grid;
  readonly rng: Rng;
  readonly difficulty: Difficulty;
  readonly map: MapDef;
  /** Un champ par tronçon : une pierre runique après l'autre, dans l'ordre, puis la sortie. */
  readonly fields: FlowField[];
  readonly spawnCenter: { x: number; y: number };
  readonly waypoints: { x: number; y: number }[];

  readonly duel: boolean;
  readonly rivals: number;
  readonly builder: BuilderDef;
  income = 0;
  ether = 0;
  gleaners: number[] = [];
  gate = { shot: 0, ramparts: 0, cooldown: 0 };
  tick = 0;
  time = 0;
  phase: Phase = Phase.Prep;
  gold: number;
  lives: number;
  /** Index de la dernière vague lancée (-1 avant la première). */
  wave = -1;
  nextWaveIn = FIRST_WAVE_DELAY;
  spawners: Spawner[] = [];
  sends: { creep: string; from: number }[] = [];
  sent: { creep: string; to: number }[] = [];
  /** Envois figés au lancement de la vague en cours : achetés et reçus. */
  waveSends: { sent: { creep: string; to: number }[]; received: { creep: string; from: number }[] } = { sent: [], received: [] };
  /** Créatures restantes (vivantes ou pas encore apparues) par vague. */
  pending = new Map<number, number>();

  towers: Tower[] = [];
  creeps: Creep[] = [];
  /** Rejetons nés d'un coup (scission) : rejoignent `creeps` en fin de `step()`. */
  offspring: Creep[] = [];
  projectiles: Projectile[] = [];
  events: GameEvent[] = [];
  readonly log: { tick: number; cmd: Command }[] = [];
  stats: Stats = { kills: 0, leaked: 0, goldEarned: 0, towersBuilt: 0, longestMaze: 0, towers: new Map(), waves: [] };

  /** Longueur restante estimée après chaque tronçon (pour le ciblage). */
  legRest: number[] = [];
  airRest: number[] = [];
  /** Compteur d'ids, accessible pour figer/restaurer une partie (voir `snapshot.ts`). */
  nextId = 1;
  towerById = new Map<number, Tower>();

  constructor(opts: WorldOptions) {
    this.grid = new Grid(opts.map);
    this.rng = new Rng(opts.seed);
    this.difficulty = opts.difficulty;
    this.duel = opts.duel ?? false;
    this.rivals = opts.rivals ?? 1;
    this.builder = builder(opts.builder);
    this.map = opts.map;
    const d = DIFFICULTY[opts.difficulty];
    this.gold = d.gold;
    this.lives = opts.lives ?? d.lives;
    this.fields = [
      ...this.grid.checkpoints.map((cells) => new FlowField(this.grid, cells)),
      new FlowField(this.grid, this.grid.exitCells),
    ];
    this.spawnCenter = this.grid.regionCenter(this.grid.spawnCells);
    this.waypoints = [
      ...this.grid.checkpoints.map((cells) => this.grid.regionCenter(cells)),
      this.grid.regionCenter(this.grid.exitCells),
    ];
    this.airRest = new Array(this.waypoints.length).fill(0);
    for (let k = this.waypoints.length - 2; k >= 0; k--) {
      const a = this.waypoints[k];
      const b = this.waypoints[k + 1];
      this.airRest[k] = this.airRest[k + 1] + Math.hypot(a.x - b.x, a.y - b.y);
    }
    this.refreshPaths();
  }

  id(): number {
    return this.nextId++;
  }

  /** Cellule d'apparition de référence pour mesurer le labyrinthe. */
  get spawnCell(): number {
    const c = this.spawnCenter;
    return this.grid.idx(Math.floor(c.x), Math.floor(c.y));
  }

  refreshPaths(): void {
    for (const f of this.fields) f.compute();
    this.updateLegRest();
    this.stats.longestMaze = Math.max(this.stats.longestMaze, this.mazeLength());
  }

  /** Recalcule la distance restante après chaque tronçon, à partir des champs déjà calculés. */
  updateLegRest(): void {
    const n = this.fields.length;
    this.legRest = new Array(n).fill(0);
    for (let k = n - 2; k >= 0; k--) {
      this.legRest[k] = this.legRest[k + 1] + this.minDist(this.fields[k + 1], this.grid.checkpoints[k]);
    }
  }

  /** Longueur du trajet terrestre complet, en cases. */
  mazeLength(): number {
    return this.fields[0].dist[this.spawnCell] + this.legRest[0];
  }

  minDist(field: FlowField, cells: number[]): number {
    let m = Infinity;
    for (const i of cells) m = Math.min(m, field.dist[i]);
    return m;
  }

  /** Cases du trajet terrestre actuel (pour l'aperçu du chemin), un tracé par tronçon. */
  groundRoute(): number[][] {
    const routes: number[][] = [];
    let from: number | undefined = this.spawnCell;
    for (const field of this.fields) {
      const leg: number[] = from !== undefined ? field.trace(from) : [];
      routes.push(leg);
      from = leg[leg.length - 1];
    }
    return routes;
  }

  emit(e: GameEvent): void {
    this.events.push(e);
  }

  drainEvents(): GameEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  addGold(n: number): void {
    this.gold += n;
    this.stats.goldEarned += n;
  }

  /** Retire des vies à la réserve ; à 0 la partie est perdue (une seule fois). */
  loseLives(n: number): void {
    this.lives -= n;
    if (this.lives <= 0 && this.phase !== Phase.Defeat) {
      this.lives = 0;
      this.phase = Phase.Defeat;
      this.emit({ t: GameEventType.Defeat });
    }
  }

  /** Vrai quand la partie est perdue : `step()` n'avance plus. */
  isOver(): boolean {
    return this.phase === Phase.Defeat;
  }

  step(): void {
    if (this.isOver()) return;
    const dt = TICK;
    this.tick++;
    this.time += dt;
    updateWaves(this, dt);
    updateGleaners(this);
    updateStatuses(this, dt);
    updateAbilities(this, dt);
    updateMovement(this, dt);
    updateCombat(this, dt);
    updateGate(this, dt);
    updateProjectiles(this, dt);
    if (this.offspring.length) {
      this.creeps.push(...this.offspring);
      this.offspring = [];
    }
    this.creeps = this.creeps.filter((c) => c.alive);
    this.projectiles = this.projectiles.filter((p) => p.alive);
  }

  /** Retire une tour de la partie (vente ou destruction) : libère son emprise et recalcule les trajets. */
  removeTower(t: Tower): void {
    this.towers = this.towers.filter((o) => o !== t);
    this.towerById.delete(t.id);
    for (const i of this.grid.footprint(t.x, t.y)) this.grid.tower[i] = 0;
    this.refreshPaths();
  }

  /** Une créature disparaît (tuée ou arrivée) : met à jour le décompte de sa vague. */
  creepGone(c: Creep): void {
    const left = (this.pending.get(c.wave) ?? 1) - 1;
    this.pending.set(c.wave, left);
  }
}
