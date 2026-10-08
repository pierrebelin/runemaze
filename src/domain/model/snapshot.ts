import { CREEPS } from '../catalog/creeps';
import { TOWERS } from '../catalog/towers';
import type { Spawner } from '../systems/waves';
import { World } from './World';
import type { Command, Corpse, Creep, Difficulty, Ember, MapDef, Phase, Projectile, Skeleton, Tower, WaveTally } from './types';

/** Tour sans référence de classe : sa définition est stockée par id, résolue via `TOWERS`. */
type StoredTower = Omit<Tower, 'def'> & { defId: string };
/** Créature sans référence de classe : sa définition est stockée par id, résolue via `CREEPS`. */
type StoredCreep = Omit<Creep, 'def'> & { defId: string };

export interface WorldSnapshot {
  map: MapDef;
  difficulty: Difficulty;
  rngState: number;
  nextId: number;
  tick: number;
  time: number;
  phase: Phase;
  duel: boolean;
  rivals: number;
  builder: string;
  income: number;
  ether: number;
  gleaners: number[];
  gate: { shot: number; ramparts: number; cooldown: number };
  sends: { creep: string; from: number }[];
  sent: { creep: string; to: number }[];
  waveSends: { sent: { creep: string; to: number }[]; received: { creep: string; from: number }[] };
  gold: number;
  lives: number;
  wave: number;
  nextWaveIn: number;
  spawners: Spawner[];
  pending: [number, number][];
  gridTower: number[];
  towers: StoredTower[];
  creeps: StoredCreep[];
  projectiles: Projectile[];
  embers: Ember[];
  corpses: Corpse[];
  skeletons: Skeleton[];
  log: { tick: number; cmd: Command }[];
  stats: {
    kills: number;
    leaked: number;
    goldEarned: number;
    towersBuilt: number;
    longestMaze: number;
    towers: [number, StoredTower][];
    waves: WaveTally[];
  };
}

function storeTower(t: Tower): StoredTower {
  const { def, ...rest } = t;
  return { ...rest, defId: def.id, offerings: [...rest.offerings], relentless: rest.relentless ? { ...rest.relentless } : rest.relentless };
}

function storeCreep(c: Creep): StoredCreep {
  const { def, ...rest } = c;
  return {
    ...rest,
    defId: def.id,
    poisons: rest.poisons.map((p) => ({ ...p })),
    breaker: rest.breaker ? { ...rest.breaker } : rest.breaker,
    heading: rest.heading ? { ...rest.heading } : rest.heading,
  };
}

function loadTower(s: StoredTower): Tower {
  const { defId, ...rest } = s;
  return { ...rest, def: TOWERS[defId], offerings: [...rest.offerings], relentless: rest.relentless ? { ...rest.relentless } : rest.relentless };
}

function loadCreep(s: StoredCreep): Creep {
  const { defId, ...rest } = s;
  return {
    ...rest,
    def: CREEPS[defId],
    poisons: rest.poisons.map((p) => ({ ...p })),
    breaker: rest.breaker ? { ...rest.breaker } : rest.breaker,
    heading: rest.heading ? { ...rest.heading } : rest.heading,
  };
}

function copyEmber(e: Ember): Ember {
  return { ...e, slow: e.slow ? { ...e.slow } : e.slow };
}

export function snapshot(world: World): WorldSnapshot {
  return {
    map: world.map,
    difficulty: world.difficulty,
    rngState: world.rng.state,
    nextId: world.nextId,
    tick: world.tick,
    time: world.time,
    phase: world.phase,
    duel: world.duel,
    rivals: world.rivals,
    builder: world.builder.id,
    income: world.income,
    ether: world.ether,
    gleaners: [...world.gleaners],
    gate: { ...world.gate },
    sends: world.sends.map((s) => ({ ...s })),
    sent: world.sent.map((s) => ({ ...s })),
    waveSends: { sent: world.waveSends.sent.map((s) => ({ ...s })), received: world.waveSends.received.map((s) => ({ ...s })) },
    gold: world.gold,
    lives: world.lives,
    wave: world.wave,
    nextWaveIn: world.nextWaveIn,
    spawners: world.spawners.map((s) => ({ ...s })),
    pending: [...world.pending.entries()],
    gridTower: Array.from(world.grid.tower),
    towers: world.towers.map(storeTower),
    creeps: world.creeps.map(storeCreep),
    projectiles: world.projectiles.map((p) => ({ ...p })),
    embers: world.embers.map(copyEmber),
    corpses: world.corpses.map((k) => ({ ...k })),
    skeletons: world.skeletons.map((k) => ({ ...k })),
    log: world.log.map((e) => ({ ...e })),
    stats: {
      kills: world.stats.kills,
      leaked: world.stats.leaked,
      goldEarned: world.stats.goldEarned,
      towersBuilt: world.stats.towersBuilt,
      longestMaze: world.stats.longestMaze,
      towers: [...world.stats.towers.entries()].map(([id, t]) => [id, storeTower(t)]),
      waves: world.stats.waves.map((w) => ({ ...w })),
    },
  };
}

export function restore(snap: WorldSnapshot): World {
  const world = new World({ map: snap.map, difficulty: snap.difficulty, seed: snap.rngState, duel: snap.duel, rivals: snap.rivals, builder: snap.builder });

  world.nextId = snap.nextId;
  world.tick = snap.tick;
  world.time = snap.time;
  world.phase = snap.phase;
  world.income = snap.income;
  world.ether = snap.ether;
  world.gleaners = [...snap.gleaners];
  world.gate = { ...snap.gate };
  world.sends = snap.sends.map((s) => ({ ...s }));
  world.sent = snap.sent.map((s) => ({ ...s }));
  world.waveSends = { sent: snap.waveSends.sent.map((s) => ({ ...s })), received: snap.waveSends.received.map((s) => ({ ...s })) };
  world.gold = snap.gold;
  world.lives = snap.lives;
  world.wave = snap.wave;
  world.nextWaveIn = snap.nextWaveIn;
  world.spawners = snap.spawners.map((s) => ({ ...s }));
  world.pending = new Map(snap.pending);
  world.grid.tower.set(snap.gridTower);
  world.log.push(...snap.log.map((e) => ({ ...e })));

  world.towers = snap.towers.map(loadTower);
  world.towerById = new Map(world.towers.map((t) => [t.id, t]));
  world.creeps = snap.creeps.map(loadCreep);
  world.projectiles = snap.projectiles.map((p) => ({ ...p }));
  world.embers = snap.embers.map(copyEmber);
  world.corpses = snap.corpses.map((k) => ({ ...k }));

  world.refreshPaths();
  // Après refreshPaths : il réaffecte `step`, que la sauvegarde doit garder.
  world.skeletons = snap.skeletons.map((k) => ({ ...k }));

  world.stats = {
    kills: snap.stats.kills,
    leaked: snap.stats.leaked,
    goldEarned: snap.stats.goldEarned,
    towersBuilt: snap.stats.towersBuilt,
    longestMaze: snap.stats.longestMaze,
    towers: new Map(
      snap.stats.towers.map(([id, s]) => [id, world.towerById.get(id) ?? loadTower(s)]),
    ),
    waves: snap.stats.waves.map((w) => ({ ...w })),
  };

  return world;
}
