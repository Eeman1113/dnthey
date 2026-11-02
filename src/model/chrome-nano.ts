/**
 * Chrome built-in AI (Prompt API / Gemini Nano).
 *
 * This module is CLIENT-ONLY. `LanguageModel` is a window API and does not exist
 * in Node, Server Components, Route Handlers or Middleware (BUILD_PROMPT.md §9.1).
 */
import {
  type Availability, type ModelProvider, type ModelSession, type PromptOptions,
  type SessionOptions, ModelTimeoutError, ModelUnavailableError,
} from './types';

if (typeof window === 'undefined') {
  throw new Error('chrome-nano.ts imported on the server. The Prompt API is client-only.');
}

/**
 * Measured on Chrome 156: create() can hang indefinitely even when availability()
 * reports "available". Every create is therefore raced against a timeout.
 */
const DEFAULT_CREATE_TIMEOUT_MS = 120_000;
const DEFAULT_PROMPT_TIMEOUT_MS = 90_000;

// Minimal structural types, the DOM lib does not yet ship these.
interface NanoSession {
  prompt(input: string, opts?: Record<string, unknown>): Promise<string>;
  promptStreaming(input: string, opts?: Record<string, unknown>): ReadableStream<string>;
  clone(opts?: Record<string, unknown>): Promise<NanoSession>;
  destroy(): void;
  contextUsage?: number;
  contextWindow?: number;
  addEventListener?(type: string, listener: () => void): void;
}
interface NanoStatic {
  availability(opts?: Record<string, unknown>): Promise<Availability>;
  create(opts?: Record<string, unknown>): Promise<NanoSession>;
}

function nano(): NanoStatic {
  const g = globalThis as unknown as { LanguageModel?: NanoStatic };
  if (!g.LanguageModel) {
    throw new ModelUnavailableError(
      'Chrome built-in AI is not available in this browser. Requires Chrome 148+ on supported hardware.',
    );
  }
  return g.LanguageModel;
}

export function isSupported(): boolean {
  return typeof window !== 'undefined' && 'LanguageModel' in globalThis;
}

function withTimeout<T>(p: Promise<T>, ms: number, phase: 'create' | 'prompt'): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new ModelTimeoutError(phase, ms)), ms);
    p.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}

class NanoSessionAdapter implements ModelSession {
  constructor(private s: NanoSession) {}

  get contextUsage(): number { return this.s.contextUsage ?? 0; }
  get contextWindow(): number { return this.s.contextWindow ?? 9216; }

  async prompt(input: string, opts: PromptOptions = {}): Promise<string> {
    const call = this.s.prompt(input, {
      ...(opts.responseConstraint ? { responseConstraint: opts.responseConstraint } : {}),
      ...(opts.omitResponseConstraintInput ? { omitResponseConstraintInput: true } : {}),
      ...(opts.signal ? { signal: opts.signal } : {}),
    });
    return withTimeout(call, opts.timeoutMs ?? DEFAULT_PROMPT_TIMEOUT_MS, 'prompt');
  }

  async *promptStreaming(input: string, opts: PromptOptions = {}): AsyncIterable<string> {
    const stream = this.s.promptStreaming(input, {
      ...(opts.responseConstraint ? { responseConstraint: opts.responseConstraint } : {}),
      ...(opts.omitResponseConstraintInput ? { omitResponseConstraintInput: true } : {}),
      ...(opts.signal ? { signal: opts.signal } : {}),
    });
    const reader = stream.getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) return;
        if (value) yield value;
      }
    } finally {
      reader.releaseLock();
    }
  }

  async clone(): Promise<ModelSession> {
    return new NanoSessionAdapter(await this.s.clone());
  }

  destroy(): void {
    try { this.s.destroy(); } catch { /* already gone */ }
  }
}

export const chromeNanoProvider: ModelProvider = {
  id: 'chrome-nano',

  async availability(): Promise<Availability> {
    if (!isSupported()) return 'unavailable';
    try {
      return await nano().availability({
        expectedInputs: [{ type: 'text', languages: ['en'] }],
        expectedOutputs: [{ type: 'text', languages: ['en'] }],
      });
    } catch {
      return 'unavailable';
    }
  },

  async createSession(opts: SessionOptions): Promise<ModelSession> {
    const create = nano().create({
      initialPrompts: [{ role: 'system', content: opts.system }],
      ...(opts.samplingMode ? { samplingMode: opts.samplingMode } : {}),
      ...(opts.signal ? { signal: opts.signal } : {}),
      expectedInputs: [{ type: 'text', languages: ['en'] }],
      expectedOutputs: [{ type: 'text', languages: ['en'] }],
      monitor(m: { addEventListener(t: string, cb: (e: { loaded: number }) => void): void }) {
        m.addEventListener('downloadprogress', (e) => opts.onDownloadProgress?.(e.loaded));
      },
    });
    const session = await withTimeout(create, opts.createTimeoutMs ?? DEFAULT_CREATE_TIMEOUT_MS, 'create');
    return new NanoSessionAdapter(session);
  },
};
