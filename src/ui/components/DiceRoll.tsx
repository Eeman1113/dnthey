'use client';

import { useEffect, useRef } from 'react';
import { animate, createScope, type Scope } from 'animejs';
import type { D20Result } from '@/engine/dtest';
import { formatMod } from '@/engine/types';

/**
 * The roll, shown in full.
 *
 * Players trust numbers they watch land, so this renders the audit record the
 * engine produced: the face, every modifier, the total, and the DC it was
 * measured against. Nothing here is decorative, and nothing is invented.
 */
export function DiceRoll({ roll }: { roll: D20Result }) {
  const root = useRef<HTMLDivElement>(null);
  const scope = useRef<Scope | null>(null);

  useEffect(() => {
    if (!root.current) return;
    // createScope keeps selectors inside this component and reverts on unmount,
    // which React Strict Mode's double invoke otherwise turns into double animations.
    scope.current = createScope({ root: root.current }).add(() => {
      animate('.die-face', {
        scale: [0.6, 1.08, 1], rotate: [-28, 6, 0], opacity: [0, 1],
        duration: 520, ease: 'outBack',
      });
      animate('.mod-chip', {
        opacity: [0, 1], y: [6, 0], delay: (_el, i) => 240 + (i ?? 0) * 70, duration: 260,
      });
      animate('.roll-total', { opacity: [0, 1], x: [-6, 0], delay: 460, duration: 280 });
    });
    return () => scope.current?.revert();
  }, []);

  const kept = roll.dice.find((d) => d.kept)!;
  const pass = roll.success;

  return (
    <div ref={root} className="dice-roll" data-outcome={pass === undefined ? 'none' : pass ? 'pass' : 'fail'}>
      <div className="die-face stat-num" aria-hidden>{kept.value}</div>
      <div className="dice-roll__body">
        <div className="dice-roll__reason label">{roll.reason}</div>
        <div className="dice-roll__maths">
          <span className="mod-chip stat-num">d20 {kept.value}</span>
          {roll.modifiers.map((m, i) => (
            <span key={i} className="mod-chip stat-num">{formatMod(m.value)} {m.label}</span>
          ))}
          <span className="roll-total stat-num">
            = {roll.total}{roll.dc !== undefined ? ` vs ${roll.dc}` : ''}
          </span>
        </div>
      </div>
      {pass !== undefined && (
        <div className="dice-roll__verdict">
          {roll.isNat20 ? 'Natural 20' : roll.isNat1 ? 'Natural 1' : pass ? 'Success' : 'Failure'}
        </div>
      )}
    </div>
  );
}
