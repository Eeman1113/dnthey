/**
 * Combat-relevant spells from SRD 5.2.1.
 *
 * Deliberately a subset: only spells whose effect this engine can resolve
 * honestly. A spell that needs positioning, concentration tracking across
 * scenes, or arbitrary narrative adjudication is left out rather than
 * half-implemented, because a spell that silently does nothing is worse than
 * a spell that is not offered.
 */
import type { Ability, DamageType } from '@/engine/types';

export type SpellEffect =
  /** Attack roll against AC, like a weapon. */
  | { kind: 'attack'; damage: string; damageType: DamageType }
  /** Target rolls a saving throw; half damage on a success unless noted. */
  | { kind: 'save'; ability: Ability; damage: string; damageType: DamageType; halfOnSave: boolean }
  /** Restores hit points to one ally. */
  | { kind: 'heal'; amount: string }
  /** Temporary hit points to the caster. */
  | { kind: 'tempHp'; amount: string };

export interface Spell {
  id: string;
  name: string;
  /** 0 is a cantrip and costs no slot. */
  level: number;
  classes: string[];
  effect: SpellEffect;
  /** Cantrip damage steps at character levels 5, 11 and 17. */
  scales?: boolean;
  text: string;
}

export const SPELLS: Spell[] = [
  // ---- cantrips, free to cast ----
  { id: 'fire-bolt', name: 'Fire Bolt', level: 0, classes: ['sorcerer', 'wizard'], scales: true,
    effect: { kind: 'attack', damage: '1d10', damageType: 'fire' },
    text: 'A mote of fire hurled at a target. On a hit, 1d10 fire damage.' },
  { id: 'ray-of-frost', name: 'Ray of Frost', level: 0, classes: ['sorcerer', 'wizard'], scales: true,
    effect: { kind: 'attack', damage: '1d8', damageType: 'cold' },
    text: 'A frigid beam. On a hit, 1d8 cold damage and the target’s speed drops by 10 feet.' },
  { id: 'sacred-flame', name: 'Sacred Flame', level: 0, classes: ['cleric'], scales: true,
    effect: { kind: 'save', ability: 'dex', damage: '1d8', damageType: 'radiant', halfOnSave: false },
    text: 'Radiance falls on the target. Dexterity save or 1d8 radiant damage. No damage on a success.' },
  { id: 'eldritch-blast', name: 'Eldritch Blast', level: 0, classes: ['warlock'], scales: true,
    effect: { kind: 'attack', damage: '1d10', damageType: 'force' },
    text: 'A beam of crackling energy. On a hit, 1d10 force damage.' },
  { id: 'vicious-mockery', name: 'Vicious Mockery', level: 0, classes: ['bard'], scales: true,
    effect: { kind: 'save', ability: 'wis', damage: '1d6', damageType: 'psychic', halfOnSave: false },
    text: 'An insult laced with magic. Wisdom save or 1d6 psychic damage and disadvantage on its next attack.' },
  { id: 'poison-spray', name: 'Poison Spray', level: 0, classes: ['druid', 'sorcerer', 'warlock', 'wizard'], scales: true,
    effect: { kind: 'save', ability: 'con', damage: '1d12', damageType: 'poison', halfOnSave: false },
    text: 'A puff of noxious gas. Constitution save or 1d12 poison damage.' },

  // ---- level 1 ----
  { id: 'magic-missile', name: 'Magic Missile', level: 1, classes: ['sorcerer', 'wizard'],
    effect: { kind: 'attack', damage: '3d4', damageType: 'force' },
    text: 'Three darts of force. They always hit, for 1d4 plus 1 each.' },
  { id: 'burning-hands', name: 'Burning Hands', level: 1, classes: ['sorcerer', 'wizard'],
    effect: { kind: 'save', ability: 'dex', damage: '3d6', damageType: 'fire', halfOnSave: true },
    text: 'A sheet of flame. Dexterity save for half of 3d6 fire damage.' },
  { id: 'guiding-bolt', name: 'Guiding Bolt', level: 1, classes: ['cleric'],
    effect: { kind: 'attack', damage: '4d6', damageType: 'radiant' },
    text: 'A flash of light. On a hit, 4d6 radiant damage and the next attack against it has advantage.' },
  { id: 'cure-wounds', name: 'Cure Wounds', level: 1, classes: ['bard', 'cleric', 'druid', 'paladin', 'ranger'],
    effect: { kind: 'heal', amount: '2d8' },
    text: 'A touch that closes wounds. Restores 2d8 hit points plus your spellcasting modifier.' },
  { id: 'false-life', name: 'False Life', level: 1, classes: ['sorcerer', 'wizard'],
    effect: { kind: 'tempHp', amount: '2d4' },
    text: 'A necromantic ward. Gain 2d4 plus 4 temporary hit points.' },
  { id: 'inflict-wounds', name: 'Inflict Wounds', level: 1, classes: ['cleric'],
    effect: { kind: 'attack', damage: '2d10', damageType: 'necrotic' },
    text: 'A withering touch. On a hit, 2d10 necrotic damage.' },
  { id: 'thunderwave', name: 'Thunderwave', level: 1, classes: ['bard', 'druid', 'sorcerer', 'wizard'],
    effect: { kind: 'save', ability: 'con', damage: '2d8', damageType: 'thunder', halfOnSave: true },
    text: 'A wave of force. Constitution save for half of 2d8 thunder damage, and it is pushed back.' },

  // ---- level 2 ----
  { id: 'scorching-ray', name: 'Scorching Ray', level: 2, classes: ['sorcerer', 'wizard'],
    effect: { kind: 'attack', damage: '6d6', damageType: 'fire' },
    text: 'Three rays of fire, 2d6 each on a hit.' },
  { id: 'shatter', name: 'Shatter', level: 2, classes: ['bard', 'sorcerer', 'warlock', 'wizard'],
    effect: { kind: 'save', ability: 'con', damage: '3d8', damageType: 'thunder', halfOnSave: true },
    text: 'A ringing noise. Constitution save for half of 3d8 thunder damage.' },
  { id: 'spiritual-weapon', name: 'Spiritual Weapon', level: 2, classes: ['cleric'],
    effect: { kind: 'attack', damage: '1d8', damageType: 'force' },
    text: 'A floating spectral weapon. On a hit, 1d8 force damage plus your spellcasting modifier.' },

  // ---- level 3 ----
  { id: 'fireball', name: 'Fireball', level: 3, classes: ['sorcerer', 'wizard'],
    effect: { kind: 'save', ability: 'dex', damage: '8d6', damageType: 'fire', halfOnSave: true },
    text: 'A roaring blast. Dexterity save for half of 8d6 fire damage.' },
  { id: 'lightning-bolt', name: 'Lightning Bolt', level: 3, classes: ['sorcerer', 'wizard'],
    effect: { kind: 'save', ability: 'dex', damage: '8d6', damageType: 'lightning', halfOnSave: true },
    text: 'A stroke of lightning. Dexterity save for half of 8d6 lightning damage.' },
  { id: 'healing-word-3', name: 'Mass Healing Word', level: 3, classes: ['bard', 'cleric'],
    effect: { kind: 'heal', amount: '2d4' },
    text: 'A word of restoration. Restores 2d4 hit points plus your spellcasting modifier.' },
];

export const SPELLS_BY_ID = Object.fromEntries(SPELLS.map((s) => [s.id, s]));

/** Cantrips gain a die at character levels 5, 11 and 17. */
export function cantripDice(base: string, level: number): string {
  const m = /^(\d+)d(\d+)$/.exec(base);
  if (!m) return base;
  const step = level >= 17 ? 3 : level >= 11 ? 2 : level >= 5 ? 1 : 0;
  return `${Number(m[1]) + step}d${m[2]}`;
}

/** What a character can actually cast, given their class and level. */
export function spellsFor(classId: string, level: number, maxSlotLevel: number): Spell[] {
  return SPELLS.filter((s) => s.classes.includes(classId) && (s.level === 0 || s.level <= maxSlotLevel))
    .map((s) => (s.level === 0 && s.scales
      ? { ...s, effect: scaleEffect(s.effect, level) }
      : s));
}

function scaleEffect(e: SpellEffect, level: number): SpellEffect {
  if (e.kind === 'attack') return { ...e, damage: cantripDice(e.damage, level) };
  if (e.kind === 'save') return { ...e, damage: cantripDice(e.damage, level) };
  return e;
}
