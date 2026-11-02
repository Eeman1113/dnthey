'use client';

/**
 * Session pool for the on-device model.
 *
 * Measured on Chrome 156: create() takes about 9.5s cold and prompt() about
 * 5.3s with a response constraint. Three serial calls per beat would be 16s of
 * dead air, so sessions are created once, kept warm, and cloned per role.
 */
import { chromeNanoProvider, isSupported } from '@/model/chrome-nano';
import type { ModelSession, SamplingMode } from '@/model/types';

/**
 * Only three live sessions.
 *
 * Every distinct session pays a create, measured at about 9.5s on this
 * hardware, so one session per role per character meant a party of two cost
 * thirty seconds of staring at a button. `aux` therefore serves every
 * occasional job (loremaster, tactician, companions, banter) from a single
 * warm session, with the role card passed in the message instead of the
 * system prompt. That costs a few hundred tokens of a 9216 window per call
 * and saves a create every time.
 */
export type Role = 'narrator' | 'adjudicator' | 'aux';

const SAMPLING: Record<Role, SamplingMode> = {
  narrator: 'most-creative',
  adjudicator: 'most-predictable',
  aux: 'balanced',
};

/** The one shared system prompt for occasional work. */
export const AUX_SYSTEM =
  'You do one small job at a time for a Dungeons and Dragons game. ' +
  'Each message tells you the job and gives you everything you need. ' +
  'Follow it exactly and output only the required JSON.';

const pool = new Map<string, Promise<ModelSession>>();

/* ------------------------------------------------------------------ telemetry */

export interface CallRecord {
  id: number;
  job: string;
  ms: number;
  ok: boolean;
  /** Set when the first attempt failed validation and a repair was needed. */
  repaired?: boolean;
  error?: string;
  contextUsed?: number;
  contextWindow?: number;
  preview: string;
}

const MAX_RECORDS = 40;
let records: CallRecord[] = [];
let nextId = 1;
const listeners = new Set<(r: CallRecord[]) => void>();

export function recordCall(r: Omit<CallRecord, 'id'>): void {
  records = [...records.slice(-(MAX_RECORDS - 1)), { ...r, id: nextId++ }];
  for (const l of listeners) l(records);
}

export function getCalls(): CallRecord[] { return records; }

export function onCalls(fn: (r: CallRecord[]) => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** Wrap any model job so the HUD sees its latency and outcome. */
export async function timed<T>(job: string, fn: () => Promise<T>): Promise<T> {
  const t0 = performance.now();
  try {
    const out = await fn();
    recordCall({
      job, ms: Math.round(performance.now() - t0), ok: out !== null,
      preview: typeof out === 'string' ? out.slice(0, 80) : JSON.stringify(out ?? '').slice(0, 80),
    });
    return out;
  } catch (e) {
    recordCall({ job, ms: Math.round(performance.now() - t0), ok: false, error: String(e), preview: '' });
    throw e;
  }
}

export function modelAvailable(): boolean {
  return isSupported();
}

/** Start the slow part early so the first beat is not paying for it. */
export function prewarm(role: Role, system: string): void {
  void getSession(role, system).catch(() => undefined);
}

export function getSession(role: Role, system: string, key: string = role): Promise<ModelSession> {
  const existing = pool.get(key);
  if (existing) return existing;
  const created = chromeNanoProvider
    .createSession({ system, samplingMode: SAMPLING[role], createTimeoutMs: 120_000 })
    .catch((e) => { pool.delete(key); throw e; });
  pool.set(key, created);
  return created;
}

export async function resetSession(key: string): Promise<void> {
  const s = pool.get(key);
  pool.delete(key);
  if (s) { try { (await s).destroy(); } catch { /* already gone */ } }
}

export function destroyAll(): void {
  for (const key of [...pool.keys()]) void resetSession(key);
}

/**
 * Ask for JSON and get a validated object back.
 * One repair attempt, then the caller's fallback. The game never stalls on a
 * bad generation (BUILD_PROMPT.md section 10).
 */
export async function askJson<T>(
  session: ModelSession,
  prompt: string,
  schema: object,
  validate: (v: unknown) => T,
  opts: { timeoutMs?: number } = {},
): Promise<T | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await session.prompt(prompt, {
        responseConstraint: schema,
        omitResponseConstraintInput: true,
        timeoutMs: opts.timeoutMs ?? 45_000,
      });
      const out = validate(JSON.parse(raw));
      if (attempt === 1) {
        recordCall({
          job: 'repair', ms: 0, ok: true, repaired: true,
          contextUsed: session.contextUsage, contextWindow: session.contextWindow,
          preview: 'second attempt succeeded',
        });
      }
      return out;
    } catch (e) {
      if (attempt === 1) {
        recordCall({
          job: 'validation', ms: 0, ok: false, error: String(e),
          contextUsed: session.contextUsage, contextWindow: session.contextWindow,
          preview: 'both attempts failed, using fallback',
        });
        return null;
      }
    }
  }
  return null;
}

/** Stream prose, yielding text as it arrives so the reader is never staring at nothing. */
export async function* askProse(
  session: ModelSession,
  prompt: string,
): AsyncGenerator<string> {
  for await (const chunk of session.promptStreaming(prompt, { timeoutMs: 60_000 })) {
    yield chunk;
  }
}


/**
 * A disposable session for one occasional job.
 *
 * Cloned from the warm `aux` session, so it costs no create (measured at
 * about 9.5s) but starts with an empty context. That matters twice over:
 * a single shared session would accumulate every previous job's history
 * until it overflowed the 9216 token window, and it would also leak role,
 * answering as a companion while still primed as the worldsmith.
 *
 * Always destroyed, so a long session does not leak sessions.
 */
export async function withAux<T>(fn: (s: ModelSession) => Promise<T>): Promise<T | null> {
  let clone: ModelSession | null = null;
  try {
    const base = await getSession('aux', AUX_SYSTEM);
    clone = await base.clone();
    return await fn(clone);
  } catch {
    return null;
  } finally {
    try { clone?.destroy(); } catch { /* already gone */ }
  }
}
