import { describe, expect, it } from 'vitest';
import { TOWERS } from '../../../src/domain/catalog/towers';
import type { Family } from '../../../src/domain/model/types';

const FAMILIES: Family[] = ['archer', 'cannon', 'frost', 'storm', 'venom'];
const all = Object.values(TOWERS);
const infusions = all.filter((d) => d.elements && d.tier === 1);

describe('catalogue des hybrides', () => {
  it('propose une infusion pour chaque paire de familles', () => {
    for (const [i, a] of FAMILIES.entries()) {
      for (const b of FAMILIES.slice(i + 1)) {
        const found = infusions.filter((d) => d.elements!.includes(a) && d.elements!.includes(b));
        expect(found, `${a} + ${b}`).toHaveLength(1);
      }
    }
  });

  it("n'a jamais deux hybrides pour la même paire de familles", () => {
    const paires = infusions.map((d) => [...d.elements!].sort().join('+'));
    expect(new Set(paires).size).toBe(paires.length);
    const de = (paire: string) => infusions.filter((d) => [...d.elements!].sort().join('+') === paire).map((d) => d.id);
    expect(de('fire+frost')).toEqual(['steam']);
    expect(de('fire+storm')).toEqual(['plasma']);
  });

  it('offre à chaque tour de niveau 2 toutes les infusions de sa famille', () => {
    // Exception : le Grand dissipateur est une fin de lignée, il n'ouvre aucune infusion.
    for (const d of all.filter((d) => d.tier === 2 && !d.elements && d.id !== 'greatdispeller')) {
      const expected = infusions.filter((h) => h.elements!.includes(d.family)).map((h) => h.id);
      expect(d.upgrades, d.id).toEqual(expect.arrayContaining(expected));
    }
  });

  it("n'offre une infusion qu'aux tours de niveau 2 de ses familles", () => {
    for (const h of infusions) {
      const parents = all.filter((d) => d.upgrades.includes(h.id));
      for (const p of parents) {
        expect(p.tier, `${p.id} vers ${h.id}`).toBe(2);
        expect(h.elements, `${p.id} vers ${h.id}`).toContain(p.family);
      }
    }
  });

  it('donne à chaque infusion une évolution finale hybride', () => {
    for (const h of infusions) {
      expect(h.upgrades, h.id).toHaveLength(1);
      const next = TOWERS[h.upgrades[0]];
      expect(next.tier).toBe(2);
      expect(next.elements).toEqual(h.elements);
      expect(next.upgrades).toEqual([]);
    }
  });

  it('range une tour hybride dans la famille de son premier élément', () => {
    for (const d of all.filter((d) => d.elements)) expect(d.family, d.id).toBe(d.elements![0]);
  });

  it('[RM-05] toute attaque de zone du catalogue est instantanée', () => {
    const areas = all.filter((d) => d.attack?.area);
    expect(areas.length).toBeGreaterThan(0);
    for (const d of areas) expect(d.attack!.projectileSpeed, d.id).toBe(0);
  });
});
