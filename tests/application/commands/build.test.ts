import { describe, expect, it } from 'vitest';
import { dispatch } from '../../../src/application/dispatch';
import { spawnCreep } from '../../../src/domain/systems/waves';
import { newWorld } from '../../support/helpers';
import { MAP_GATED_STONES, MAP_ICE, MAP_LOOP, MAP_TWO_STONES } from '../../support/maps';
import { MAP_CROSSING, MAP_WORMHOLE_GAP, MAP_WORMHOLE_NOOK, MAP_WORMHOLE_RING, MAP_WORMHOLE_SEALABLE_GATE } from '../../support/maps';
import { CommandType } from '../../../src/domain/model/types';

describe('build', () => {
  it('allonge le trajet quand on construit un mur en travers', () => {
    const w = newWorld();
    const before = w.mazeLength();
    // Un rideau de murs vertical de y=1 à y=20, colonne 10 : les créatures doivent contourner par le bas.
    for (let y = 1; y <= 19; y += 2) expect(dispatch(w, { c: CommandType.Build, def: 'wall', x: 10, y }).ok).toBe(true);
    expect(w.mazeLength()).toBeGreaterThan(before + 10);
  });

  it('refuse toute construction qui fermerait le passage', () => {
    const w = newWorld('easy');
    w.gold = 10_000;
    // Mur complet sur la colonne 20 sauf la dernière case : le dernier bloc doit être refusé.
    const results = [];
    for (let y = 1; y <= 21; y += 2) results.push(dispatch(w, { c: CommandType.Build, def: 'wall', x: 20, y }));
    const last = results[results.length - 1];
    expect(last.ok).toBe(false);
    expect(Number.isFinite(w.mazeLength())).toBe(true);
  });

  it('[RM-01] inscrit la tour posée au registre, en place', () => {
    const w = newWorld();
    const built = dispatch(w, { c: CommandType.Build, def: 'archer', x: 10, y: 8 }) as { ok: true; id: number };

    expect(w.stats.towers.size).toBe(1);
    const entry = w.stats.towers.get(built.id)!;
    expect(entry.fate).toBe('standing');
    expect(entry.def.name).toBe("Tour d'archers");
  });

  it('[RM-03] refuse la construction quand elle fermerait le tronçon de la pierre 2 à la porte', () => {
    const w = newWorld('normal', 42, MAP_GATED_STONES);
    const gold = w.gold;

    const r = dispatch(w, { c: CommandType.Build, def: 'wall', x: 15, y: 1 });

    expect(r).toEqual({ ok: false, reason: 'Impossible de bloquer le chemin.' });
    expect(w.towers).toHaveLength(0);
    expect(w.gold).toBe(gold);
  });

  it('[RM-03] refuse la construction quand elle fermerait le tronçon de la pierre 1 à la pierre 2', () => {
    const w = newWorld('normal', 42, MAP_GATED_STONES);
    const gold = w.gold;

    const r = dispatch(w, { c: CommandType.Build, def: 'wall', x: 10, y: 1 });

    expect(r).toEqual({ ok: false, reason: 'Impossible de bloquer le chemin.' });
    expect(w.towers).toHaveLength(0);
    expect(w.gold).toBe(gold);
  });

  it('[RM-03] refuse la construction quand elle enfermerait une créature en route vers la porte après la pierre 2', () => {
    const w = newWorld('normal', 42, MAP_GATED_STONES);
    // Poche en cul-de-sac (colonnes 12-15, ligne 4) accessible uniquement
    // par le col en colonnes 12-13 : la créature s'y trouve déjà, en route
    // vers la porte (leg 2), sans jamais fermer le tronçon général
    // pierre 2 → porte (colonnes 15-16, lignes 1-2, resté ouvert).
    const c = spawnCreep(w, 'rat', 0);
    c.leg = 2;
    c.tx = 14;
    c.ty = 4;
    c.x = 14.5;
    c.y = 4.5;
    const gold = w.gold;

    const r = dispatch(w, { c: CommandType.Build, def: 'wall', x: 12, y: 3 });

    expect(r).toEqual({ ok: false, reason: 'Impossible de bloquer le chemin.' });
    expect(w.towers).toHaveLength(0);
    expect(w.gold).toBe(gold);
  });

  it('[RM-03] accepte la construction quand tous les tronçons restent ouverts', () => {
    const w = newWorld('normal', 42, MAP_GATED_STONES);
    const gold = w.gold;

    const r = dispatch(w, { c: CommandType.Build, def: 'wall', x: 1, y: 1 });

    expect(r.ok).toBe(true);
    expect(w.towers).toHaveLength(1);
    expect(w.gold).toBe(gold - 3);
  });

  it('[RM-03] accepte une construction sur une case couverte par une flaque et garde le même trajet', () => {
    const w = newWorld();
    const témoin = newWorld();
    w.embers.push({ id: w.id(), towerId: 1, x: 10.5, y: 8.5, radius: 1, dps: 6, expires: w.tick + 180 });

    const r = dispatch(w, { c: CommandType.Build, def: 'wall', x: 10, y: 8 });
    const rTémoin = dispatch(témoin, { c: CommandType.Build, def: 'wall', x: 10, y: 8 });

    expect(r.ok).toBe(true);
    expect(rTémoin.ok).toBe(true);
    expect(w.mazeLength()).toBe(témoin.mazeLength());
    expect(w.embers).toHaveLength(1);
  });

  it('[CU-03] construit la base de sa famille et sa base signature', () => {
    const w = newWorld('normal', 42, MAP_CROSSING, 'bastion');
    w.gold = 10_000;

    const a = dispatch(w, { c: CommandType.Build, def: 'archer', x: 10, y: 8 });
    const g = dispatch(w, { c: CommandType.Build, def: 'guard', x: 14, y: 8 });

    expect(a.ok).toBe(true);
    expect(g.ok).toBe(true);
    expect(w.towers).toHaveLength(2);
  });

  it('[RM-02] refuse de construire la base d’un autre bâtisseur', () => {
    const w = newWorld('normal', 42, MAP_CROSSING, 'bastion');
    const gold = w.gold;

    const r = dispatch(w, { c: CommandType.Build, def: 'cannon', x: 10, y: 8 });

    expect(r).toEqual({ ok: false, reason: 'Construction inconnue.' });
    expect(w.gold).toBe(gold);
    expect(w.towers).toHaveLength(0);
  });

  it('[RM-02] construit un Dissipateur pour 25 or quand le bâtisseur est Arcanistes', () => {
    const w = newWorld('normal', 42, MAP_CROSSING, 'arcanists');
    const gold = w.gold;

    const r = dispatch(w, { c: CommandType.Build, def: 'dispeller', x: 10, y: 8 }) as { ok: true; id: number };

    expect(r.ok).toBe(true);
    expect(w.towers).toHaveLength(1);
    expect(w.towerById.get(r.id)!.def.id).toBe('dispeller');
    expect(gold - w.gold).toBe(25);
  });

  it('[RM-02] refuse de construire un Dissipateur quand le bâtisseur n\'est pas Arcanistes', () => {
    const w = newWorld('normal', 42, MAP_CROSSING, 'bastion');
    const gold = w.gold;

    const r = dispatch(w, { c: CommandType.Build, def: 'dispeller', x: 10, y: 8 });

    expect(r).toEqual({ ok: false, reason: 'Construction inconnue.' });
    expect(w.gold).toBe(gold);
    expect(w.towers).toHaveLength(0);
  });

  it('[RM-10] refuse une Garde qui fermerait le passage', () => {
    const w = newWorld('normal', 42, MAP_GATED_STONES, 'bastion');
    w.gold = 10_000;

    const r = dispatch(w, { c: CommandType.Build, def: 'guard', x: 15, y: 1 });

    expect(r).toEqual({ ok: false, reason: 'Impossible de bloquer le chemin.' });
    expect(w.towers).toHaveLength(0);
  });
});

describe('build : glace', () => {
  it('[CU-01] refuse une tour dont l’emprise recouvre une case de glace, sans rien changer', () => {
    const w = newWorld('normal', 42, MAP_ICE);
    const gold = w.gold;

    const r = dispatch(w, { c: CommandType.Build, def: 'archer', x: 4, y: 3 });

    expect(r.ok).toBe(false);
    expect(w.gold).toBe(gold);
    expect(w.towers).toHaveLength(0);
    expect(w.log).toHaveLength(0);
  });

  it('[CU-01] refuse un mur posé sur la glace', () => {
    const w = newWorld('normal', 42, MAP_ICE);

    const r = dispatch(w, { c: CommandType.Build, def: 'wall', x: 6, y: 2 });

    expect(r.ok).toBe(false);
    expect(w.towers).toHaveLength(0);
  });

  it('[CU-01] accepte une tour posée contre une plaque de glace', () => {
    const w = newWorld('normal', 42, MAP_ICE);

    const r = dispatch(w, { c: CommandType.Build, def: 'archer', x: 3, y: 3 });

    expect(r.ok).toBe(true);
    expect(w.towers).toHaveLength(1);
  });
});

describe('build : pas de demi-tour', () => {
  /** Rat engagé dans le couloir du haut de la boucle, entre les cases (5, 1) et (6, 1), vers la pierre 1. */
  const ratHeadingRight = (w: ReturnType<typeof newWorld>) => {
    const c = spawnCreep(w, 'rat', 0);
    c.leg = 0;
    c.tx = 6;
    c.ty = 1;
    c.x = 5.6;
    c.y = 1.5;
    return c;
  };

  it('refuse une construction qui ferait faire demi-tour à une créature en route', () => {
    const w = newWorld('normal', 42, MAP_LOOP);
    ratHeadingRight(w);
    const gold = w.gold;

    const r = dispatch(w, { c: CommandType.Build, def: 'wall', x: 7, y: 1 });

    expect(r).toEqual({ ok: false, reason: 'Les créatures en route ne peuvent pas faire demi-tour.' });
    expect(w.towers).toHaveLength(0);
    expect(w.gold).toBe(gold);
  });

  it('accepte la même construction quand aucune créature n’est engagée dans le couloir', () => {
    const w = newWorld('normal', 42, MAP_LOOP);

    expect(dispatch(w, { c: CommandType.Build, def: 'wall', x: 7, y: 1 }).ok).toBe(true);
  });

  it('accepte une construction derrière la créature, qui garde son sens de marche', () => {
    const w = newWorld('normal', 42, MAP_LOOP);
    ratHeadingRight(w);

    expect(dispatch(w, { c: CommandType.Build, def: 'wall', x: 3, y: 1 }).ok).toBe(true);
  });

  it('laisse les champs de flux intacts après un refus', () => {
    const w = newWorld('normal', 42, MAP_LOOP);
    ratHeadingRight(w);
    const before = w.mazeLength();

    dispatch(w, { c: CommandType.Build, def: 'wall', x: 7, y: 1 });

    expect(w.mazeLength()).toBe(before);
  });

  /** Rat du dernier tronçon (pierre 2 → porte) du Champ des Deux Pierres, entre (7, 3) et (8, 3), vers la droite. */
  const ratInField = (w: ReturnType<typeof newWorld>) => {
    const c = spawnCreep(w, 'rat', 0);
    c.leg = 2;
    c.tx = 8;
    c.ty = 3;
    c.x = 7.6;
    c.y = 3.5;
    return c;
  };

  it('retient le cap de la créature déviée par une construction', () => {
    const w = newWorld('normal', 42, MAP_TWO_STONES);
    const c = ratInField(w);

    // Le mur en (9, 3) barre la droite : le rat tourne de 90° vers le haut.
    expect(dispatch(w, { c: CommandType.Build, def: 'wall', x: 9, y: 3 }).ok).toBe(true);

    expect(c.heading!.x).toBeGreaterThan(0);
    expect(c.heading!.y).toBe(0);
  });

  it('ne retient aucun cap pour une créature dont le pas suivant ne change pas', () => {
    const w = newWorld('normal', 42, MAP_TWO_STONES);
    const c = ratInField(w);

    expect(dispatch(w, { c: CommandType.Build, def: 'wall', x: 2, y: 4 }).ok).toBe(true);

    expect(c.heading).toBeUndefined();
  });

  it('refuse une construction qui écarterait la créature de plus de 90° de son cap retenu', () => {
    const w = newWorld('normal', 42, MAP_TWO_STONES);
    const c = ratInField(w);
    // Cap retenu d'une déviation précédente : le rat descendait avant de tourner à droite.
    c.heading = { x: 0, y: 1 };

    const r = dispatch(w, { c: CommandType.Build, def: 'wall', x: 9, y: 3 });

    expect(r).toEqual({ ok: false, reason: 'Les créatures en route ne peuvent pas faire demi-tour.' });
  });
});

describe('build : trou de ver', () => {
  it('[RM-09] accepte une construction qui ne laisse que le trou de ver comme passage', () => {
    const w = newWorld('normal', 42, MAP_WORMHOLE_GAP);
    const gold = w.gold;

    // La tour 2×2 en (10, 9) ferme le passage du mur : seul le trou de ver relie encore les deux faces.
    const r = dispatch(w, { c: CommandType.Build, def: 'wall', x: 10, y: 9 });

    expect(r.ok).toBe(true);
    expect(w.towers).toHaveLength(1);
    expect(w.gold).toBe(gold - 3);
    expect(Number.isFinite(w.mazeLength())).toBe(true);
  });

  it('[RM-09] refuse une construction qui ne laisse aucun passage, trou de ver compris, sans rien changer', () => {
    const w = newWorld('normal', 42, MAP_WORMHOLE_SEALABLE_GATE);
    const gold = w.gold;

    // La tour en (15, 9) ferme l'alcôve de la porte : aucun trajet ne l'atteint, même par le trou de ver.
    const r = dispatch(w, { c: CommandType.Build, def: 'wall', x: 15, y: 9 });

    expect(r).toEqual({ ok: false, reason: 'Impossible de bloquer le chemin.' });
    expect(w.towers).toHaveLength(0);
    expect(w.gold).toBe(gold);
    expect(w.log).toHaveLength(0);
  });

  it('[RM-09] refuse une construction qui enferme une créature en route, trou de ver compris', () => {
    const w = newWorld('normal', 42, MAP_WORMHOLE_GAP);
    // Créature dans l'alcôve sans issue (colonnes 15-18, lignes 9-10), en route vers la porte.
    const c = spawnCreep(w, 'rat', 0);
    c.leg = 1;
    c.tx = 18;
    c.ty = 9;
    c.x = 18.5;
    c.y = 9.5;
    const gold = w.gold;

    const r = dispatch(w, { c: CommandType.Build, def: 'wall', x: 15, y: 9 });

    expect(r).toEqual({ ok: false, reason: 'Impossible de bloquer le chemin.' });
    expect(w.towers).toHaveLength(0);
    expect(w.gold).toBe(gold);
    expect(w.log).toHaveLength(0);
  });

  it('[RM-09] ne prend pas le passage par le trou de ver pour un demi-tour', () => {
    const w = newWorld('normal', 42, MAP_WORMHOLE_GAP);
    // Créature sur la case d'entrée (9, 4) du bout `a`, cap retenu vers l'ouest : sa sortie `A` est à l'est.
    const c = spawnCreep(w, 'rat', 0);
    c.leg = 0;
    c.tx = 9;
    c.ty = 4;
    c.x = 9.5;
    c.y = 4.5;
    c.heading = { x: -1, y: 0 };
    const gold = w.gold;

    // Le mur en (13, 4) déplace la case d'arrivée de (12, 5) à (12, 4) : le pas suivant change, toujours vers l'est.
    const r = dispatch(w, { c: CommandType.Build, def: 'wall', x: 13, y: 4 });

    expect(r).toEqual({ ok: true, id: expect.any(Number) });
    expect(w.towers).toHaveLength(1);
    expect(w.gold).toBe(gold - 3);
  });

  it('[RM-13] refuse la tour qui fermerait le dernier côté libre d’un bout, sans rien changer', () => {
    const w = newWorld('normal', 42, MAP_WORMHOLE_NOOK);
    const gold = w.gold;

    // La tour en (12, 3) bouche les deux cases au sud de `A` ; le trajet à pied reste ouvert.
    const r = dispatch(w, { c: CommandType.Build, def: 'wall', x: 12, y: 3 });

    expect(r).toEqual({ ok: false, reason: 'L’accès au trou de ver doit rester ouvert.' });
    expect(w.towers).toHaveLength(0);
    expect(w.gold).toBe(gold);
    expect(w.log).toHaveLength(0);
  });

  it('[RM-13] refuse l’anneau de tours qui enfermerait un bout dans une poche', () => {
    const w = newWorld('normal', 42, MAP_WORMHOLE_RING);
    // La première tour laisse deux cases d'entrée à la poche.
    expect(dispatch(w, { c: CommandType.Build, def: 'wall', x: 12, y: 5 }).ok).toBe(true);
    const gold = w.gold;
    const logged = w.log.length;

    const r = dispatch(w, { c: CommandType.Build, def: 'wall', x: 14, y: 5 });

    expect(r).toEqual({ ok: false, reason: 'L’accès au trou de ver doit rester ouvert.' });
    expect(w.towers).toHaveLength(1);
    expect(w.gold).toBe(gold);
    expect(w.log).toHaveLength(logged);
  });

  it('[RM-13] accepte une tour contre un bout quand un autre côté reste libre', () => {
    const w = newWorld('normal', 42, MAP_WORMHOLE_NOOK);
    const gold = w.gold;

    // La tour en (12, 4) touche le sud de `A` par la ligne 3 laissée libre : on y accède par les côtés.
    const r = dispatch(w, { c: CommandType.Build, def: 'wall', x: 12, y: 4 });

    expect(r.ok).toBe(true);
    expect(w.towers).toHaveLength(1);
    expect(w.gold).toBe(gold - 3);
  });
});
