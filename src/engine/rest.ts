/**
 * Rests and progression (2024 rules).
 *
 * Short Rest: one hour, spend Hit Dice to heal, each die plus your
 * Constitution modifier.
 * Long Rest: eight hours, all hit points back, HALF your total Hit Dice back
 * rounded down with a minimum of one, and one level of Exhaustion removed.
 */
import { Rng } from './rng';
import { roll, type DiceRoll } from './dice';
import { levelFromXp } from '@/data/srd/classes';
import type { CharacterBuild, CharacterState } from '@/character/types';
import { derive } from '@/character/derive';

export interface RestResult {
  state: CharacterState;
  healed: number;
  rolls: DiceRoll[];
  note: string;
}

export function shortRest(
  build: CharacterBuild, state: CharacterState, seed: string, diceToSpend: number,
): RestResult {
  const d = derive(build);
  const spend = Math.max(0, Math.min(diceToSpend, state.hitDiceRemaining));
  const rng = new Rng(`${seed}:short`);
  const rolls: DiceRoll[] = [];
  let healed = 0;

  for (let i = 0; i < spend; i++) {
    // Each Hit Die adds the Constitution modifier, and a die can never heal
    // less than nothing even with a negative modifier.
    const r = roll(rng, `1d${d.hitDie}`, 'hit die', [{ label: 'CON', value: d.mods.con }]);
    rolls.push(r);
    healed += Math.max(0, r.total);
  }

  const currentHp = Math.min(d.maxHp, state.currentHp + healed);
  return {
    state: { ...state, currentHp, hitDiceRemaining: state.hitDiceRemaining - spend },
    healed: currentHp - state.currentHp,
    rolls,
    note: spend === 0 ? 'You rest an hour and spend nothing.' : `You spend ${spend} Hit ${spend === 1 ? 'Die' : 'Dice'}.`,
  };
}

export function longRest(build: CharacterBuild, state: CharacterState): RestResult {
  const d = derive(build);
  // Half your total, rounded down, minimum one.
  const regained = Math.max(1, Math.floor(build.level / 2));
  const hitDiceRemaining = Math.min(build.level, state.hitDiceRemaining + regained);

  return {
    state: {
      ...state,
      currentHp: d.maxHp,
      tempHp: 0,
      hitDiceRemaining,
      exhaustion: Math.max(0, state.exhaustion - 1),
      deathSaves: { successes: 0, failures: 0 },
      spellSlotsUsed: state.spellSlotsUsed.map(() => 0),
      concentratingOn: null,
      // Humans regain Heroic Inspiration on a Long Rest (Resourceful).
      heroicInspiration: state.heroicInspiration || build.speciesId === 'human',
    },
    healed: d.maxHp - state.currentHp,
    rolls: [],
    note: `You sleep eight hours. Full hit points, ${regained} Hit ${regained === 1 ? 'Die' : 'Dice'} back.`,
  };
}

export interface LevelUp { from: number; to: number; hpGain: number }

/**
 * Award XP and level up if it crosses a threshold.
 * Hit points use the fixed average, which is what derive() assumes, so the
 * sheet and the award can never disagree.
 */
export function awardXp(build: CharacterBuild, xp: number): { build: CharacterBuild; levelUp: LevelUp | null } {
  const totalXp = build.xp + xp;
  const newLevel = Math.min(20, levelFromXp(totalXp));
  if (newLevel === build.level) return { build: { ...build, xp: totalXp }, levelUp: null };

  const before = derive(build).maxHp;
  const leveled: CharacterBuild = { ...build, xp: totalXp, level: newLevel };
  const after = derive(leveled).maxHp;
  return { build: leveled, levelUp: { from: build.level, to: newLevel, hpGain: after - before } };
}
