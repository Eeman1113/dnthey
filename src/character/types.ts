import type { Ability, AbilityScores, Skill, ConditionName } from '@/engine/types';
import type { Mastery } from '@/data/srd/equipment';

export type ScoreMethod = 'standard_array' | 'point_buy' | 'rolled';

/** The player's choices. Everything else is derived from this (see derive.ts). */
export interface CharacterBuild {
  id: string;
  name: string;
  pronouns: string;
  classId: string;
  subclassChosen?: string;
  backgroundId: string;
  speciesId: string;
  /** Resolves a species sub-option, e.g. elven lineage or draconic ancestry. */
  speciesChoice?: string;
  sizeChoice?: 'small' | 'medium';
  level: number;
  xp: number;
  scoreMethod: ScoreMethod;
  /** Scores BEFORE the background increase is applied. */
  baseScores: AbilityScores;
  /** Background grants +2/+1 to two, or +1/+1/+1 to all three, of its abilities. */
  backgroundIncrease: Partial<Record<Ability, number>>;
  /** Chosen from the class's skillChoices; background skills are added automatically. */
  classSkills: Skill[];
  /** Human's Skillful trait, Skilled feat, etc. */
  bonusSkills: Skill[];
  expertise: Skill[];
  originFeatId: string;
  featIds: string[];
  weaponMasteries: Mastery[];
  languages: string[];
  equipmentOption: 'A' | 'B';
  inventory: string[];
  gold: number;
  equippedArmorId?: string;
  hasShield: boolean;
  equippedWeaponIds: string[];
  /** Flavour, written into the Codex at campaign start. */
  appearance: string;
  backstory: string;
  personality: { trait: string; ideal: string; bond: string; flaw: string };
  portraitAssetId?: string;
}

/** Live, mutable state during play. Never derived, this is what the engine mutates. */
export interface CharacterState {
  currentHp: number;
  tempHp: number;
  hitDiceRemaining: number;
  exhaustion: number;
  conditions: { name: ConditionName; source: string; endsOn: string }[];
  deathSaves: { successes: number; failures: number };
  spellSlotsUsed: number[];
  heroicInspiration: boolean;
  concentratingOn: string | null;
}

export interface Character {
  build: CharacterBuild;
  state: CharacterState;
  kind: 'pc' | 'companion';
}
