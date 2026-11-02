'use client';

import { useEffect, useState } from 'react';
import type { Availability } from '@/model/types';

type State = { status: Availability | 'checking'; progress: number };

/**
 * Honest reporting of the on-device model's state. Deliberately never claims
 * "ready" just because availability() says "available" — see BUILD_PROMPT.md Appendix B.
 */
export function ModelStatus({ compact = false }: { compact?: boolean }) {
  const [state, setState] = useState<State>({ status: 'checking', progress: 0 });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!('LanguageModel' in globalThis)) {
        if (!cancelled) setState({ status: 'unavailable', progress: 0 });
        return;
      }
      const { chromeNanoProvider } = await import('@/model/chrome-nano');
      const a = await chromeNanoProvider.availability();
      if (!cancelled) setState({ status: a, progress: 0 });
    })();
    return () => { cancelled = true; };
  }, []);

  const label: Record<Availability | 'checking', string> = {
    checking: 'checking for a Dungeon Master…',
    available: 'Dungeon Master ready',
    downloadable: 'Dungeon Master must be summoned',
    downloading: `summoning… ${Math.round(state.progress * 100)}%`,
    unavailable: 'no on-device model',
  };

  const dot: Record<Availability | 'checking', string> = {
    checking: 'var(--parchment-faint)',
    available: 'var(--success)',
    downloadable: 'var(--gold)',
    downloading: 'var(--gold)',
    unavailable: 'var(--failure)',
  };

  return (
    <div className="flex items-center gap-2" title={`Prompt API status: ${state.status}`}>
      <span
        aria-hidden
        style={{
          width: 7, height: 7, borderRadius: 999, background: dot[state.status],
          boxShadow: `0 0 8px ${dot[state.status]}`,
          animation: state.status === 'checking' || state.status === 'downloading'
            ? 'pulse 1.6s ease-in-out infinite' : undefined,
        }}
      />
      <span className="label-xs" style={{ letterSpacing: '0.1em' }}>
        {compact ? state.status : label[state.status]}
      </span>
      <style>{`@keyframes pulse { 0%,100% { opacity: 1 } 50% { opacity: 0.35 } }`}</style>
    </div>
  );
}
