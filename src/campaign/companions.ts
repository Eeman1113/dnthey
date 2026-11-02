import type { CompanionCard } from '@/agents/dm';
import type { CharacterBuild } from '@/character/types';
import { emptyBuild } from '@/character/builder';
import type { Ability, Skill } from '@/engine/types';
import type { Mastery } from '@/data/srd/equipment';

/**
 * A small cast with real friction. Two is deliberate: each companion costs a
 * model call per beat, and at about 5s a call a party of four would add
 * twenty seconds of waiting to every turn.
 */
export const COMPANION_POOL: CompanionCard[] = [
  {
    id: 'brakka', name: 'Brakka', pronouns: 'she/her', species: 'orc', klass: 'barbarian',
    voice: 'Blunt, short sentences, allergic to plans. Calls the player "little one" regardless of their size.',
    want: 'To settle a debt owed to her by someone in this region.',
    flaw: 'Solves problems by hitting them, then apologises later, badly.',
    portraitId: 'barbarian',
  },
  {
    id: 'veladrin', name: 'Veladrin', pronouns: 'he/him', species: 'human', klass: 'wizard',
    voice: 'Precise, faintly condescending, fond of correcting details nobody asked about.',
    want: 'To find a page torn from a book he was supposed to be guarding.',
    flaw: 'Cannot leave a mystery alone, even when leaving is the sensible move.',
    portraitId: 'wizard',
  },
  {
    id: 'pell', name: 'Pell', pronouns: 'they/them', species: 'halfling', klass: 'rogue',
    voice: 'Cheerful, quick, deflects everything with a joke. Never answers a question directly the first time.',
    want: 'To get far away from the city they grew up in, and stay away.',
    flaw: 'Takes things. Small things, constantly, without really deciding to.',
    portraitId: 'rogue',
  },
  {
    id: 'ysolde', name: 'Ysolde', pronouns: 'she/her', species: 'human', klass: 'cleric',
    voice: 'Calm and unhurried. Asks the question everyone else is avoiding.',
    want: 'To understand why her god stopped answering three years ago.',
    flaw: 'Will not lie, even when a lie would save everyone a great deal of trouble.',
    portraitId: 'cleric',
  },
];

export function pickCompanions(seed: string, count = 2): CompanionCard[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  const pool = [...COMPANION_POOL];
  const out: CompanionCard[] = [];
  for (let i = 0; i < count && pool.length; i++) {
    h = Math.imul(h ^ (h >>> 15), h | 1);
    out.push(pool.splice(Math.abs(h) % pool.length, 1)[0]!);
  }
  return out;
}


/**
 * A real character sheet for each companion.
 *
 * They used to fight on a flat profile, AC 14 and 12 hit points regardless of
 * who they were, which meant the wizard was as hard to kill as the barbarian
 * and nobody had a spell. These go through the same builder and the same
 * derive() as the player, so their armour class, hit points, attacks and
 * spell slots come from the rules rather than from a guess.
 */
interface Loadout {
  classId: string; speciesId: string; backgroundId: string;
  scores: Record<Ability, number>;
  increase: Partial<Record<Ability, number>>;
  skills: Skill[];
  feat: string;
  masteries: Mastery[];
  armor?: string;
  shield?: boolean;
  weapons: string[];
}

const LOADOUTS: Record<string, Loadout> = {
  brakka: {
    classId: 'barbarian', speciesId: 'orc', backgroundId: 'soldier',
    scores: { str: 15, dex: 13, con: 14, int: 8, wis: 12, cha: 10 },
    increase: { str: 2, con: 1 },
    skills: ['athletics', 'intimidation'], feat: 'savage_attacker',
    masteries: ['cleave', 'topple'], weapons: ['greataxe', 'handaxe'],
  },
  veladrin: {
    classId: 'wizard', speciesId: 'human', backgroundId: 'sage',
    scores: { str: 8, dex: 14, con: 13, int: 15, wis: 12, cha: 10 },
    increase: { int: 2, con: 1 },
    skills: ['arcana', 'investigation'], feat: 'magic_initiate_wizard',
    masteries: [], weapons: ['quarterstaff', 'dagger'],
  },
  pell: {
    classId: 'rogue', speciesId: 'halfling', backgroundId: 'criminal',
    scores: { str: 8, dex: 15, con: 13, int: 14, wis: 12, cha: 10 },
    increase: { dex: 2, con: 1 },
    skills: ['acrobatics', 'deception', 'perception', 'sleight_of_hand'],
    feat: 'alert', masteries: ['vex', 'nick'],
    armor: 'leather', weapons: ['shortsword', 'dagger', 'shortbow'],
  },
  ysolde: {
    classId: 'cleric', speciesId: 'human', backgroundId: 'acolyte',
    scores: { str: 13, dex: 10, con: 14, int: 12, wis: 15, cha: 8 },
    increase: { wis: 2, int: 1 },
    skills: ['insight', 'religion'], feat: 'magic_initiate_cleric',
    masteries: [], armor: 'chain_shirt', shield: true, weapons: ['mace'],
  },
};

export function companionBuild(card: CompanionCard, level: number): CharacterBuild {
  const l = LOADOUTS[card.id];
  if (!l) {
    // Unknown companion: a plain, legal level appropriate fighter rather than
    // a crash or an invented profile.
    return {
      ...emptyBuild(), id: card.id, name: card.name, pronouns: card.pronouns,
      classId: 'fighter', speciesId: 'human', backgroundId: 'soldier', level,
      baseScores: { str: 15, dex: 13, con: 14, int: 10, wis: 12, cha: 8 },
      backgroundIncrease: { str: 2, con: 1 },
      classSkills: ['athletics', 'perception'], originFeatId: 'savage_attacker',
      weaponMasteries: ['topple'], equippedArmorId: 'chain_shirt',
      equippedWeaponIds: ['longsword'], scoreMethod: 'standard_array',
    };
  }
  return {
    ...emptyBuild(),
    id: card.id, name: card.name, pronouns: card.pronouns, level,
    classId: l.classId, speciesId: l.speciesId, backgroundId: l.backgroundId,
    speciesChoice: l.speciesId === 'elf' ? 'wood' : undefined,
    scoreMethod: 'standard_array',
    baseScores: l.scores, backgroundIncrease: l.increase,
    classSkills: l.skills, originFeatId: l.feat,
    weaponMasteries: l.masteries,
    equippedArmorId: l.armor, hasShield: !!l.shield,
    equippedWeaponIds: l.weapons,
  };
}
