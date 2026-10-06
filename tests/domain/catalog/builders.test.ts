import { describe, expect, it } from 'vitest';
import { BUILDERS } from '../../../src/domain/catalog/builders';
import { TOWERS, tower } from '../../../src/domain/catalog/towers';
import { builderTowers } from '../../../src/domain/rules/builder';

/** Descendants d'une tour, sans traverser les hybrides. */
function descendants(id: string): string[] {
  return tower(id).upgrades
    .filter((u) => !tower(u).elements)
    .flatMap((u) => [u, ...descendants(u)]);
}

describe('builders', () => {
  it('[RM-03] chaque bâtisseur a deux hybrides accessibles depuis ses deux niveaux 2', () => {
    expect(Object.keys(BUILDERS).sort()).toEqual(['arcanists', 'bastion', 'forge', 'sanctuary', 'sylve']);
    for (const b of Object.values(BUILDERS)) {
      for (const h of b.hybrids) expect(tower(h).elements, `${b.id} ${h}`).toBeDefined();
      const tier2 = descendants(b.roots[0]).filter((id) => tower(id).tier === 2);
      expect(tier2, b.id).toHaveLength(2);
      for (const t of tier2) {
        for (const h of b.hybrids) expect(tower(t).upgrades, `${b.id} ${t} -> ${h}`).toContain(h);
      }
    }
  });

  it('chaque bâtisseur garde au moins une tour qui touche les volants', () => {
    expect(Object.keys(BUILDERS).sort()).toEqual(['arcanists', 'bastion', 'forge', 'sanctuary', 'sylve']);
    for (const b of Object.values(BUILDERS)) {
      const set = builderTowers(b, TOWERS);
      const anti = [...set].some((id) => {
        const t = tower(id).attack?.targets;
        return t === 'air' || t === 'both';
      });
      expect(anti, b.id).toBe(true);
    }
  });

  it('aucune tour signature n\'appartient à deux bâtisseurs', () => {
    expect(Object.keys(BUILDERS).sort()).toEqual(['arcanists', 'bastion', 'forge', 'sanctuary', 'sylve']);
    const owner = new Map<string, string>();
    for (const b of Object.values(BUILDERS)) {
      for (const id of [b.roots[1], ...descendants(b.roots[1])]) {
        expect(owner.has(id), `${id} : ${owner.get(id)} et ${b.id}`).toBe(false);
        owner.set(id, b.id);
      }
    }
  });
});
