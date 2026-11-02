/**
 * Seeded, auditable randomness. Every die roll in the game comes from here so that
 * a campaign can be replayed exactly from its event log (BUILD_PROMPT.md §1.5).
 *
 * mulberry32: small, fast, well-distributed 32-bit PRNG. Not cryptographic -
 * it does not need to be, and determinism is the whole point.
 */
export class Rng {
  private state: number;

  constructor(seed: number | string) {
    this.state = typeof seed === 'string' ? Rng.hashSeed(seed) : seed >>> 0;
  }

  /** FNV-1a, turns a campaign/event id into a usable 32-bit seed. */
  static hashSeed(s: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }

  /** Next float in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Integer in [1, sides]. */
  die(sides: number): number {
    if (!Number.isInteger(sides) || sides < 1) throw new Error(`bad die: d${sides}`);
    return Math.floor(this.next() * sides) + 1;
  }

  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    if (max < min) throw new Error(`bad range: ${min}..${max}`);
    return min + Math.floor(this.next() * (max - min + 1));
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('pick from empty array');
    return items[this.int(0, items.length - 1)]!;
  }

  /** Fisher-Yates, returns a new array. */
  shuffle<T>(items: readonly T[]): T[] {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [out[i], out[j]] = [out[j]!, out[i]!];
    }
    return out;
  }

  /** Snapshot/restore so a roll can be replayed without re-running history. */
  getState(): number { return this.state; }
  setState(s: number): void { this.state = s >>> 0; }
}
