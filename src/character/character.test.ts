import { describe, it, expect } from 'vitest';
import { derive, finalScores } from './derive';
import { exampleBuild, validateBuild, isPlayable, initialState, emptyBuild } from './builder';
import {
  pointBuyCost, pointBuyRemaining, validateBackgroundIncrease, STANDARD_ARRAY, POINT_BUY_BUDGET,
} from './scores';
import { CLASSES, FULL_CASTER_SLOTS, HALF_CASTER_SLOTS, WARLOCK_SLOTS, levelFromXp, XP_THRESHOLDS } from '@/data/srd/classes';
import { SPECIES } from '@/data/srd/species';
import { BACKGROUNDS } from '@/data/srd/backgrounds';
import { WEAPONS, ARMOR, MASTERIES } from '@/data/srd/equipment';

describe('SRD 5.2.1 data completeness', () => {
  it('has the 12 classes, 9 species and 4 backgrounds', () => {
    expect(CLASSES).toHaveLength(12);
    expect(SPECIES).toHaveLength(9);
    expect(BACKGROUNDS).toHaveLength(4);
  });

  it('excludes content not in the SRD', () => {
    const ids = CLASSES.map((c) => c.id);
    expect(ids).not.toContain('artificer');
    expect(SPECIES.map((s) => s.id)).not.toContain('aasimar');
    expect(SPECIES.map((s) => s.id)).not.toContain('half_elf');
    expect(SPECIES.map((s) => s.id)).not.toContain('half_orc');
  });

  it('gives every species 2024-style traits with no ability bonuses', () => {
    for (const s of SPECIES) {
      expect(s.traits.length).toBeGreaterThan(0);
      expect(s).not.toHaveProperty('abilityScoreIncrease');
    }
  });

  it('gives every background exactly 3 abilities, 2 skills and an origin feat', () => {
    for (const b of BACKGROUNDS) {
      expect(b.abilities).toHaveLength(3);
      expect(new Set(b.abilities).size).toBe(3);
      expect(b.skills).toHaveLength(2);
      expect(b.originFeat).toBeTruthy();
    }
  });

  it('gives every weapon a valid mastery property', () => {
    for (const w of WEAPONS) expect(MASTERIES).toContain(w.mastery);
  });

  it('caps medium armor Dex at +2 and heavy at +0', () => {
    for (const a of ARMOR) {
      if (a.category === 'medium') expect(a.dexCap).toBe(2);
      if (a.category === 'heavy') expect(a.dexCap).toBe(0);
      if (a.category === 'light') expect(a.dexCap).toBeNull();
    }
  });

  it('has correct spell slot tables', () => {
    expect(FULL_CASTER_SLOTS).toHaveLength(20);
    expect(FULL_CASTER_SLOTS[0]).toEqual([2]);          // L1 wizard: two level-1 slots
    expect(FULL_CASTER_SLOTS[4]).toEqual([4, 3, 2]);    // L5 full caster
    expect(HALF_CASTER_SLOTS[0]).toEqual([]);           // paladins get nothing at L1
    expect(HALF_CASTER_SLOTS[1]).toEqual([2]);          // casting begins at L2
    expect(WARLOCK_SLOTS[4]).toEqual([2, 3]);           // L5 warlock: 2 slots of level 3
  });

  it('maps XP to level on the SRD thresholds', () => {
    expect(XP_THRESHOLDS).toHaveLength(20);
    expect(levelFromXp(0)).toBe(1);
    expect(levelFromXp(299)).toBe(1);
    expect(levelFromXp(300)).toBe(2);
    expect(levelFromXp(2700)).toBe(4);
    expect(levelFromXp(355000)).toBe(20);
    expect(levelFromXp(999999)).toBe(20);
  });
});

describe('ability score methods', () => {
  it('prices point buy per the SRD table', () => {
    expect(pointBuyCost({ str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 })).toBe(0);
    expect(pointBuyCost({ str: 15, dex: 15, con: 15, int: 8, wis: 8, cha: 8 })).toBe(27);
    expect(pointBuyRemaining({ str: 15, dex: 15, con: 15, int: 8, wis: 8, cha: 8 })).toBe(0);
    // 14 costs 7, not 6 — the curve steepens above 13
    expect(pointBuyCost({ str: 14, dex: 8, con: 8, int: 8, wis: 8, cha: 8 })).toBe(7);
  });

  it('rejects scores outside the point buy range', () => {
    expect(() => pointBuyCost({ str: 16, dex: 8, con: 8, int: 8, wis: 8, cha: 8 })).toThrow();
    expect(() => pointBuyCost({ str: 7, dex: 8, con: 8, int: 8, wis: 8, cha: 8 })).toThrow();
  });

  it('fits the standard array in the point buy budget conceptually', () => {
    expect([...STANDARD_ARRAY]).toEqual([15, 14, 13, 12, 10, 8]);
    expect(POINT_BUY_BUDGET).toBe(27);
  });
});

describe('background ability increases (2024)', () => {
  const allowed = ['str', 'dex', 'con'] as const;

  it('accepts +2/+1', () => {
    expect(validateBackgroundIncrease({ str: 2, dex: 1 }, allowed)).toEqual([]);
  });

  it('accepts +1/+1/+1', () => {
    expect(validateBackgroundIncrease({ str: 1, dex: 1, con: 1 }, allowed)).toEqual([]);
  });

  it('rejects +3 to one ability', () => {
    expect(validateBackgroundIncrease({ str: 3 }, allowed).length).toBeGreaterThan(0);
  });

  it('rejects +2/+2 (over budget)', () => {
    expect(validateBackgroundIncrease({ str: 2, dex: 2 }, allowed).length).toBeGreaterThan(0);
  });

  it('rejects abilities outside the background', () => {
    const issues = validateBackgroundIncrease({ cha: 2, str: 1 }, allowed);
    expect(issues.some((i) => i.includes('CHA'))).toBe(true);
  });
});

describe('derived character sheet', () => {
  const build = exampleBuild();
  const d = derive(build);

  it('applies background increase to base scores', () => {
    // base DEX 15 +2 from Criminal background = 17
    expect(finalScores(build).dex).toBe(17);
    expect(finalScores(build).con).toBe(14);
    expect(d.mods.dex).toBe(3);
  });

  it('uses the right proficiency bonus for level 3', () => {
    expect(d.proficiencyBonus).toBe(2);
  });

  it('computes HP as max die at L1 plus average thereafter', () => {
    // Rogue d8, CON mod +2, level 3 => 8+2 + 2*(5+2) = 24
    expect(d.maxHp).toBe(24);
  });

  it('computes AC from light armor with uncapped Dex', () => {
    // Leather 11 + DEX 3 = 14
    expect(d.armorClass).toBe(14);
    expect(d.armorNote).toBe('Leather Armor');
  });

  it('adds proficiency bonus to Initiative for the Alert feat', () => {
    expect(d.initiative).toBe(d.mods.dex + d.proficiencyBonus);
  });

  it('doubles proficiency for expertise skills only', () => {
    expect(d.skills.stealth.expertise).toBe(true);
    expect(d.skills.stealth.mod).toBe(d.mods.dex + d.proficiencyBonus * 2);
    expect(d.skills.acrobatics.expertise).toBe(false);
    expect(d.skills.acrobatics.mod).toBe(d.mods.dex + d.proficiencyBonus);
    expect(d.skills.arcana.proficient).toBe(false);
    expect(d.skills.arcana.mod).toBe(d.mods.int);
  });

  it('derives passive scores as 10 + modifier', () => {
    expect(d.passivePerception).toBe(10 + d.skills.perception.mod);
  });

  it('gives a rogue no spellcasting', () => {
    expect(d.spellSaveDc).toBeNull();
    expect(d.spellSlots).toEqual([]);
    expect(d.pactSlots).toBeNull();
  });

  it('marks masteries active only for chosen properties', () => {
    const shortsword = d.attacks.find((a) => a.weapon.id === 'shortsword')!;
    expect(shortsword.weapon.mastery).toBe('vex');
    expect(shortsword.masteryActive).toBe(true);
    expect(shortsword.ability).toBe('dex');   // finesse, Dex is higher
    expect(shortsword.attackBonus).toBe(d.mods.dex + d.proficiencyBonus);
  });

  it('computes carrying capacity as STR x 15', () => {
    expect(d.carryingCapacity).toBe(finalScores(build).str * 15);
  });
});

describe('class-specific derivations', () => {
  it('gives a barbarian Unarmored Defense (10 + DEX + CON)', () => {
    const b = exampleBuild({
      classId: 'barbarian', backgroundId: 'soldier', speciesId: 'orc', level: 1,
      baseScores: { str: 15, dex: 14, con: 13, int: 8, wis: 12, cha: 10 },
      backgroundIncrease: { str: 2, con: 1 },
      classSkills: ['athletics', 'survival'], expertise: [],
      originFeatId: 'savage_attacker', weaponMasteries: ['cleave', 'topple'],
      equippedArmorId: undefined, equippedWeaponIds: ['greataxe'],
    });
    const d = derive(b);
    expect(d.armorClass).toBe(10 + d.mods.dex + d.mods.con);
    expect(d.armorNote).toContain('Unarmored Defense');
    expect(d.maxHp).toBe(12 + d.mods.con);  // d12 at level 1
  });

  it('caps Dex at +2 in medium armor', () => {
    const b = exampleBuild({
      classId: 'cleric', backgroundId: 'acolyte', speciesId: 'dwarf', level: 1,
      baseScores: { str: 13, dex: 15, con: 14, int: 10, wis: 12, cha: 8 },
      backgroundIncrease: { wis: 2, int: 1 },
      classSkills: ['insight', 'religion'], expertise: [],
      originFeatId: 'magic_initiate_cleric', weaponMasteries: [],
      equippedArmorId: 'chain_shirt', hasShield: true, equippedWeaponIds: ['mace'],
    });
    const d = derive(b);
    // Chain Shirt 13 + min(DEX +2, cap 2) + Shield 2 = 17
    expect(d.mods.dex).toBe(2);
    expect(d.armorClass).toBe(17);
    expect(d.armorNote).toContain('Shield');
  });

  it('gives a dwarf +1 HP per level (Dwarven Toughness)', () => {
    const common = {
      classId: 'cleric' as const, backgroundId: 'acolyte', level: 4,
      baseScores: { str: 13, dex: 12, con: 14, int: 10, wis: 15, cha: 8 },
      backgroundIncrease: { wis: 2, int: 1 },
      classSkills: ['insight', 'religion'] as never, expertise: [],
      originFeatId: 'magic_initiate_cleric', weaponMasteries: [],
      equippedWeaponIds: ['mace'],
    };
    const dwarf = derive(exampleBuild({ ...common, speciesId: 'dwarf' }));
    const human = derive(exampleBuild({ ...common, speciesId: 'human' }));
    expect(dwarf.maxHp - human.maxHp).toBe(4);
  });

  it('computes a wizard spell save DC as 8 + PB + INT', () => {
    const b = exampleBuild({
      classId: 'wizard', backgroundId: 'sage', speciesId: 'gnome', speciesChoice: 'rock', level: 5,
      baseScores: { str: 8, dex: 14, con: 13, int: 15, wis: 12, cha: 10 },
      backgroundIncrease: { int: 2, con: 1 },
      classSkills: ['arcana', 'investigation'], expertise: [],
      originFeatId: 'magic_initiate_wizard', weaponMasteries: [],
      equippedArmorId: undefined, equippedWeaponIds: ['quarterstaff'],
    });
    const d = derive(b);
    expect(d.proficiencyBonus).toBe(3);
    expect(d.mods.int).toBe(3);               // 15 + 2 = 17 => +3
    expect(d.spellSaveDc).toBe(8 + 3 + 3);    // 14
    expect(d.spellAttackBonus).toBe(6);
    expect(d.spellSlots).toEqual([4, 3, 2]);
  });

  it('gives a warlock pact slots rather than ordinary slots', () => {
    const b = exampleBuild({
      classId: 'warlock', backgroundId: 'criminal', speciesId: 'tiefling', speciesChoice: 'infernal', level: 5,
      baseScores: { str: 8, dex: 14, con: 13, int: 12, wis: 10, cha: 15 },
      backgroundIncrease: { dex: 2, con: 1 },
      classSkills: ['arcana', 'deception'], expertise: [],
      originFeatId: 'alert', weaponMasteries: [],
      equippedArmorId: 'leather', equippedWeaponIds: ['dagger'],
    });
    const d = derive(b);
    expect(d.spellSlots).toEqual([]);
    expect(d.pactSlots).toEqual({ count: 2, level: 3 });
  });

  it('gives a bard Jack of All Trades on non-proficient skills only', () => {
    const b = exampleBuild({
      classId: 'bard', backgroundId: 'criminal', speciesId: 'human', level: 5,
      baseScores: { str: 8, dex: 14, con: 13, int: 12, wis: 10, cha: 15 },
      backgroundIncrease: { dex: 2, con: 1 },
      classSkills: ['performance', 'persuasion', 'acrobatics'], expertise: ['persuasion'],
      bonusSkills: [], originFeatId: 'musician', weaponMasteries: [],
      equippedArmorId: 'leather', equippedWeaponIds: ['dagger'],
    });
    const d = derive(b);
    const pb = d.proficiencyBonus;                 // 3 at level 5
    expect(d.skills.arcana.proficient).toBe(false);
    expect(d.skills.arcana.mod).toBe(d.mods.int + Math.floor(pb / 2));
    expect(d.skills.persuasion.mod).toBe(d.mods.cha + pb * 2);
  });
});

describe('build validation', () => {
  it('accepts a complete legal build', () => {
    const issues = validateBuild(exampleBuild()).filter((i) => i.severity === 'error');
    expect(issues).toEqual([]);
    expect(isPlayable(exampleBuild())).toBe(true);
  });

  it('rejects an empty build', () => {
    expect(isPlayable(emptyBuild())).toBe(false);
  });

  it('rejects the wrong number of class skills', () => {
    const issues = validateBuild(exampleBuild({ classSkills: ['acrobatics'] }));
    expect(issues.some((i) => i.field === 'classSkills' && i.severity === 'error')).toBe(true);
  });

  it('rejects a skill that is not on the class list', () => {
    const issues = validateBuild(exampleBuild({ classSkills: ['arcana', 'deception', 'investigation', 'perception'] }));
    expect(issues.some((i) => i.message.includes('not on the Rogue skill list'))).toBe(true);
  });

  it('rejects expertise without proficiency', () => {
    const issues = validateBuild(exampleBuild({ expertise: ['arcana'] }));
    expect(issues.some((i) => i.field === 'expertise' && i.severity === 'error')).toBe(true);
  });

  it('rejects too many weapon masteries', () => {
    const issues = validateBuild(exampleBuild({ weaponMasteries: ['vex', 'nick', 'sap'] }));
    expect(issues.some((i) => i.field === 'weaponMasteries' && i.severity === 'error')).toBe(true);
  });

  it('requires a species sub-choice when the species has one', () => {
    const issues = validateBuild(exampleBuild({ speciesId: 'dragonborn', speciesChoice: undefined }));
    expect(issues.some((i) => i.field === 'speciesChoice')).toBe(true);
  });

  it('rejects an unnamed character', () => {
    expect(validateBuild(exampleBuild({ name: '  ' })).some((i) => i.field === 'name')).toBe(true);
  });

  it('warns rather than errors on a redundant skill pick', () => {
    // Criminal grants stealth; picking it again is wasteful but not illegal
    const issues = validateBuild(exampleBuild({
      classSkills: ['acrobatics', 'deception', 'investigation', 'stealth'],
      expertise: ['stealth'],
    }));
    const stealthIssue = issues.find((i) => i.message.includes('already granted'));
    expect(stealthIssue?.severity).toBe('warning');
  });
});

describe('initial state', () => {
  it('starts at full HP with level-many hit dice', () => {
    const build = exampleBuild();
    const s = initialState(build);
    expect(s.currentHp).toBe(derive(build).maxHp);
    expect(s.hitDiceRemaining).toBe(build.level);
    expect(s.exhaustion).toBe(0);
    expect(s.deathSaves).toEqual({ successes: 0, failures: 0 });
  });

  it('gives humans Heroic Inspiration from the start (Resourceful)', () => {
    expect(initialState(exampleBuild({ speciesId: 'human' })).heroicInspiration).toBe(true);
    expect(initialState(exampleBuild({ speciesId: 'halfling' })).heroicInspiration).toBe(false);
  });

  it('sizes the spell slot tracker to the class', () => {
    const wiz = exampleBuild({
      classId: 'wizard', backgroundId: 'sage', speciesId: 'human', level: 5,
      classSkills: ['arcana', 'investigation'], expertise: [],
      backgroundIncrease: { int: 2, con: 1 }, originFeatId: 'magic_initiate_wizard',
      weaponMasteries: [], equippedArmorId: undefined, equippedWeaponIds: ['quarterstaff'],
    });
    expect(initialState(wiz).spellSlotsUsed).toEqual([0, 0, 0]);
  });
});

describe('portrait matching', () => {
  it('prefers same species and archetype', async () => {
    const { matchPortrait } = await import('@/ui/portraits');
    const m = matchPortrait({ speciesId: 'orc', classId: 'barbarian' });
    expect(m.entry?.species).toBe('orc');
    expect(m.entry?.archetype).toBe('martial');
    expect(m.confident).toBe(true);
  });

  it('never reuses an excluded portrait', async () => {
    const { matchPortrait } = await import('@/ui/portraits');
    const first = matchPortrait({ speciesId: 'elf', classId: 'rogue' });
    const second = matchPortrait({ speciesId: 'elf', classId: 'rogue', exclude: [first.entry!.id] });
    expect(second.entry?.id).not.toBe(first.entry?.id);
  });

  it('refuses a weak match rather than showing a wrong face', async () => {
    const { matchPortrait } = await import('@/ui/portraits');
    const all = (await import('@/ui/portraits')).PORTRAITS.map((p) => p.id);
    const m = matchPortrait({ speciesId: 'nonexistent', classId: 'nonexistent', exclude: all.slice(0, 30) });
    expect(m.src).toBeNull();
  });

  it('produces a stable sigil for a given seed', async () => {
    const { sigilFor } = await import('@/ui/portraits');
    expect(sigilFor('abc')).toEqual(sigilFor('abc'));
    expect(sigilFor('abc')).not.toEqual(sigilFor('abd'));
  });

  it('every portrait entry has a file on disk', async () => {
    const { PORTRAITS } = await import('@/ui/portraits');
    const { existsSync } = await import('node:fs');
    const missing = PORTRAITS.filter((p) => !existsSync(`public/assets/portraits/${p.id}.webp`));
    expect(missing.map((m) => m.id)).toEqual([]);
  });
});

describe('scenery matching', () => {
  it('matches a location description to a biome', async () => {
    const { matchBiome } = await import('@/ui/scenery');
    expect(matchBiome('a damp dungeon corridor under the keep').entry.id).toBe('dungeon-corridor');
    expect(matchBiome('the drowned bog east of the mire').entry.id).toBe('swamp');
    expect(matchBiome('a crowded tavern on the harbour').score).toBeGreaterThan(0);
  });

  it('always returns a usable backdrop even with no keyword hit', async () => {
    const { matchBiome } = await import('@/ui/scenery');
    const m = matchBiome('zzzz nothing matches here');
    expect(m.score).toBe(0);
    expect(m.src).toMatch(/^\/assets\/biomes\/.+\.webp$/);
  });

  it('only claims creature art that exists on disk', async () => {
    const { CREATURE_ART } = await import('@/ui/scenery');
    const { existsSync } = await import('node:fs');
    const missing = [...CREATURE_ART].filter((id) => !existsSync(`public/assets/creatures/${id}.webp`));
    expect(missing).toEqual([]);
  });

  it('only claims biomes that exist on disk', async () => {
    const { BIOMES } = await import('@/ui/scenery');
    const { existsSync } = await import('node:fs');
    const missing = BIOMES.filter((b) => !existsSync(`public/assets/biomes/${b.id}.webp`));
    expect(missing.map((m) => m.id)).toEqual([]);
  });
});
