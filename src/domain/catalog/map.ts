import type { Biome, MapRecipe } from '../model/types';

export const MAP_RECIPE: MapRecipe = {
  width: 36,
  height: 24,
  landmark: 3,
  landmarkGap: 10,
  landmarkMargin: 2,
  biomes: { earth: { rocks: { min: 12, max: 24 } }, snow: { ice: { patches: { min: 5, max: 7 }, size: { min: 5, max: 9 } } }, space: { crystals: { count: { min: 4, max: 6 }, gap: 3 }, wormholes: { count: { min: 1, max: 2 }, gap: 12 } } },
  minLeg: 14,
  route: { min: 50, max: 80 },
};

export const BIOMES: Biome[] = ['earth', 'snow', 'space'];

/** Bonus de vitesse des créatures terrestres selon le sol ; bonus de portée des tours sur cristal. */
export const TERRAIN = { ice: { speed: 1.4 }, crystal: { range: 0.2 } };
