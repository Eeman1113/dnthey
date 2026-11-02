import { describe, it, expect } from 'vitest';
import { Rng } from './rng';
import { parseFormula, roll, rollDamage, rollAbilityScores } from './dice';
import { rollD20, resolveAdvantage, passiveScore, outcomeTier } from './dtest';
import { abilityMod, proficiencyBonus } from './types';

describe('Rng', () => {
  it('is deterministic for a given seed', () => {
    const a = new Rng('campaign-1');
    const b = new Rng('campaign-1');
    const as = Array.from({ length: 50 }, () => a.die(20));
    const bs = Array.from({ length: 50 }, () => b.die(20));
    expect(as).toEqual(bs);
  });

  it('differs across seeds', () => {
    const a = Array.from({ length: 50 }, (_, i) => new Rng('x').die(20) + i);
    const b = Array.from({ length: 50 }, (_, i) => new Rng('y').die(20) + i);
    expect(a).not.toEqual(b);
  });

  it('stays in range over many rolls', () => {
    const r = new Rng(42);
    for (let i = 0; i < 20000; i++) {
      const v = r.die(20);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(20);
    }
  });

  it('covers every face of a d20', () => {
    const r = new Rng(7);
    const seen = new Set<number>();
    for (let i = 0; i < 5000; i++) seen.add(r.die(20));
    expect(seen.size).toBe(20);
  });

  it('restores state exactly', () => {
    const r = new Rng(99);
    r.die(20);
    const s = r.getState();
    const after = [r.die(20), r.die(6), r.die(8)];
    r.setState(s);
    expect([r.die(20), r.die(6), r.die(8)]).toEqual(after);
  });
});

describe('ability modifiers and proficiency', () => {
  it('maps scores to modifiers', () => {
    expect(abilityMod(1)).toBe(-5);
    expect(abilityMod(8)).toBe(-1);
    expect(abilityMod(9)).toBe(-1);
    expect(abilityMod(10)).toBe(0);
    expect(abilityMod(11)).toBe(0);
    expect(abilityMod(15)).toBe(2);
    expect(abilityMod(18)).toBe(4);
    expect(abilityMod(20)).toBe(5);
    expect(abilityMod(30)).toBe(10);
  });

  it('follows the 2024 proficiency table', () => {
    const expected: [number, number][] = [
      [1, 2], [4, 2], [5, 3], [8, 3], [9, 4], [12, 4], [13, 5], [16, 5], [17, 6], [20, 6],
    ];
    for (const [lvl, pb] of expected) expect(proficiencyBonus(lvl)).toBe(pb);
  });

  it('rejects out-of-range levels', () => {
    expect(() => proficiencyBonus(0)).toThrow();
    expect(() => proficiencyBonus(21)).toThrow();
  });
});

describe('dice formulas', () => {
  it('parses notation', () => {
    expect(parseFormula('2d6+3')).toEqual({ count: 2, sides: 6, flat: 3 });
    expect(parseFormula('d20')).toEqual({ count: 1, sides: 20, flat: 0 });
    expect(parseFormula('1d8-1')).toEqual({ count: 1, sides: 8, flat: -1 });
    expect(parseFormula(' 4d6 + 2 - 1 ')).toEqual({ count: 4, sides: 6, flat: 1 });
  });

  it('rejects nonsense', () => {
    expect(() => parseFormula('banana')).toThrow();
    expect(() => parseFormula('500d6')).toThrow();
  });

  it('totals dice plus modifiers', () => {
    const r = roll(new Rng(1), '3d6+2', 'test', [{ label: 'bless', value: 1 }]);
    const sum = r.dice.reduce((s, d) => s + d.value, 0);
    expect(r.total).toBe(sum + 2 + 1);
    expect(r.dice).toHaveLength(3);
  });
});

describe('critical hits (2024)', () => {
  it('doubles damage dice but NOT modifiers', () => {
    const normal = rollDamage(new Rng(5), '1d8', 'longsword', {
      modifiers: [{ label: 'STR', value: 3 }],
    });
    const crit = rollDamage(new Rng(5), '1d8', 'longsword', {
      critical: true, modifiers: [{ label: 'STR', value: 3 }],
    });
    expect(normal.dice).toHaveLength(1);
    expect(crit.dice).toHaveLength(2);
    // the +3 appears exactly once in both
    expect(crit.modifiers.filter((m) => m.label === 'STR')).toHaveLength(1);
    const critDice = crit.dice.reduce((s, d) => s + d.value, 0);
    expect(crit.total).toBe(critDice + 3);
  });

  it('never returns negative damage', () => {
    const r = rollDamage(new Rng(3), '1d4', 'weak hit', {
      modifiers: [{ label: 'penalty', value: -50 }],
    });
    expect(r.total).toBe(0);
  });
});

describe('4d6 drop lowest', () => {
  it('produces six scores in 3..18 and drops exactly one die each', () => {
    const scores = rollAbilityScores(new Rng('char-1'));
    expect(scores).toHaveLength(6);
    for (const s of scores) {
      expect(s.roll.dice).toHaveLength(4);
      expect(s.roll.dice.filter((d) => !d.kept)).toHaveLength(1);
      const dropped = s.roll.dice.find((d) => !d.kept)!;
      const kept = s.roll.dice.filter((d) => d.kept);
      for (const k of kept) expect(k.value).toBeGreaterThanOrEqual(dropped.value);
      expect(s.score).toBe(kept.reduce((a, d) => a + d.value, 0));
      expect(s.score).toBeGreaterThanOrEqual(3);
      expect(s.score).toBeLessThanOrEqual(18);
    }
  });
});

describe('advantage does not stack (2024)', () => {
  it('cancels when both are present, regardless of count', () => {
    expect(resolveAdvantage(['flanking'], [])).toBe('advantage');
    expect(resolveAdvantage([], ['prone'])).toBe('disadvantage');
    expect(resolveAdvantage(['a', 'b', 'c'], ['x'])).toBe('none');
    expect(resolveAdvantage(['a'], ['x', 'y', 'z'])).toBe('none');
    expect(resolveAdvantage([], [])).toBe('none');
  });

  it('rolls two dice and keeps the higher on advantage', () => {
    for (let seed = 0; seed < 200; seed++) {
      const r = rollD20(new Rng(seed), { kind: 'ability_check', advantageSources: ['hidden'], reason: 't' });
      expect(r.dice).toHaveLength(2);
      const kept = r.dice.find((d) => d.kept)!;
      const other = r.dice.find((d) => !d.kept)!;
      expect(kept.value).toBeGreaterThanOrEqual(other.value);
    }
  });

  it('keeps the lower on disadvantage', () => {
    for (let seed = 0; seed < 200; seed++) {
      const r = rollD20(new Rng(seed), { kind: 'ability_check', disadvantageSources: ['exhausted'], reason: 't' });
      const kept = r.dice.find((d) => d.kept)!;
      const other = r.dice.find((d) => !d.kept)!;
      expect(kept.value).toBeLessThanOrEqual(other.value);
    }
  });

  it('rolls a single die when flat', () => {
    const r = rollD20(new Rng(1), { kind: 'ability_check', reason: 't' });
    expect(r.dice).toHaveLength(1);
  });
});

describe('exhaustion (2024): -2 per level to every d20 Test', () => {
  it('applies cumulatively', () => {
    for (let lvl = 0; lvl <= 5; lvl++) {
      const r = rollD20(new Rng(11), { kind: 'saving_throw', reason: 't', exhaustionLevel: lvl });
      const penalty = r.modifiers.find((m) => m.label.startsWith('exhaustion'))?.value ?? 0;
      expect(penalty).toBe(lvl === 0 ? 0 : -2 * lvl);
      expect(r.total).toBe(r.natural - 2 * lvl);
    }
  });

  it('never modifies a death save', () => {
    const r = rollD20(new Rng(11), { kind: 'death_save', reason: 't', exhaustionLevel: 3, dc: 10 });
    expect(r.modifiers).toHaveLength(0);
    expect(r.total).toBe(r.natural);
  });
});

describe('attack roll crit/fumble rules', () => {
  it('nat 20 hits and nat 1 misses regardless of AC', () => {
    let saw20 = false, saw1 = false;
    for (let seed = 0; seed < 600 && !(saw20 && saw1); seed++) {
      const r = rollD20(new Rng(seed), { kind: 'attack_roll', dc: 99, reason: 't' });
      if (r.isNat20) { expect(r.success).toBe(true); saw20 = true; }
      const r2 = rollD20(new Rng(seed), { kind: 'attack_roll', dc: -99, reason: 't' });
      if (r2.isNat1) { expect(r2.success).toBe(false); saw1 = true; }
    }
    expect(saw20 && saw1).toBe(true);
  });

  it('an ability check does not auto-succeed on a nat 20', () => {
    for (let seed = 0; seed < 600; seed++) {
      const r = rollD20(new Rng(seed), { kind: 'ability_check', dc: 30, reason: 't', modifiers: [{ label: 'x', value: 0 }] });
      if (r.isNat20) { expect(r.success).toBe(false); return; }
    }
  });
});

describe('passive scores', () => {
  it('is 10 + modifiers, +/-5 for advantage state', () => {
    const mods = [{ label: 'WIS', value: 3 }, { label: 'prof', value: 2 }];
    expect(passiveScore(mods)).toBe(15);
    expect(passiveScore(mods, 'advantage')).toBe(20);
    expect(passiveScore(mods, 'disadvantage')).toBe(10);
  });
});

describe('outcome tiers', () => {
  const mk = (total: number, dc: number, nat = 10) =>
    ({ total, dc, isNat20: nat === 20, isNat1: nat === 1 }) as never;
  it('bands by margin', () => {
    expect(outcomeTier(mk(25, 15))).toBe('critical_success');
    expect(outcomeTier(mk(19, 15))).toBe('success');
    expect(outcomeTier(mk(15, 15))).toBe('narrow_success');
    expect(outcomeTier(mk(13, 15))).toBe('narrow_failure');
    expect(outcomeTier(mk(8, 15))).toBe('failure');
    expect(outcomeTier(mk(2, 15))).toBe('critical_failure');
  });
});
