import type { ArmorType, AttackType, CreepDef } from '../model/types';

// Table attaque / armure calquée sur la logique de Warcraft III :
// chaque type d'attaque a ses cibles de prédilection et ses cauchemars.
export const ATTACK_TABLE: Record<AttackType, Record<ArmorType, number>> = {
  normal: { unarmored: 1, light: 1, medium: 1.5, heavy: 1, fortified: 0.7, hero: 1 },
  pierce: { unarmored: 1.5, light: 2, medium: 0.75, heavy: 1, fortified: 0.35, hero: 0.5 },
  siege: { unarmored: 1.5, light: 1, medium: 0.5, heavy: 1, fortified: 1.5, hero: 0.5 },
  magic: { unarmored: 1, light: 1.25, medium: 0.75, heavy: 2, fortified: 0.35, hero: 0.5 },
  chaos: { unarmored: 1, light: 1, medium: 1, heavy: 1, fortified: 1, hero: 1 },
};

export const ATTACK_LABEL: Record<AttackType, string> = {
  normal: 'Normale', pierce: 'Perçante', siege: 'Siège', magic: 'Magique', chaos: 'Chaos',
};

export const ARMOR_LABEL: Record<ArmorType, string> = {
  unarmored: 'Sans armure', light: 'Légère', medium: 'Moyenne', heavy: 'Lourde', fortified: 'Fortifiée', hero: 'Héroïque',
};

/**
 * Réduction liée à la valeur d'armure (formule de Warcraft III) :
 * chaque point absorbe environ 6 % des dégâts, avec rendement décroissant ;
 * une armure négative amplifie les dégâts.
 */
export function armorValueMultiplier(armor: number): number {
  if (armor >= 0) return 1 - (armor * 0.06) / (1 + armor * 0.06);
  return 2 - Math.pow(0.94, -armor);
}

export function damageMultiplier(
  attack: AttackType,
  creep: Pick<CreepDef, 'armorType' | 'armor' | 'magicImmune'>,
  shred = 0,
  ignoreArmorValue = false,
  dispel = 0,
): number {
  const immune = attack === 'magic' && creep.magicImmune;
  if (immune && dispel <= 0) return 0;
  const typeMult = ATTACK_TABLE[attack][creep.armorType];
  const valueMult = ignoreArmorValue ? 1 : armorValueMultiplier(creep.armor - shred);
  return (immune ? dispel : 1) * typeMult * valueMult;
}
