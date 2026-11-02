import { describe, it, expect } from 'vitest';
import { shortRest, longRest, awardXp } from './rest';
import { exampleBuild, initialState } from '@/character/builder';
import { derive } from '@/character/derive';

const hurt = (level = 3) => {
  const build = exampleBuild({ level });
  const d = derive(build);
  const state = { ...initialState(build), currentHp: 1, hitDiceRemaining: level, exhaustion: 2 };
  return { build, state, max: d.maxHp };
};

describe('short rest', () => {
  it('spends the dice asked for and heals by them', () => {
    const { build, state } = hurt();
    const r = shortRest(build, state, 'seed', 2);
    expect(r.state.hitDiceRemaining).toBe(1);
    expect(r.state.currentHp).toBeGreaterThan(state.currentHp);
    expect(r.rolls).toHaveLength(2);
  });

  it('cannot spend dice it does not have', () => {
    const { build, state } = hurt();
    const r = shortRest(build, { ...state, hitDiceRemaining: 1 }, 'seed', 99);
    expect(r.state.hitDiceRemaining).toBe(0);
    expect(r.rolls).toHaveLength(1);
  });

  it('never heals past the maximum', () => {
    const { build, state, max } = hurt();
    const r = shortRest(build, { ...state, currentHp: max - 1 }, 'seed', 3);
    expect(r.state.currentHp).toBe(max);
  });

  it('spending nothing changes nothing', () => {
    const { build, state } = hurt();
    const r = shortRest(build, state, 'seed', 0);
    expect(r.state.currentHp).toBe(state.currentHp);
    expect(r.state.hitDiceRemaining).toBe(state.hitDiceRemaining);
  });

  it('does not touch exhaustion, which only a long rest clears', () => {
    const { build, state } = hurt();
    expect(shortRest(build, state, 'seed', 1).state.exhaustion).toBe(2);
  });
});

describe('long rest', () => {
  it('restores all hit points', () => {
    const { build, state, max } = hurt();
    expect(longRest(build, state).state.currentHp).toBe(max);
  });

  it('returns half the total hit dice, rounded down, minimum one', () => {
    for (const [level, expected] of [[1, 1], [3, 1], [4, 2], [5, 2], [20, 10]] as const) {
      const build = exampleBuild({ level });
      const spent = { ...initialState(build), hitDiceRemaining: 0 };
      expect(longRest(build, spent).state.hitDiceRemaining, `level ${level}`).toBe(expected);
    }
  });

  it('never exceeds the character level in hit dice', () => {
    const build = exampleBuild({ level: 4 });
    const almost = { ...initialState(build), hitDiceRemaining: 4 };
    expect(longRest(build, almost).state.hitDiceRemaining).toBe(4);
  });

  it('removes exactly one level of exhaustion', () => {
    const { build, state } = hurt();
    expect(longRest(build, state).state.exhaustion).toBe(1);
    expect(longRest(build, { ...state, exhaustion: 0 }).state.exhaustion).toBe(0);
  });

  it('resets spell slots and clears death saves', () => {
    const build = exampleBuild({
      classId: 'wizard', backgroundId: 'sage', level: 5,
      classSkills: ['arcana', 'investigation'], expertise: [],
      backgroundIncrease: { int: 2, con: 1 }, originFeatId: 'magic_initiate_wizard',
      weaponMasteries: [], equippedArmorId: undefined, equippedWeaponIds: ['quarterstaff'],
    });
    const used = { ...initialState(build), spellSlotsUsed: [4, 3, 2], deathSaves: { successes: 1, failures: 2 } };
    const out = longRest(build, used).state;
    expect(out.spellSlotsUsed).toEqual([0, 0, 0]);
    expect(out.deathSaves).toEqual({ successes: 0, failures: 0 });
  });

  it('gives a human back Heroic Inspiration', () => {
    const build = exampleBuild({ speciesId: 'human' });
    const spent = { ...initialState(build), heroicInspiration: false };
    expect(longRest(build, spent).state.heroicInspiration).toBe(true);
  });
});

describe('xp and levelling', () => {
  it('accumulates without levelling below the threshold', () => {
    const build = exampleBuild({ level: 1, xp: 0 });
    const out = awardXp(build, 150);
    expect(out.build.xp).toBe(150);
    expect(out.levelUp).toBeNull();
  });

  it('levels at the SRD threshold and reports the hit point gain', () => {
    const build = exampleBuild({ level: 1, xp: 0 });
    const out = awardXp(build, 300);
    expect(out.build.level).toBe(2);
    expect(out.levelUp).toMatchObject({ from: 1, to: 2 });
    expect(out.levelUp!.hpGain).toBeGreaterThan(0);
  });

  it('can jump more than one level at once', () => {
    const out = awardXp(exampleBuild({ level: 1, xp: 0 }), 2700);
    expect(out.build.level).toBe(4);
    expect(out.levelUp).toMatchObject({ from: 1, to: 4 });
  });

  it('stops at 20', () => {
    const out = awardXp(exampleBuild({ level: 20, xp: 355000 }), 999999);
    expect(out.build.level).toBe(20);
    expect(out.levelUp).toBeNull();
  });

  it('the hit point gain matches what the sheet derives', () => {
    const build = exampleBuild({ level: 1, xp: 0 });
    const out = awardXp(build, 300);
    expect(derive(out.build).maxHp - derive(build).maxHp).toBe(out.levelUp!.hpGain);
  });
});
