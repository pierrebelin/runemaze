import { describe, expect, it } from 'vitest';
import { updateGate } from '../../../src/domain/systems/gate';
import { spawnCreep } from '../../../src/domain/systems/waves';
import type { Creep } from '../../../src/domain/model/types';
import type { World } from '../../../src/domain/model/World';
import { newDuelWorld } from '../../support/helpers';

const HP = 1000;

// Créature sans armure (Chaos = dégâts bruts), posée à `dist` cases à gauche du centre de la sortie.
function creepAt(w: World, dist: number, air = false): Creep {
  const exit = w.waypoints[w.waypoints.length - 1];
  const c = spawnCreep(w, 'rat', 0);
  c.def = { ...c.def, armor: 0, armorType: 'unarmored', air };
  c.hp = HP;
  c.maxHp = HP;
  c.x = exit.x - dist;
  c.y = exit.y;
  return c;
}

describe('gate', () => {
  it('[RM-09] inflige 30 dégâts Chaos à la créature la plus proche de la sortie quand le Tir est au niveau 2', () => {
    const w = newDuelWorld();
    w.gate.shot = 2;
    const loin = creepAt(w, 3);
    const proche = creepAt(w, 1);

    updateGate(w, 0.5);

    expect(proche.hp).toBe(HP - 30);
    expect(loin.hp).toBe(HP);
  });

  it('[RM-09] tire une fois par seconde, pas plus', () => {
    const w = newDuelWorld();
    w.gate.shot = 2;
    const c = creepAt(w, 1);

    updateGate(w, 0.5);
    expect(c.hp).toBe(HP - 30);

    updateGate(w, 0.5);
    expect(c.hp).toBe(HP - 30);

    updateGate(w, 0.5);
    expect(c.hp).toBe(HP - 60);
  });

  it('[RM-09] tire sur une créature volante comme sur une créature au sol', () => {
    const w = newDuelWorld();
    w.gate.shot = 1;
    const sol = creepAt(w, 1, false);

    updateGate(w, 0.5);
    expect(sol.hp).toBe(HP - 15);

    sol.alive = false;
    w.creeps = [];
    const air = creepAt(w, 1, true);
    w.gate.cooldown = 0;

    updateGate(w, 0.5);
    expect(air.hp).toBe(HP - 15);
  });

  it('[RM-09] ignore une créature à plus de 4 cases du centre de la porte', () => {
    const w = newDuelWorld();
    w.gate.shot = 2;
    const c = creepAt(w, 0);
    c.x -= 4 + c.def.radius + 0.5;

    updateGate(w, 0.5);
    expect(c.hp).toBe(HP);

    const dedans = creepAt(w, 4 + c.def.radius - 0.1);
    updateGate(w, 1);
    expect(dedans.hp).toBe(HP - 30);
    expect(c.hp).toBe(HP);
  });

  it('[RM-09] verse la prime au défenseur quand la Porte tue une créature', () => {
    const w = newDuelWorld();
    w.gate.shot = 2;
    const c = creepAt(w, 1);
    c.hp = 10;
    const or = w.gold;

    updateGate(w, 0.5);

    expect(c.alive).toBe(false);
    expect(c.bounty).toBeGreaterThan(0);
    expect(w.gold - or).toBe(c.bounty);
  });

  it('[RM-09] ne tire pas quand le Tir est au niveau 0', () => {
    const w = newDuelWorld();
    const c = creepAt(w, 1);

    updateGate(w, 0.5);
    updateGate(w, 0.5);
    expect(c.hp).toBe(HP);

    w.gate.shot = 1;
    updateGate(w, 0.5);
    expect(c.hp).toBe(HP - 15);
  });
});
