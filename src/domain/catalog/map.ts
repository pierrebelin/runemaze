import type { Biome, MapRecipe } from '../model/types';

export const MAP_RECIPE: MapRecipe = {
  width: 36,
  height: 24,
  landmark: 3,
  landmarkGap: 10,
  rocks: { min: 12, max: 24 },
  rockMargin: 2,
  minLeg: 14,
  route: { min: 50, max: 80 },
};

export const BIOMES: Biome[] = ['earth', 'snow', 'space'];
