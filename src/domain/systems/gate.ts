import { GATE } from '../catalog/ether';
import type { World } from '../model/World';
import { GameEventType, type AttackDef } from '../model/types';
import { acquireTargets, applyDamage } from './combat';

const SHOT: AttackDef = {
  type: 'chaos', dmg: [0, 0], cooldown: GATE.shot.cooldown, range: GATE.shot.range, projectileSpeed: 0, targets: 'both',
};

/** La Porte tire sur la créature la plus proche de la sortie ; sans cible, elle reste prête. */
export function updateGate(world: World, dt: number): void {
  if (world.gate.shot === 0) return;
  world.gate.cooldown -= dt;
  if (world.gate.cooldown > 0) return;
  const exit = world.waypoints[world.waypoints.length - 1];
  const [target] = acquireTargets(world, { cx: exit.x, cy: exit.y, targetMode: 'close' }, SHOT, 1);
  if (!target) {
    world.gate.cooldown = 0;
    return;
  }
  world.gate.cooldown = GATE.shot.cooldown;
  applyDamage(world, target, GATE.shot.damage * world.gate.shot, 'chaos', 0, false);
  world.emit({ t: GameEventType.Chain, points: [exit, { x: target.x, y: target.y }] });
}
