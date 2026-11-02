/**
 * Construction and validation of a character build. The UI edits a draft through
 * these helpers so that an illegal character can never reach the engine.
 */
import { ulid } from 'ulid';
import { SKILLS, type Skill } from '@/engine/types';
import { CLASSES_BY_ID } from '@/data/srd/classes';
import { SPECIES_BY_ID } from '@/data/srd/species';
import { BACKGROUNDS_BY_ID } from '@/data/srd/backgrounds';
import { FEATS_BY_ID, ORIGIN_FEATS } from '@/data/srd/feats';
import { WEAPONS_BY_ID, MASTERIES } from '@/data/srd/equipment';
import { STANDARD_ARRAY, emptyScores, pointBuyCost, POINT_BUY_BUDGET, validateBackgroundIncrease } from './scores';
import { derive } from './derive';
import type { CharacterBuild, CharacterState, Character } from './types';

export function emptyBuild(): CharacterBuild {
  return {
    id: ulid(),
    name: '',
    pronouns: 'they/them',
    classId: 'fighter',
    backgroundId: 'soldier',
    speciesId: 'human',
    level: 1,
    xp: 0,
    scoreMethod: 'standard_array',
    baseScores: emptyScores(10),
    backgroundIncrease: {},
    classSkills: [],
    bonusSkills: [],
    expertise: [],
    originFeatId: 'savage_attacker',
    featIds: [],
    weaponMasteries: [],
    languages: ['Common'],
    equipmentOption: 'A',
    inventory: [],
    gold: 0,
    hasShield: false,
    equippedWeaponIds: [],
    appearance: '',
    backstory: '',
    personality: { trait: '', ideal: '', bond: '', flaw: '' },
  };
}

/**
 * Assign the standard array in the order the player ranked their abilities.
 * `order` is most-important-first.
 */
export function assignStandardArray(order: readonly (keyof CharacterBuild['baseScores'])[]) {
  const scores = emptyScores(10);
  order.forEach((ability, i) => {
    const v = STANDARD_ARRAY[i];
    if (v !== undefined) scores[ability] = v;
  });
  return scores;
}

export interface ValidationIssue { field: string; message: string; severity: 'error' | 'warning' }

export function validateBuild(build: CharacterBuild): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const err = (field: string, message: string) => issues.push({ field, message, severity: 'error' });
  const warn = (field: string, message: string) => issues.push({ field, message, severity: 'warning' });

  const cls = CLASSES_BY_ID[build.classId];
  const species = SPECIES_BY_ID[build.speciesId];
  const background = BACKGROUNDS_BY_ID[build.backgroundId];

  // An unset field is "not chosen yet", not a malformed value, the creation UI
  // shows these as a checklist, so they must read as prompts rather than errors.
  if (!cls) {
    err('classId', build.classId ? `unknown class "${build.classId}"` : 'choose a class');
    return issues;
  }
  if (!species) {
    err('speciesId', build.speciesId ? `unknown species "${build.speciesId}"` : 'choose a species');
    return issues;
  }
  if (!background) {
    err('backgroundId', build.backgroundId ? `unknown background "${build.backgroundId}"` : 'choose a background');
    return issues;
  }

  if (!build.name.trim()) err('name', 'give your character a name');
  if (build.level < 1 || build.level > 20) err('level', 'level must be between 1 and 20');

  // Scores
  for (const [ability, score] of Object.entries(build.baseScores)) {
    if (score < 1 || score > 20) err(`baseScores.${ability}`, `${ability.toUpperCase()} must be between 1 and 20`);
  }
  if (build.scoreMethod === 'point_buy') {
    try {
      const spent = pointBuyCost(build.baseScores);
      if (spent > POINT_BUY_BUDGET) err('baseScores', `point buy over budget: ${spent}/${POINT_BUY_BUDGET}`);
      else if (spent < POINT_BUY_BUDGET) warn('baseScores', `${POINT_BUY_BUDGET - spent} points unspent`);
    } catch (e) {
      err('baseScores', (e as Error).message);
    }
  }
  if (build.scoreMethod === 'standard_array') {
    const sorted = Object.values(build.baseScores).sort((a, b) => b - a);
    if (JSON.stringify(sorted) !== JSON.stringify([...STANDARD_ARRAY])) {
      err('baseScores', 'standard array must use exactly 15, 14, 13, 12, 10, 8');
    }
  }

  // Background increase (2024: this is where ability bonuses come from)
  for (const m of validateBackgroundIncrease(build.backgroundIncrease, background.abilities)) {
    err('backgroundIncrease', m);
  }

  // Species sub-choice
  if (species.choice && !build.speciesChoice) {
    err('speciesChoice', `choose a ${species.choice.label}`);
  } else if (species.choice && build.speciesChoice) {
    if (!species.choice.options.some((o) => o.id === build.speciesChoice)) {
      err('speciesChoice', `"${build.speciesChoice}" is not a valid ${species.choice.label}`);
    }
  }

  // Skills
  if (build.classSkills.length !== cls.skillCount) {
    err('classSkills', `choose exactly ${cls.skillCount} class skill${cls.skillCount === 1 ? '' : 's'} (chose ${build.classSkills.length})`);
  }
  for (const s of build.classSkills) {
    if (!cls.skillChoices.includes(s)) err('classSkills', `${s} is not on the ${cls.name} skill list`);
    if (background.skills.includes(s)) {
      warn('classSkills', `${s} is already granted by your background. Pick another to avoid wasting it`);
    }
  }
  const dupes = build.classSkills.filter((s, i) => build.classSkills.indexOf(s) !== i);
  if (dupes.length) err('classSkills', `duplicate skill choices: ${dupes.join(', ')}`);
  for (const s of [...build.bonusSkills, ...build.expertise]) {
    if (!SKILLS.includes(s as Skill)) err('skills', `unknown skill "${s}"`);
  }
  for (const s of build.expertise) {
    const proficient = [...background.skills, ...build.classSkills, ...build.bonusSkills].includes(s);
    if (!proficient) err('expertise', `cannot take Expertise in ${s} without proficiency in it`);
  }

  // Origin feat
  const feat = FEATS_BY_ID[build.originFeatId];
  if (!feat) err('originFeatId', build.originFeatId ? `unknown feat "${build.originFeatId}"` : 'choose an Origin feat');
  else if (feat.category !== 'origin') err('originFeatId', `${feat.name} is not an Origin feat`);
  if (build.originFeatId !== background.originFeat && build.speciesId !== 'human') {
    warn('originFeatId', `${background.name} normally grants ${FEATS_BY_ID[background.originFeat]?.name ?? background.originFeat}`);
  }

  // Weapon mastery
  const allowedMasteries = cls.weaponMasteryCount ?? 0;
  if (build.weaponMasteries.length > allowedMasteries) {
    err('weaponMasteries', `${cls.name} gets ${allowedMasteries} weapon masteries, chose ${build.weaponMasteries.length}`);
  }
  for (const m of build.weaponMasteries) {
    if (!MASTERIES.includes(m)) err('weaponMasteries', `unknown mastery "${m}"`);
  }

  // Equipment sanity
  for (const id of build.equippedWeaponIds) {
    if (!WEAPONS_BY_ID[id]) err('equippedWeaponIds', `unknown weapon "${id}"`);
  }
  if (build.equippedArmorId && cls.armor.length === 0) {
    warn('equippedArmorId', `${cls.name} has no armor training, so wearing armor will disrupt class features`);
  }

  return issues;
}

export function isPlayable(build: CharacterBuild): boolean {
  return validateBuild(build).every((i) => i.severity !== 'error');
}

/** Fresh, undamaged state at the start of an adventure. */
export function initialState(build: CharacterBuild): CharacterState {
  const d = derive(build);
  return {
    currentHp: d.maxHp,
    tempHp: 0,
    hitDiceRemaining: build.level,
    exhaustion: 0,
    conditions: [],
    deathSaves: { successes: 0, failures: 0 },
    spellSlotsUsed: d.spellSlots.map(() => 0),
    heroicInspiration: build.speciesId === 'human',
    concentratingOn: null,
  };
}

export function makeCharacter(build: CharacterBuild, kind: 'pc' | 'companion' = 'pc'): Character {
  return { build, state: initialState(build), kind };
}

/** A complete, legal level-1 character, used for tests, demos and AI companions. */
export function exampleBuild(overrides: Partial<CharacterBuild> = {}): CharacterBuild {
  const base: CharacterBuild = {
    ...emptyBuild(),
    name: 'Veyra Ashlock',
    pronouns: 'she/her',
    classId: 'rogue',
    backgroundId: 'criminal',
    speciesId: 'halfling',
    level: 3,
    scoreMethod: 'standard_array',
    baseScores: { str: 8, dex: 15, con: 13, int: 14, wis: 12, cha: 10 },
    backgroundIncrease: { dex: 2, con: 1 },
    classSkills: ['acrobatics', 'deception', 'investigation', 'perception'],
    bonusSkills: [],
    expertise: ['stealth', 'perception'],
    originFeatId: 'alert',
    featIds: [],
    weaponMasteries: ['vex', 'nick'],
    languages: ['Common', 'Thieves’ Cant', 'Elvish'],
    equipmentOption: 'A',
    gold: 8,
    equippedArmorId: 'leather',
    hasShield: false,
    equippedWeaponIds: ['shortsword', 'dagger', 'shortbow'],
    appearance: 'Small, wiry, with a scar through one eyebrow and a permanent half-smile.',
    personality: {
      trait: 'Counts the exits in every room before she sits down.',
      ideal: 'Nobody gets left behind, not even the ones who deserve it.',
      bond: 'Owes a debt to the fence who raised her.',
      flaw: 'Cannot resist taking something that is not nailed down.',
    },
    backstory: '',
  };
  return { ...base, ...overrides };
}

export const ORIGIN_FEAT_OPTIONS = ORIGIN_FEATS;
