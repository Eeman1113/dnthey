/** Weapons, armor and the 2024 Weapon Mastery properties (SRD 5.2.1). */
import type { DamageType } from '@/engine/types';

/** The eight mastery properties introduced in the 2024 rules. */
export const MASTERIES = ['cleave', 'graze', 'nick', 'push', 'sap', 'slow', 'topple', 'vex'] as const;
export type Mastery = (typeof MASTERIES)[number];

export const MASTERY_TEXT: Record<Mastery, string> = {
  cleave: 'If you hit a creature with a melee attack, you can make a single attack against a second creature within 5 feet of the first that is also within your reach. On a hit, the second creature takes the weapon’s damage but you do not add your ability modifier unless it is negative. Once per turn.',
  graze: 'If your attack roll misses, you can deal damage to the target equal to the ability modifier you used for the attack roll. This damage is the same type as the weapon’s and cannot be increased except by raising the modifier.',
  nick: 'When you make the extra attack of the Light property, you can make it as part of the Attack action instead of as a Bonus Action. Once per turn.',
  push: 'If you hit a creature, you can push it up to 10 feet straight away from yourself if it is Large or smaller.',
  sap: 'If you hit a creature, that creature has Disadvantage on its next attack roll before the start of your next turn.',
  slow: 'If you hit a creature and deal damage, you can reduce its Speed by 10 feet until the start of your next turn. If the creature is hit more than once, the reduction does not exceed 10 feet.',
  topple: 'If you hit a creature, you can force it to make a Constitution saving throw (DC 8 plus your ability modifier and Proficiency Bonus). On a failure, it has the Prone condition.',
  vex: 'If you hit a creature and deal damage, you have Advantage on your next attack roll against that creature before the end of your next turn.',
};

export type WeaponProperty =
  | 'ammunition' | 'finesse' | 'heavy' | 'light' | 'loading' | 'range'
  | 'reach' | 'thrown' | 'two_handed' | 'versatile';

export interface Weapon {
  id: string;
  name: string;
  category: 'simple' | 'martial';
  kind: 'melee' | 'ranged';
  cost: number;           // in gp
  damage: string;         // e.g. "1d8"
  damageType: DamageType;
  weight: number;
  properties: WeaponProperty[];
  versatileDamage?: string;
  range?: [number, number];
  mastery: Mastery;
}

export const WEAPONS: Weapon[] = [
  // Simple melee
  { id: 'club', name: 'Club', category: 'simple', kind: 'melee', cost: 0.1, damage: '1d4', damageType: 'bludgeoning', weight: 2, properties: ['light'], mastery: 'slow' },
  { id: 'dagger', name: 'Dagger', category: 'simple', kind: 'melee', cost: 2, damage: '1d4', damageType: 'piercing', weight: 1, properties: ['finesse', 'light', 'thrown'], range: [20, 60], mastery: 'nick' },
  { id: 'greatclub', name: 'Greatclub', category: 'simple', kind: 'melee', cost: 0.2, damage: '1d8', damageType: 'bludgeoning', weight: 10, properties: ['two_handed'], mastery: 'push' },
  { id: 'handaxe', name: 'Handaxe', category: 'simple', kind: 'melee', cost: 5, damage: '1d6', damageType: 'slashing', weight: 2, properties: ['light', 'thrown'], range: [20, 60], mastery: 'vex' },
  { id: 'javelin', name: 'Javelin', category: 'simple', kind: 'melee', cost: 0.5, damage: '1d6', damageType: 'piercing', weight: 2, properties: ['thrown'], range: [30, 120], mastery: 'slow' },
  { id: 'light_hammer', name: 'Light Hammer', category: 'simple', kind: 'melee', cost: 2, damage: '1d4', damageType: 'bludgeoning', weight: 2, properties: ['light', 'thrown'], range: [20, 60], mastery: 'nick' },
  { id: 'mace', name: 'Mace', category: 'simple', kind: 'melee', cost: 5, damage: '1d6', damageType: 'bludgeoning', weight: 4, properties: [], mastery: 'sap' },
  { id: 'quarterstaff', name: 'Quarterstaff', category: 'simple', kind: 'melee', cost: 0.2, damage: '1d6', damageType: 'bludgeoning', weight: 4, properties: ['versatile'], versatileDamage: '1d8', mastery: 'topple' },
  { id: 'sickle', name: 'Sickle', category: 'simple', kind: 'melee', cost: 1, damage: '1d4', damageType: 'slashing', weight: 2, properties: ['light'], mastery: 'nick' },
  { id: 'spear', name: 'Spear', category: 'simple', kind: 'melee', cost: 1, damage: '1d6', damageType: 'piercing', weight: 3, properties: ['thrown', 'versatile'], versatileDamage: '1d8', range: [20, 60], mastery: 'sap' },
  // Simple ranged
  { id: 'dart', name: 'Dart', category: 'simple', kind: 'ranged', cost: 0.05, damage: '1d4', damageType: 'piercing', weight: 0.25, properties: ['finesse', 'thrown'], range: [20, 60], mastery: 'vex' },
  { id: 'light_crossbow', name: 'Light Crossbow', category: 'simple', kind: 'ranged', cost: 25, damage: '1d8', damageType: 'piercing', weight: 5, properties: ['ammunition', 'loading', 'two_handed'], range: [80, 320], mastery: 'slow' },
  { id: 'shortbow', name: 'Shortbow', category: 'simple', kind: 'ranged', cost: 25, damage: '1d6', damageType: 'piercing', weight: 2, properties: ['ammunition', 'two_handed'], range: [80, 320], mastery: 'vex' },
  { id: 'sling', name: 'Sling', category: 'simple', kind: 'ranged', cost: 0.1, damage: '1d4', damageType: 'bludgeoning', weight: 0, properties: ['ammunition'], range: [30, 120], mastery: 'slow' },
  // Martial melee
  { id: 'battleaxe', name: 'Battleaxe', category: 'martial', kind: 'melee', cost: 10, damage: '1d8', damageType: 'slashing', weight: 4, properties: ['versatile'], versatileDamage: '1d10', mastery: 'topple' },
  { id: 'flail', name: 'Flail', category: 'martial', kind: 'melee', cost: 10, damage: '1d8', damageType: 'bludgeoning', weight: 2, properties: [], mastery: 'sap' },
  { id: 'glaive', name: 'Glaive', category: 'martial', kind: 'melee', cost: 20, damage: '1d10', damageType: 'slashing', weight: 6, properties: ['heavy', 'reach', 'two_handed'], mastery: 'graze' },
  { id: 'greataxe', name: 'Greataxe', category: 'martial', kind: 'melee', cost: 30, damage: '1d12', damageType: 'slashing', weight: 7, properties: ['heavy', 'two_handed'], mastery: 'cleave' },
  { id: 'greatsword', name: 'Greatsword', category: 'martial', kind: 'melee', cost: 50, damage: '2d6', damageType: 'slashing', weight: 6, properties: ['heavy', 'two_handed'], mastery: 'graze' },
  { id: 'halberd', name: 'Halberd', category: 'martial', kind: 'melee', cost: 20, damage: '1d10', damageType: 'slashing', weight: 6, properties: ['heavy', 'reach', 'two_handed'], mastery: 'cleave' },
  { id: 'longsword', name: 'Longsword', category: 'martial', kind: 'melee', cost: 15, damage: '1d8', damageType: 'slashing', weight: 3, properties: ['versatile'], versatileDamage: '1d10', mastery: 'sap' },
  { id: 'maul', name: 'Maul', category: 'martial', kind: 'melee', cost: 10, damage: '2d6', damageType: 'bludgeoning', weight: 10, properties: ['heavy', 'two_handed'], mastery: 'topple' },
  { id: 'morningstar', name: 'Morningstar', category: 'martial', kind: 'melee', cost: 15, damage: '1d8', damageType: 'piercing', weight: 4, properties: [], mastery: 'sap' },
  { id: 'rapier', name: 'Rapier', category: 'martial', kind: 'melee', cost: 25, damage: '1d8', damageType: 'piercing', weight: 2, properties: ['finesse'], mastery: 'vex' },
  { id: 'scimitar', name: 'Scimitar', category: 'martial', kind: 'melee', cost: 25, damage: '1d6', damageType: 'slashing', weight: 3, properties: ['finesse', 'light'], mastery: 'nick' },
  { id: 'shortsword', name: 'Shortsword', category: 'martial', kind: 'melee', cost: 10, damage: '1d6', damageType: 'piercing', weight: 2, properties: ['finesse', 'light'], mastery: 'vex' },
  { id: 'trident', name: 'Trident', category: 'martial', kind: 'melee', cost: 5, damage: '1d8', damageType: 'piercing', weight: 4, properties: ['thrown', 'versatile'], versatileDamage: '1d10', range: [20, 60], mastery: 'topple' },
  { id: 'warhammer', name: 'Warhammer', category: 'martial', kind: 'melee', cost: 15, damage: '1d8', damageType: 'bludgeoning', weight: 5, properties: ['versatile'], versatileDamage: '1d10', mastery: 'push' },
  // Martial ranged
  { id: 'heavy_crossbow', name: 'Heavy Crossbow', category: 'martial', kind: 'ranged', cost: 50, damage: '1d10', damageType: 'piercing', weight: 18, properties: ['ammunition', 'heavy', 'loading', 'two_handed'], range: [100, 400], mastery: 'push' },
  { id: 'longbow', name: 'Longbow', category: 'martial', kind: 'ranged', cost: 50, damage: '1d8', damageType: 'piercing', weight: 2, properties: ['ammunition', 'heavy', 'two_handed'], range: [150, 600], mastery: 'slow' },
];

export const WEAPONS_BY_ID = Object.fromEntries(WEAPONS.map((w) => [w.id, w]));

export interface Armor {
  id: string;
  name: string;
  category: 'light' | 'medium' | 'heavy' | 'shield';
  cost: number;
  baseAc: number;
  /** Medium armor caps the Dex bonus at +2; heavy adds none. */
  dexCap: number | null;
  strengthRequirement?: number;
  stealthDisadvantage: boolean;
  weight: number;
}

export const ARMOR: Armor[] = [
  { id: 'padded', name: 'Padded Armor', category: 'light', cost: 5, baseAc: 11, dexCap: null, stealthDisadvantage: true, weight: 8 },
  { id: 'leather', name: 'Leather Armor', category: 'light', cost: 10, baseAc: 11, dexCap: null, stealthDisadvantage: false, weight: 10 },
  { id: 'studded_leather', name: 'Studded Leather Armor', category: 'light', cost: 45, baseAc: 12, dexCap: null, stealthDisadvantage: false, weight: 13 },
  { id: 'hide', name: 'Hide Armor', category: 'medium', cost: 10, baseAc: 12, dexCap: 2, stealthDisadvantage: false, weight: 12 },
  { id: 'chain_shirt', name: 'Chain Shirt', category: 'medium', cost: 50, baseAc: 13, dexCap: 2, stealthDisadvantage: false, weight: 20 },
  { id: 'scale_mail', name: 'Scale Mail', category: 'medium', cost: 50, baseAc: 14, dexCap: 2, stealthDisadvantage: true, weight: 45 },
  { id: 'breastplate', name: 'Breastplate', category: 'medium', cost: 400, baseAc: 14, dexCap: 2, stealthDisadvantage: false, weight: 20 },
  { id: 'half_plate', name: 'Half Plate Armor', category: 'medium', cost: 750, baseAc: 15, dexCap: 2, stealthDisadvantage: true, weight: 40 },
  { id: 'ring_mail', name: 'Ring Mail', category: 'heavy', cost: 30, baseAc: 14, dexCap: 0, stealthDisadvantage: true, weight: 40 },
  { id: 'chain_mail', name: 'Chain Mail', category: 'heavy', cost: 75, baseAc: 16, dexCap: 0, strengthRequirement: 13, stealthDisadvantage: true, weight: 55 },
  { id: 'splint', name: 'Splint Armor', category: 'heavy', cost: 200, baseAc: 17, dexCap: 0, strengthRequirement: 15, stealthDisadvantage: true, weight: 60 },
  { id: 'plate', name: 'Plate Armor', category: 'heavy', cost: 1500, baseAc: 18, dexCap: 0, strengthRequirement: 15, stealthDisadvantage: true, weight: 65 },
  { id: 'shield', name: 'Shield', category: 'shield', cost: 10, baseAc: 2, dexCap: null, stealthDisadvantage: false, weight: 6 },
];

export const ARMOR_BY_ID = Object.fromEntries(ARMOR.map((a) => [a.id, a]));
