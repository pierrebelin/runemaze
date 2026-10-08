import type { Biome, MapRecipe } from '../model/types';

export const MAP_RECIPE: MapRecipe = {
  width: 36,
  height: 24,
  landmark: 3,
  landmarkGap: 10,
  landmarkMargin: 2,
  biomes: { earth: { rocks: { min: 12, max: 24 } }, snow: { ice: { patches: { min: 3, max: 5 }, size: { min: 4, max: 8 } } }, space: {} },
  minLeg: 14,
  route: { min: 50, max: 80 },
};

export const BIOMES: Biome[] = ['earth', 'snow', 'space'];

/** Bonus de vitesse des créatures terrestres selon le sol. */
export const TERRAIN = { ice: { speed: 1.4 } };
