import type { BuilderDef } from '../model/types';

export const BUILDERS: Record<string, BuilderDef> = {
  bastion: {
    id: 'bastion',
    name: 'Bastion',
    style: 'corps à corps et auras, au cœur du labyrinthe',
    weakness: 'peu de zone à distance',
    roots: ['archer', 'guard'],
    hybrids: ['ballista', 'darkarrows'],
  },
  forge: {
    id: 'forge',
    name: 'Forge',
    style: 'siège, zone, auras de vitesse',
    weakness: 'contre les chefs',
    roots: ['cannon', 'anvil'],
    hybrids: ['cryoshell', 'firebomb'],
  },
  sylve: {
    id: 'sylve',
    name: 'Sylve',
    style: 'poison, épines, ralentissement',
    weakness: 'peu de dégâts directs',
    roots: ['venom', 'bramble'],
    hybrids: ['stinger', 'naphtha'],
  },
  pyromancers: {
    id: 'pyromancers',
    name: 'Pyromanciens',
    style: 'braise au sol, salve, acharnement',
    weakness: 'volants et créatures rapides',
    roots: ['brazier', 'hearth'],
    hybrids: ['steam', 'plasma'],
  },
  necromancers: {
    id: 'necromancers',
    name: 'Nécromanciens',
    style: 'chaos qui ignore les armures, poison et lenteur',
    weakness: 'dégâts modestes par coup',
    roots: ['ossuary', 'altar'],
    hybrids: ['blackplague', 'lich'],
  },
  guild: {
    id: 'guild',
    name: 'Guilde marchande',
    style: 'or, primes, revenu',
    weakness: 'défense médiocre',
    roots: ['crossbow', 'counter'],
    hybrids: ['bountyhunter', 'coincannon'],
    gleanerCost: 40,
  },
  sanctuary: {
    id: 'sanctuary',
    name: 'Sanctuaire',
    style: 'contrôle : lenteur, gel, étourdissement',
    weakness: 'faible contre les cibles seules',
    roots: ['frost', 'gong'],
    hybrids: ['hail', 'blightfrost'],
  },
  arcanists: {
    id: 'arcanists',
    name: 'Arcanistes',
    style: 'magie, chaînes, montée en puissance',
    weakness: 'contre les immunisés à la magie',
    roots: ['storm', 'pylon', 'dispeller'],
    hybrids: ['thunderarrow', 'acidarc'],
  },
};

export function builder(id: string): BuilderDef {
  const b = BUILDERS[id];
  if (!b) throw new Error(`Bâtisseur inconnu : ${id}`);
  return b;
}
