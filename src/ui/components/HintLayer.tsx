'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Touch affordance for the `[data-hint]` jargon help.
 *
 * The hints are CSS `:hover` tooltips, which is correct on a pointer — Apple
 * documents tooltips as exactly that (offering-help.md › Desktop: "tooltips can
 * appear when a person holds the pointer over an element"). A phone has no
 * hover, so the same text needs a tap affordance, and the jargon it explains
 * ("d8", "WIS", "expertise", "proficiency bonus") is precisely what a first-time
 * player cannot do without.
 *
 * Constraints this design respects:
 *
 *  - Most hint carriers are spans INSIDE a card `<button>`. Turning them into
 *    buttons would nest interactive elements, so instead a single document-level
 *    listener catches the tap in the capture phase, shows the hint, and stops
 *    the tap from also selecting the card. The markup stays unchanged.
 *  - Only touch and pen taps are intercepted. A mouse keeps the hover tooltip
 *    and keeps selecting cards on click, so desktop behaviour is untouched.
 *  - The popover is dismissed by an explicit action (tapping it, tapping
 *    elsewhere, Escape) and never on a timer — accessibility.md › Cognitive:
 *    "Minimize use of time-boxed interface elements... Prefer dismissing views
 *    with an explicit action."
 *  - It is announced to screen readers via a polite live region. Keyboard users
 *    reach the same text from the card's aria-label and, for the standalone
 *    terms in the character sheet, from `:focus-visible`.
 */
export function HintLayer() {
  const [pop, setPop] = useState<{ text: string; top?: number; bottom?: number } | null>(null);
  const openRef = useRef(false);
  const coarseRef = useRef(false);

  openRef.current = pop !== null;

  useEffect(() => {
    const fine = () =>
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    const onPointerDown = (e: PointerEvent) => {
      coarseRef.current = e.pointerType === 'touch' || e.pointerType === 'pen';
    };

    const onClick = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (!target || typeof target.closest !== 'function') return;

      // A tap inside the popover dismisses it, and is swallowed so it cannot
      // also fall through to whatever card sits behind it.
      if (openRef.current && target.closest('[data-hint-pop]')) {
        e.preventDefault();
        e.stopPropagation();
        setPop(null);
        return;
      }

      const touch = coarseRef.current || !fine();
      const host = touch ? (target.closest('[data-hint]') as HTMLElement | null) : null;
      const text = host?.getAttribute('data-hint');

      if (host && text) {
        e.preventDefault();
        e.stopPropagation();
        const r = host.getBoundingClientRect();
        // Full-width minus gutters, so there is no horizontal math to get
        // wrong at 320px. Below the term by preference — above it the card
        // would hide the very option the term describes — and above only when
        // the lower half of the screen has no room.
        setPop(
          window.innerHeight - r.bottom > 190
            ? { text, top: Math.round(r.bottom + 10) }
            : { text, bottom: Math.round(window.innerHeight - r.top + 10) },
        );
        return;
      }

      // Any other tap while a hint is open dismisses it first, popover-style.
      if (openRef.current) {
        e.preventDefault();
        e.stopPropagation();
        setPop(null);
      }
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && openRef.current) setPop(null);
    };
    const close = () => { if (openRef.current) setPop(null); };

    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, []);

  if (!pop) return null;

  return (
    <div
      data-hint-pop
      role="status"
      aria-live="polite"
      className="hint-pop"
      style={{
        left: 'max(0.75rem, env(safe-area-inset-left))',
        right: 'max(0.75rem, env(safe-area-inset-right))',
        top: pop.top,
        bottom: pop.bottom,
      }}
    >
      {pop.text}
      <div>
        <button type="button" className="hint-pop__close" onClick={() => setPop(null)}>
          Got it
        </button>
      </div>
    </div>
  );
}
