'use client';

import { useEffect, useState } from 'react';

export type ThemePref = 'light' | 'dark' | 'system';
const KEY = 'dnthey.theme';

/** Applied by the inline script in layout.tsx too — keep the two in agreement. */
export function applyTheme(pref: ThemePref) {
  const root = document.documentElement;
  if (pref === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', pref);
  try { localStorage.setItem(KEY, pref); } catch { /* private mode */ }
}

export function ThemeToggle() {
  const [pref, setPref] = useState<ThemePref>('system');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    let stored: string | null = null;
    try { stored = localStorage.getItem(KEY); } catch { /* private mode */ }
    setPref(stored === 'light' || stored === 'dark' ? stored : 'system');
    setMounted(true);
  }, []);

  const choose = (p: ThemePref) => { setPref(p); applyTheme(p); };

  const options: { id: ThemePref; label: string; glyph: string }[] = [
    { id: 'light', label: 'Light', glyph: '☀' },
    { id: 'dark', label: 'Dark', glyph: '☾' },
    { id: 'system', label: 'System', glyph: '◐' },
  ];

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className="flex items-center gap-0.5 p-0.5"
      style={{ border: '1px solid var(--hairline)', borderRadius: 8, background: 'var(--panel)' }}
    >
      {options.map((o) => {
        // Before mount we do not know the stored value; render unselected rather
        // than guessing, so the control never flickers to the wrong state.
        const active = mounted && pref === o.id;
        return (
          <button
            key={o.id}
            role="radio"
            aria-checked={active}
            aria-label={o.label}
            title={o.label}
            onClick={() => choose(o.id)}
            /* Size lives in CSS (.theme-btn) so touch can widen these to 44pt
               without disturbing the 30x28 desktop metrics. */
            className="theme-btn"
            style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '0.875rem',
              lineHeight: 1,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 6,
              border: 'none',
              cursor: 'pointer',
              background: active ? 'var(--raised)' : 'transparent',
              color: active ? 'var(--rubric)' : 'var(--content-3)',
              transition: 'color 120ms, background 120ms',
            }}
          >
            {o.glyph}
          </button>
        );
      })}
    </div>
  );
}
