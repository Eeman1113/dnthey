/**
 * The 12 classes of SRD 5.2.1 with one subclass each.
 * Level progression is modelled to 20; features are listed where they change play.
 */
import type { Ability, Skill } from '@/engine/types';

export type Caster = 'full' | 'half' | 'third' | 'warlock' | 'none';

export interface ClassFeature { level: number; name: string; text: string }

export interface CharClass {
  id: string;
  name: string;
  hitDie: 6 | 8 | 10 | 12;
  primary: Ability[];
  savingThrows: [Ability, Ability];
  /** Number of skills chosen from `skillChoices` at level 1. */
  skillCount: number;
  skillChoices: Skill[];
  armor: string[];
  weapons: string[];
  caster: Caster;
  spellcastingAbility?: Ability;
  /** 2024: these classes get Weapon Mastery at level 1. */
  weaponMasteryCount?: number;
  subclassName: string;
  subclassLevel: number;
  /** One line on what it actually feels like to play. Shown on the class card. */
  description: string;
  /** The fantasy, in a few words, the hook under the name. */
  tagline: string;
  startingEquipment: { option: 'A' | 'B'; items: string[]; gold: number }[];
  features: ClassFeature[];
}

export const CLASSES: CharClass[] = [
  {
    id: 'barbarian', name: 'Barbarian', hitDie: 12, primary: ['str'], savingThrows: ['str', 'con'],
    skillCount: 2, skillChoices: ['animal_handling', 'athletics', 'intimidation', 'nature', 'perception', 'survival'],
    armor: ['Light', 'Medium', 'Shields'], weapons: ['Simple', 'Martial'], caster: 'none',
    weaponMasteryCount: 2, subclassName: 'Path of the Berserker', subclassLevel: 3,
    tagline: 'Rage into the thick of it and refuse to go down',
    description: 'You run at the problem. Huge hit points, damage resistance while raging, and the best survivability in the game, at the cost of subtlety and spells.',
    startingEquipment: [
      { option: 'A', items: ['Greataxe', 'Handaxe (4)', 'Explorer’s Pack'], gold: 15 },
      { option: 'B', items: [], gold: 75 },
    ],
    features: [
      { level: 1, name: 'Rage', text: 'As a Bonus Action you enter a Rage for 10 minutes, gaining damage resistance to Bludgeoning, Piercing, and Slashing damage, a bonus to Strength-based damage rolls, Advantage on Strength checks and saving throws, and you cannot cast or concentrate on spells.' },
      { level: 1, name: 'Unarmored Defense', text: 'While not wearing armor, your base Armor Class equals 10 plus your Dexterity and Constitution modifiers. You can use a Shield.' },
      { level: 1, name: 'Weapon Mastery', text: 'You can use the mastery properties of two kinds of weapons of your choice with which you have proficiency.' },
      { level: 2, name: 'Danger Sense', text: 'You have Advantage on Dexterity saving throws unless you have the Incapacitated condition.' },
      { level: 2, name: 'Reckless Attack', text: 'You can throw aside all concern for defense to attack with fierce desperation, gaining Advantage on Strength-based attack rolls this turn but giving attacks against you Advantage until your next turn.' },
      { level: 5, name: 'Extra Attack', text: 'You can attack twice instead of once whenever you take the Attack action on your turn.' },
      { level: 5, name: 'Fast Movement', text: 'Your Speed increases by 10 feet while you are not wearing Heavy armor.' },
    ],
  },
  {
    id: 'bard', name: 'Bard', hitDie: 8, primary: ['cha'], savingThrows: ['dex', 'cha'],
    skillCount: 3, skillChoices: ['acrobatics', 'animal_handling', 'arcana', 'athletics', 'deception', 'history', 'insight', 'intimidation', 'investigation', 'medicine', 'nature', 'perception', 'performance', 'persuasion', 'religion', 'sleight_of_hand', 'stealth', 'survival'],
    armor: ['Light'], weapons: ['Simple'], caster: 'full', spellcastingAbility: 'cha',
    subclassName: 'College of Lore', subclassLevel: 3,
    tagline: 'Talk your way in, then make everyone else better at their job',
    description: "A full spellcaster who is also the party's face. Bardic Inspiration hands out bonus dice, and you end up passable at nearly every skill in the game.",
    startingEquipment: [
      { option: 'A', items: ['Leather Armor', 'Dagger', 'Musical Instrument', 'Entertainer’s Pack'], gold: 19 },
      { option: 'B', items: [], gold: 90 },
    ],
    features: [
      { level: 1, name: 'Bardic Inspiration', text: 'As a Bonus Action you give a creature a Bardic Inspiration die (d6), which it can add to one d20 Test. You have a number of uses equal to your Charisma modifier, regained on a Short or Long Rest.' },
      { level: 1, name: 'Spellcasting', text: 'You can cast Bard spells using Charisma as your spellcasting ability.' },
      { level: 2, name: 'Expertise', text: 'Choose two skill proficiencies; your Proficiency Bonus is doubled for ability checks using them.' },
      { level: 2, name: 'Jack of All Trades', text: 'You add half your Proficiency Bonus (round down) to any ability check you make that uses a skill you lack proficiency in.' },
      { level: 5, name: 'Font of Inspiration', text: 'You regain all expended uses of Bardic Inspiration on a Short or Long Rest, and can expend a spell slot to regain one use.' },
    ],
  },
  {
    id: 'cleric', name: 'Cleric', hitDie: 8, primary: ['wis'], savingThrows: ['wis', 'cha'],
    skillCount: 2, skillChoices: ['history', 'insight', 'medicine', 'persuasion', 'religion'],
    armor: ['Light', 'Medium', 'Shields'], weapons: ['Simple'], caster: 'full', spellcastingAbility: 'wis',
    subclassName: 'Life Domain', subclassLevel: 3,
    tagline: "Divine power, heavy armour, and the party's lifeline",
    description: 'You heal, you buff, you turn undead, and you can hold a front line. Prepared from the entire Cleric list each day, so you adapt to whatever is coming.',
    startingEquipment: [
      { option: 'A', items: ['Chain Shirt', 'Shield', 'Mace', 'Holy Symbol', 'Priest’s Pack'], gold: 7 },
      { option: 'B', items: [], gold: 110 },
    ],
    features: [
      { level: 1, name: 'Spellcasting', text: 'You can cast Cleric spells using Wisdom as your spellcasting ability. You prepare spells from the whole Cleric list.' },
      { level: 1, name: 'Divine Order', text: 'Choose Protector (Martial weapon and Heavy armor training) or Thaumaturge (an extra cantrip and a bonus to Arcana and Religion checks).' },
      { level: 2, name: 'Channel Divinity', text: 'You can channel divine energy to Turn Undead or to use Divine Spark to heal or harm a creature within 30 feet.' },
      { level: 5, name: 'Sear Undead', text: 'When you use Turn Undead, you deal Radiant damage to each undead that fails its saving throw.' },
    ],
  },
  {
    id: 'druid', name: 'Druid', hitDie: 8, primary: ['wis'], savingThrows: ['int', 'wis'],
    skillCount: 2, skillChoices: ['arcana', 'animal_handling', 'insight', 'medicine', 'nature', 'perception', 'religion', 'survival'],
    armor: ['Light', 'Shields'], weapons: ['Simple'], caster: 'full', spellcastingAbility: 'wis',
    subclassName: 'Circle of the Land', subclassLevel: 3,
    tagline: 'Nature magic, and the ability to become the animal',
    description: 'A full caster who turns into beasts with Wild Shape. Strong control and utility spells, and a second body to spend when things get physical.',
    startingEquipment: [
      { option: 'A', items: ['Leather Armor', 'Shield', 'Sickle', 'Druidic Focus (Quarterstaff)', 'Explorer’s Pack', 'Herbalism Kit'], gold: 9 },
      { option: 'B', items: [], gold: 50 },
    ],
    features: [
      { level: 1, name: 'Spellcasting', text: 'You can cast Druid spells using Wisdom as your spellcasting ability. You prepare spells from the whole Druid list.' },
      { level: 1, name: 'Druidic', text: 'You know Druidic, the secret language of druids, and can use it to leave hidden messages.' },
      { level: 1, name: 'Primal Order', text: 'Choose Magician (an extra cantrip and a bonus to Arcana and Nature checks) or Warden (Martial weapon and Medium armor training).' },
      { level: 2, name: 'Wild Shape', text: 'As a Bonus Action you can magically assume the shape of a Beast you have learned for this feature, a number of times equal to your Proficiency Bonus per Long Rest.' },
      { level: 2, name: 'Wild Companion', text: 'You can expend a spell slot to cast Find Familiar without material components; the familiar is a Fey.' },
      { level: 5, name: 'Wild Resurgence', text: 'Once per turn you can turn one unexpended Wild Shape use into a level 1 spell slot, or expend a slot to regain a Wild Shape use.' },
    ],
  },
  {
    id: 'fighter', name: 'Fighter', hitDie: 10, primary: ['str', 'dex'], savingThrows: ['str', 'con'],
    skillCount: 2, skillChoices: ['acrobatics', 'animal_handling', 'athletics', 'history', 'insight', 'intimidation', 'perception', 'persuasion', 'survival'],
    armor: ['Light', 'Medium', 'Heavy', 'Shields'], weapons: ['Simple', 'Martial'], caster: 'none',
    weaponMasteryCount: 3, subclassName: 'Champion', subclassLevel: 3,
    tagline: 'The most attacks, the most armour, the most second chances',
    description: 'The simplest class to pick up and the hardest to out-damage. Action Surge gives you an extra turn, Second Wind patches you up, and you get the widest weapon mastery.',
    startingEquipment: [
      { option: 'A', items: ['Chain Mail', 'Greatsword', 'Flail', 'Javelin (8)', 'Dungeoneer’s Pack'], gold: 4 },
      { option: 'B', items: [], gold: 155 },
    ],
    features: [
      { level: 1, name: 'Fighting Style', text: 'You gain a Fighting Style feat of your choice.' },
      { level: 1, name: 'Second Wind', text: 'As a Bonus Action you regain Hit Points equal to 1d10 plus your Fighter level, twice per Short or Long Rest.' },
      { level: 1, name: 'Weapon Mastery', text: 'You can use the mastery properties of three kinds of weapons of your choice with which you have proficiency.' },
      { level: 2, name: 'Action Surge', text: 'On your turn you can take one additional action, once per Short or Long Rest.' },
      { level: 2, name: 'Tactical Mind', text: 'When you fail an ability check, you can expend a use of Second Wind to add 1d10 to the roll.' },
      { level: 5, name: 'Extra Attack', text: 'You can attack twice instead of once whenever you take the Attack action on your turn.' },
      { level: 5, name: 'Tactical Shift', text: 'Whenever you activate Second Wind, you can move up to half your Speed without provoking Opportunity Attacks.' },
    ],
  },
  {
    id: 'monk', name: 'Monk', hitDie: 8, primary: ['dex', 'wis'], savingThrows: ['str', 'dex'],
    skillCount: 2, skillChoices: ['acrobatics', 'athletics', 'history', 'insight', 'religion', 'stealth'],
    armor: [], weapons: ['Simple', 'Martial weapons with the Light property'], caster: 'none',
    subclassName: 'Warrior of the Open Hand', subclassLevel: 3,
    tagline: 'Fists, speed, and a stunning strike nobody wants to fail',
    description: 'No armour and no weapons needed. You move faster than anyone, strike multiple times a turn, and spend Focus Points to stun, dodge, or dart across the battlefield.',
    startingEquipment: [
      { option: 'A', items: ['Spear', 'Dagger (5)', 'Artisan’s Tools or Musical Instrument', 'Explorer’s Pack'], gold: 11 },
      { option: 'B', items: [], gold: 50 },
    ],
    features: [
      { level: 1, name: 'Martial Arts', text: 'Your Unarmed Strikes use a d6 damage die, you can use Dexterity for Unarmed Strikes and Monk weapons, and you can make an Unarmed Strike as a Bonus Action.' },
      { level: 1, name: 'Unarmored Defense', text: 'While not wearing armor or wielding a Shield, your base Armor Class equals 10 plus your Dexterity and Wisdom modifiers.' },
      { level: 2, name: 'Monk’s Focus', text: 'You gain Focus Points equal to your Monk level, spent on Flurry of Blows, Patient Defense, and Step of the Wind. You regain them on a Short or Long Rest.' },
      { level: 2, name: 'Unarmored Movement', text: 'Your Speed increases by 10 feet while you are not wearing armor or wielding a Shield.' },
      { level: 2, name: 'Uncanny Metabolism', text: 'When you roll Initiative, you can regain all expended Focus Points and heal, once per Long Rest.' },
      { level: 5, name: 'Extra Attack', text: 'You can attack twice instead of once whenever you take the Attack action on your turn.' },
      { level: 5, name: 'Stunning Strike', text: 'Once per turn when you hit with a Monk weapon or Unarmed Strike, you can spend 1 Focus Point to force a Constitution save or inflict the Stunned condition until the start of your next turn.' },
    ],
  },
  {
    id: 'paladin', name: 'Paladin', hitDie: 10, primary: ['str', 'cha'], savingThrows: ['wis', 'cha'],
    skillCount: 2, skillChoices: ['athletics', 'insight', 'intimidation', 'medicine', 'persuasion', 'religion'],
    armor: ['Light', 'Medium', 'Heavy', 'Shields'], weapons: ['Simple', 'Martial'], caster: 'half', spellcastingAbility: 'cha',
    weaponMasteryCount: 2, subclassName: 'Oath of Devotion', subclassLevel: 3,
    tagline: 'Oath-bound, armoured, and able to burn spells into damage',
    description: 'A half caster who hits like a fighter. Lay On Hands heals the party out of combat, and Divine Smite turns a spell slot into a sudden pile of radiant damage.',
    startingEquipment: [
      { option: 'A', items: ['Chain Mail', 'Shield', 'Longsword', 'Javelin (6)', 'Holy Symbol', 'Priest’s Pack'], gold: 9 },
      { option: 'B', items: [], gold: 150 },
    ],
    features: [
      { level: 1, name: 'Lay On Hands', text: 'You have a pool of healing power equal to five times your Paladin level, which you can spend as a Bonus Action to restore Hit Points or cure the Poisoned condition.' },
      { level: 1, name: 'Spellcasting', text: 'You can cast Paladin spells using Charisma as your spellcasting ability.' },
      { level: 1, name: 'Weapon Mastery', text: 'You can use the mastery properties of two kinds of weapons of your choice with which you have proficiency.' },
      { level: 2, name: 'Fighting Style', text: 'You gain a Fighting Style feat of your choice.' },
      { level: 2, name: 'Paladin’s Smite', text: 'You always have Divine Smite prepared and can cast it once per Long Rest without a spell slot.' },
      { level: 5, name: 'Extra Attack', text: 'You can attack twice instead of once whenever you take the Attack action on your turn.' },
      { level: 5, name: 'Faithful Steed', text: 'You always have Find Steed prepared and can cast it once per Long Rest without a spell slot.' },
    ],
  },
  {
    id: 'ranger', name: 'Ranger', hitDie: 10, primary: ['dex', 'wis'], savingThrows: ['str', 'dex'],
    skillCount: 3, skillChoices: ['animal_handling', 'athletics', 'insight', 'investigation', 'nature', 'perception', 'stealth', 'survival'],
    armor: ['Light', 'Medium', 'Shields'], weapons: ['Simple', 'Martial'], caster: 'half', spellcastingAbility: 'wis',
    weaponMasteryCount: 2, subclassName: 'Hunter', subclassLevel: 3,
    tagline: "Tracker, skirmisher, and the party's answer to the wilderness",
    description: "A half caster built around Hunter's Mark and mobility. Strong skills, strong ranged damage, and the one who keeps the party alive between towns.",
    startingEquipment: [
      { option: 'A', items: ['Studded Leather Armor', 'Scimitar', 'Shortsword', 'Longbow', 'Arrows (20)', 'Quiver', 'Druidic Focus', 'Explorer’s Pack'], gold: 7 },
      { option: 'B', items: [], gold: 150 },
    ],
    features: [
      { level: 1, name: 'Favored Enemy', text: 'You always have the Hunter’s Mark spell prepared and can cast it without a spell slot a number of times per Long Rest based on your level.' },
      { level: 1, name: 'Spellcasting', text: 'You can cast Ranger spells using Wisdom as your spellcasting ability.' },
      { level: 1, name: 'Weapon Mastery', text: 'You can use the mastery properties of two kinds of weapons of your choice with which you have proficiency.' },
      { level: 2, name: 'Deft Explorer', text: 'You gain Expertise in one skill and learn two languages.' },
      { level: 2, name: 'Fighting Style', text: 'You gain a Fighting Style feat of your choice.' },
      { level: 5, name: 'Extra Attack', text: 'You can attack twice instead of once whenever you take the Attack action on your turn.' },
    ],
  },
  {
    id: 'rogue', name: 'Rogue', hitDie: 8, primary: ['dex'], savingThrows: ['dex', 'int'],
    skillCount: 4, skillChoices: ['acrobatics', 'athletics', 'deception', 'insight', 'intimidation', 'investigation', 'perception', 'performance', 'persuasion', 'sleight_of_hand', 'stealth'],
    armor: ['Light'], weapons: ['Simple', 'Martial weapons with the Finesse or Light property'], caster: 'none',
    weaponMasteryCount: 2, subclassName: 'Thief', subclassLevel: 3,
    tagline: 'Hit once, hit hard, and never be where the danger is',
    description: 'Sneak Attack puts all your damage in one precise strike. Expertise makes you the best in the party at a few chosen skills, and Cunning Action keeps you out of reach.',
    startingEquipment: [
      { option: 'A', items: ['Leather Armor', 'Dagger (2)', 'Shortsword', 'Shortbow', 'Arrows (20)', 'Quiver', 'Thieves’ Tools', 'Burglar’s Pack'], gold: 8 },
      { option: 'B', items: [], gold: 100 },
    ],
    features: [
      { level: 1, name: 'Expertise', text: 'Choose two skill proficiencies; your Proficiency Bonus is doubled for ability checks using them.' },
      { level: 1, name: 'Sneak Attack', text: 'Once per turn you can deal extra damage to one creature you hit with an attack roll if you have Advantage, or if an ally is within 5 feet of the target and you do not have Disadvantage. The extra damage is 1d6 at level 1, increasing as you level.' },
      { level: 1, name: 'Thieves’ Cant', text: 'You know Thieves’ Cant and one other language of your choice.' },
      { level: 1, name: 'Weapon Mastery', text: 'You can use the mastery properties of two kinds of weapons of your choice with which you have proficiency.' },
      { level: 2, name: 'Cunning Action', text: 'You can take the Dash, Disengage, or Hide action as a Bonus Action.' },
      { level: 5, name: 'Cunning Strike', text: 'When you deal Sneak Attack damage you can forgo some of it to add an effect such as Poison, Trip, or Withdraw.' },
      { level: 5, name: 'Uncanny Dodge', text: 'When a creature you can see hits you with an attack roll, you can use your Reaction to halve the damage.' },
    ],
  },
  {
    id: 'sorcerer', name: 'Sorcerer', hitDie: 6, primary: ['cha'], savingThrows: ['con', 'cha'],
    skillCount: 2, skillChoices: ['arcana', 'deception', 'insight', 'intimidation', 'persuasion', 'religion'],
    armor: [], weapons: ['Simple'], caster: 'full', spellcastingAbility: 'cha',
    subclassName: 'Draconic Sorcery', subclassLevel: 3,
    tagline: 'Raw innate magic, bent into new shapes mid-cast',
    description: 'A full caster with a smaller spell list but Metamagic: spend Sorcery Points to twin a spell, cast it without gestures, or push it further than it should go.',
    startingEquipment: [
      { option: 'A', items: ['Spear', 'Dagger (2)', 'Arcane Focus (crystal)', 'Dungeoneer’s Pack'], gold: 28 },
      { option: 'B', items: [], gold: 50 },
    ],
    features: [
      { level: 1, name: 'Spellcasting', text: 'You can cast Sorcerer spells using Charisma as your spellcasting ability.' },
      { level: 1, name: 'Innate Sorcery', text: 'As a Bonus Action you can unleash your innate magic for 1 minute, gaining a +1 bonus to your spell save DC and Advantage on Sorcerer spell attack rolls. Twice per Long Rest.' },
      { level: 2, name: 'Font of Magic', text: 'You have Sorcery Points equal to your Sorcerer level, which you can convert to and from spell slots.' },
      { level: 2, name: 'Metamagic', text: 'You learn two Metamagic options, such as Careful Spell or Twinned Spell, which you fuel with Sorcery Points.' },
      { level: 5, name: 'Sorcerous Restoration', text: 'When you finish a Short Rest you can regain Sorcery Points equal to half your Sorcerer level, once per Long Rest.' },
    ],
  },
  {
    id: 'warlock', name: 'Warlock', hitDie: 8, primary: ['cha'], savingThrows: ['wis', 'cha'],
    skillCount: 2, skillChoices: ['arcana', 'deception', 'history', 'intimidation', 'investigation', 'nature', 'religion'],
    armor: ['Light'], weapons: ['Simple'], caster: 'warlock', spellcastingAbility: 'cha',
    subclassName: 'Fiend Patron', subclassLevel: 3,
    tagline: 'A pact with something older, paid in favours',
    description: 'Few spell slots, but they come back on a short rest and always cast at the highest level. Eldritch Invocations let you build a very specific, very strange character.',
    startingEquipment: [
      { option: 'A', items: ['Leather Armor', 'Sickle', 'Dagger (2)', 'Arcane Focus (orb)', 'Book (occult lore)', 'Scholar’s Pack'], gold: 15 },
      { option: 'B', items: [], gold: 100 },
    ],
    features: [
      { level: 1, name: 'Eldritch Invocations', text: 'You learn invocations such as Pact of the Blade or Agonizing Blast, and can replace them as you level.' },
      { level: 1, name: 'Pact Magic', text: 'You can cast Warlock spells using Charisma. Your spell slots are all of the same level and you regain them on a Short or Long Rest.' },
      { level: 2, name: 'Magical Cunning', text: 'You can perform a 1-minute rite to regain expended Pact Magic spell slots, once per Long Rest.' },
      { level: 5, name: 'Eldritch Invocations', text: 'Your invocation options expand as your Warlock level increases.' },
    ],
  },
  {
    id: 'wizard', name: 'Wizard', hitDie: 6, primary: ['int'], savingThrows: ['int', 'wis'],
    skillCount: 2, skillChoices: ['arcana', 'history', 'insight', 'investigation', 'medicine', 'nature', 'religion'],
    armor: [], weapons: ['Simple'], caster: 'full', spellcastingAbility: 'int',
    subclassName: 'Evoker', subclassLevel: 3,
    tagline: 'The widest spell list in the game, written down and studied',
    description: 'A full caster with a spellbook that grows every level. Fragile in a fight, but given ten minutes and the right spell prepared, there is almost nothing you cannot solve.',
    startingEquipment: [
      { option: 'A', items: ['Quarterstaff', 'Arcane Focus (wand)', 'Robe', 'Spellbook', 'Scholar’s Pack'], gold: 5 },
      { option: 'B', items: [], gold: 55 },
    ],
    features: [
      { level: 1, name: 'Spellcasting', text: 'You can cast Wizard spells using Intelligence as your spellcasting ability, preparing them from your spellbook.' },
      { level: 1, name: 'Ritual Adept', text: 'You can cast any spell in your spellbook with the Ritual tag as a Ritual without preparing it.' },
      { level: 1, name: 'Arcane Recovery', text: 'Once per day when you finish a Short Rest, you can recover expended spell slots with a combined level equal to half your Wizard level (round up).' },
      { level: 2, name: 'Scholar', text: 'You gain Expertise in one skill from Arcana, History, Investigation, Medicine, Nature, or Religion.' },
      { level: 5, name: 'Memorize Spell', text: 'Whenever you finish a Short Rest, you can study your spellbook and replace one prepared spell with another.' },
    ],
  },
];

export const CLASSES_BY_ID = Object.fromEntries(CLASSES.map((c) => [c.id, c]));

/** Full-caster spell slot table (levels 1-20), SRD 5.2.1. */
export const FULL_CASTER_SLOTS: number[][] = [
  [2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 3, 1],
  [4, 3, 3, 3, 2], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1, 1], [4, 3, 3, 3, 3, 1, 1, 1, 1], [4, 3, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 2, 1, 1],
];

/** Half-casters (Paladin, Ranger) begin casting at level 2. */
export const HALF_CASTER_SLOTS: number[][] = [
  [], [2], [3], [3], [4, 2], [4, 2], [4, 3], [4, 3], [4, 3, 2], [4, 3, 2],
  [4, 3, 3], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 2],
  [4, 3, 3, 3, 1], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2], [4, 3, 3, 3, 2],
];

/** Warlock Pact Magic: [slotCount, slotLevel] by level. */
export const WARLOCK_SLOTS: [number, number][] = [
  [1, 1], [2, 1], [2, 2], [2, 2], [2, 3], [2, 3], [2, 4], [2, 4], [2, 5], [2, 5],
  [3, 5], [3, 5], [3, 5], [3, 5], [3, 5], [3, 5], [4, 5], [4, 5], [4, 5], [4, 5],
];

/** XP thresholds to reach each level (SRD 5.2.1). Index = level - 1. */
export const XP_THRESHOLDS = [
  0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000,
  85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000,
];

export function levelFromXp(xp: number): number {
  let lvl = 1;
  for (let i = 0; i < XP_THRESHOLDS.length; i++) if (xp >= XP_THRESHOLDS[i]!) lvl = i + 1;
  return lvl;
}
