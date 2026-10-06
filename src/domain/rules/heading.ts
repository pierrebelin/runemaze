import type { Creep } from '../model/types';

export interface Vec {
  x: number;
  y: number;
}

/** Sens de marche actuel d'une créature terrestre : de sa position vers la case visée. */
export function motion(c: Creep): Vec {
  return { x: c.tx + 0.5 - c.x, y: c.ty + 0.5 - c.y };
}

/** Cap de référence contre les demi-tours : celui retenu à la première déviation, sinon le sens de marche. */
export function capOf(c: Creep): Vec {
  return c.heading ?? motion(c);
}

/** Vrai si `step` part à plus de 90° de `cap`. */
export function opposes(cap: Vec, step: Vec): boolean {
  return cap.x * step.x + cap.y * step.y < 0;
}

/** Vrai si `step` reprend la direction de `cap` (à moins de 25° près). */
export function realigns(cap: Vec, step: Vec): boolean {
  const dot = cap.x * step.x + cap.y * step.y;
  return dot > 0.9 * Math.hypot(cap.x, cap.y) * Math.hypot(step.x, step.y);
}
