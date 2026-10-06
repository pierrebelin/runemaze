import type { AuraKind, Tower } from '../model/types';

/** Auras non cumulables : pour chaque type, seule la plus forte des tours voisines compte. */
export function auraBonus(t: Tower, towers: Tower[]): Record<AuraKind, number> {
  const bonus: Record<AuraKind, number> = { damage: 0, attackSpeed: 0 };
  for (const o of towers) {
    const aura = o.def.aura;
    if (o === t || !aura) continue;
    if (Math.hypot(o.cx - t.cx, o.cy - t.cy) <= aura.radius) bonus[aura.kind] = Math.max(bonus[aura.kind], aura.pct);
  }
  return bonus;
}
