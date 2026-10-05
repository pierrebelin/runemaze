import type { CreepDef, WaveDef, WaveGroup, Difficulty } from '../model/types';

const C: CreepDef[] = [
  { id: 'rat', name: 'Rat des marais', plural: 'Rats des marais', hpFactor: 0.7, speed: 2.2, armorType: 'unarmored', armor: 0, leak: 1, radius: 0.28, bountyFactor: 0.8, send: { cost: 7, income: 1 } },
  { id: 'wolf', name: 'Loup gris', plural: 'Loups gris', hpFactor: 0.8, speed: 2.9, armorType: 'light', armor: 1, leak: 1, radius: 0.32, bountyFactor: 1, send: { cost: 14, income: 2 } },
  { id: 'raider', name: 'Maraudeur', plural: 'Maraudeurs', hpFactor: 1, speed: 2, armorType: 'medium', armor: 2, leak: 1, radius: 0.34, bountyFactor: 1, send: { cost: 25, income: 3 } },
  { id: 'troll', name: 'Troll des tourbières', plural: 'Trolls des tourbières', hpFactor: 1.05, speed: 1.9, armorType: 'medium', armor: 1, regen: 0.02, leak: 1, radius: 0.36, bountyFactor: 1.1 },
  { id: 'golem', name: 'Golem de pierre', plural: 'Golems de pierre', hpFactor: 1.6, speed: 1.45, armorType: 'fortified', armor: 4, leak: 1, radius: 0.4, bountyFactor: 1.3, send: { cost: 90, income: 8 } },
  { id: 'knight', name: 'Colosse cuirassé', plural: 'Colosses cuirassés', hpFactor: 1.35, speed: 1.7, armorType: 'heavy', armor: 5, leak: 1, radius: 0.38, bountyFactor: 1.2 },
  { id: 'harpy', name: 'Harpie', plural: 'Harpies', hpFactor: 0.75, speed: 2.1, armorType: 'light', armor: 0, air: true, leak: 1, radius: 0.32, bountyFactor: 1, send: { cost: 45, income: 5 } },
  { id: 'wyvern', name: 'Vouivre', plural: 'Vouivres', hpFactor: 1.05, speed: 1.9, armorType: 'medium', armor: 3, air: true, leak: 1, radius: 0.38, bountyFactor: 1.2 },
  { id: 'wraith', name: 'Spectre', plural: 'Spectres', hpFactor: 0.95, speed: 2.1, armorType: 'medium', armor: 2, magicImmune: true, leak: 1, radius: 0.33, bountyFactor: 1.1, send: { cost: 110, income: 9 } },
  { id: 'ogre', name: 'Ogre chef de guerre', plural: 'Ogre chef de guerre', hpFactor: 22, speed: 1.35, armorType: 'hero', armor: 4, boss: true, leak: 5, radius: 0.6, bountyFactor: 18, fury: { below: 0.5, mult: 1.5 } },
  { id: 'hydra', name: 'Hydre des marais', plural: 'Hydre des marais', hpFactor: 24, speed: 1.3, armorType: 'hero', armor: 6, regen: 0.012, boss: true, leak: 5, radius: 0.65, bountyFactor: 22, brood: { creep: 'hydrahead', count: 2, below: [0.75, 0.5, 0.25] } },
  { id: 'hydrahead', name: 'Tête d\'Hydre', plural: 'Têtes d\'Hydre', hpFactor: 1.5, speed: 2, armorType: 'medium', armor: 3, leak: 1, radius: 0.3, bountyFactor: 0.5 },
  { id: 'ashlord', name: 'Seigneur des cendres', plural: 'Seigneur des cendres', hpFactor: 30, speed: 1.25, armorType: 'hero', armor: 8, boss: true, leak: 10, radius: 0.72, bountyFactor: 30, breaker: { charge: 2, armed: 5, cooldown: 12, range: 4 } },
  { id: 'runeguard', name: 'Garde runique', plural: 'Gardes runiques', hpFactor: 1, speed: 1.9, armorType: 'heavy', armor: 3, leak: 1, radius: 0.38, bountyFactor: 1.2, shield: 4 },
  { id: 'dunerunner', name: 'Coureur des dunes', plural: 'Coureurs des dunes', hpFactor: 0.7, speed: 2.4, armorType: 'light', armor: 0, leak: 1, radius: 0.32, bountyFactor: 1, sprint: { mult: 2, duration: 1, cooldown: 4 } },
  { id: 'shaman', name: 'Chaman', plural: 'Chamans', hpFactor: 0.9, speed: 2, armorType: 'light', armor: 1, leak: 1, radius: 0.32, bountyFactor: 1.2, heal: { pct: 0.25, radius: 2.5, every: 3 } },
  { id: 'slime', name: 'Limon', plural: 'Limons', hpFactor: 1.2, speed: 1.8, armorType: 'unarmored', armor: 0, leak: 1, radius: 0.34, bountyFactor: 1, split: { creep: 'slimelet', count: 2 } },
  { id: 'slimelet', name: 'Petit Limon', plural: 'Petits Limons', hpFactor: 0.35, speed: 2.4, armorType: 'unarmored', armor: 0, leak: 1, radius: 0.22, bountyFactor: 0.3 },
  { id: 'sapper', name: 'Sapeur gobelin', plural: 'Sapeurs gobelins', hpFactor: 1.1, speed: 1.8, armorType: 'medium', armor: 2, leak: 1, radius: 0.32, bountyFactor: 1.4, breaker: { charge: 2, armed: 10, cooldown: 20, range: 3 } },
];

export const CREEPS: Record<string, CreepDef> = Object.fromEntries(C.map((c) => [c.id, c]));

const G = (creep: string, count: number, interval = 0.8, delay = 0): WaveGroup => ({ creep, count, interval, delay });
const W = (...groups: WaveGroup[]): WaveDef => ({ groups });

/** Les 30 vagues de la campagne. Au-delà : mode infini (voir waveAt). */
export const WAVES: WaveDef[] = [
  W(G('rat', 12)), W(G('wolf', 12, 0.7)), W(G('raider', 12)), W(G('golem', 10, 1.1)), W(G('harpy', 12)),
  W(G('dunerunner', 14)),
  W(G('knight', 10, 1)),
  W(G('troll', 12), G('wolf', 10, 0.7, 3)),
  W(G('wraith', 12)),
  W(G('ogre', 1), G('raider', 6, 0.8, 30)),
  W(G('runeguard', 14)),
  W(G('wyvern', 12), G('raider', 12, 0.7, 3)),
  W(G('slime', 12)),
  W(G('rat', 30, 0.35), G('shaman', 4, 0.8, 3)),
  W(G('wraith', 14, 0.7), G('golem', 8, 1, 3)),
  W(G('sapper', 8)),
  W(G('knight', 14, 0.9), G('shaman', 5, 0.8, 3)),
  W(G('harpy', 18, 0.6), G('dunerunner', 14, 0.8, 3)),
  W(G('runeguard', 14), G('slime', 10, 0.8, 3)),
  W(G('hydra', 1)),
  W(G('golem', 16, 0.9), G('sapper', 4, 0.8, 3)),
  W(G('wyvern', 16, 0.8), G('wraith', 12, 0.7, 3)),
  W(G('knight', 16, 0.8), G('runeguard', 10, 0.8, 3)),
  W(G('slime', 16, 0.8), G('shaman', 5, 0.8, 3)),
  W(G('troll', 20, 0.6), G('sapper', 6, 0.8, 3)),
  W(G('dunerunner', 26, 0.7), G('wolf', 20, 0.5, 3)),
  W(G('harpy', 22, 0.55), G('wyvern', 10, 0.8, 3)),
  W(G('golem', 18, 0.8), G('shaman', 6, 0.8, 3), G('sapper', 4, 0.8, 6)),
  W(G('knight', 20, 0.7), G('runeguard', 12, 0.8, 3), G('dunerunner', 12, 0.8, 6)),
  W(G('ashlord', 1), G('shaman', 4, 0.8, 40)),
];

export const CAMPAIGN_LENGTH = WAVES.length;

export function waveAt(index: number): WaveDef {
  if (index < WAVES.length) return WAVES[index];
  // Mode infini : on reboucle sur les vagues 11 à 30 avec plus de monstres.
  const loop = 10 + ((index - WAVES.length) % 20);
  const base = WAVES[loop];
  return {
    groups: base.groups.map((g) => ({ ...g, count: g.count === 1 ? 1 : Math.round(g.count * 1.2) })),
  };
}

export const DIFFICULTY: Record<Difficulty, { label: string; hp: number; lives: number; gold: number }> = {
  easy: { label: 'Recrue', hp: 0.75, lives: 30, gold: 110 },
  normal: { label: 'Vétéran', hp: 1, lives: 21, gold: 90 },
  hard: { label: 'Légende', hp: 1.4, lives: 10, gold: 85 },
};

/** PV de base d’une créature standard à la vague `index` (0 = première vague). */
export function baseHp(index: number): number {
  return Math.round(24 * Math.pow(1.155, index) + 8 * index);
}

export function bountyFor(index: number, def: CreepDef): number {
  return Math.max(1, Math.round((2 + index * 0.45) * def.bountyFactor));
}

export function clearBonus(index: number): number {
  return 10 + index * 3;
}
