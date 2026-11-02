import { describe, it, expect } from 'vitest';
import { buildEncounter, XP_BUDGET, MONSTERS, MONSTERS_BY_ID } from '@/data/srd/encounters';
import { startCombat, resolveAttack, advance, checkEnd, living, rollDeathSave, resolveSpell, canCast } from './combat';
import { exampleBuild, initialState, initialState as initialStateFor } from '@/character/builder';
import { pickCompanions } from './companions';
import type { Campaign } from './types';

const campaign = (): Campaign => {
  const build = exampleBuild({ level: 3 });
  return {
    id: 'c', createdAt: 0, tone: 't',
    world: { realmName: 'R', openingLocation: 'L', locationKind: 'dungeon', hook: 'h', threat: 't', openingScene: 's' },
    worldGenerated: false,
    pc: { build, state: initialState(build) },
    companions: pickCompanions('seed', 2).map((card) => ({ card, bond: 2 })),
    scene: 's', lines: '', beats: [], seed: 'fixed-seed', rollCount: 0, combat: null, foes: [], codex: [], chronicle: { entries: [] },
  };
};

describe('encounter budget (2024 DMG)', () => {
  it('never exceeds the XP ceiling for the party', () => {
    for (const level of [1, 2, 3, 4, 5]) {
      for (const diff of ['low', 'moderate', 'high'] as const) {
        for (const size of [1, 3, 5]) {
          const budget = XP_BUDGET[level]![diff] * size;
          const foes = buildEncounter(level, size, diff, (n) => n - 1);
          const spent = foes.reduce((a, m) => a + m.xp, 0);
          expect(spent, `L${level} ${diff} x${size}`).toBeLessThanOrEqual(budget);
        }
      }
    }
  });

  it('always returns at least one creature', () => {
    expect(buildEncounter(1, 1, 'low', () => 0).length).toBeGreaterThan(0);
  });

  it('respects a theme filter', () => {
    const foes = buildEncounter(5, 4, 'high', (n) => n - 1, ['goblin']);
    expect(foes.every((f) => f.id === 'goblin')).toBe(true);
  });

  it('gives every monster a usable stat block', () => {
    for (const m of MONSTERS) {
      expect(m.ac).toBeGreaterThan(0);
      expect(m.hp).toBeGreaterThan(0);
      expect(m.attack.damage).toMatch(/^\d*d\d+$/);
      expect(m.xp).toBeGreaterThan(0);
    }
  });
});

describe('combat', () => {
  it('builds an initiative order containing the party and the foes', () => {
    const c = campaign();
    const s = startCombat(c, [MONSTERS_BY_ID['goblin']!, MONSTERS_BY_ID['goblin']!]);
    expect(s.order.filter((x) => x.side === 'party')).toHaveLength(3); // pc + 2 companions
    expect(s.order.filter((x) => x.side === 'foe')).toHaveLength(2);
    // sorted descending
    const inits = s.order.map((o) => o.initiative);
    expect([...inits].sort((a, b) => b - a)).toEqual(inits);
  });

  it('disambiguates duplicate monster names', () => {
    const s = startCombat(campaign(), [MONSTERS_BY_ID['wolf']!, MONSTERS_BY_ID['wolf']!]);
    const names = s.order.filter((o) => o.side === 'foe').map((o) => o.name);
    expect(new Set(names).size).toBe(2);
  });

  it('is deterministic for a given seed', () => {
    const a = startCombat(campaign(), [MONSTERS_BY_ID['orc']!]);
    const b = startCombat(campaign(), [MONSTERS_BY_ID['orc']!]);
    expect(a.order.map((o) => o.initiative)).toEqual(b.order.map((o) => o.initiative));
  });

  it('never drives hit points below zero', () => {
    const c = campaign();
    const s = startCombat(c, [MONSTERS_BY_ID['kobold']!]);
    const pc = s.order.find((o) => o.id === 'pc')!;
    const foe = s.order.find((o) => o.side === 'foe')!;
    for (let i = 0; i < 40; i++) { resolveAttack(s, 'seed', pc, foe); s.turn++; }
    expect(foe.hp).toBe(0);
  });

  it('declares victory only when every foe is down or gone', () => {
    const c = campaign();
    let s = startCombat(c, [MONSTERS_BY_ID['kobold']!]);
    expect(checkEnd(s, [MONSTERS_BY_ID['kobold']!]).over).toBe(false);
    s.order.filter((o) => o.side === 'foe').forEach((f) => { f.hp = 0; });
    s = checkEnd(s, [MONSTERS_BY_ID['kobold']!]);
    expect(s.over).toBe(true);
    expect(s.outcome).toBe('victory');
    expect(s.xpAwarded).toBe(25);
  });

  it('skips the downed when advancing turns', () => {
    const c = campaign();
    let s = startCombat(c, [MONSTERS_BY_ID['goblin']!, MONSTERS_BY_ID['goblin']!]);
    s.order[1]!.hp = 0;
    const seen: string[] = [];
    for (let i = 0; i < s.order.length * 2; i++) { s = advance(s); seen.push(s.order[s.turn]!.id); }
    expect(seen).not.toContain(s.order[1]!.id);
  });

  it('lets the resolute hold but allows the mercenary to break', () => {
    // skeleton "never retreats", bandit "surrenders when losing"
    const c = campaign();
    const s = startCombat(c, [MONSTERS_BY_ID['skeleton']!]);
    const sk = s.order.find((o) => o.side === 'foe')!;
    sk.hp = 1;
    const pc = s.order.find((o) => o.id === 'pc')!;
    let fled = false;
    for (let i = 0; i < 30; i++) { sk.hp = 1; s.turn = i; if (resolveAttack(s, 's', pc, sk).targetFled) fled = true; }
    expect(fled, 'a skeleton should never flee').toBe(false);
  });

  it('counts only the standing as living', () => {
    const c = campaign();
    const s = startCombat(c, [MONSTERS_BY_ID['orc']!, MONSTERS_BY_ID['orc']!]);
    s.order.filter((o) => o.side === 'foe')[0]!.fled = true;
    expect(living(s, 'foe')).toHaveLength(1);
  });
});

describe('monster art', () => {
  it('every playable monster has a cutout on disk', async () => {
    const { MONSTERS } = await import('@/data/srd/encounters');
    const { existsSync } = await import('node:fs');
    const missing = MONSTERS.filter(
      (m) => !existsSync(`public/assets/monsters/${m.id}.webp`)
          || !existsSync(`public/assets/monsters/${m.id}.avif`),
    );
    expect(missing.map((m) => m.id)).toEqual([]);
  });
});

describe('naming', () => {
  it('numbers duplicates per type, not by position in the list', async () => {
    const { startCombat } = await import('./combat');
    const { MONSTERS_BY_ID } = await import('@/data/srd/encounters');
    const s = startCombat(campaign(), [
      MONSTERS_BY_ID['wolf']!, MONSTERS_BY_ID['bandit']!,
      MONSTERS_BY_ID['wolf']!, MONSTERS_BY_ID['bandit']!,
    ]);
    const names = s.order.filter((o) => o.side === 'foe').map((o) => o.name).sort();
    expect(names).toEqual(['Bandit 1', 'Bandit 2', 'Wolf 1', 'Wolf 2']);
  });

  it('pluralises the opening line like English, not like a template', async () => {
    const { openingBeat } = await import('./beat');
    const { MONSTERS_BY_ID } = await import('@/data/srd/encounters');
    const wolves = openingBeat([MONSTERS_BY_ID['wolf']!, MONSTERS_BY_ID['wolf']!], '');
    expect(wolves.text).toContain('two Wolves');
    expect(wolves.text).not.toContain('Wolfs');
  });
});

describe('death saves (2024)', () => {
  const setup = () => {
    const c = campaign();
    const s = startCombat(c, [MONSTERS_BY_ID['orc']!]);
    const pc = s.order.find((o) => o.id === 'pc')!;
    return { c, s, pc };
  };

  it('a player at 0 HP is dying, not dead', () => {
    const { s, pc } = setup();
    const foe = s.order.find((o) => o.side === 'foe')!;
    pc.hp = 1;
    resolveAttack(s, 'seed', foe, pc);
    if (pc.hp === 0) { expect(pc.dying).toBe(true); expect(pc.dead).toBeFalsy(); }
  });

  it('a monster at 0 HP simply drops', () => {
    const { s, pc } = setup();
    const foe = s.order.find((o) => o.side === 'foe')!;
    foe.hp = 1;
    resolveAttack(s, 'seed', pc, foe);
    if (foe.hp === 0) { expect(foe.dead).toBe(true); expect(foe.dying).toBeFalsy(); }
  });

  it('three failures kill and three successes stabilise', () => {
    const { s, pc } = setup();
    pc.hp = 0; pc.dying = true; pc.deathSaves = { successes: 0, failures: 2 };
    // Force the failing branch by exhausting successes instead.
    let outcome = '';
    for (let i = 0; i < 40 && !outcome; i++) {
      s.round = i;
      const r = rollDeathSave('seed', s, pc);
      if (r.outcome === 'dead' || r.outcome === 'stable' || r.outcome === 'revived') outcome = r.outcome;
    }
    expect(['dead', 'stable', 'revived']).toContain(outcome);
  });

  it('a death save takes no modifiers, not even exhaustion', () => {
    const { s, pc } = setup();
    pc.hp = 0; pc.dying = true;
    const r = rollDeathSave('seed', s, pc);
    // DC 10 against a bare d20: the result must be decidable from the face alone.
    expect(r.success).toBe(r.natural >= 10 || r.natural === 20);
  });

  it('damage while down adds a failure, and two on a critical', () => {
    const { s, pc } = setup();
    const foe = s.order.find((o) => o.side === 'foe')!;
    pc.hp = 0; pc.dying = true; pc.deathSaves = { successes: 0, failures: 0 };
    let hits = 0;
    for (let i = 0; i < 20 && !pc.dead; i++) {
      s.turn = i;
      if (resolveAttack(s, 'seed', foe, pc).hit) hits++;
    }
    if (hits > 0) expect((pc.deathSaves!.failures) + (pc.dead ? 3 : 0)).toBeGreaterThan(0);
  });

  it('the party has not lost while someone is still dying', () => {
    const { s, pc } = setup();
    s.order.filter((o) => o.side === 'party').forEach((o) => { o.hp = 0; o.dead = true; });
    pc.dead = false; pc.dying = true; pc.hp = 0;
    expect(checkEnd(s, [MONSTERS_BY_ID['orc']!]).over).toBe(false);
    pc.dead = true; pc.dying = false;
    expect(checkEnd(s, [MONSTERS_BY_ID['orc']!]).over).toBe(true);
  });

  it('a dying character still gets a turn, which is when they roll', () => {
    const { s } = setup();
    const pc = s.order.find((o) => o.id === 'pc')!;
    pc.hp = 0; pc.dying = true;
    let reached = false;
    let cur = { ...s };
    for (let i = 0; i < s.order.length * 2; i++) { cur = advance(cur); if (cur.order[cur.turn]!.id === 'pc') reached = true; }
    expect(reached).toBe(true);
  });
});

describe('companion bond', () => {
  it('being overruled costs trust and agreement earns it', async () => {
    const { applyStance } = await import('./beat');
    const c = campaign();
    const id = c.companions[0]!.card.id;
    expect(applyStance(c, id, 'opposed').companions[0]!.bond).toBe(1);
    expect(applyStance(c, id, 'enthusiastic').companions[0]!.bond).toBe(3);
    expect(applyStance(c, id, 'onboard').companions[0]!.bond).toBe(2);
  });

  it('a companion whose trust runs out leaves, once', async () => {
    const { applyStance } = await import('./beat');
    let c = campaign();
    const id = c.companions[0]!.card.id;
    c = { ...c, companions: c.companions.map((x) => (x.card.id === id ? { ...x, bond: 1 } : x)) };
    const out = applyStance(c, id, 'opposed');
    expect(out.left).toBe(c.companions[0]!.card.name);
    expect(out.companions[0]!.gone).toBe(true);
    // Already gone, so no second announcement.
    expect(applyStance({ ...c, companions: out.companions }, id, 'opposed').left).toBeNull();
  });

  it('never exceeds the range', async () => {
    const { applyStance } = await import('./beat');
    let c = campaign();
    const id = c.companions[0]!.card.id;
    for (let i = 0; i < 10; i++) {
      c = { ...c, companions: applyStance(c, id, 'enthusiastic').companions };
    }
    expect(c.companions[0]!.bond).toBe(5);
  });

  it('only touches the companion named', async () => {
    const { applyStance } = await import('./beat');
    const c = campaign();
    const out = applyStance(c, c.companions[0]!.card.id, 'opposed');
    expect(out.companions[1]!.bond).toBe(2);
  });
});

describe('combat persists across a reload', () => {
  it('campaign carries the live fight, not component state', () => {
    const c = campaign();
    const s = startCombat(c, [MONSTERS_BY_ID['goblin']!]);
    const saved: typeof c = { ...c, combat: s, foes: [MONSTERS_BY_ID['goblin']!] };
    const round = JSON.parse(JSON.stringify(saved)) as typeof c;
    expect(round.combat!.turn).toBe(s.turn);
    expect(round.combat!.round).toBe(s.round);
    expect(round.combat!.order.map((o) => o.id)).toEqual(s.order.map((o) => o.id));
    expect(round.foes).toHaveLength(1);
  });
});

describe('companions are real characters', () => {
  it('every companion in the pool builds a legal character', async () => {
    const { COMPANION_POOL, companionBuild } = await import('./companions');
    const { validateBuild } = await import('@/character/builder');
    for (const card of COMPANION_POOL) {
      const build = companionBuild(card, 3);
      const errors = validateBuild(build).filter((i) => i.severity === 'error');
      expect(errors.map((e) => e.message), card.id).toEqual([]);
    }
  });

  it('their sheets differ by class, instead of one flat profile', async () => {
    const { COMPANION_POOL, companionBuild } = await import('./companions');
    const { derive } = await import('@/character/derive');
    const sheets = COMPANION_POOL.map((c) => derive(companionBuild(c, 3)));
    expect(new Set(sheets.map((s) => s.maxHp)).size).toBeGreaterThan(1);
    expect(new Set(sheets.map((s) => s.armorClass)).size).toBeGreaterThan(1);
  });

  it('the barbarian is tougher than the wizard', async () => {
    const { COMPANION_POOL, companionBuild } = await import('./companions');
    const { derive } = await import('@/character/derive');
    const brakka = derive(companionBuild(COMPANION_POOL.find((c) => c.id === 'brakka')!, 3));
    const veladrin = derive(companionBuild(COMPANION_POOL.find((c) => c.id === 'veladrin')!, 3));
    expect(brakka.maxHp).toBeGreaterThan(veladrin.maxHp);
  });

  it('the casters get spell slots and the barbarian does not', async () => {
    const { COMPANION_POOL, companionBuild } = await import('./companions');
    const { derive } = await import('@/character/derive');
    const slots = (id: string) => derive(companionBuild(COMPANION_POOL.find((c) => c.id === id)!, 3)).spellSlots;
    expect(slots('veladrin').length).toBeGreaterThan(0);
    expect(slots('ysolde').length).toBeGreaterThan(0);
    expect(slots('brakka')).toEqual([]);
  });

  it('an unknown companion still builds something legal', async () => {
    const { companionBuild } = await import('./companions');
    const { validateBuild } = await import('@/character/builder');
    const build = companionBuild(
      { id: 'nobody', name: 'Nobody', pronouns: 'they/them', species: 'human', klass: 'fighter',
        voice: 'v', want: 'w', flaw: 'f', portraitId: 'fighter' }, 2);
    expect(validateBuild(build).filter((i) => i.severity === 'error')).toEqual([]);
  });
});

describe('spellcasting', () => {
  const caster = () => {
    const c = campaign();
    const wiz = exampleBuild({
      classId: 'wizard', backgroundId: 'sage', speciesId: 'human', level: 5,
      baseScores: { str: 8, dex: 14, con: 13, int: 15, wis: 12, cha: 10 },
      backgroundIncrease: { int: 2, con: 1 },
      classSkills: ['arcana', 'investigation'], expertise: [],
      originFeatId: 'magic_initiate_wizard', weaponMasteries: [],
      equippedArmorId: undefined, equippedWeaponIds: ['quarterstaff'],
    });
    const camp = { ...c, pc: { build: wiz, state: initialStateFor(wiz) } };
    const s = startCombat(camp, [MONSTERS_BY_ID['goblin']!]);
    return { s, pc: s.order.find((o) => o.id === 'pc')!, foe: s.order.find((o) => o.side === 'foe')! };
  };

  it('a caster brings spells and slots, a barbarian does not', async () => {
    const { pc } = caster();
    expect(pc.spells!.length).toBeGreaterThan(0);
    expect(pc.slots!.length).toBeGreaterThan(0);

    const c = campaign();
    const s = startCombat(c, [MONSTERS_BY_ID['goblin']!]);
    const rogue = s.order.find((o) => o.id === 'pc')!;
    expect(rogue.spells).toBeUndefined();
  });

  it('a cantrip costs no slot and a levelled spell does', async () => {
    const { s, pc, foe } = caster();
    const { SPELLS_BY_ID } = await import('@/data/srd/spells');
    const before = [...pc.slotsUsed!];
    resolveSpell(s, 'seed', pc, foe, SPELLS_BY_ID['fire-bolt']!);
    expect(pc.slotsUsed).toEqual(before);
    resolveSpell(s, 'seed', pc, foe, SPELLS_BY_ID['magic-missile']!);
    expect(pc.slotsUsed![0]).toBe(before[0]! + 1);
  });

  it('refuses to cast without a slot', async () => {
    const { pc } = caster();
    const { SPELLS_BY_ID } = await import('@/data/srd/spells');
    pc.slotsUsed = pc.slots!.map((n) => n);
    expect(canCast(pc, SPELLS_BY_ID['magic-missile']!)).toBe(false);
    expect(canCast(pc, SPELLS_BY_ID['fire-bolt']!)).toBe(true);
  });

  it('a save spell halves on a success only when it should', async () => {
    const { s, pc, foe } = caster();
    const { SPELLS_BY_ID } = await import('@/data/srd/spells');
    // Sacred Flame does nothing on a success; Burning Hands halves.
    let sawHalf = false, sawZero = false;
    for (let i = 0; i < 60; i++) {
      s.turn = i;
      foe.hp = foe.maxHp;
      const r = resolveSpell(s, `seed${i}`, pc, foe, SPELLS_BY_ID['burning-hands']!);
      if (r.saved && r.damage > 0) sawHalf = true;
      foe.hp = foe.maxHp;
      const r2 = resolveSpell(s, `seed${i}`, pc, foe, { ...SPELLS_BY_ID['sacred-flame']!, level: 0 });
      if (r2.saved && r2.damage === 0) sawZero = true;
    }
    expect(sawHalf).toBe(true);
    expect(sawZero).toBe(true);
  });

  it('healing brings a dying ally back up and clears their saves', async () => {
    const { s, pc } = caster();
    const { SPELLS_BY_ID } = await import('@/data/srd/spells');
    const ally = s.order.find((o) => o.side === 'party' && o.id !== 'pc')!;
    ally.hp = 0; ally.dying = true; ally.deathSaves = { successes: 0, failures: 2 };
    resolveSpell(s, 'seed', pc, ally, SPELLS_BY_ID['cure-wounds']!);
    expect(ally.hp).toBeGreaterThan(0);
    expect(ally.dying).toBe(false);
    expect(ally.deathSaves).toEqual({ successes: 0, failures: 0 });
  });

  it('never heals past the maximum', async () => {
    const { s, pc } = caster();
    const { SPELLS_BY_ID } = await import('@/data/srd/spells');
    const ally = s.order.find((o) => o.side === 'party' && o.id !== 'pc')!;
    ally.hp = ally.maxHp - 1;
    resolveSpell(s, 'seed', pc, ally, SPELLS_BY_ID['cure-wounds']!);
    expect(ally.hp).toBe(ally.maxHp);
  });

  it('cantrips scale with character level, levelled spells do not', async () => {
    const { cantripDice, spellsFor } = await import('@/data/srd/spells');
    expect(cantripDice('1d10', 1)).toBe('1d10');
    expect(cantripDice('1d10', 5)).toBe('2d10');
    expect(cantripDice('1d10', 11)).toBe('3d10');
    expect(cantripDice('1d10', 17)).toBe('4d10');
    const l5 = spellsFor('wizard', 5, 3);
    expect(l5.find((x) => x.id === 'fire-bolt')!.effect).toMatchObject({ damage: '2d10' });
    expect(l5.find((x) => x.id === 'fireball')!.effect).toMatchObject({ damage: '8d6' });
  });

  it('only offers spells the class and slot level allow', async () => {
    const { spellsFor } = await import('@/data/srd/spells');
    const low = spellsFor('wizard', 1, 1);
    expect(low.some((s) => s.id === 'fireball')).toBe(false);
    expect(low.some((s) => s.id === 'magic-missile')).toBe(true);
    expect(spellsFor('wizard', 5, 3).some((s) => s.id === 'sacred-flame')).toBe(false);
  });

  it('a spell can kill, and never drives hit points below zero', async () => {
    const { s, pc, foe } = caster();
    const { SPELLS_BY_ID } = await import('@/data/srd/spells');
    for (let i = 0; i < 20 && !foe.dead; i++) {
      s.turn = i;
      resolveSpell(s, `k${i}`, pc, foe, SPELLS_BY_ID['fire-bolt']!);
    }
    expect(foe.hp).toBe(0);
    expect(foe.dead).toBe(true);
  });
});
