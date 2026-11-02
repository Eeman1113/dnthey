/**
 * Campaign memory.
 *
 * The model has a 9216 token window shared between input and output, so a
 * campaign cannot live inside it. Memory is therefore three tiers, and only a
 * retrieved slice of it is ever sent (BUILD_PROMPT.md section 6):
 *
 *   Live window  the last few beats, verbatim, held by the campaign log
 *   Chronicle    one compacted line per closed scene
 *   Codex        typed entity records, retrieved by relevance
 *
 * Retrieval is local scoring, not embeddings: there is no embedding API
 * on device, and a campaign's codex is small enough that term frequency
 * weighted by recency and salience does the job.
 */

export type EntityKind = 'npc' | 'place' | 'faction' | 'item' | 'quest' | 'event';

export interface CodexEntity {
  id: string;
  kind: EntityKind;
  name: string;
  /** Twenty five words at most. This is the line that gets injected. */
  oneLine: string;
  facts: string[];
  tags: string[];
  /** DM only knowledge is never sent to the Narrator, which could leak it. */
  knownToPlayer: boolean;
  salience: number;
  lastSeenBeat: number;
}

export interface Chronicle {
  entries: { scene: number; text: string }[];
}

const STOP = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'of', 'to', 'in', 'on', 'at', 'for',
  'with', 'you', 'your', 'is', 'it', 'its', 'as', 'by', 'from', 'that', 'this',
  'they', 'them', 'their', 'he', 'she', 'his', 'her', 'i', 'me', 'my', 'we',
]);

export function terms(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s'-]/g, ' ').split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
}

/**
 * Score an entity against the current query.
 * Term overlap, lifted by how important the entity is and how recently it
 * appeared, so a thing named two beats ago outranks a thing named in act one.
 */
export function score(e: CodexEntity, q: string[], currentBeat: number): number {
  const hay = terms(`${e.name} ${e.oneLine} ${e.facts.join(' ')} ${e.tags.join(' ')}`);
  const bag = new Set(hay);
  let overlap = 0;
  for (const t of q) if (bag.has(t)) overlap += 1;
  if (overlap === 0) return 0;
  const recency = 1 / (1 + Math.max(0, currentBeat - e.lastSeenBeat) / 12);
  return overlap * (1 + e.salience * 0.5) * (0.5 + recency);
}

/**
 * The slice sent to an agent. `forNarrator` drops DM only entities, because
 * the Narrator writes prose and would spend a secret the moment it knew one.
 */
export function retrieve(
  codex: CodexEntity[], query: string, currentBeat: number,
  opts: { limit?: number; forNarrator?: boolean } = {},
): CodexEntity[] {
  const q = terms(query);
  return codex
    .filter((e) => (opts.forNarrator ? e.knownToPlayer : true))
    .map((e) => ({ e, s: score(e, q, currentBeat) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, opts.limit ?? 5)
    .map((x) => x.e);
}

/** Compact the retrieved slice into something that fits a prompt budget. */
export function renderCodex(entities: CodexEntity[], maxChars = 700): string {
  const lines: string[] = [];
  let used = 0;
  for (const e of entities) {
    const line = `${e.name} (${e.kind}): ${e.oneLine}`;
    if (used + line.length > maxChars) break;
    lines.push(line);
    used += line.length;
  }
  return lines.join('\n');
}

export function renderChronicle(c: Chronicle, maxEntries = 6): string {
  return c.entries.slice(-maxEntries).map((e) => e.text).join(' ');
}

/**
 * Merge a newly observed entity into the codex.
 * An existing entity gains facts and salience rather than being duplicated,
 * which is what keeps a long campaign from filling up with five slightly
 * different records of the same innkeeper.
 */
export function upsert(codex: CodexEntity[], incoming: Omit<CodexEntity, 'id' | 'salience'>): CodexEntity[] {
  const key = incoming.name.trim().toLowerCase();
  const existing = codex.find((e) => e.name.trim().toLowerCase() === key);
  if (!existing) {
    return [...codex, { ...incoming, id: key.replace(/\s+/g, '-'), salience: 1 }];
  }
  const facts = [...existing.facts];
  for (const f of incoming.facts) {
    if (!facts.some((x) => x.toLowerCase() === f.toLowerCase())) facts.push(f);
  }
  return codex.map((e) => (e === existing ? {
    ...e,
    facts: facts.slice(-8),
    oneLine: incoming.oneLine || e.oneLine,
    tags: [...new Set([...e.tags, ...incoming.tags])],
    knownToPlayer: e.knownToPlayer || incoming.knownToPlayer,
    salience: Math.min(5, e.salience + 1),
    lastSeenBeat: Math.max(e.lastSeenBeat, incoming.lastSeenBeat),
  } : e));
}

/** Keep the codex bounded. Drops the least important, least recent records. */
export function prune(codex: CodexEntity[], max = 60, currentBeat = 0): CodexEntity[] {
  if (codex.length <= max) return codex;
  return [...codex]
    .sort((a, b) => (b.salience * 10 - (currentBeat - b.lastSeenBeat))
                  - (a.salience * 10 - (currentBeat - a.lastSeenBeat)))
    .slice(0, max);
}
