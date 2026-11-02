/** Provider-agnostic surface so the game never imports a browser API directly. */
export type Availability = 'unavailable' | 'downloadable' | 'downloading' | 'available';

export type SamplingMode = 'most-predictable' | 'balanced' | 'most-creative';

export interface SessionOptions {
  system: string;
  samplingMode?: SamplingMode;
  signal?: AbortSignal;
  onDownloadProgress?: (loaded: number) => void;
  /** Hard ceiling on create(); see BUILD_PROMPT.md Appendix B. */
  createTimeoutMs?: number;
}

export interface PromptOptions {
  /** JSON Schema. Produced from Zod via z.toJSONSchema(). */
  responseConstraint?: object;
  omitResponseConstraintInput?: boolean;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface ModelSession {
  prompt(input: string, opts?: PromptOptions): Promise<string>;
  promptStreaming(input: string, opts?: PromptOptions): AsyncIterable<string>;
  clone(): Promise<ModelSession>;
  destroy(): void;
  readonly contextUsage: number;
  readonly contextWindow: number;
}

export interface ModelProvider {
  readonly id: string;
  availability(): Promise<Availability>;
  createSession(opts: SessionOptions): Promise<ModelSession>;
}

export class ModelTimeoutError extends Error {
  constructor(public phase: 'create' | 'prompt', public ms: number) {
    super(`model ${phase} exceeded ${ms}ms`);
    this.name = 'ModelTimeoutError';
  }
}

export class ModelUnavailableError extends Error {
  constructor(message: string) { super(message); this.name = 'ModelUnavailableError'; }
}
