import { describe, expect, it } from 'vitest';
import { armorValueMultiplier, damageMultiplier } from '../../../src/domain/rules/Damage';

describe('Damage', () => {
  it('suit la formule d’armure de Warcraft III', () => {
    expect(armorValueMultiplier(0)).toBe(1);
    expect(armorValueMultiplier(10)).toBeCloseTo(1 - 0.6 / 1.6, 6);
    expect(armorValueMultiplier(-5)).toBeGreaterThan(1);
  });

  it('applique la table attaque / armure', () => {
    expect(damageMultiplier('pierce', { armorType: 'light', armor: 0 })).toBe(2);
    expect(damageMultiplier('siege', { armorType: 'fortified', armor: 0 })).toBe(1.5);
    expect(damageMultiplier('magic', { armorType: 'medium', armor: 0, magicImmune: true })).toBe(0);
    expect(damageMultiplier('chaos', { armorType: 'medium', armor: 0, magicImmune: true })).toBe(1);
  });

  it('[RM-03] applique 30 % puis la table et l\'armure quand une attaque magique dissipante touche un immunisé', () => {
    const wraith = { armorType: 'medium', armor: 2, magicImmune: true } as const;

    expect(damageMultiplier('magic', wraith, 0, false, 0.3)).toBeCloseTo(0.3 * 0.75 * armorValueMultiplier(2), 6);
  });

  it('[RM-03] le Dissipateur frappe comme une tour magique ordinaire quand la créature n\'est pas immunisée', () => {
    const wolf = { armorType: 'light', armor: 1 } as const;

    expect(damageMultiplier('magic', wolf, 0, false, 0.3)).toBe(damageMultiplier('magic', wolf));
  });

  it('[RM-04] une attaque magique sans dissipation inflige toujours 0 dégât à un immunisé', () => {
    const wraith = { armorType: 'medium', armor: 2, magicImmune: true } as const;

    expect(damageMultiplier('magic', wraith, 0, false, 0)).toBe(0);
    expect(damageMultiplier('magic', wraith)).toBe(0);
  });
});
