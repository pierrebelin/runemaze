import { baseHp, bountyFor, CAMPAIGN_LENGTH, clearBonus, CREEPS, DIFFICULTY, waveAt } from '../catalog/creeps';
import type { World } from '../model/World';
import { SEND_GAP, sendDelay } from '../rules/sendTiming';
import { tradeIncome } from '../rules/trade';
import { waveReward } from '../rules/waveReward';
import type { Creep, CreepDef } from '../model/types';
import { BreakerPhase, GameEventType, Phase } from '../model/types';

export interface Spawner {
  wave: number;
  creep: string;
  left: number;
  interval: number;
  timer: number;
}

/** Délai entre la fin d'apparition d'une vague et la suivante. */
export const WAVE_GAP = 14;

export function waveDuration(index: number): number {
  const w = waveAt(index);
  return Math.max(...w.groups.map((g) => g.delay + (g.count - 1) * g.interval));
}

export function launchWave(world: World): void {
  const index = world.wave + 1;
  const w = waveAt(index);
  world.wave = index;
  world.phase = Phase.Playing;
  let pending = 0;
  for (const g of w.groups) {
    world.spawners.push({ wave: index, creep: g.creep, left: g.count, interval: g.interval, timer: g.delay });
    pending += g.count;
  }
  // Les envois reçus sortent répartis sur la durée de la vague, dans l'ordre d'achat.
  world.sends.forEach(({ creep }, k) => {
    const timer = sendDelay(k, world.sends.length, waveDuration(index));
    world.spawners.push({ wave: index, creep, left: 1, interval: SEND_GAP, timer });
  });
  pending += world.sends.length;
  world.waveSends = { sent: world.sent, received: world.sends };
  world.sent = [];
  world.sends = [];
  world.pending.set(index, pending);
  world.stats.waves[index] = { livesLost: 0, gold: null };
  world.nextWaveIn = waveDuration(index) + WAVE_GAP;
  const first = w.groups[0];
  world.emit({ t: GameEventType.WaveStart, wave: index, creep: first.creep, boss: w.groups.some((g) => CREEPS[g.creep].boss) });
}

/** PV d'une créature à la vague `wave`, difficulté comprise, avec la croissance au-delà de la campagne. */
export function creepHp(world: World, def: CreepDef, wave: number): number {
  const endlessMult = wave >= CAMPAIGN_LENGTH ? Math.pow(1.08, wave - CAMPAIGN_LENGTH + 1) : 1;
  return Math.round(baseHp(wave) * def.hpFactor * DIFFICULTY[world.difficulty].hp * endlessMult);
}

/** Construction commune d'une créature, apparition normale ou rejeton de scission. */
function buildCreep(world: World, def: CreepDef, wave: number, x: number, y: number, tx: number, ty: number, leg: number): Creep {
  const hp = creepHp(world, def, wave);
  return {
    id: world.id(), def, wave, x, y, hp, maxHp: hp, leg,
    tx, ty,
    slowPct: 0, slowTimer: 0, shred: 0, shredTimer: 0, poisons: [], frozen: 0, freezeGuard: 0, shield: def.shield ?? 0,
    sprint: 0, sprintCooldown: 0, healTimer: def.heal?.every ?? 0,
    alive: true, remaining: Infinity, bob: world.rng.next() * Math.PI * 2, hitFlash: 0,
    bounty: bountyFor(wave, def),
    brood: 0,
    breaker: def.breaker ? { phase: BreakerPhase.Charge, timer: def.breaker.charge } : undefined,
  };
}

export function spawnCreep(world: World, defId: string, wave: number): Creep {
  const def = CREEPS[defId];
  const g = world.grid;
  const cell = g.spawnCells[world.rng.int(g.spawnCells.length)];
  const c = buildCreep(world, def, wave, g.cx(cell) + 0.5, g.cy(cell) + 0.5, g.cx(cell), g.cy(cell), 0);
  if (def.air) {
    c.x = world.spawnCenter.x;
    c.y = world.spawnCenter.y;
  }
  world.creeps.push(c);
  return c;
}

/** Fait naître `count` rejetons `defId` à la position du parent, dans `world.offspring`. */
export function spawnOffspring(world: World, parent: Creep, defId: string, count: number): void {
  const def = CREEPS[defId];
  for (let i = 0; i < count; i++) {
    world.offspring.push(buildCreep(world, def, parent.wave, parent.x, parent.y, parent.tx, parent.ty, parent.leg));
  }
  world.pending.set(parent.wave, (world.pending.get(parent.wave) ?? 0) + count);
}

export function updateWaves(world: World, dt: number): void {
  // Compte à rebours vers la prochaine vague.
  world.nextWaveIn -= dt;
  if (world.nextWaveIn <= 0) launchWave(world);

  for (const s of world.spawners) {
    s.timer -= dt;
    while (s.left > 0 && s.timer <= 0) {
      spawnCreep(world, s.creep, s.wave);
      s.left--;
      s.timer += s.interval;
    }
  }
  world.spawners = world.spawners.filter((s) => s.left > 0);

  // Vagues terminées : prime de fin de vague et intérêts sur l'or en réserve.
  for (const [wave, left] of world.pending) {
    if (left > 0) continue;
    world.pending.delete(wave);
    if (world.phase === Phase.Defeat) continue;
    const { bonus, interest, income } = waveReward(clearBonus(wave), wave, world.gold, world.income, world.duel);
    const trade = tradeIncome(world.towers);
    world.addGold(bonus + interest + income + trade);
    // Remparts : vies rendues, jamais au-delà des vies de départ.
    if (world.gate.ramparts > 0) {
      world.lives = Math.min(DIFFICULTY[world.difficulty].lives, world.lives + world.gate.ramparts);
    }
    world.stats.waves[wave].gold = world.gold;
    world.emit({ t: GameEventType.WaveCleared, wave, bonus, interest, income, trade });
  }
}
