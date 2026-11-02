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

export type Role = 'worldsmith' | 'narrator' | 'adjudicator' | 'companion';

const SAMPLING: Record<Role, SamplingMode> = {
  worldsmith: 'most-creative',
  narrator: 'most-creative',
  adjudicator: 'most-predictable',
  companion: 'balanced',
};

const pool = new Map<string, Promise<ModelSession>>();

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
      return validate(JSON.parse(raw));
    } catch {
      if (attempt === 1) return null;
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
