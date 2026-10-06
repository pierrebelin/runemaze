/** Écart minimal entre deux envois reçus d'une même vague (s). */
export const SEND_GAP = 0.8;

/** Instant de sortie du k-ième envoi : réparti sur la durée de la vague, jamais plus serré que SEND_GAP. */
export function sendDelay(k: number, count: number, duration: number): number {
  return k * Math.max(duration / count, SEND_GAP);
}
