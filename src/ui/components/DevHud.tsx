'use client';

import { useEffect, useState } from 'react';
import { getCalls, onCalls, type CallRecord } from '@/agents/session';

/**
 * What the model is actually doing.
 *
 * Every agent call is timed and recorded: which job, how long, whether it came
 * back valid, whether it needed a repair, and how much of the 9216 token
 * window it used. This is how you tell a slow turn from a failed one, and it
 * is the only way to see a fallback firing, because a fallback by design looks
 * exactly like a working game.
 *
 * Off by default. Toggled with the keyboard, never shipped as visible chrome.
 */
export function DevHud() {
  const [open, setOpen] = useState(false);
  const [calls, setCalls] = useState<CallRecord[]>([]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Ctrl+Shift+D, chosen to avoid colliding with browser shortcuts.
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    setCalls(getCalls());
    return onCalls(setCalls);
  }, [open]);

  if (!open) return null;

  const real = calls.filter((c) => c.ms > 0);
  const median = real.length
    ? [...real].map((c) => c.ms).sort((a, b) => a - b)[Math.floor(real.length / 2)]!
    : 0;
  const failures = calls.filter((c) => !c.ok).length;

  return (
    <aside className="hud" role="complementary" aria-label="Developer telemetry">
      <div className="hud__head">
        <span className="label label-strong">Model telemetry</span>
        <button className="btn btn-quiet" onClick={() => setOpen(false)}>Close</button>
      </div>

      <div className="hud__stats">
        <Stat k="calls" v={calls.length} />
        <Stat k="median" v={`${median}ms`} />
        <Stat k="failed" v={failures} warn={failures > 0} />
      </div>

      <ol className="hud__list">
        {[...calls].reverse().map((c) => (
          <li key={c.id} className="hud__row" data-ok={c.ok}>
            <span className="hud__job">{c.job}</span>
            <span className="stat-num hud__ms">{c.ms > 0 ? `${c.ms}ms` : ''}</span>
            <span className="hud__preview">{c.error ?? c.preview}</span>
          </li>
        ))}
        {!calls.length && <li className="meta-quiet">Nothing yet. Take a turn.</li>}
      </ol>

      <p className="meta-quiet hud__hint">Ctrl + Shift + D to close.</p>
    </aside>
  );
}

function Stat({ k, v, warn }: { k: string; v: string | number; warn?: boolean }) {
  return (
    <div className="hud__stat">
      <span className="label" style={{ fontSize: 'var(--text-xs)' }}>{k}</span>
      <span className="stat-num" style={{ color: warn ? 'var(--rubric)' : 'var(--content-1)' }}>{v}</span>
    </div>
  );
}
