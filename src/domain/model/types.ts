// Types partagés de la simulation. Aucune dépendance au DOM : tout ce qui est
// dans src/sim/ tourne aussi bien dans le navigateur que dans les tests Node.

export type AttackType = 'normal' | 'pierce' | 'siege' | 'magic' | 'chaos';
export type ArmorType = 'unarmored' | 'light' | 'medium' | 'heavy' | 'fortified' | 'hero';
export type TargetMode = 'first' | 'last' | 'strong' | 'weak' | 'close';
export type TargetLayer = 'ground' | 'air' | 'both';
export type Family = 'wall' | 'archer' | 'cannon' | 'frost' | 'storm' | 'venom' | 'fire';
export type Difficulty = 'easy' | 'normal' | 'hard';
export type GateUpgrade = 'shot' | 'ramparts';

export type AuraKind = 'damage' | 'attackSpeed';

export interface AttackDef {
  type: AttackType;
  dmg: [number, number];
  /** Secondes entre deux tirs. */
  cooldown: number;
  /** Portée en cases, mesurée depuis le centre de la tour. */
  range: number;
  /** Cases par seconde ; 0 = impact instantané (foudre). */
  projectileSpeed: number;
  targets: TargetLayer;
  splash?: { radius: number; falloff: number };
  slow?: { pct: number; duration: number };
  poison?: { dps: number; duration: number; maxStacks: number };
  chain?: { bounces: number; range: number; decay: number };
  multishot?: number;
  /** Frappe d'un coup toutes les créatures à portée. */
  area?: true;
  crit?: { chance: number; mult: number };
  armorShred?: { amount: number; duration: number };
  freeze?: { chance: number; duration: number; guard: number };
  /** Immobilise sans toucher à la garde de gel. */
  stun?: { duration: number };
  /** Montée en puissance : bonus de vitesse d'attaque plafonné à `max`. */
  rampUp?: { max: number };
  /** Acharnement : bonus de dégâts par coup consécutif sur la même cible, plafonné à `max`. */
  relentless?: { step: number; max: number };
  /** Part des dégâts magiques infligée quand même aux immunisés à la magie. */
  dispel?: number;
  /** Flaque déposée à l'impact. */
  ember?: { radius: number; duration: number; dps: number; slow?: { pct: number; duration: number } };
}

/** Flaque de braise au sol ; `expires` en ticks. */
export interface Ember {
  id: number;
  towerId: number;
  x: number;
  y: number;
  radius: number;
  dps: number;
  slow?: { pct: number; duration: number };
  expires: number;
}

export interface TowerDef {
  id: string;
  name: string;
  family: Family;
  tier: number;
  /** Coût de construction, ou coût incrémental d'une amélioration. */
  cost: number;
  desc: string;
  attack?: AttackDef;
  aura?: { kind: AuraKind; pct: number; radius: number };
  upgrades: string[];
  /** Familles d'origine pour une tour hybride issue d'une infusion. */
  elements?: [Family, Family];
}

export interface CreepDef {
  id: string;
  name: string;
  plural: string;
  /** Multiplicateur appliqué aux PV de base de la vague. */
  hpFactor: number;
  /** Cases par seconde. */
  speed: number;
  armorType: ArmorType;
  armor: number;
  air?: boolean;
  boss?: boolean;
  magicImmune?: boolean;
  /** Fraction des PV max régénérée par seconde. */
  regen?: number;
  /** Vies perdues si la créature atteint la sortie. */
  leak: number;
  radius: number;
  bountyFactor: number;
  send?: { cost: number; income: number };
  shield?: number;
  sprint?: { mult: number; duration: number; cooldown: number };
  fury?: { below: number; mult: number };
  heal?: { pct: number; radius: number; every: number };
  /** Créature et nombre engendrés à la mort (pas à la sortie). */
  split?: { creep: string; count: number };
  /** Rejetons engendrés à chaque seuil de PV franchi (pas à la mort). */
  brood?: { creep: string; count: number; below: number[] };
  /** Cycle charge → armé → recharge du Sapeur gobelin (secondes, portée en cases). */
  breaker?: { charge: number; armed: number; cooldown: number; range: number };
}

export interface WaveTally {
  livesLost: number;
  gold: number | null;
}

export interface WaveGroup {
  creep: string;
  count: number;
  /** Secondes entre deux apparitions. */
  interval: number;
  /** Secondes avant la première apparition du groupe. */
  delay: number;
}

export interface WaveDef {
  groups: WaveGroup[];
}

export type CellKind = 'build' | 'rock' | 'spawn' | 'checkpoint' | 'exit' | 'road' | 'ice';

export type Biome = 'earth' | 'snow' | 'space';

export interface MapDef {
  id: string;
  name: string;
  width: number;
  height: number;
  rows: string[];
  /** Absent = 'earth'. */
  biome?: Biome;
}

export interface BiomeRecipe {
  rocks?: { min: number; max: number };
  ice?: { patches: { min: number; max: number }; size: { min: number; max: number } };
}

export interface MapRecipe {
  width: number;
  height: number;
  landmark: number;
  landmarkGap: number;
  landmarkMargin: number;
  biomes: Record<Biome, BiomeRecipe>;
  minLeg: number;
  route: { min: number; max: number };
}

export interface Creep {
  id: number;
  def: CreepDef;
  wave: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  leg: number;
  /** Case vers laquelle la créature terrestre se dirige. */
  tx: number;
  ty: number;
  /**
   * Cap retenu quand une construction a dévié la créature : aucune construction ne peut ensuite
   * l'en écarter de plus de 90°. Oublié quand elle reprend ce cap ou change de tronçon.
   */
  heading?: { x: number; y: number };
  slowPct: number;
  slowTimer: number;
  shred: number;
  shredTimer: number;
  poisons: { dps: number; t: number; towerId: number; defId: string }[];
  frozen: number;
  freezeGuard: number;
  shield: number;
  sprint: number;
  sprintCooldown: number;
  healTimer: number;
  alive: boolean;
  /** Distance restante estimée jusqu'à la sortie (pour le ciblage « premier »). */
  remaining: number;
  bob: number;
  hitFlash: number;
  bounty: number;
  /** Nombre de seuils de `brood` déjà franchis. */
  brood: number;
  /** État du cycle du Sapeur gobelin (absent si sa définition n'a pas `breaker`). */
  breaker?: { phase: BreakerPhase; timer: number };
}

/** Cycle du Sapeur gobelin : charge, fenêtre de destruction, récupération. */
export enum BreakerPhase {
  Charge = 'charge',
  Armed = 'armed',
  Cooldown = 'cooldown',
}

export type TowerFate = 'standing' | 'sold' | 'destroyed';

export interface Tower {
  id: number;
  def: TowerDef;
  x: number;
  y: number;
  cx: number;
  cy: number;
  cooldown: number;
  targetMode: TargetMode;
  spent: number;
  kills: number;
  damage: number;
  aim: number;
  /** Secondes cumulées avec une cible à portée. */
  ramp: number;
  /** Cible de l'acharnement et coups consécutifs sur elle. */
  relentless?: { targetId: number; hits: number };
  fate: TowerFate;
}

export interface Projectile {
  id: number;
  towerId: number;
  attack: AttackDef;
  defId: string;
  family: Family;
  x: number;
  y: number;
  sx: number;
  sy: number;
  targetId: number;
  tx: number;
  ty: number;
  dmgRoll: number;
  crit: boolean;
  alive: boolean;
}

export enum GameEventType {
  Kill = 'kill',
  Leak = 'leak',
  Hit = 'hit',
  Fire = 'fire',
  Chain = 'chain',
  Built = 'built',
  Upgraded = 'upgraded',
  Sold = 'sold',
  Destroyed = 'destroyed',
  WaveStart = 'waveStart',
  WaveCleared = 'waveCleared',
  Defeat = 'defeat',
}

export type GameEvent =
  | { t: GameEventType.Kill; x: number; y: number; bounty: number; creepId: number; boss: boolean }
  | { t: GameEventType.Leak; lives: number; boss: boolean }
  | { t: GameEventType.Hit; x: number; y: number; family: Family; splash: number; crit: boolean; dmg: number }
  | { t: GameEventType.Fire; towerId: number; family: Family }
  | { t: GameEventType.Chain; points: { x: number; y: number }[] }
  | { t: GameEventType.Built; towerId: number; x: number; y: number }
  | { t: GameEventType.Upgraded; towerId: number }
  | { t: GameEventType.Sold; x: number; y: number; refund: number }
  | { t: GameEventType.Destroyed; x: number; y: number }
  | { t: GameEventType.WaveStart; wave: number; creep: string; boss: boolean }
  | { t: GameEventType.WaveCleared; wave: number; bonus: number; interest: number; income: number }
  | { t: GameEventType.Defeat };

export enum Phase {
  Prep = 'prep',
  Playing = 'playing',
  Defeat = 'defeat',
}

export enum CommandType {
  Build = 'build',
  Upgrade = 'upgrade',
  Sell = 'sell',
  Target = 'target',
  Send = 'send',
  Receive = 'receive',
  Gleaner = 'gleaner',
  Gate = 'gate',
  ReserveLoss = 'reserveLoss',
  Resign = 'resign',
}

export type Command =
  | { c: CommandType.Build; def: string; x: number; y: number }
  | { c: CommandType.Upgrade; tower: number; def: string }
  | { c: CommandType.Sell; tower: number }
  | { c: CommandType.Target; tower: number; mode: TargetMode }
  | { c: CommandType.Send; creep: string }
  | { c: CommandType.Receive; creep: string; from: number }
  | { c: CommandType.Gleaner }
  | { c: CommandType.Gate; upgrade: GateUpgrade }
  | { c: CommandType.ReserveLoss; lives: number }
  | { c: CommandType.Resign };

export type Result = { ok: true; id?: number } | { ok: false; reason: string };

export interface BuilderDef {
  id: string;
  name: string;
  style: string;
  weakness: string;
  roots: string[];
  hybrids: [string, string];
}
