/** Prime versée pour une créature : prime de base × coefficient de la tour qui l'achève, arrondie. */
export function bountyPaid(bounty: number, mult = 1): number {
  return Math.round(bounty * mult);
}
