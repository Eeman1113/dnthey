/**
 * d20 Tests, the 2024 rules unify ability checks, attack rolls and saving throws
 * into one concept. Everything that rolls a d20 for a creature goes through here.
 */
import { Rng } from './rng';
import type { DiceRoll, Modifier } from './dice';
import type { Advantage } from './types';

export type D20Kind = 'ability_check' | 'saving_throw' | 'attack_roll' | 'initiative' | 'death_save';

export interface D20Result {
  kind: D20Kind;
  /** both d20s when rolling with advantage/disadvantage; `kept` marks the one used */
  dice: { sides: 20; value: number; kept: boolean }[];
  natural: number;
  modifiers: Modifier[];
  total: number;
  advantage: Advantage;
  /** sources that granted advantage/disadvantage, kept for the UI explanation */
  advantageSources: string[];
  disadvantageSources: string[];
  dc?: number;
  success?: boolean;
  isNat20: boolean;
  isNat1: boolean;
  reason: string;
  seedState: number;
}

/**
 * Advantage and disadvantage DO NOT STACK (2024 PHB): any number of sources of each
 * simply cancel to a flat roll. This resolves the net state from raw source lists.
 */
export function resolveAdvantage(advSources: string[], disSources: string[]): Advantage {
  const a = advSources.length > 0;
  const d = disSources.length > 0;
  if (a && d) return 'none';
  if (a) return 'advantage';
  if (d) return 'disadvantage';
  return 'none';
}

export interface D20Options {
  kind: D20Kind;
  modifiers?: Modifier[];
  advantageSources?: string[];
  disadvantageSources?: string[];
  dc?: number;
  reason: string;
  /**
   * Exhaustion applies a cumulative -2 to EVERY d20 Test (2024). Passed as a level,
   * converted to a modifier here so no caller can forget it.
   */
  exhaustionLevel?: number;
}

export function rollD20(rng: Rng, opts: D20Options): D20Result {
  const seedState = rng.getState();
  const advSources = opts.advantageSources ?? [];
  const disSources = opts.disadvantageSources ?? [];
  const advantage = resolveAdvantage(advSources, disSources);

  const first = rng.die(20);
  const dice: { sides: 20; value: number; kept: boolean }[] = [
    { sides: 20, value: first, kept: true },
  ];
  if (advantage !== 'none') {
    const second = rng.die(20);
    dice.push({ sides: 20, value: second, kept: false });
    const useIdx =
      advantage === 'advantage'
        ? (second > first ? 1 : 0)
        : (second < first ? 1 : 0);
    dice.forEach((d, i) => { d.kept = i === useIdx; });
  }

  const natural = dice.find((d) => d.kept)!.value;
  const modifiers: Modifier[] = [...(opts.modifiers ?? [])];

  // Death saves are never modified (2024), not even by exhaustion.
  const exh = opts.exhaustionLevel ?? 0;
  if (exh > 0 && opts.kind !== 'death_save') {
    modifiers.push({ label: `exhaustion ${exh}`, value: -2 * exh });
  }

  const total = natural + modifiers.reduce((s, m) => s + m.value, 0);
  const isNat20 = natural === 20;
  const isNat1 = natural === 1;

  let success: boolean | undefined;
  if (opts.dc !== undefined) {
    // A natural 20 on an attack roll always hits; a natural 1 always misses.
    if (opts.kind === 'attack_roll') success = isNat20 ? true : isNat1 ? false : total >= opts.dc;
    else success = total >= opts.dc;
  }

  return {
    kind: opts.kind, dice, natural, modifiers, total, advantage,
    advantageSources: advSources, disadvantageSources: disSources,
    dc: opts.dc, success, isNat20, isNat1, reason: opts.reason, seedState,
  };
}

/**
 * Heroic Inspiration (2024): reroll the d20 and you MUST use the new roll,
 * even if it is worse. Returns a fresh result linked to the original.
 */
export function rerollWithHeroicInspiration(rng: Rng, prev: D20Result): D20Result {
  const next = rollD20(rng, {
    kind: prev.kind,
    modifiers: prev.modifiers.filter((m) => !m.label.startsWith('exhaustion')),
    advantageSources: prev.advantageSources,
    disadvantageSources: prev.disadvantageSources,
    dc: prev.dc,
    reason: `${prev.reason} (Heroic Inspiration reroll)`,
    exhaustionLevel: Math.abs(
      (prev.modifiers.find((m) => m.label.startsWith('exhaustion'))?.value ?? 0) / 2,
    ),
  });
  return next;
}

/** Passive score = 10 + all modifiers that would apply to the check. */
export function passiveScore(modifiers: Modifier[], advantage: Advantage = 'none'): number {
  const base = 10 + modifiers.reduce((s, m) => s + m.value, 0);
  if (advantage === 'advantage') return base + 5;
  if (advantage === 'disadvantage') return base - 5;
  return base;
}

/** Narration-friendly bands. The Resolver agent is given this, never the raw number. */
export type OutcomeTier = 'critical_success' | 'success' | 'narrow_success' | 'narrow_failure' | 'failure' | 'critical_failure';

export function outcomeTier(r: D20Result): OutcomeTier {
  if (r.dc === undefined) return r.isNat20 ? 'critical_success' : r.isNat1 ? 'critical_failure' : 'success';
  if (r.isNat20) return 'critical_success';
  if (r.isNat1) return 'critical_failure';
  const margin = r.total - r.dc;
  if (margin >= 10) return 'critical_success';
  if (margin >= 3) return 'success';
  if (margin >= 0) return 'narrow_success';
  if (margin >= -3) return 'narrow_failure';
  if (margin >= -9) return 'failure';
  return 'critical_failure';
}
