/**
 * Dice notation + the audit record that the UI dice tray renders.
 * The model never produces these numbers (BUILD_PROMPT.md §1.1).
 */
import { Rng } from './rng';

export type Modifier = { label: string; value: number };

export interface DiceRoll {
  /** e.g. "2d6+3" as requested */
  formula: string;
  /** every individual die face, in order rolled */
  dice: { sides: number; value: number; kept: boolean }[];
  modifiers: Modifier[];
  total: number;
  reason: string;
  /** PRNG state before the roll, lets the UI replay this exact roll */
  seedState: number;
}

const DICE_RE = /^\s*(\d*)d(\d+)\s*((?:[+-]\s*\d+\s*)*)$/i;

export interface ParsedFormula { count: number; sides: number; flat: number }

export function parseFormula(formula: string): ParsedFormula {
  const m = DICE_RE.exec(formula);
  if (!m) throw new Error(`unparseable dice formula: "${formula}"`);
  const count = m[1] === '' ? 1 : Number(m[1]);
  const sides = Number(m[2]);
  let flat = 0;
  const tail = m[3] ?? '';
  for (const part of tail.matchAll(/([+-])\s*(\d+)/g)) {
    flat += (part[1] === '-' ? -1 : 1) * Number(part[2]);
  }
  if (count < 1 || count > 100) throw new Error(`absurd dice count in "${formula}"`);
  return { count, sides, flat };
}

/** Roll a formula like "2d6+3". Flat terms in the formula become a modifier row. */
export function roll(rng: Rng, formula: string, reason: string, extra: Modifier[] = []): DiceRoll {
  const seedState = rng.getState();
  const { count, sides, flat } = parseFormula(formula);
  const dice = Array.from({ length: count }, () => ({ sides, value: rng.die(sides), kept: true }));
  const modifiers: Modifier[] = [...extra];
  if (flat !== 0) modifiers.unshift({ label: 'formula', value: flat });
  const total =
    dice.reduce((s, d) => s + d.value, 0) + modifiers.reduce((s, m) => s + m.value, 0);
  return { formula, dice, modifiers, total, reason, seedState };
}

/**
 * Critical hits double the damage DICE only, not the modifiers (2024 rules).
 * Weapon/unarmed dice are doubled; a flat +3 from Dexterity is not.
 */
export function rollDamage(
  rng: Rng,
  formula: string,
  reason: string,
  opts: { critical?: boolean; modifiers?: Modifier[] } = {},
): DiceRoll {
  const { count, sides, flat } = parseFormula(formula);
  const effectiveCount = opts.critical ? count * 2 : count;
  const seedState = rng.getState();
  const dice = Array.from({ length: effectiveCount }, () => ({
    sides,
    value: rng.die(sides),
    kept: true,
  }));
  const modifiers: Modifier[] = [...(opts.modifiers ?? [])];
  if (flat !== 0) modifiers.unshift({ label: 'formula', value: flat });
  const raw = dice.reduce((s, d) => s + d.value, 0) + modifiers.reduce((s, m) => s + m.value, 0);
  return {
    formula: opts.critical ? `${formula} (crit: ${effectiveCount}d${sides})` : formula,
    dice,
    modifiers,
    total: Math.max(0, raw), // damage never heals
    reason,
    seedState,
  };
}

/** 4d6-drop-lowest, six times, one of the three legal 2024 score methods. */
export function rollAbilityScores(rng: Rng): { score: number; roll: DiceRoll }[] {
  return Array.from({ length: 6 }, (_, i) => {
    const seedState = rng.getState();
    const dice = Array.from({ length: 4 }, () => ({ sides: 6, value: rng.die(6), kept: true }));
    const lowest = dice.reduce((lo, d) => (d.value < lo.value ? d : lo), dice[0]!);
    lowest.kept = false;
    const score = dice.filter((d) => d.kept).reduce((s, d) => s + d.value, 0);
    return {
      score,
      roll: { formula: '4d6kh3', dice, modifiers: [], total: score, reason: `ability score ${i + 1}`, seedState },
    };
  });
}
