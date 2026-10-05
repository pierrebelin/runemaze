export function incomeCap(nextWave: number): number {
  return 4 + 2 * nextWave;
}

export function raiseIncome(income: number, gain: number, nextWave: number): number {
  // Le plafond borne la hausse, jamais le revenu déjà acquis.
  return Math.max(income, Math.min(income + gain, incomeCap(nextWave)));
}
