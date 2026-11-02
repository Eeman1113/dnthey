import Link from 'next/link';
import Image from 'next/image';
import { ModelStatus } from '@/ui/components/ModelStatus';
import { ThemeToggle } from '@/ui/components/ThemeToggle';

export default function TitlePage() {
  return (
    <main className="min-h-dvh flex flex-col" style={{ position: 'relative', isolation: 'isolate' }}>
      <div aria-hidden style={{ position: 'absolute', inset: 0, zIndex: -1, overflow: 'hidden' }}>
        <Image
          src="/assets/brand/title-backdrop.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          style={{ objectFit: 'cover', objectPosition: 'center 68%', opacity: 'var(--art-dim)' }}
        />
        <div
          style={{
            position: 'absolute', inset: 0,
            background:
              'radial-gradient(ellipse 72% 58% at 50% 46%, rgba(var(--scrim-rgb), 0.70), rgba(var(--scrim-rgb), 0.94) 72%),' +
              'linear-gradient(180deg, var(--surface) 0%, transparent 24%, transparent 70%, var(--surface) 100%)',
          }}
        />
      </div>

      {/* One row on desktop. On a phone the model-status line — which can read
          "Dungeon Master must be summoned" — wraps to its own row rather than
          squeezing the brand and the theme control. */}
      <header className="title-bar gutter">
        <span className="label label-strong title-bar__brand">dnthey</span>
        <div className="title-bar__toggle"><ThemeToggle /></div>
        <div className="title-bar__status"><ModelStatus /></div>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center gutter py-8 text-center hero-lift">
        <p className="label" style={{ marginBottom: '1.25rem' }}>A dungeon that runs itself</p>

        {/* The lower bound drops to 2.25rem so "Is Always Set" still fits on one
            line inside a 320px viewport without a horizontal scroll. */}
        <h1 style={{ fontSize: 'clamp(2.25rem, 8.5vw, 5.5rem)', lineHeight: 0.98, maxWidth: '16ch' }}>
          The Table<br />Is Always Set
        </h1>

        {/* The only gold on the page: one illuminated rule. Gold is precious here. */}
        <div
          aria-hidden
          style={{
            width: '11rem', height: 1, margin: '2.25rem 0',
            background: 'linear-gradient(90deg, transparent, var(--gold) 50%, transparent)',
            opacity: 0.85,
          }}
        />

        <p className="prose-ink" style={{ maxWidth: '38rem', color: 'var(--content-2)', fontSize: '1.0625rem' }}>
          A full Dungeons &amp; Dragons campaign for one person. The Dungeon Master
          invents the world, calls for the rolls, and runs the monsters. Your party
          are players too — they argue, they improvise, and they can die.
        </p>

        <div className="cta-row mt-9">
          <Link href="/create" className="btn btn-primary" style={{ padding: '0.6rem 1.35rem' }}>
            Begin a new campaign
          </Link>
          <button className="btn" disabled>Continue</button>
        </div>
      </div>

      <footer className="gutter py-6">
        <p className="meta-quiet" style={{ maxWidth: '42rem', fontSize: '0.75rem', lineHeight: 1.6 }}>
          Built on the System Reference Document 5.2.1, © Wizards of the Coast LLC,
          licensed under CC BY 4.0. Not affiliated with, endorsed, sponsored, or
          specifically approved by Wizards of the Coast LLC.
        </p>
      </footer>
    </main>
  );
}
