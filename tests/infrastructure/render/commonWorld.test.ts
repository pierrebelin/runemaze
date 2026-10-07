import { describe, expect, it } from 'vitest';
import { MAP_GAP, MAX_ZOOM, fittedView, isDrag, isMapVisible, layOutMaps, mapAt, panView, toWorldPoint, zoomView } from '../../../src/infrastructure/render/commonWorld';

describe('commonWorld', () => {
  it('[RM-01] place la seconde carte à droite de la première, après un écart de 2 cases', () => {
    const world = layOutMaps([{ w: 20, h: 14 }, { w: 18, h: 16 }]);

    expect(MAP_GAP).toBe(2);
    expect(world.maps[0]).toEqual({ x: 0, y: 0, w: 20, h: 14 });
    expect(world.maps[1]).toEqual({ x: 22, y: 0, w: 18, h: 16 });
  });

  it('[RM-01] couvre la largeur des deux cartes et de l’écart quand la partie est un duel', () => {
    const world = layOutMaps([{ w: 20, h: 14 }, { w: 18, h: 16 }]);

    expect(world.w).toBe(40);
    expect(world.h).toBe(16);
  });

  it('[CU-01] ne contient que sa carte quand la partie est en solo', () => {
    const world = layOutMaps([{ w: 20, h: 14 }]);

    expect(world.maps).toEqual([{ x: 0, y: 0, w: 20, h: 14 }]);
    expect(world.w).toBe(20);
    expect(world.h).toBe(14);
  });

  it('[CU-01] montre sa carte entière à la plus grande taille qui tient dans la zone de jeu', () => {
    // 833/20 = 41.65 : arrondi au quart inférieur → 41.5 (600/14 = 42.86 ne limite pas)
    const view = fittedView({ x: 0, y: 0, w: 20, h: 14 }, { w: 833, h: 600 });

    expect(view.scale).toBe(41.5);
  });

  it('[CU-01] centre sa carte dans la zone de jeu quand il reste de la place sur un côté', () => {
    // 800/20 = 40 ; 700/40 = 17.5 cases visibles pour 14 : 1.75 case de marge en haut
    const view = fittedView({ x: 0, y: 0, w: 20, h: 14 }, { w: 800, h: 700 });

    expect(view.x).toBeCloseTo(0);
    expect(view.y).toBeCloseTo(-1.75);
  });

  it('[RM-09] cadre la carte de droite quand c’est la sienne (invité)', () => {
    const world = layOutMaps([{ w: 20, h: 14 }, { w: 18, h: 16 }]);

    // 640/16 = 40 ; 800/40 = 20 cases visibles pour 18 : 1 case de marge à gauche
    const view = fittedView(world.maps[1], { w: 800, h: 640 });

    expect(view.scale).toBe(40);
    expect(view.x).toBeCloseTo(21);
    expect(view.y).toBeCloseTo(0);
  });

  it('[CU-01] garde une taille de case d’au moins 8 px quand la zone de jeu est minuscule', () => {
    const view = fittedView({ x: 0, y: 0, w: 20, h: 14 }, { w: 50, h: 50 });

    expect(view.scale).toBe(8);
  });

  it('[RM-06] convertit un point de l’écran en position du monde commun selon la vue', () => {
    const view = { x: 10, y: 4, scale: 20 };

    expect(toWorldPoint(view, { x: 100, y: 60 })).toEqual({ x: 15, y: 7 });
  });

  it('[RM-06] donne la carte touchée et la case locale quand le point est sur une carte', () => {
    const world = layOutMaps([{ w: 20, h: 14 }, { w: 18, h: 16 }]);

    expect(mapAt(world, { x: 5.5, y: 3.25 })).toEqual({ index: 0, x: 5.5, y: 3.25 });
  });

  it('[RM-06] désigne la carte adverse quand le point tombe à droite de l’écart', () => {
    const world = layOutMaps([{ w: 20, h: 14 }, { w: 18, h: 16 }]);

    expect(mapAt(world, { x: 25.5, y: 4 })).toEqual({ index: 1, x: 3.5, y: 4 });
  });

  it('[RM-06] ne désigne aucune carte quand le point tombe dans l’écart', () => {
    const world = layOutMaps([{ w: 20, h: 14 }, { w: 18, h: 16 }]);

    expect(mapAt(world, { x: 21, y: 5 })).toBeNull();
  });

  it('[RM-02] reconnaît un glisser quand le pointeur s’éloigne de plus de 6 px', () => {
    expect(isDrag({ x: 100, y: 100 }, { x: 107, y: 100 })).toBe(true);
    expect(isDrag({ x: 100, y: 100 }, { x: 105, y: 105 })).toBe(true);
  });

  it('[RM-02] reconnaît un clic quand le pointeur bouge de 6 px ou moins', () => {
    expect(isDrag({ x: 100, y: 100 }, { x: 106, y: 100 })).toBe(false);
    expect(isDrag({ x: 100, y: 100 }, { x: 104, y: 104 })).toBe(false);
    expect(isDrag({ x: 100, y: 100 }, { x: 100, y: 100 })).toBe(false);
  });

  it('[CU-02] fait suivre le pointeur au monde commun quand on glisse', () => {
    const world = layOutMaps([{ w: 20, h: 14 }, { w: 18, h: 16 }]);
    const screen = { w: 800, h: 600 };
    const view = { x: 5, y: 2, scale: 40 };
    const before = toWorldPoint(view, { x: 300, y: 200 });

    const moved = panView(view, 100, 40, world, screen);

    const after = toWorldPoint(moved, { x: 400, y: 240 });
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
    expect(moved.scale).toBe(40);
  });

  it('[RM-04] bloque le déplacement quand le centre de l’écran sortirait du monde commun', () => {
    const world = layOutMaps([{ w: 20, h: 14 }, { w: 18, h: 16 }]);
    const screen = { w: 800, h: 600 };
    const view = { x: 5, y: 2, scale: 40 };

    for (const [dx, dy] of [[100000, 100000], [-100000, -100000]]) {
      const moved = panView(view, dx, dy, world, screen);
      const c = toWorldPoint(moved, { x: screen.w / 2, y: screen.h / 2 });
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.x).toBeLessThanOrEqual(world.w);
      expect(c.y).toBeGreaterThanOrEqual(0);
      expect(c.y).toBeLessThanOrEqual(world.h);
    }
  });

  it('[RM-03] garde sous le curseur le point du monde visé quand on zoome', () => {
    const world = layOutMaps([{ w: 20, h: 14 }, { w: 18, h: 16 }]);
    const screen = { w: 800, h: 600 };
    const fitted = fittedView(world.maps[0], screen);
    const at = { x: 300, y: 200 };
    const before = toWorldPoint(fitted, at);

    const zoomed = zoomView(fitted, 1.2, at, world, fitted, screen);

    const after = toWorldPoint(zoomed, at);
    expect(zoomed.scale).toBeCloseTo(fitted.scale * 1.2);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });

  it('[RM-04] plafonne le zoom à 2 fois la vue ajustée', () => {
    const world = layOutMaps([{ w: 20, h: 14 }, { w: 18, h: 16 }]);
    const screen = { w: 800, h: 600 };
    const fitted = fittedView(world.maps[0], screen);

    const zoomed = zoomView(fitted, 1000, { x: 400, y: 300 }, world, fitted, screen);

    expect(MAX_ZOOM).toBe(2);
    expect(zoomed.scale).toBe(MAX_ZOOM * fitted.scale);
  });

  it('[RM-04] arrête le dézoom quand tout le monde commun est visible', () => {
    const world = layOutMaps([{ w: 20, h: 14 }, { w: 18, h: 16 }]);
    const screen = { w: 800, h: 600 };
    const fitted = fittedView(world.maps[0], screen);
    const entire = Math.min(screen.w / world.w, screen.h / world.h);

    const zoomed = zoomView(fitted, 0.0001, { x: 400, y: 300 }, world, fitted, screen);

    expect(entire).toBeLessThan(fitted.scale);
    expect(zoomed.scale).toBeCloseTo(entire);
  });

  it('[RM-04] arrête le dézoom à la vue ajustée quand la partie est en solo', () => {
    const world = layOutMaps([{ w: 20, h: 14 }]);
    const screen = { w: 800, h: 600 };
    const fitted = fittedView(world.maps[0], screen);

    const zoomed = zoomView(fitted, 0.0001, { x: 400, y: 300 }, world, fitted, screen);

    expect(zoomed.scale).toBe(fitted.scale);
  });

  it('[RM-10] laisse intacte la vue reçue quand on déplace ou zoome', () => {
    const world = layOutMaps([{ w: 20, h: 14 }, { w: 18, h: 16 }]);
    const screen = { w: 800, h: 600 };
    const fitted = fittedView(world.maps[0], screen);
    const view = { x: 5, y: 2, scale: 40 };
    const copy = JSON.parse(JSON.stringify(view));

    panView(view, 100, 40, world, screen);
    zoomView(view, 1.5, { x: 300, y: 200 }, world, fitted, screen);

    expect(view).toEqual(copy);
  });

  it('[RM-08] juge sa carte visible quand une partie seulement est à l’écran', () => {
    const world = layOutMaps([{ w: 20, h: 14 }, { w: 18, h: 16 }]);
    const screen = { w: 800, h: 600 };
    // 800/40 = 20 cases visibles de x = 15 à 35 : seul le bord droit (15 à 20) de la carte 0 reste à l'écran
    const view = { x: 15, y: 0, scale: 40 };

    expect(isMapVisible(view, screen, world.maps[0])).toBe(true);
  });

  it('[RM-08] juge sa carte invisible quand la vue est entièrement sur la carte adverse', () => {
    const world = layOutMaps([{ w: 20, h: 14 }, { w: 18, h: 16 }]);
    const screen = { w: 800, h: 640 };
    // échelle 40 : la vue couvre x de 21 à 41, la carte 0 s'arrête à x = 20
    const view = fittedView(world.maps[1], screen);

    expect(isMapVisible(view, screen, world.maps[0])).toBe(false);
  });
});

describe('grille 2 contre 2', () => {
  const sizes = [{ w: 20, h: 14 }, { w: 20, h: 14 }, { w: 20, h: 14 }, { w: 20, h: 14 }];

  it('[RM-11] place quatre cartes en deux rangées de deux, séparées de 2 cases, quand la grille a 2 colonnes', () => {
    const world = layOutMaps(sizes, 2);

    expect(world.maps).toEqual([
      { x: 0, y: 0, w: 20, h: 14 },
      { x: 22, y: 0, w: 20, h: 14 },
      { x: 0, y: 16, w: 20, h: 14 },
      { x: 22, y: 16, w: 20, h: 14 },
    ]);
  });

  it('[RM-11] couvre la largeur de deux cartes et la hauteur de deux rangées avec leurs écarts', () => {
    const world = layOutMaps(sizes, 2);

    expect(world.w).toBe(42);
    expect(world.h).toBe(30);
  });

  it('[RM-11] donne la carte touchée et la case locale sur la rangée du bas', () => {
    const world = layOutMaps(sizes, 2);

    expect(mapAt(world, { x: 5.5, y: 20 })).toEqual({ index: 2, x: 5.5, y: 4 });
    expect(mapAt(world, { x: 25.5, y: 17 })).toEqual({ index: 3, x: 3.5, y: 1 });
  });
});
