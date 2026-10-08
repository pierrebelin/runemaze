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
    expect(Object.keys(BUILDERS).sort()).toEqual(['arcanists', 'bastion', 'forge', 'guild', 'necromancers', 'pyromancers', 'sanctuary', 'sylve']);
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
    expect(Object.keys(BUILDERS).sort()).toEqual(['arcanists', 'bastion', 'forge', 'guild', 'necromancers', 'pyromancers', 'sanctuary', 'sylve']);
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
    expect(Object.keys(BUILDERS).sort()).toEqual(['arcanists', 'bastion', 'forge', 'guild', 'necromancers', 'pyromancers', 'sanctuary', 'sylve']);
    const owner = new Map<string, string>();
    for (const b of Object.values(BUILDERS)) {
      for (const id of [b.roots[1], ...descendants(b.roots[1])]) {
        expect(owner.has(id), `${id} : ${owner.get(id)} et ${b.id}`).toBe(false);
        owner.set(id, b.id);
      }
    }
  });

  it('[RM-01] propose les Pyromanciens parmi les bâtisseurs', () => {
    expect(Object.keys(BUILDERS).sort()).toEqual(['arcanists', 'bastion', 'forge', 'guild', 'necromancers', 'pyromancers', 'sanctuary', 'sylve']);
    expect(BUILDERS.pyromancers.id).toBe('pyromancers');
  });

  it('[RM-01] propose les Nécromanciens parmi les bâtisseurs', () => {
    expect(Object.keys(BUILDERS).sort()).toEqual(['arcanists', 'bastion', 'forge', 'guild', 'necromancers', 'pyromancers', 'sanctuary', 'sylve']);
    expect(BUILDERS.necromancers.id).toBe('necromancers');
  });

  it('[RM-01] le jeu des Nécromanciens contient l\'Ossuaire, l\'Autel, leurs évolutions, Peste noire et Liche, et rien d\'autre', () => {
    const b = BUILDERS.necromancers;
    expect(b.roots).toEqual(['ossuary', 'altar']);
    expect(b.hybrids.slice().sort()).toEqual(['blackplague', 'lich']);
    expect(tower('blackplague').elements).toEqual(['chaos', 'venom']);
    expect(tower('lich').elements).toEqual(['chaos', 'frost']);
    expect(tower('blackplague').upgrades).toEqual(['pandemic']);
    expect(tower('lich').upgrades).toEqual(['lichking']);
    expect([...builderTowers(b, TOWERS)].sort()).toEqual([
      'wall', 'ossuary', 'crypt', 'necropolis', 'charnel', 'legion',
      'altar', 'bloodaltar', 'reliquary', 'blackplague', 'pandemic', 'lich', 'lichking',
    ].sort());
  });

  it('[RM-01] le jeu des Pyromanciens contient le Brasero, le Foyer, leurs évolutions, Vapeur et Plasma, et rien d\'autre', () => {
    const b = BUILDERS.pyromancers;
    expect(b.roots).toEqual(['brazier', 'hearth']);
    expect(b.hybrids.slice().sort()).toEqual(['plasma', 'steam']);
    expect(tower('steam').elements).toEqual(['fire', 'frost']);
    expect(tower('plasma').elements).toEqual(['fire', 'storm']);
    expect([...builderTowers(b, TOWERS)].sort()).toEqual([
      'wall', 'brazier', 'blaze', 'volcano', 'flamethrower', 'dragonbreath',
      'hearth', 'conflagration', 'ashfield', 'steam', 'scorchmist', 'plasma', 'solararc',
    ].sort());
  });

  it('[RM-01] propose la Guilde marchande parmi les bâtisseurs', () => {
    expect(Object.keys(BUILDERS).sort()).toEqual(['arcanists', 'bastion', 'forge', 'guild', 'necromancers', 'pyromancers', 'sanctuary', 'sylve']);
    expect(BUILDERS.guild.id).toBe('guild');
    expect(tower('counter').family).toBe('gold');
  });

  it('[RM-01] le jeu de la Guilde contient l\'Arbalétrier, le Comptoir, leurs évolutions, Chasseur de primes et Canon à pièces, et rien d\'autre', () => {
    const b = BUILDERS.guild;
    expect(b.roots).toEqual(['crossbow', 'counter']);
    expect(b.hybrids.slice().sort()).toEqual(['bountyhunter', 'coincannon']);
    expect(tower('bountyhunter').upgrades).toEqual(['hitman']);
    expect(tower('coincannon').upgrades).toEqual(['goldbombard']);
    expect([...builderTowers(b, TOWERS)].sort()).toEqual([
      'wall', 'crossbow', 'taxman', 'collector', 'mercenary', 'captain',
      'counter', 'bank', 'caravan', 'bountyhunter', 'hitman', 'coincannon', 'goldbombard',
    ].sort());
  });

  it('[RM-13] la Forge propose l\'Obus incendiaire et plus le Canon à foudre', () => {
    const b = BUILDERS.forge;
    expect(b.hybrids).toContain('firebomb');
    expect(b.hybrids).not.toContain('teslacannon');
    expect(tower('firebomb').upgrades).toEqual(['napalm']);
    expect(tower('firebomb').elements).toEqual(['cannon', 'fire']);
    expect([...builderTowers(b, TOWERS)]).toEqual(expect.arrayContaining(['firebomb', 'napalm']));
    expect([...builderTowers(b, TOWERS)]).not.toContain('teslacannon');
  });

  it('[RM-13] la Sylve propose le Naphte et plus l\'Obus toxique', () => {
    const b = BUILDERS.sylve;
    expect(b.hybrids).toContain('naphtha');
    expect(b.hybrids).not.toContain('plagueshell');
    expect(tower('naphtha').upgrades).toEqual(['naphthatide']);
    expect(tower('naphtha').elements).toEqual(['venom', 'fire']);
    expect([...builderTowers(b, TOWERS)]).toEqual(expect.arrayContaining(['naphtha', 'naphthatide']));
    expect([...builderTowers(b, TOWERS)]).not.toContain('plagueshell');
  });

  it('[RM-13] le Bastion propose les Flèches noires et plus les Flèches de givre', () => {
    const b = BUILDERS.bastion;
    expect(b.hybrids).toEqual(['ballista', 'darkarrows']);
    expect(b.hybrids).not.toContain('frostarrow');
    expect([...builderTowers(b, TOWERS)]).toContain('darkarrows');
    expect([...builderTowers(b, TOWERS)]).not.toContain('frostarrow');
  });

  it('[RM-13] les hybrides retirés restent au catalogue sans appartenir à aucun bâtisseur', () => {
    for (const id of ['teslacannon', 'plagueshell']) {
      expect(TOWERS[id], id).toBeDefined();
      for (const b of Object.values(BUILDERS)) {
        expect(b.hybrids, `${b.id} ${id}`).not.toContain(id);
        expect([...builderTowers(b, TOWERS)], `${b.id} ${id}`).not.toContain(id);
      }
    }
  });
});
