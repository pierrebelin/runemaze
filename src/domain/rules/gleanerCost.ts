import type { BuilderDef } from '../model/types';

export function gleanerCost(base: number, builder: BuilderDef): number {
  return builder.gleanerCost ?? base;
}
