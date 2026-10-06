import type { BuilderDef, TowerDef } from '../model/types';

/** Tours accessibles au bâtisseur : filtre des arbres existants, sans les dupliquer. */
export function builderTowers(b: BuilderDef, towers: Record<string, TowerDef>): Set<string> {
  const set = new Set<string>(['wall']);
  const pending = [...b.roots];
  while (pending.length > 0) {
    const id = pending.pop()!;
    if (set.has(id)) continue;
    set.add(id);
    for (const u of towers[id].upgrades) {
      // Entrée dans un hybride depuis une tour de base : seulement ceux du bâtisseur.
      if (towers[u].elements && !towers[id].elements && !b.hybrids.includes(u)) continue;
      pending.push(u);
    }
  }
  return set;
}

export function buildMenu(b: BuilderDef): string[] {
  return ['wall', ...b.roots];
}

export function upgradeOptions(def: TowerDef, allowed: Set<string>): string[] {
  return def.upgrades.filter((u) => allowed.has(u));
}
