/**
 * The 9 species of SRD 5.2.1 (CC BY 4.0, Wizards of the Coast).
 * 2024 rules: species grant traits ONLY — no ability score bonuses (those come from
 * background) and no languages (chosen separately).
 */
import type { Size } from '@/engine/types';

export interface SpeciesTrait { name: string; text: string }

export interface Species {
  id: string;
  name: string;
  /** Creature type is always Humanoid for player species in the SRD. */
  size: Size | { choice: Size[] };
  speed: number;
  traits: SpeciesTrait[];
  /** Species that require the player to pick a sub-option at creation. */
  choice?: { id: string; label: string; options: { id: string; name: string; text: string }[] };
}

export const SPECIES: Species[] = [
  {
    id: 'dragonborn', name: 'Dragonborn', size: 'medium', speed: 30,
    traits: [
      { name: 'Draconic Ancestry', text: 'Your lineage stems from a dragon progenitor, which determines your Breath Weapon and Damage Resistance.' },
      { name: 'Breath Weapon', text: 'When you take the Attack action on your turn, you can replace one attack with an exhalation in a 15-foot Cone or a 30-foot Line that is 5 feet wide. Each creature in that area makes a Dexterity saving throw (DC 8 plus your Constitution modifier and Proficiency Bonus), taking 1d10 damage of your ancestry type on a failed save and half as much on a success. The damage increases by 1d10 at character levels 5, 11, and 17. You use this a number of times equal to your Proficiency Bonus, regaining all uses on a Long Rest.' },
      { name: 'Damage Resistance', text: 'You have Resistance to the damage type determined by your Draconic Ancestry.' },
      { name: 'Darkvision', text: 'You have Darkvision with a range of 60 feet.' },
      { name: 'Draconic Flight', text: 'At character level 5, you can channel draconic magic to give yourself temporary flight. As a Bonus Action, you sprout spectral wings for 10 minutes, gaining a Fly Speed equal to your Speed. Once used, you cannot do so again until you finish a Long Rest.' },
    ],
    choice: {
      id: 'ancestry', label: 'Draconic Ancestry',
      options: [
        { id: 'black', name: 'Black (Acid)', text: 'Acid damage and resistance.' },
        { id: 'blue', name: 'Blue (Lightning)', text: 'Lightning damage and resistance.' },
        { id: 'brass', name: 'Brass (Fire)', text: 'Fire damage and resistance.' },
        { id: 'bronze', name: 'Bronze (Lightning)', text: 'Lightning damage and resistance.' },
        { id: 'copper', name: 'Copper (Acid)', text: 'Acid damage and resistance.' },
        { id: 'gold', name: 'Gold (Fire)', text: 'Fire damage and resistance.' },
        { id: 'green', name: 'Green (Poison)', text: 'Poison damage and resistance.' },
        { id: 'red', name: 'Red (Fire)', text: 'Fire damage and resistance.' },
        { id: 'silver', name: 'Silver (Cold)', text: 'Cold damage and resistance.' },
        { id: 'white', name: 'White (Cold)', text: 'Cold damage and resistance.' },
      ],
    },
  },
  {
    id: 'dwarf', name: 'Dwarf', size: 'medium', speed: 30,
    traits: [
      { name: 'Darkvision', text: 'You have Darkvision with a range of 120 feet.' },
      { name: 'Dwarven Resilience', text: 'You have Resistance to Poison damage. You also have Advantage on saving throws you make to avoid or end the Poisoned condition.' },
      { name: 'Dwarven Toughness', text: 'Your Hit Point maximum increases by 1, and it increases by 1 again whenever you gain a level.' },
      { name: 'Stonecunning', text: 'As a Bonus Action, you gain Tremorsense with a range of 60 feet for 10 minutes. You must be on a stone surface or touching one. You can use this a number of times equal to your Proficiency Bonus, regaining all uses on a Long Rest.' },
    ],
  },
  {
    id: 'elf', name: 'Elf', size: 'medium', speed: 30,
    traits: [
      { name: 'Darkvision', text: 'You have Darkvision with a range of 60 feet.' },
      { name: 'Elven Lineage', text: 'You are part of a lineage that grants you supernatural abilities.' },
      { name: 'Fey Ancestry', text: 'You have Advantage on saving throws you make to avoid or end the Charmed condition.' },
      { name: 'Keen Senses', text: 'You have proficiency in the Insight, Perception, or Survival skill.' },
      { name: 'Trance', text: 'You do not need to sleep, and magic cannot put you to sleep. You can finish a Long Rest in 4 hours if you spend those hours in a trancelike meditation.' },
    ],
    choice: {
      id: 'lineage', label: 'Elven Lineage',
      options: [
        { id: 'drow', name: 'Drow', text: 'Darkvision range becomes 120 feet. You know the Dancing Lights cantrip; at level 3 Faerie Fire, at level 5 Darkness, each once per Long Rest.' },
        { id: 'high', name: 'High Elf', text: 'You know the Prestidigitation cantrip and can swap it on a Long Rest; at level 3 Detect Magic, at level 5 Misty Step, each once per Long Rest.' },
        { id: 'wood', name: 'Wood Elf', text: 'Your Speed increases to 35 feet. You know the Druidcraft cantrip; at level 3 Longstrider, at level 5 Pass without Trace, each once per Long Rest.' },
      ],
    },
  },
  {
    id: 'gnome', name: 'Gnome', size: 'small', speed: 30,
    traits: [
      { name: 'Darkvision', text: 'You have Darkvision with a range of 60 feet.' },
      { name: 'Gnomish Cunning', text: 'You have Advantage on Intelligence, Wisdom, and Charisma saving throws.' },
      { name: 'Gnomish Lineage', text: 'You are part of a lineage that grants you supernatural abilities.' },
    ],
    choice: {
      id: 'lineage', label: 'Gnomish Lineage',
      options: [
        { id: 'forest', name: 'Forest Gnome', text: 'You know the Minor Illusion cantrip and always have the Speak with Animals spell prepared, castable without a spell slot a number of times equal to your Proficiency Bonus per Long Rest.' },
        { id: 'rock', name: 'Rock Gnome', text: 'You know the Mending and Prestidigitation cantrips. You can spend 10 minutes to create a Tiny clockwork device.' },
      ],
    },
  },
  {
    id: 'goliath', name: 'Goliath', size: 'medium', speed: 35,
    traits: [
      { name: 'Giant Ancestry', text: 'You are descended from giants. Choose one supernatural boon from your ancestry, usable a number of times equal to your Proficiency Bonus per Long Rest.' },
      { name: 'Large Form', text: 'Starting at character level 5, you can change your size to Large as a Bonus Action if you are in a big enough space, for 10 minutes. You have Advantage on Strength checks and your Speed increases by 10 feet. Once used, you cannot do so again until you finish a Long Rest.' },
      { name: 'Powerful Build', text: 'You have Advantage on any ability check you make to end the Grappled condition. You also count as one size larger when determining your carrying capacity.' },
    ],
    choice: {
      id: 'ancestry', label: 'Giant Ancestry',
      options: [
        { id: 'cloud', name: "Cloud's Jaunt", text: 'As a Bonus Action, magically teleport up to 30 feet to an unoccupied space you can see.' },
        { id: 'fire', name: "Fire's Burn", text: 'When you hit a target with an attack roll and deal damage, you can deal an extra 1d10 Fire damage.' },
        { id: 'frost', name: "Frost's Chill", text: 'When you hit a target with an attack roll and deal damage, you can deal an extra 1d6 Cold damage and reduce its Speed by 10 feet until the start of your next turn.' },
        { id: 'hill', name: "Hill's Tumble", text: 'When you hit a Large or smaller creature with an attack roll and deal damage, you can give that target the Prone condition.' },
        { id: 'stone', name: "Stone's Endurance", text: 'When you take damage, you can use your Reaction to roll 1d12, add your Constitution modifier, and reduce the damage by that total.' },
        { id: 'storm', name: "Storm's Thunder", text: 'When you take damage from a creature within 60 feet, you can use your Reaction to deal 1d8 Thunder damage to that creature.' },
      ],
    },
  },
  {
    id: 'halfling', name: 'Halfling', size: 'small', speed: 30,
    traits: [
      { name: 'Brave', text: 'You have Advantage on saving throws you make to avoid or end the Frightened condition.' },
      { name: 'Halfling Nimbleness', text: 'You can move through the space of any creature that is a size larger than you, but you cannot stop in that space.' },
      { name: 'Luck', text: 'When you roll a 1 on the d20 of a D20 Test, you can reroll the die and must use the new roll.' },
      { name: 'Naturally Stealthy', text: 'You can take the Hide action even when you are obscured only by a creature that is at least one size larger than you.' },
    ],
  },
  {
    id: 'human', name: 'Human', size: { choice: ['small', 'medium'] }, speed: 30,
    traits: [
      { name: 'Resourceful', text: 'You gain Heroic Inspiration whenever you finish a Long Rest.' },
      { name: 'Skillful', text: 'You gain proficiency in one skill of your choice.' },
      { name: 'Versatile', text: 'You gain an Origin feat of your choice.' },
    ],
  },
  {
    id: 'orc', name: 'Orc', size: 'medium', speed: 30,
    traits: [
      { name: 'Adrenaline Rush', text: 'You can take the Dash action as a Bonus Action. When you do so, you gain a number of Temporary Hit Points equal to your Proficiency Bonus. You can use this a number of times equal to your Proficiency Bonus, regaining all uses on a Short or Long Rest.' },
      { name: 'Darkvision', text: 'You have Darkvision with a range of 120 feet.' },
      { name: 'Relentless Endurance', text: 'When you are reduced to 0 Hit Points but not killed outright, you can drop to 1 Hit Point instead. Once used, you cannot do so again until you finish a Long Rest.' },
    ],
  },
  {
    id: 'tiefling', name: 'Tiefling', size: { choice: ['small', 'medium'] }, speed: 30,
    traits: [
      { name: 'Darkvision', text: 'You have Darkvision with a range of 60 feet.' },
      { name: 'Fiendish Legacy', text: 'You are the recipient of a legacy that grants you supernatural abilities.' },
      { name: 'Otherworldly Presence', text: 'You know the Thaumaturgy cantrip, cast with the spellcasting ability determined by your Fiendish Legacy.' },
    ],
    choice: {
      id: 'legacy', label: 'Fiendish Legacy',
      options: [
        { id: 'abyssal', name: 'Abyssal', text: 'Resistance to Poison damage. You know Poison Spray; at level 3 Ray of Sickness, at level 5 Hold Person, each once per Long Rest.' },
        { id: 'chthonic', name: 'Chthonic', text: 'Resistance to Necrotic damage. You know Chill Touch; at level 3 False Life, at level 5 Ray of Enfeeblement, each once per Long Rest.' },
        { id: 'infernal', name: 'Infernal', text: 'Resistance to Fire damage. You know Fire Bolt; at level 3 Hellish Rebuke, at level 5 Darkness, each once per Long Rest.' },
      ],
    },
  },
];

export const SPECIES_BY_ID = Object.fromEntries(SPECIES.map((s) => [s.id, s]));
