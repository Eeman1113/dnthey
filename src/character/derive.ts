/**
 * Everything computed from a CharacterBuild. Pure, no randomness, no state.
 * The UI sheet and the engine both read from this, so there is exactly one
 * definition of "what is this character's AC".
 */
import {
  ABILITIES, SKILLS, SKILL_ABILITY, abilityMod, proficiencyBonus,
  type Ability, type AbilityScores, type Skill,
} from '@/engine/types';
import { CLASSES_BY_ID, FULL_CASTER_SLOTS, HALF_CASTER_SLOTS, WARLOCK_SLOTS } from '@/data/srd/classes';
import { SPECIES_BY_ID } from '@/data/srd/species';
import { BACKGROUNDS_BY_ID } from '@/data/srd/backgrounds';
import { ARMOR_BY_ID, WEAPONS_BY_ID, type Weapon } from '@/data/srd/equipment';
import { applyIncrease } from './scores';
import type { CharacterBuild } from './types';

export interface DerivedAttack {
  weapon: Weapon;
  ability: Ability;
  attackBonus: number;
  damage: string;
  damageBonus: number;
  proficient: boolean;
  masteryActive: boolean;
}

export interface Derived {
  scores: AbilityScores;
  mods: Record<Ability, number>;
  proficiencyBonus: number;
  maxHp: number;
  armorClass: number;
  armorNote: string;
  initiative: number;
  speed: number;
  hitDie: number;
  saves: Record<Ability, { mod: number; proficient: boolean }>;
  skills: Record<Skill, { mod: number; proficient: boolean; expertise: boolean }>;
  passivePerception: number;
  passiveInsight: number;
  passiveInvestigation: number;
  spellcastingAbility: Ability | null;
  spellSaveDc: number | null;
  spellAttackBonus: number | null;
  spellSlots: number[];
  /** Warlock Pact Magic is a different shape from ordinary slots. */
  pactSlots: { count: number; level: number } | null;
  carryingCapacity: number;
  attacks: DerivedAttack[];
  allSkillProficiencies: Skill[];
  stealthDisadvantage: boolean;
}

export function finalScores(build: CharacterBuild): AbilityScores {
  return applyIncrease(build.baseScores, build.backgroundIncrease);
}

export function derive(build: CharacterBuild): Derived {
  const cls = CLASSES_BY_ID[build.classId];
  const species = SPECIES_BY_ID[build.speciesId];
  const background = BACKGROUNDS_BY_ID[build.backgroundId];
  if (!cls) throw new Error(`unknown class: ${build.classId}`);
  if (!species) throw new Error(`unknown species: ${build.speciesId}`);
  if (!background) throw new Error(`unknown background: ${build.backgroundId}`);

  const scores = finalScores(build);
  const mods = Object.fromEntries(
    ABILITIES.map((a) => [a, abilityMod(scores[a])]),
  ) as Record<Ability, number>;
  const pb = proficiencyBonus(build.level);

  // --- Hit points: max hit die at level 1, then average (die/2 + 1) per level ---
  const perLevelAvg = cls.hitDie / 2 + 1;
  let maxHp = cls.hitDie + mods.con + (build.level - 1) * (perLevelAvg + mods.con);
  if (build.speciesId === 'dwarf') maxHp += build.level;            // Dwarven Toughness
  if (build.featIds.includes('tough')) maxHp += build.level * 2;    // Tough feat
  maxHp = Math.max(1, Math.floor(maxHp));

  // --- Armor Class ---
  let armorClass: number;
  let armorNote: string;
  let stealthDisadvantage = false;
  const armor = build.equippedArmorId ? ARMOR_BY_ID[build.equippedArmorId] : undefined;

  if (armor && armor.category !== 'shield') {
    const dexPart = armor.dexCap === null ? mods.dex : Math.min(mods.dex, armor.dexCap);
    armorClass = armor.baseAc + dexPart;
    armorNote = armor.name;
    stealthDisadvantage = armor.stealthDisadvantage;
  } else if (build.classId === 'barbarian') {
    armorClass = 10 + mods.dex + mods.con;                           // Unarmored Defense
    armorNote = 'Unarmored Defense (Barbarian)';
  } else if (build.classId === 'monk' && !build.hasShield) {
    armorClass = 10 + mods.dex + mods.wis;                           // Unarmored Defense
    armorNote = 'Unarmored Defense (Monk)';
  } else {
    armorClass = 10 + mods.dex;
    armorNote = 'Unarmored';
  }
  if (build.hasShield) {
    armorClass += 2;
    armorNote += ' + Shield';
  }
  if (build.featIds.includes('style_defense') && armor && armor.category !== 'shield') {
    armorClass += 1;
    armorNote += ' + Defense';
  }

  // --- Initiative ---
  let initiative = mods.dex;
  if (build.featIds.includes('alert') || build.originFeatId === 'alert') initiative += pb;

  // --- Speed ---
  let speed = species.speed;
  if (build.speciesId === 'elf' && build.speciesChoice === 'wood') speed = 35;
  if (build.classId === 'monk' && build.level >= 2 && !armor) speed += 10;
  if (build.classId === 'barbarian' && build.level >= 5 && (!armor || armor.category !== 'heavy')) speed += 10;

  // --- Saving throws ---
  const saves = Object.fromEntries(
    ABILITIES.map((a) => {
      const proficient = cls.savingThrows.includes(a);
      return [a, { mod: mods[a] + (proficient ? pb : 0), proficient }];
    }),
  ) as Record<Ability, { mod: number; proficient: boolean }>;

  // --- Skills ---
  const proficientSkills = new Set<Skill>([
    ...background.skills,
    ...build.classSkills,
    ...build.bonusSkills,
  ]);
  const expertiseSet = new Set(build.expertise);
  const jackOfAllTrades = build.classId === 'bard' && build.level >= 2;

  const skills = Object.fromEntries(
    SKILLS.map((s) => {
      const ability = SKILL_ABILITY[s];
      const proficient = proficientSkills.has(s);
      const expertise = expertiseSet.has(s) && proficient;
      let mod = mods[ability];
      if (expertise) mod += pb * 2;
      else if (proficient) mod += pb;
      else if (jackOfAllTrades) mod += Math.floor(pb / 2);
      return [s, { mod, proficient, expertise }];
    }),
  ) as Record<Skill, { mod: number; proficient: boolean; expertise: boolean }>;

  // --- Spellcasting ---
  const spellcastingAbility = cls.spellcastingAbility ?? null;
  const spellSaveDc = spellcastingAbility ? 8 + pb + mods[spellcastingAbility] : null;
  const spellAttackBonus = spellcastingAbility ? pb + mods[spellcastingAbility] : null;

  let spellSlots: number[] = [];
  let pactSlots: { count: number; level: number } | null = null;
  const idx = build.level - 1;
  if (cls.caster === 'full') spellSlots = [...(FULL_CASTER_SLOTS[idx] ?? [])];
  else if (cls.caster === 'half') spellSlots = [...(HALF_CASTER_SLOTS[idx] ?? [])];
  else if (cls.caster === 'warlock') {
    const w = WARLOCK_SLOTS[idx];
    if (w) pactSlots = { count: w[0], level: w[1] };
  }

  // --- Attacks ---
  const attacks: DerivedAttack[] = build.equippedWeaponIds
    .map((id) => WEAPONS_BY_ID[id])
    .filter((w): w is Weapon => Boolean(w))
    .map((weapon) => {
      // Finesse and ranged weapons may use Dexterity; otherwise Strength for melee.
      const canUseDex = weapon.properties.includes('finesse') || weapon.kind === 'ranged';
      const ability: Ability = canUseDex && mods.dex >= mods.str ? 'dex' : weapon.kind === 'ranged' ? 'dex' : 'str';
      const proficient = isProficientWithWeapon(cls.weapons, weapon);
      let attackBonus = mods[ability] + (proficient ? pb : 0);
      if (build.featIds.includes('style_archery') && weapon.kind === 'ranged') attackBonus += 2;
      let damageBonus = mods[ability];
      if (build.featIds.includes('style_dueling') && weapon.kind === 'melee' && !weapon.properties.includes('two_handed')) {
        damageBonus += 2;
      }
      return {
        weapon, ability, attackBonus, damage: weapon.damage, damageBonus, proficient,
        masteryActive: build.weaponMasteries.includes(weapon.mastery),
      };
    });

  return {
    scores, mods, proficiencyBonus: pb, maxHp, armorClass, armorNote, initiative, speed,
    hitDie: cls.hitDie, saves, skills,
    passivePerception: 10 + skills.perception.mod,
    passiveInsight: 10 + skills.insight.mod,
    passiveInvestigation: 10 + skills.investigation.mod,
    spellcastingAbility, spellSaveDc, spellAttackBonus, spellSlots, pactSlots,
    carryingCapacity: scores.str * 15,
    attacks,
    allSkillProficiencies: [...proficientSkills].sort(),
    stealthDisadvantage,
  };
}

function isProficientWithWeapon(classWeapons: string[], weapon: { category: string; properties: string[] }): boolean {
  for (const entry of classWeapons) {
    if (entry === 'Simple' && weapon.category === 'simple') return true;
    if (entry === 'Martial' && weapon.category === 'martial') return true;
    if (entry.startsWith('Martial weapons with') && weapon.category === 'martial') {
      if (entry.includes('Finesse') && weapon.properties.includes('finesse')) return true;
      if (entry.includes('Light') && weapon.properties.includes('light')) return true;
    }
  }
  return false;
}
