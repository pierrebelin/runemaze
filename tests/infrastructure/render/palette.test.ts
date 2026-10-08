import { describe, expect, it } from 'vitest';
import { BIOME_PALETTE, PAL } from '../../../src/infrastructure/render/palette';

describe('palette', () => {
  it('[RM-08] garde pour Terre les couleurs actuelles du sol, des rochers et des repères', () => {
    expect(BIOME_PALETTE.earth).toMatchObject({
      ground: PAL.grassB,
      groundSpots: ['rgba(78, 100, 56, 0.22)', 'rgba(34, 46, 26, 0.25)'],
      tuft: PAL.tuft,
      tuftDark: '#2f3f25',
      dirt: PAL.dirt,
      dirtDark: PAL.dirtDark,
      rock: PAL.rock,
      rockDark: PAL.rockDark,
      rockLight: PAL.rockLight,
      cliff: PAL.cliff,
      stone: PAL.stone,
      stoneDark: PAL.stoneDark,
      stoneLight: PAL.stoneLight,
    });
  });

  it('[RM-08] donne à Neige et à Espace un sol, des rochers et des repères différents de Terre', () => {
    const earth = BIOME_PALETTE.earth;

    for (const biome of ['snow', 'space'] as const) {
      const p = BIOME_PALETTE[biome];

      expect(p.ground, `${biome} ground`).not.toBe(earth.ground);
      expect(p.rock, `${biome} rock`).not.toBe(earth.rock);
      expect(p.stone, `${biome} stone`).not.toBe(earth.stone);
    }
  });
});
