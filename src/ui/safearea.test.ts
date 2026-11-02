import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * Safe area insets cannot be exercised without a notched device, and
 * env() cannot be read or written from script, so the behaviour is verified
 * two ways: these static guards, and a runtime probe that substitutes a real
 * device's numbers into the tokens (see the --sai-* block in globals.css).
 *
 * The bug these exist to prevent: three rules used
 * `env(safe-area-inset-left)` inside a padding shorthand, which applies the
 * LEFT inset to BOTH sides. Correct in portrait where the two match, wrong in
 * landscape on a notched phone where they do not, pushing content 59px off
 * the side that has no notch.
 */

const css = readFileSync('app/globals.css', 'utf8');
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '');
const code = stripComments(css);

describe('safe area insets', () => {
  it('reads env() exactly once per side, into a token', () => {
    for (const side of ['top', 'right', 'bottom', 'left']) {
      const uses = code.match(new RegExp(`env\\(safe-area-inset-${side}`, 'g')) ?? [];
      expect(uses.length, `safe-area-inset-${side} should be read once`).toBe(1);
    }
  });

  it('declares all four tokens with a zero fallback', () => {
    for (const side of ['top', 'right', 'bottom', 'left']) {
      expect(code).toContain(`--sai-${side}: env(safe-area-inset-${side}, 0px)`);
    }
  });

  it('never puts a single inset in a padding shorthand, which would hit both sides', () => {
    // A 2 or 3 value padding shorthand sets left AND right from one value.
    const offenders: string[] = [];
    for (const line of code.split('\n')) {
      const m = /padding:\s*([^;]+);/.exec(line);
      if (!m) continue;
      const value = m[1]!;
      if (!/--sai-(left|right)/.test(value)) continue;
      // Count top level values: a 4 value shorthand is fine, fewer is not.
      const parts = value.replace(/\([^()]*\)/g, 'x').trim().split(/\s+/);
      if (parts.length < 4) offenders.push(line.trim());
    }
    expect(offenders).toEqual([]);
  });

  it('pairs the horizontal tokens with their own side', () => {
    // padding-left must never be fed the right inset, and vice versa.
    expect(code).not.toMatch(/padding-left:[^;]*--sai-right/);
    expect(code).not.toMatch(/padding-right:[^;]*--sai-left/);
    expect(code).not.toMatch(/margin-left:[^;]*--sai-right/);
    expect(code).not.toMatch(/margin-right:[^;]*--sai-left/);
  });

  it('floors every inset against a real gutter, so a zero inset still has padding', () => {
    // Every horizontal use should be inside a max() with something non zero.
    const bare = code.match(/padding-(left|right):\s*var\(--sai-(left|right)\)/g) ?? [];
    expect(bare).toEqual([]);
  });

  it('is enabled at all: cover is what makes the insets report real numbers', () => {
    const layout = readFileSync('app/layout.tsx', 'utf8');
    expect(layout).toContain("viewportFit: 'cover'");
  });
});
