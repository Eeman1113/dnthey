'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * How much of the bottom of the viewport is covered by a fixed bar.
 *
 * The creator docks the live character sheet there, so "is there room below
 * the term" is not the same question as "is there room below the term before
 * the bottom of the screen". Measured, not assumed: the dock's height tracks
 * the reader's text size.
 */
function bottomObstruction() {
  let worst = 0;
  for (const el of Array.from(document.querySelectorAll('[data-bottom-dock]'))) {
    if (getComputedStyle(el).position !== 'fixed') continue;
    const r = el.getBoundingClientRect();
    if (r.height === 0) continue;
    worst = Math.max(worst, window.innerHeight - r.top);
  }
  return Math.max(0, Math.min(worst, window.innerHeight));
}

/**
 * Touch affordance for the `[data-hint]` jargon help.
 *
 * The hints are CSS `:hover` tooltips, which is correct on a pointer, Apple
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
 *    elsewhere, Escape) and never on a timer, accessibility.md › Cognitive:
 *    "Minimize use of time-boxed interface elements... Prefer dismissing views
 *    with an explicit action."
 *  - It is announced to screen readers via a polite live region. Keyboard users
 *    reach the same text from the card's aria-label and, for the standalone
 *    terms in the character sheet, from `:focus-visible`.
 */
export function HintLayer() {
  /** Anchor rectangle of the tapped term; the popover is placed from it after
      it has been measured, because its height depends on the text. */
  const [pop, setPop] = useState<{ text: string; anchorTop: number; anchorBottom: number } | null>(null);
  /** Pointer tooltip. Separate from `pop`, which is the touch popover. */
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(null);
  const tipRef = useRef<HTMLDivElement | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);
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
        // wrong at 320px. Vertical placement is decided after measuring, in
        // the layout effect below.
        setPop({ text, anchorTop: Math.round(r.top), anchorBottom: Math.round(r.bottom) });
        return;
      }

      // Any other tap while a hint is open dismisses it first, popover-style.
      if (openRef.current) {
        e.preventDefault();
        e.stopPropagation();
        setPop(null);
      }
    };

    /**
     * Hover tooltip. This lives here rather than in CSS because a `::after`
     * anchored at the middle of the term cannot know where the viewport edge
     * is: on a left-column card the box ran off-screen and the start of the
     * sentence was unreadable. Positions are clamped below.
     */
    const onOver = (e: PointerEvent | MouseEvent) => {
      if (!fine()) return;
      const t = e.target as Element | null;
      if (!t || typeof t.closest !== 'function') return;
      const host = t.closest('[data-hint]') as HTMLElement | null;
      const text = host?.getAttribute('data-hint');
      if (!host || !text) return;
      const r = host.getBoundingClientRect();
      setTip({ text, x: r.left + r.width / 2, y: r.top });
    };

    const onOut = (e: PointerEvent | MouseEvent) => {
      const t = e.relatedTarget as Element | null;
      if (t && typeof t.closest === 'function' && t.closest('[data-hint]')) return;
      setTip(null);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { if (openRef.current) setPop(null); setTip(null); }
    };
    const close = () => { if (openRef.current) setPop(null); setTip(null); };

    // Both: pointer events are the modern path, but mouseover/mouseout keep
    // this working under synthetic input and older event pipelines.
    document.addEventListener('pointerover', onOver as EventListener, true);
    document.addEventListener('pointerout', onOut as EventListener, true);
    document.addEventListener('mouseover', onOver as EventListener, true);
    document.addEventListener('mouseout', onOut as EventListener, true);
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('pointerover', onOver as EventListener, true);
      document.removeEventListener('pointerout', onOut as EventListener, true);
      document.removeEventListener('mouseover', onOver as EventListener, true);
      document.removeEventListener('mouseout', onOut as EventListener, true);
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, []);

  // Measure then clamp: the tooltip's width depends on its text, so the only
  // honest way to keep it inside the viewport is to place it after layout.
  useEffect(() => {
    const el = tipRef.current;
    if (!el || !tip) return;
    const M = 8;
    const { width: w, height: h } = el.getBoundingClientRect();
    const left = Math.min(Math.max(M, tip.x - w / 2), window.innerWidth - w - M);
    const above = tip.y - h - 10;
    const top = above >= M ? above : tip.y + 26;   // flip under the term if it would clip the top
    el.style.left = `${Math.round(left)}px`;
    el.style.top = `${Math.round(top)}px`;
    el.style.visibility = 'visible';
  }, [tip]);

  /**
   * Place the touch popover.
   *
   * It prefers to sit below the term, because the card above it is the very
   * option the term describes and covering it would be self defeating. It
   * only fits below if there is room between the term and whatever covers
   * the bottom of the viewport: with the character sheet docked there, a
   * popover measured against the full window height was drawn half behind
   * the dock, taking its "Got it" button with it. Measuring the popover and
   * the obstruction is the only way to get this right at every text size.
   */
  useEffect(() => {
    const el = popRef.current;
    if (!el || !pop) return;
    const M = 8;
    const gap = 10;
    const h = el.getBoundingClientRect().height;
    const floor = window.innerHeight - bottomObstruction();
    const roomBelow = floor - pop.anchorBottom - gap;
    const roomAbove = pop.anchorTop - gap - M;

    let top: number;
    if (h <= roomBelow) top = pop.anchorBottom + gap;
    else if (h <= roomAbove) top = pop.anchorTop - gap - h;
    // Neither side fits, which happens at the largest text sizes. Pin it to
    // the top of the viewport, where the whole hint is at least readable.
    else top = M;

    el.style.top = `${Math.round(Math.max(M, top))}px`;
    el.style.visibility = 'visible';
  }, [pop]);

  if (!pop && !tip) return null;

  return (
    <>
      {tip && (
        <div
          ref={tipRef}
          role="tooltip"
          className="hint-tip"
          // Hidden for the first frame so the unclamped position is never painted.
          style={{ left: 0, top: 0, visibility: 'hidden' }}
        >
          {tip.text}
        </div>
      )}
      {pop && (
        <div
          ref={popRef}
          data-hint-pop
          role="status"
          aria-live="polite"
          className="hint-pop"
          // Placed by the layout effect above; hidden until then so the
          // unplaced position is never painted.
          style={{
            left: 'max(0.75rem, env(safe-area-inset-left))',
            right: 'max(0.75rem, env(safe-area-inset-right))',
            top: 0,
            visibility: 'hidden',
          }}
        >
          {pop.text}
          <div>
            <button type="button" className="hint-pop__close" onClick={() => setPop(null)}>
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
