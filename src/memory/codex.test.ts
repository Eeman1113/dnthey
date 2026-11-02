import { describe, it, expect } from 'vitest';
import { terms, score, retrieve, renderCodex, upsert, prune, type CodexEntity } from './codex';

const ent = (p: Partial<CodexEntity>): CodexEntity => ({
  id: 'x', kind: 'npc', name: 'Someone', oneLine: 'A person.',
  facts: [], tags: [], knownToPlayer: true, salience: 1, lastSeenBeat: 0, ...p,
});

describe('terms', () => {
  it('drops stop words and short tokens', () => {
    expect(terms('The cobbler is in the alley')).toEqual(['cobbler', 'alley']);
  });
  it('keeps names with apostrophes and hyphens intact', () => {
    expect(terms("Tanner's Alley")).toContain("tanner's");
  });
});

describe('retrieval', () => {
  const codex = [
    ent({ name: 'Old Man Hemlock', oneLine: 'A cobbler whose niece was taken.', tags: ['cobbler'], lastSeenBeat: 10 }),
    ent({ name: 'The Salt Cartel', kind: 'faction', oneLine: 'Smugglers who run the harbour.', lastSeenBeat: 2 }),
    ent({ name: 'Mirefang', kind: 'place', oneLine: 'A drowned causeway east of town.', lastSeenBeat: 9 }),
  ];

  it('finds the entity the text is about', () => {
    const r = retrieve(codex, 'I ask Hemlock about the cobbler shop', 10);
    expect(r[0]!.name).toBe('Old Man Hemlock');
  });

  it('returns nothing when nothing matches', () => {
    expect(retrieve(codex, 'zzzz qqqq', 10)).toEqual([]);
  });

  it('prefers the recent over the long forgotten, all else equal', () => {
    const recent = ent({ name: 'Ledger', oneLine: 'A harbour ledger.', lastSeenBeat: 20 });
    const old = ent({ name: 'Ledger Two', oneLine: 'A harbour ledger.', lastSeenBeat: 0 });
    expect(score(recent, terms('harbour ledger'), 20))
      .toBeGreaterThan(score(old, terms('harbour ledger'), 20));
  });

  it('weights salience, so a recurring NPC outranks a one-off', () => {
    const major = ent({ name: 'A', oneLine: 'a smuggler', salience: 5, lastSeenBeat: 5 });
    const minor = ent({ name: 'B', oneLine: 'a smuggler', salience: 1, lastSeenBeat: 5 });
    expect(score(major, terms('smuggler'), 5)).toBeGreaterThan(score(minor, terms('smuggler'), 5));
  });

  it('NEVER hands a DM only entity to the narrator', () => {
    const withSecret = [...codex, ent({ name: 'The Betrayal', oneLine: 'Hemlock sold her himself.', knownToPlayer: false, lastSeenBeat: 10 })];
    const forNarrator = retrieve(withSecret, 'Hemlock', 10, { forNarrator: true });
    expect(forNarrator.some((e) => !e.knownToPlayer)).toBe(false);
    // but the adjudicator, which shapes consequences, may see it
    const forDm = retrieve(withSecret, 'Hemlock betrayal', 10);
    expect(forDm.some((e) => !e.knownToPlayer)).toBe(true);
  });

  it('respects the limit', () => {
    expect(retrieve(codex, 'cobbler harbour causeway', 10, { limit: 2 })).toHaveLength(2);
  });
});

describe('rendering stays inside a prompt budget', () => {
  it('truncates rather than overflowing the slice', () => {
    const many = Array.from({ length: 40 }, (_, i) =>
      ent({ name: `Entity ${i}`, oneLine: 'x'.repeat(60) }));
    expect(renderCodex(many, 300).length).toBeLessThanOrEqual(300);
  });
});

describe('upsert', () => {
  it('adds a new entity', () => {
    const out = upsert([], { kind: 'npc', name: 'Pell', oneLine: 'A rogue.', facts: [], tags: [], knownToPlayer: true, lastSeenBeat: 1 });
    expect(out).toHaveLength(1);
  });

  it('merges instead of duplicating, and raises salience', () => {
    let c = upsert([], { kind: 'npc', name: 'Hemlock', oneLine: 'A cobbler.', facts: ['has a niece'], tags: [], knownToPlayer: true, lastSeenBeat: 1 });
    c = upsert(c, { kind: 'npc', name: 'hemlock', oneLine: 'A cobbler.', facts: ['owes money'], tags: ['debt'], knownToPlayer: true, lastSeenBeat: 4 });
    expect(c).toHaveLength(1);
    expect(c[0]!.facts).toEqual(['has a niece', 'owes money']);
    expect(c[0]!.salience).toBe(2);
    expect(c[0]!.lastSeenBeat).toBe(4);
  });

  it('does not repeat a fact it already has', () => {
    let c = upsert([], { kind: 'npc', name: 'A', oneLine: 'x', facts: ['tall'], tags: [], knownToPlayer: true, lastSeenBeat: 0 });
    c = upsert(c, { kind: 'npc', name: 'A', oneLine: 'x', facts: ['Tall'], tags: [], knownToPlayer: true, lastSeenBeat: 1 });
    expect(c[0]!.facts).toEqual(['tall']);
  });

  it('a secret stays secret once revealed as known, never the reverse', () => {
    let c = upsert([], { kind: 'npc', name: 'A', oneLine: 'x', facts: [], tags: [], knownToPlayer: true, lastSeenBeat: 0 });
    c = upsert(c, { kind: 'npc', name: 'A', oneLine: 'x', facts: [], tags: [], knownToPlayer: false, lastSeenBeat: 1 });
    expect(c[0]!.knownToPlayer).toBe(true);
  });
});

describe('prune', () => {
  it('keeps the codex bounded', () => {
    const many = Array.from({ length: 100 }, (_, i) => ent({ name: `E${i}`, lastSeenBeat: i }));
    expect(prune(many, 60, 100)).toHaveLength(60);
  });
  it('keeps the important and the recent', () => {
    const many = [
      ...Array.from({ length: 70 }, (_, i) => ent({ name: `old${i}`, salience: 1, lastSeenBeat: 0 })),
      ent({ name: 'important', salience: 5, lastSeenBeat: 99 }),
    ];
    expect(prune(many, 10, 100).some((e) => e.name === 'important')).toBe(true);
  });
  it('leaves a small codex alone', () => {
    const few = [ent({ name: 'A' })];
    expect(prune(few, 60, 10)).toEqual(few);
  });
});
