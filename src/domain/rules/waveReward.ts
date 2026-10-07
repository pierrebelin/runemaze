export interface WaveReward {
  bonus: number;
  interest: number;
  income: number;
  capped: boolean;
}

/** Gain de fin de vague : prime, plus intérêts sur l'or en réserve (solo/coop) ou revenu (duel). */
export function waveReward(bonus: number, wave: number, gold: number, income: number, duel: boolean): WaveReward {
  if (duel) return { bonus, interest: 0, income, capped: false };
  const raw = Math.floor(gold * 0.04);
  const cap = 20 + wave * 2;
  return { bonus, interest: Math.min(raw, cap), income: 0, capped: raw > cap };
}
