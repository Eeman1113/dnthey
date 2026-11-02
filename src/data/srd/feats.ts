/** Origin feats and fighting styles from SRD 5.2.1. */
export interface Feat {
  id: string;
  name: string;
  category: 'origin' | 'general' | 'fighting_style';
  text: string;
  /** Feats that grant a skill/tool/spell choice the builder must resolve. */
  grants?: string;
}

export const FEATS: Feat[] = [
  { id: 'alert', name: 'Alert', category: 'origin', text: 'You gain a bonus to Initiative equal to your Proficiency Bonus. You can also swap your Initiative with a willing ally in the same combat.' },
  { id: 'crafter', name: 'Crafter', category: 'origin', text: 'You gain proficiency with three Artisan’s Tools of your choice, get a 20% discount on nonmagical items, and can craft certain items faster.', grants: 'three artisan tool proficiencies' },
  { id: 'healer', name: 'Healer', category: 'origin', text: 'You can use a Healer’s Kit as a Utilize action to restore 1d6 plus the creature’s number of Hit Dice in Hit Points to a creature within 5 feet.' },
  { id: 'lucky', name: 'Lucky', category: 'origin', text: 'You have Luck Points equal to your Proficiency Bonus, which you can spend to give yourself Advantage on a D20 Test or impose Disadvantage on an attack roll against you. You regain them on a Long Rest.' },
  { id: 'magic_initiate_cleric', name: 'Magic Initiate (Cleric)', category: 'origin', text: 'You learn two cantrips and one level 1 spell from the Cleric spell list. You can cast the level 1 spell once per Long Rest without a spell slot, or using slots you have.', grants: 'two cleric cantrips and one level 1 cleric spell' },
  { id: 'magic_initiate_druid', name: 'Magic Initiate (Druid)', category: 'origin', text: 'You learn two cantrips and one level 1 spell from the Druid spell list. You can cast the level 1 spell once per Long Rest without a spell slot, or using slots you have.', grants: 'two druid cantrips and one level 1 druid spell' },
  { id: 'magic_initiate_wizard', name: 'Magic Initiate (Wizard)', category: 'origin', text: 'You learn two cantrips and one level 1 spell from the Wizard spell list. You can cast the level 1 spell once per Long Rest without a spell slot, or using slots you have.', grants: 'two wizard cantrips and one level 1 wizard spell' },
  { id: 'musician', name: 'Musician', category: 'origin', text: 'You gain proficiency with three Musical Instruments. As you finish a Short or Long Rest, you can play a song and give Heroic Inspiration to allies who hear it, up to your Proficiency Bonus.', grants: 'three instrument proficiencies' },
  { id: 'savage_attacker', name: 'Savage Attacker', category: 'origin', text: 'Once per turn when you hit with a weapon, you can roll the weapon’s damage dice twice and use either roll.' },
  { id: 'skilled', name: 'Skilled', category: 'origin', text: 'You gain proficiency in any combination of three skills or tools of your choice.', grants: 'three skill or tool proficiencies' },
  { id: 'tavern_brawler', name: 'Tavern Brawler', category: 'origin', text: 'Your Unarmed Strike deals 1d4 damage, you can reroll a 1 on that damage once per turn, you can push a creature 5 feet when you hit with an Unarmed Strike, and you gain proficiency with improvised weapons.' },
  { id: 'tough', name: 'Tough', category: 'origin', text: 'Your Hit Point maximum increases by an amount equal to twice your character level. Whenever you gain a level thereafter, it increases by an additional 2.' },

  { id: 'ability_score_improvement', name: 'Ability Score Improvement', category: 'general', text: 'Increase one ability score by 2, or two ability scores by 1 each, to a maximum of 20.' },
  { id: 'grappler', name: 'Grappler', category: 'general', text: 'You have Advantage on attack rolls against a creature Grappled by you, and you can move a creature Grappled by you without the usual speed penalty.' },
  { id: 'great_weapon_master', name: 'Great Weapon Master', category: 'general', text: 'When you score a Critical Hit or reduce a creature to 0 Hit Points with a melee weapon with the Heavy property, you can make one attack with that weapon as a Bonus Action.' },
  { id: 'sharpshooter', name: 'Sharpshooter', category: 'general', text: 'Attacking at Long Range does not impose Disadvantage, and your ranged attacks with weapons ignore Half Cover and Three-Quarters Cover.' },
  { id: 'war_caster', name: 'War Caster', category: 'general', text: 'You have Advantage on Constitution saving throws to maintain Concentration, can perform somatic components with weapons in hand, and can cast a spell as an Opportunity Attack.' },

  { id: 'style_archery', name: 'Fighting Style: Archery', category: 'fighting_style', text: 'You gain a +2 bonus to attack rolls you make with Ranged weapons.' },
  { id: 'style_defense', name: 'Fighting Style: Defense', category: 'fighting_style', text: 'While you are wearing Light, Medium, or Heavy armor, you gain a +1 bonus to Armor Class.' },
  { id: 'style_dueling', name: 'Fighting Style: Dueling', category: 'fighting_style', text: 'When you are wielding a Melee weapon in one hand and no other weapons, you gain a +2 bonus to damage rolls with that weapon.' },
  { id: 'style_great_weapon', name: 'Fighting Style: Great Weapon Fighting', category: 'fighting_style', text: 'When you roll damage for a Melee weapon with the Two-Handed or Versatile property, you can treat any roll of 1 or 2 on a damage die as a 3.' },
];

export const FEATS_BY_ID = Object.fromEntries(FEATS.map((f) => [f.id, f]));
export const ORIGIN_FEATS = FEATS.filter((f) => f.category === 'origin');
