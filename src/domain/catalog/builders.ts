import type { BuilderDef } from '../model/types';

export const BUILDERS: Record<string, BuilderDef> = {
  bastion: {
    id: 'bastion',
    name: 'Bastion',
    style: 'corps à corps et auras, au cœur du labyrinthe',
    weakness: 'peu de zone à distance',
    roots: ['archer', 'guard'],
    hybrids: ['ballista', 'frostarrow'],
  },
  forge: {
    id: 'forge',
    name: 'Forge',
    style: 'siège, zone, auras de vitesse',
    weakness: 'contre les chefs',
    roots: ['cannon', 'anvil'],
    hybrids: ['cryoshell', 'teslacannon'],
  },
  sylve: {
    id: 'sylve',
    name: 'Sylve',
    style: 'poison, épines, ralentissement',
    weakness: 'peu de dégâts directs',
    roots: ['venom', 'bramble'],
    hybrids: ['stinger', 'plagueshell'],
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
    roots: ['storm', 'pylon'],
    hybrids: ['thunderarrow', 'acidarc'],
  },
};

export function builder(id: string): BuilderDef {
  const b = BUILDERS[id];
  if (!b) throw new Error(`Bâtisseur inconnu : ${id}`);
  return b;
}
