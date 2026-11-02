/**
 * The 4 backgrounds of SRD 5.2.1. In the 2024 rules the background is where your
 * ability score increases and your Origin feat come from, not your species.
 */
import type { Ability, Skill } from '@/engine/types';

export interface Background {
  id: string;
  name: string;
  /** Exactly three abilities; the player spends +2/+1 or +1/+1/+1 among them. */
  abilities: [Ability, Ability, Ability];
  originFeat: string;
  skills: [Skill, Skill];
  toolProficiency: string;
  equipment: { option: 'A' | 'B'; items: string[]; gold: number }[];
  description: string;
}

export const BACKGROUNDS: Background[] = [
  {
    id: 'acolyte', name: 'Acolyte',
    abilities: ['int', 'wis', 'cha'],
    originFeat: 'magic_initiate_cleric',
    skills: ['insight', 'religion'],
    toolProficiency: 'Calligrapher’s Supplies',
    equipment: [
      { option: 'A', items: ['Calligrapher’s Supplies', 'Book (prayers)', 'Holy Symbol', 'Parchment (10 sheets)', 'Robe'], gold: 8 },
      { option: 'B', items: [], gold: 50 },
    ],
    description: 'You devoted yourself to service in a temple, and learned sacred rites and the care of a congregation.',
  },
  {
    id: 'criminal', name: 'Criminal',
    abilities: ['dex', 'con', 'int'],
    originFeat: 'alert',
    skills: ['sleight_of_hand', 'stealth'],
    toolProficiency: 'Thieves’ Tools',
    equipment: [
      { option: 'A', items: ['Dagger (2)', 'Thieves’ Tools', 'Crowbar', 'Pouch (2)', 'Traveler’s Clothes'], gold: 16 },
      { option: 'B', items: [], gold: 50 },
    ],
    description: 'You learned your trade in the shadows, and you know how a city breathes after dark.',
  },
  {
    id: 'sage', name: 'Sage',
    abilities: ['con', 'int', 'wis'],
    originFeat: 'magic_initiate_wizard',
    skills: ['arcana', 'history'],
    toolProficiency: 'Calligrapher’s Supplies',
    equipment: [
      { option: 'A', items: ['Quarterstaff', 'Calligrapher’s Supplies', 'Book (history)', 'Parchment (8 sheets)', 'Robe'], gold: 8 },
      { option: 'B', items: [], gold: 50 },
    ],
    description: 'You spent your formative years in libraries and lecture halls, chasing an answer nobody else wanted.',
  },
  {
    id: 'soldier', name: 'Soldier',
    abilities: ['str', 'dex', 'con'],
    originFeat: 'savage_attacker',
    skills: ['athletics', 'intimidation'],
    toolProficiency: 'Gaming Set (choose one)',
    equipment: [
      { option: 'A', items: ['Spear', 'Shortbow', 'Arrows (20)', 'Gaming Set', 'Healer’s Kit', 'Quiver', 'Traveler’s Clothes'], gold: 14 },
      { option: 'B', items: [], gold: 50 },
    ],
    description: 'You trained as a soldier and learned what a line of people holding spears is actually for.',
  },
];

export const BACKGROUNDS_BY_ID = Object.fromEntries(BACKGROUNDS.map((b) => [b.id, b]));
