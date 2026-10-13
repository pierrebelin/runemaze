import type { ArmorType, AttackType, BuilderDef, CreepDef, Difficulty, TowerDef } from '../domain/model/types';
import { ARMOR_LABEL, ATTACK_LABEL } from '../domain/rules/Damage';
import { DIFFICULTY } from '../domain/catalog/creeps';
import { ARMOR_EN, ATTACK_EN, BUILDERS_EN, CREEPS_EN, DIFFICULTY_EN, REASONS_EN, TOWERS_EN } from './english';

// Langue de l'interface. Choisie à l'écran titre seulement : elle ne change jamais pendant une partie.

export type Lang = 'fr' | 'en';

export const LANGS: Lang[] = ['fr', 'en'];

export const LANG_NAME: Record<Lang, string> = { fr: 'Français', en: 'English' };

let current: Lang = 'fr';

export const lang = (): Lang => current;

export function setLang(l: Lang): void {
  current = l;
}

/** Texte dans la langue courante : le français d'abord, l'anglais ensuite. */
export const tr = (fr: string, en: string): string => (current === 'en' ? en : fr);

const en = <T>(table: Record<string, T>, id: string): T | undefined => (current === 'en' ? table[id] : undefined);

export const towerName = (d: TowerDef): string => en(TOWERS_EN, d.id)?.name ?? d.name;
export const towerDesc = (d: TowerDef): string => en(TOWERS_EN, d.id)?.desc ?? d.desc;
export const creepName = (d: CreepDef): string => en(CREEPS_EN, d.id)?.name ?? d.name;
export const creepPlural = (d: CreepDef): string => en(CREEPS_EN, d.id)?.plural ?? d.plural;
export const builderName = (b: BuilderDef): string => en(BUILDERS_EN, b.id)?.name ?? b.name;
export const builderStyle = (b: BuilderDef): string => en(BUILDERS_EN, b.id)?.style ?? b.style;
export const builderWeakness = (b: BuilderDef): string => en(BUILDERS_EN, b.id)?.weakness ?? b.weakness;
export const difficultyLabel = (d: Difficulty): string => en(DIFFICULTY_EN, d) ?? DIFFICULTY[d].label;
export const attackLabel = (t: AttackType): string => en(ATTACK_EN, t) ?? ATTACK_LABEL[t];
export const armorLabel = (a: ArmorType): string => en(ARMOR_EN, a) ?? ARMOR_LABEL[a];

/** Refus de l'application ou du serveur (texte français) dans la langue courante. */
export function reasonText(reason: string): string {
  if (current !== 'en') return reason;
  const gold = /^Il faut (\d+) pièces d'or\.$/.exec(reason);
  if (gold) return `You need ${gold[1]} gold.`;
  return REASONS_EN[reason] ?? reason;
}
