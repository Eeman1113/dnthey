/** Core vocabulary of the 2024 ruleset (SRD 5.2.1). */

export const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
export type Ability = (typeof ABILITIES)[number];

export const ABILITY_NAMES: Record<Ability, string> = {
  str: 'Strength', dex: 'Dexterity', con: 'Constitution',
  int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma',
};

export const SKILLS = [
  'acrobatics', 'animal_handling', 'arcana', 'athletics', 'deception', 'history',
  'insight', 'intimidation', 'investigation', 'medicine', 'nature', 'perception',
  'performance', 'persuasion', 'religion', 'sleight_of_hand', 'stealth', 'survival',
] as const;
export type Skill = (typeof SKILLS)[number];

/** Which ability each skill keys off. */
export const SKILL_ABILITY: Record<Skill, Ability> = {
  acrobatics: 'dex', animal_handling: 'wis', arcana: 'int', athletics: 'str',
  deception: 'cha', history: 'int', insight: 'wis', intimidation: 'cha',
  investigation: 'int', medicine: 'wis', nature: 'int', perception: 'wis',
  performance: 'cha', persuasion: 'cha', religion: 'int', sleight_of_hand: 'dex',
  stealth: 'dex', survival: 'wis',
};

export const SKILL_NAMES: Record<Skill, string> = {
  acrobatics: 'Acrobatics', animal_handling: 'Animal Handling', arcana: 'Arcana',
  athletics: 'Athletics', deception: 'Deception', history: 'History', insight: 'Insight',
  intimidation: 'Intimidation', investigation: 'Investigation', medicine: 'Medicine',
  nature: 'Nature', perception: 'Perception', performance: 'Performance',
  persuasion: 'Persuasion', religion: 'Religion', sleight_of_hand: 'Sleight of Hand',
  stealth: 'Stealth', survival: 'Survival',
};

/** The 15 conditions of the 2024 rules. */
export const CONDITIONS = [
  'blinded', 'charmed', 'deafened', 'exhaustion', 'frightened', 'grappled',
  'incapacitated', 'invisible', 'paralyzed', 'petrified', 'poisoned', 'prone',
  'restrained', 'stunned', 'unconscious',
] as const;
export type ConditionName = (typeof CONDITIONS)[number];

/** The DC ladder the Adjudicator agent is constrained to (BUILD_PROMPT.md §4.2). */
export const DC_LADDER = [5, 10, 15, 20, 25, 30] as const;
export type DifficultyClass = (typeof DC_LADDER)[number];
export const DC_LABELS: Record<DifficultyClass, string> = {
  5: 'Very Easy', 10: 'Easy', 15: 'Medium',
  20: 'Hard', 25: 'Very Hard', 30: 'Nearly Impossible',
};

export type AbilityScores = Record<Ability, number>;
export type Advantage = 'advantage' | 'none' | 'disadvantage';
export type DamageType =
  | 'acid' | 'bludgeoning' | 'cold' | 'fire' | 'force' | 'lightning' | 'necrotic'
  | 'piercing' | 'poison' | 'psychic' | 'radiant' | 'slashing' | 'thunder';

export type Size = 'tiny' | 'small' | 'medium' | 'large' | 'huge' | 'gargantuan';

/** score -> modifier, floor((score - 10) / 2) */
export function abilityMod(score: number): number {
  return Math.floor((score - 10) / 2);
}

/** Proficiency bonus by character level (2024 PHB). */
export function proficiencyBonus(level: number): number {
  if (level < 1 || level > 20) throw new Error(`level out of range: ${level}`);
  return 2 + Math.floor((level - 1) / 4);
}

export function formatMod(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}
