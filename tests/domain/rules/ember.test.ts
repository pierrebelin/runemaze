import { describe, expect, it } from 'vitest';
import { strongestEmber } from '../../../src/domain/rules/ember';
import type { Ember } from '../../../src/domain/model/types';

function ember(id: number, x: number, dps: number, radius = 1): Ember {
  return { id, towerId: 1, x, y: 0, radius, dps, expires: 1000 };
}

describe('ember', () => {
  it('[RM-02] choisit la flaque au plus fort dps parmi celles qui contiennent le point', () => {
    const faible = ember(1, 0, 6);
    const forte = ember(2, 0.5, 16);
    const loin = ember(3, 10, 45);

    expect(strongestEmber([faible, forte, loin], 0.2, 0, 0.1)).toBe(forte);

    // Égalité de dps : le plus petit id l'emporte, quel que soit l'ordre.
    const a = ember(4, 0, 10);
    const b = ember(5, 0, 10);
    expect(strongestEmber([b, a], 0, 0, 0.1)).toBe(a);

    // Le rayon de la créature compte : à 1,3 du centre, rayon 0,5 dedans, rayon 0,1 dehors.
    expect(strongestEmber([faible], 1.3, 0, 0.5)).toBe(faible);
    expect(strongestEmber([faible], 1.3, 0, 0.1)).toBeUndefined();
  });
});
