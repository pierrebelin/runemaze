import { describe, expect, it } from 'vitest';
import { dispatch } from '../../../src/application/dispatch';
import { updateAbilities } from '../../../src/domain/systems/abilities';
import { applyDamage } from '../../../src/domain/systems/combat';
import { spawnCreep } from '../../../src/domain/systems/waves';
import { newWorld, run } from '../../support/helpers';
import { CommandType, GameEventType, BreakerPhase } from '../../../src/domain/model/types';

const TICK = 1 / 60;
/** Premier tick qui atteint ou dépasse l'instant `s` (la simulation avance par pas fixes). */
const ticksUntil = (s: number) => Math.ceil(s / TICK - 1e-9) * TICK;

describe('abilities', () => {
  it('[RM-09] rend 25 % des PV max du Chaman à chaque voisin à 2,5 cases ou moins toutes les 3 s', () => {
    const w = newWorld();
    const shaman = spawnCreep(w, 'shaman', 0);
    shaman.x = 5;
    shaman.y = 5;
    shaman.healTimer = 0;
    const neighbor = spawnCreep(w, 'rat', 0);
    neighbor.x = 6.5;
    neighbor.y = 5;
    neighbor.hp = 1;

    updateAbilities(w, TICK);

    expect(neighbor.hp).toBeCloseTo(1 + shaman.maxHp * 0.25);
  });

  it('[RM-09] ne dépasse pas les PV max du soigné', () => {
    const w = newWorld();
    const shaman = spawnCreep(w, 'shaman', 0);
    shaman.x = 5;
    shaman.y = 5;
    shaman.healTimer = 0;
    const neighbor = spawnCreep(w, 'rat', 0);
    neighbor.x = 6.5;
    neighbor.y = 5;
    neighbor.hp = neighbor.maxHp - 1;

    updateAbilities(w, TICK);

    expect(neighbor.hp).toBe(neighbor.maxHp);
  });

  it('[RM-09] ne soigne ni le Chaman lui-même ni une créature au-delà de 2,5 cases', () => {
    const w = newWorld();
    const shaman = spawnCreep(w, 'shaman', 0);
    shaman.x = 5;
    shaman.y = 5;
    shaman.healTimer = 0;
    shaman.hp = 1;
    const far = spawnCreep(w, 'rat', 0);
    far.x = 8;
    far.y = 5;
    far.hp = 1;
    const atEdge = spawnCreep(w, 'rat', 0);
    atEdge.x = 7.5;
    atEdge.y = 5;
    atEdge.hp = 1;

    updateAbilities(w, TICK);

    expect(shaman.hp).toBe(1);
    expect(far.hp).toBe(1);
    expect(atEdge.hp).toBeCloseTo(1 + shaman.maxHp * 0.25);
  });

  it('[RM-09] ne soigne pas avant 3 s après l’apparition du Chaman', () => {
    const w = newWorld();
    const shaman = spawnCreep(w, 'shaman', 0);
    shaman.x = 5;
    shaman.y = 5;
    const neighbor = spawnCreep(w, 'rat', 0);
    neighbor.x = 6.5;
    neighbor.y = 5;
    neighbor.hp = 1;

    for (let i = 0; i < Math.round(3 * 60) - 1; i++) w.step();
    expect(neighbor.hp).toBe(1);

    w.step();
    expect(neighbor.hp).toBeCloseTo(1 + shaman.maxHp * 0.25);
  });

  it('[RM-08] un Chaman étourdi ne soigne pas', () => {
    const w = newWorld();
    const shaman = spawnCreep(w, 'shaman', 0);
    shaman.x = 5;
    shaman.y = 5;
    shaman.healTimer = 0;
    shaman.frozen = 1;
    const neighbor = spawnCreep(w, 'rat', 0);
    neighbor.x = 6.5;
    neighbor.y = 5;
    neighbor.hp = 1;

    updateAbilities(w, TICK);

    expect(neighbor.hp).toBe(1);
  });

  describe('briseur', () => {
    it('[RM-04] ouvre la fenêtre 2 s après l’apparition du Sapeur', () => {
      const w = newWorld();
      const sapper = spawnCreep(w, 'sapper', 0);

      run(w, 2 - TICK);
      expect(sapper.breaker?.phase).toBe(BreakerPhase.Charge);

      w.step();
      expect(sapper.breaker?.phase).toBe(BreakerPhase.Armed);
      expect(sapper.breaker?.timer).toBeGreaterThanOrEqual(0);
      expect(sapper.breaker?.timer).toBeLessThanOrEqual(10);
    });

    it('[RM-04] passe en recharge à l’instant tiré dans la fenêtre puis recharge 20 s avant une nouvelle charge', () => {
      const w = newWorld();
      const sapper = spawnCreep(w, 'sapper', 0);

      run(w, 2);
      const windowInstant = sapper.breaker!.timer;

      run(w, ticksUntil(windowInstant));
      expect(sapper.breaker?.phase).toBe(BreakerPhase.Cooldown);
      expect(sapper.breaker?.timer).toBeCloseTo(20, 1);

      run(w, 20 - TICK);
      expect(sapper.breaker?.phase).toBe(BreakerPhase.Cooldown);

      w.step();
      expect(sapper.breaker?.phase).toBe(BreakerPhase.Charge);
      expect(sapper.breaker?.timer).toBeCloseTo(2, 1);
    });

    it('[RM-04] suspend le cycle tant que le Sapeur est gelé', () => {
      const w = newWorld();
      const sapper = spawnCreep(w, 'sapper', 0);
      sapper.frozen = 5;

      run(w, 2);
      expect(sapper.breaker?.phase).toBe(BreakerPhase.Charge);
    });

    it('[RM-08] distingue le Sapeur en fenêtre d’un Sapeur en charge ou en recharge', () => {
      const w = newWorld();
      const a = spawnCreep(w, 'sapper', 0);

      run(w, 1);
      const b = spawnCreep(w, 'sapper', 0);
      run(w, 1);
      // Même instant : A a 2 s d'existence (fenêtre ouverte), B seulement 1 s (encore en charge).
      expect(a.breaker?.phase).toBe(BreakerPhase.Armed);
      expect(b.breaker?.phase).not.toBe(BreakerPhase.Armed);

      const windowInstant = a.breaker!.timer;
      run(w, ticksUntil(windowInstant));
      expect(a.breaker?.phase).toBe(BreakerPhase.Cooldown);

      const c = spawnCreep(w, 'sapper', 0);
      run(w, 2);
      // Même instant : A toujours en recharge (20 s), C vient d'ouvrir sa fenêtre.
      expect(c.breaker?.phase).toBe(BreakerPhase.Armed);
      expect(a.breaker?.phase).not.toBe(BreakerPhase.Armed);
    });

    it("[RM-05] détruit la tour sans rendre d'or et raccourcit le trajet aussitôt quand elle fermait un détour", () => {
      const w = newWorld();
      // Rideau de murs vertical colonne 10, y = 1..19 (recette build.test.ts) : le mur
      // du milieu (y=9) est le seul à portée 3 du Sapeur placé à son centre.
      let middleId = -1;
      for (let y = 1; y <= 19; y += 2) {
        const r = dispatch(w, { c: CommandType.Build, def: 'wall', x: 10, y }) as { ok: true; id: number };
        if (y === 9) middleId = r.id;
      }
      const t = w.towerById.get(middleId)!;
      const before = w.mazeLength();
      const goldBefore = w.gold;

      const sapper = spawnCreep(w, 'sapper', 0);
      sapper.x = t.cx;
      sapper.y = t.cy;
      sapper.breaker = { phase: BreakerPhase.Armed, timer: TICK / 2 };

      w.step();

      expect(w.towers.includes(t)).toBe(false);
      expect(w.towerById.get(middleId)).toBeUndefined();
      expect(w.gold).toBe(goldBefore);
      expect(t.fate).toBe('destroyed');
      expect(w.mazeLength()).toBeLessThan(before - 5);
      const events = w.drainEvents();
      expect(events).toContainEqual({ t: GameEventType.Destroyed, x: t.cx, y: t.cy });
    });

    it('[RM-05] redirige les créatures déjà en route par le passage rouvert', () => {
      const w = newWorld();
      let middleId = -1;
      for (let y = 1; y <= 19; y += 2) {
        const r = dispatch(w, { c: CommandType.Build, def: 'wall', x: 10, y }) as { ok: true; id: number };
        if (y === 9) middleId = r.id;
      }
      const t = w.towerById.get(middleId)!;

      // Rat déjà en route, côté amont du rideau, face à l'ouverture qui va s'ouvrir en (10,9).
      const rat = spawnCreep(w, 'rat', 0);
      rat.leg = 0;
      rat.tx = 8;
      rat.ty = 9;
      rat.x = 8.5;
      rat.y = 9.5;
      w.step();
      const remainingBefore = rat.remaining;

      const sapper = spawnCreep(w, 'sapper', 0);
      sapper.x = t.cx;
      sapper.y = t.cy;
      sapper.breaker = { phase: BreakerPhase.Armed, timer: TICK / 2 };

      w.step();

      expect(rat.remaining).toBeLessThan(remainingBefore - 5);
    });

    it('[RM-07] ne détruit aucune tour quand le Sapeur meurt pendant sa fenêtre', () => {
      const w = newWorld();
      const built = dispatch(w, { c: CommandType.Build, def: 'wall', x: 5, y: 5 }) as { ok: true; id: number };
      const t = w.towerById.get(built.id)!;

      const sapper = spawnCreep(w, 'sapper', 0);
      sapper.x = t.cx;
      sapper.y = t.cy;
      sapper.breaker = { phase: BreakerPhase.Armed, timer: TICK / 2 };
      // Vague 0 non lancée par `launchWave` ici : évite que sa mort ne déclenche la clôture de vague.
      w.pending.set(0, 2);

      applyDamage(w, sapper, 1e6, 'chaos', 0, true);
      w.step();

      expect(w.towers.includes(t)).toBe(true);
      expect(w.towerById.get(built.id)).toBe(t);
      const events = w.drainEvents();
      expect(events).not.toContainEqual(expect.objectContaining({ t: GameEventType.Destroyed }));
    });

    it('[RM-15] détruit la tour la plus proche à 4 cases dans une fenêtre de 5 s puis recharge 12 s', () => {
      const w = newWorld();
      const built = dispatch(w, { c: CommandType.Build, def: 'wall', x: 5, y: 5 }) as { ok: true; id: number };
      const t = w.towerById.get(built.id)!;

      const ashlord = spawnCreep(w, 'ashlord', 0);
      // Aligné sur le centre de la tour, décalé de 4 cases en x (formule de distanceToTower).
      const ax = t.cx + 4;
      const ay = t.cy;
      const fix = () => {
        ashlord.x = ax;
        ashlord.y = ay;
      };
      fix();
      // Chef non gelable : on fige quand même sa position pour que la distance reste exacte.
      const advance = (seconds: number) => {
        const ticks = Math.round(seconds * 60);
        for (let i = 0; i < ticks; i++) {
          fix();
          w.step();
        }
        fix();
      };

      advance(2 - TICK);
      expect(ashlord.breaker?.phase).toBe(BreakerPhase.Charge);

      advance(TICK);
      expect(ashlord.breaker?.phase).toBe(BreakerPhase.Armed);
      expect(ashlord.breaker?.timer).toBeGreaterThanOrEqual(0);
      expect(ashlord.breaker?.timer).toBeLessThanOrEqual(5);

      const windowInstant = ashlord.breaker!.timer;
      advance(ticksUntil(windowInstant));
      expect(w.towers.includes(t)).toBe(false);
      expect(t.fate).toBe('destroyed');
      expect(ashlord.breaker?.phase).toBe(BreakerPhase.Cooldown);
      expect(ashlord.breaker?.timer).toBeCloseTo(12, 1);

      advance(12 - TICK);
      expect(ashlord.breaker?.phase).toBe(BreakerPhase.Cooldown);

      advance(TICK);
      expect(ashlord.breaker?.phase).toBe(BreakerPhase.Charge);
      expect(ashlord.breaker?.timer).toBeCloseTo(2, 1);
    });

    it("[RM-06] passe en recharge sans rien détruire quand aucune tour n'est à portée", () => {
      const w = newWorld();
      const far = dispatch(w, { c: CommandType.Build, def: 'wall', x: 5, y: 5 }) as { ok: true; id: number };
      const towersBefore = [...w.towers];

      const sapper = spawnCreep(w, 'sapper', 0);
      sapper.x = 25;
      sapper.y = 18;
      sapper.breaker = { phase: BreakerPhase.Armed, timer: TICK / 2 };

      w.step();

      expect(w.towers).toEqual(towersBefore);
      expect(w.towerById.get(far.id)).toBeDefined();
      expect(sapper.breaker?.phase).toBe(BreakerPhase.Cooldown);
    });
  });
});
