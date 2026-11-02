/** The three legal 2024 ability score methods, and background increase rules. */
import type { Ability, AbilityScores } from '@/engine/types';
import { ABILITIES } from '@/engine/types';

export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8] as const;

/** Point Buy: 27 points, scores 8..15 before any increase. */
export const POINT_BUY_COST: Record<number, number> = {
  8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9,
};
export const POINT_BUY_BUDGET = 27;

export function pointBuyCost(scores: AbilityScores): number {
  let total = 0;
  for (const a of ABILITIES) {
    const cost = POINT_BUY_COST[scores[a]];
    if (cost === undefined) throw new Error(`score ${scores[a]} is out of point-buy range (8-15)`);
    total += cost;
  }
  return total;
}

export function pointBuyRemaining(scores: AbilityScores): number {
  return POINT_BUY_BUDGET - pointBuyCost(scores);
}

export function emptyScores(value = 8): AbilityScores {
  return { str: value, dex: value, con: value, int: value, wis: value, cha: value };
}

/**
 * A background increase is legal if it is +2/+1 across two of the background's three
 * abilities, or +1/+1/+1 across all three. Nothing else.
 */
export function validateBackgroundIncrease(
  increase: Partial<Record<Ability, number>>,
  allowed: readonly Ability[],
): string[] {
  const errors: string[] = [];
  const entries = Object.entries(increase).filter(([, v]) => (v ?? 0) !== 0) as [Ability, number][];

  for (const [ability] of entries) {
    if (!allowed.includes(ability)) {
      errors.push(`${ability.toUpperCase()} is not one of this background's abilities`);
    }
  }
  const values = entries.map(([, v]) => v).sort((a, b) => b - a);
  const total = values.reduce((s, v) => s + v, 0);
  if (total !== 3) {
    errors.push(`background increases must total exactly 3 points (got ${total})`);
    return errors;
  }
  const isTwoOne = values.length === 2 && values[0] === 2 && values[1] === 1;
  const isOneOneOne = values.length === 3 && values.every((v) => v === 1);
  if (!isTwoOne && !isOneOneOne) {
    errors.push('background increases must be +2/+1 to two abilities or +1/+1/+1 to all three');
  }
  return errors;
}

export function applyIncrease(
  base: AbilityScores,
  increase: Partial<Record<Ability, number>>,
): AbilityScores {
  const out = { ...base };
  for (const a of ABILITIES) out[a] = base[a] + (increase[a] ?? 0);
  return out;
}
