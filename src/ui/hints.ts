/** Plain-language explanations of the game's jargon, for hover help. */
import { ABILITY_NAMES, type Ability } from '@/engine/types';

export const HIT_DIE_HINT = (die: number) =>
  `Hit die: d${die}. This sets how tough you are — you start with ${die} hit points plus your Constitution bonus, and roll a d${die} for more each level. d6 is the most fragile, d12 the sturdiest.`;

export const ABILITY_HINT: Record<Ability, string> = {
  str: 'Strength — raw physical power. Melee weapons, lifting, shoving, climbing.',
  dex: 'Dexterity — agility and reflexes. Finesse and ranged weapons, armour class, stealth, initiative.',
  con: 'Constitution — stamina. Adds to your hit points at every level and resists poison and exhaustion.',
  int: 'Intelligence — reasoning and recall. Wizard spellcasting, plus Arcana, History and Investigation.',
  wis: 'Wisdom — perception and insight. Cleric and Druid spellcasting, plus noticing things and reading people.',
  cha: 'Charisma — force of personality. Bard, Sorcerer, Warlock and Paladin spellcasting, plus persuasion and deception.',
};

export const PRIMARY_ABILITY_HINT = (abilities: Ability[]) =>
  `Primary ability: ${abilities.map((a) => ABILITY_NAMES[a]).join(' or ')}. Put your highest score here — ` +
  'it drives your attack rolls, your spell save DC, and most of what the class is good at.';

export const CASTER_HINT =
  'Spellcaster. You prepare or know spells and spend spell slots to cast them, regaining slots when you rest.';

export const MARTIAL_HINT =
  'No spellcasting. Everything you do comes from weapons, position and class features, which makes the class simpler to run.';

export const SIZE_HINT =
  'Size. Small creatures squeeze through tight spaces more easily; Medium is the default for most equipment and reach.';

export const SPEED_HINT =
  'Walking speed per turn. You can also split this movement around your action — move, strike, then step back.';

export const BACKGROUND_ABILITY_HINT =
  'In the 2024 rules your ability increases come from your background, not your species. ' +
  'You spend 3 points among these three: +2 and +1 to two of them, or +1 to all three.';

export const SAVE_HINT =
  'Saving throw proficiency. When something forces you to resist — a trap, a spell, a shove — you add your proficiency bonus to these two.';

export const EXPERTISE_HINT =
  'Expertise: your proficiency bonus is doubled for this skill. It is how a specialist becomes genuinely exceptional at one thing.';

export const PROFICIENCY_HINT =
  'Proficiency bonus. Added to anything you are trained in — attacks, skills, saving throws. It grows from +2 to +6 as you level.';
