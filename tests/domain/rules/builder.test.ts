import { describe, expect, it } from 'vitest';
import { TOWERS, tower } from '../../../src/domain/catalog/towers';
import { builder } from '../../../src/domain/catalog/builders';
import { buildMenu, builderTowers, upgradeOptions } from '../../../src/domain/rules/builder';

describe('builder', () => {
  it('[RM-02] le jeu du Bastion contient le mur, l\'arbre des archers, la lignée de la Garde, Baliste et Flèches noires et leurs évolutions', () => {
    const set = builderTowers(builder('bastion'), TOWERS);

    expect([...set].sort()).toEqual(
      ['wall', 'archer', 'sniper', 'volley', 'hawkeye', 'arrowstorm', 'guard', 'champion', 'standard', 'ballista', 'siegebow', 'darkarrows', 'doomvolley'].sort(),
    );
  });

  it('[RM-02] le jeu du Bastion exclut les tours des autres familles et les autres hybrides', () => {
    const set = builderTowers(builder('bastion'), TOWERS);

    expect(set.size).toBeGreaterThan(0);
    for (const id of ['cannon', 'frost', 'storm', 'venom', 'anvil', 'bramble', 'gong', 'pylon', 'thunderarrow', 'stinger', 'skypiercer', 'rustspike']) {
      expect(set.has(id), id).toBe(false);
    }
  });

  it('[RM-03] propose à un niveau 2 son niveau 3 et les deux hybrides du bâtisseur seulement', () => {
    const set = builderTowers(builder('bastion'), TOWERS);

    expect(upgradeOptions(tower('sniper'), set)).toEqual(['hawkeye', 'ballista', 'darkarrows']);
  });

  it('[RM-02] propose au mur la base de la famille et la base signature du bâtisseur', () => {
    const forge = builder('forge');
    const set = builderTowers(forge, TOWERS);

    expect([...upgradeOptions(tower('wall'), set)].sort()).toEqual(['anvil', 'cannon']);
    expect(buildMenu(forge)).toEqual(['wall', 'cannon', 'anvil']);
  });

  it('[RM-02] propose mur, Foudre, Pylône et Dissipateur quand le bâtisseur est Arcanistes', () => {
    expect(buildMenu(builder('arcanists'))).toEqual(['wall', 'storm', 'pylon', 'dispeller']);
  });
});
