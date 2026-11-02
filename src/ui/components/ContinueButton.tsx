'use client';

import { useEffect, useState } from 'react';

const SAVE_KEY = 'dnthey.characters';

/**
 * The title screen's second action.
 *
 * It cannot work yet, because the play screen is not built. That is a fine
 * reason for a control to be unavailable and a bad reason for it to say
 * nothing: gestures.md > Best practices, on unavailable controls, "If you
 * don't clearly communicate why a gesture doesn't work, people might think
 * your app has frozen or they aren't performing the gesture correctly".
 *
 * So the button explains itself, and the explanation is true in both of the
 * two situations it can be in: nothing saved yet, or characters saved and
 * nowhere to play them. It uses `aria-disabled` rather than `disabled`,
 * because a disabled button is out of the tab order and fires no pointer
 * events, which would put the explanation out of reach of exactly the people
 * most likely to need it. The hint text is also attached as a description so
 * a screen reader reads it with the button.
 */
export function ContinueButton() {
  const [saved, setSaved] = useState<number | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      setSaved(Array.isArray(parsed) ? parsed.length : 0);
    } catch {
      setSaved(0);
    }
  }, []);

  const why =
    saved === null
      ? 'Looking for saved characters on this device.'
      : saved === 0
        ? 'Nothing saved on this device yet. Begin a new campaign to make your first character.'
        : `${saved} character${saved === 1 ? '' : 's'} saved on this device. Playing a campaign is the next part being built.`;

  return (
    <>
      <button
        className="btn"
        aria-disabled="true"
        aria-describedby="continue-why"
        data-hint={why}
        onClick={(e) => e.preventDefault()}
      >
        Continue
      </button>
      <span id="continue-why" className="sr-only">{why}</span>
    </>
  );
}
