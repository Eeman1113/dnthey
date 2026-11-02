'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const CHARACTERS_KEY = 'dnthey.characters';
const CAMPAIGN_KEY = 'dnthey.campaign';

/**
 * The title screen's second action.
 *
 * It has three honest states rather than one permanently dead control:
 * a campaign in progress to resume, a character saved and ready to start a
 * campaign with, or nothing yet. It stays `aria-disabled` rather than
 * `disabled` in the empty case, because a disabled button is out of the tab
 * order and fires no pointer events, which would put the explanation out of
 * reach of exactly the people most likely to need it
 * (gestures.md > Best practices).
 */
export function ContinueButton() {
  const [state, setState] = useState<'loading' | 'campaign' | 'character' | 'empty'>('loading');

  useEffect(() => {
    try {
      if (window.localStorage.getItem(CAMPAIGN_KEY)) { setState('campaign'); return; }
      const raw = window.localStorage.getItem(CHARACTERS_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      setState(Array.isArray(parsed) && parsed.length ? 'character' : 'empty');
    } catch {
      setState('empty');
    }
  }, []);

  if (state === 'campaign') {
    return (
      <Link href="/play" className="btn" style={{ textDecoration: 'none' }}>
        Resume campaign
      </Link>
    );
  }

  if (state === 'character') {
    return (
      <Link href="/play" className="btn" style={{ textDecoration: 'none' }}>
        Play a saved character
      </Link>
    );
  }

  const hint = 'Nothing saved on this device yet. Begin a new campaign to make your first character.';
  return (
    <button
      type="button"
      className="btn"
      aria-disabled="true"
      data-hint={hint}
      aria-describedby="continue-hint"
      onClick={(e) => e.preventDefault()}
      style={{ opacity: 0.45, cursor: 'not-allowed' }}
    >
      Continue
      <span id="continue-hint" className="sr-only">{hint}</span>
    </button>
  );
}
