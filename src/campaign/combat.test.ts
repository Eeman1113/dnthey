import { describe, it, expect } from 'vitest';
import { buildEncounter, XP_BUDGET, MONSTERS, MONSTERS_BY_ID } from '@/data/srd/encounters';
import { startCombat, resolveAttack, advance, checkEnd, living } from './combat';
import { exampleBuild, initialState } from '@/character/builder';
import { pickCompanions } from './companions';
import type { Campaign } from './types';

const campaign = (): Campaign => {
  const build = exampleBuild({ level: 3 });
  return {
    id: 'c', createdAt: 0, tone: 't',
    world: { realmName: 'R', openingLocation: 'L', locationKind: 'dungeon', hook: 'h', threat: 't', openingScene: 's' },
    worldGenerated: false,
    pc: { build, state: initialState(build) },
    companions: pickCompanions('seed', 2).map((card) => ({ card })),
    scene: 's', beats: [], seed: 'fixed-seed', rollCount: 0,
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
