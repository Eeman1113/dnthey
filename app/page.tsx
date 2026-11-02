import Link from 'next/link';
import Image from 'next/image';
import { ModelStatus } from '@/ui/components/ModelStatus';
import { ThemeToggle } from '@/ui/components/ThemeToggle';

/** Server Component. Only the status pill is a client island. */
export default function TitlePage() {
  return (
    <main className="min-h-screen flex flex-col" style={{ position: 'relative', isolation: 'isolate' }}>
      {/* Title backdrop. Pushed well back so the type stays the subject. */}
      <div aria-hidden style={{ position: 'absolute', inset: 0, zIndex: -1, overflow: 'hidden' }}>
        <Image
          src="/assets/brand/title-backdrop.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          style={{ objectFit: 'cover', objectPosition: 'center 70%', opacity: 'var(--art-dim)' }}
        />
        <div
          style={{
            position: 'absolute', inset: 0,
            background:
              'radial-gradient(ellipse 70% 55% at 50% 42%, rgba(var(--scrim-rgb), 0.72), rgba(var(--scrim-rgb), 0.93) 70%),' +
              'linear-gradient(180deg, var(--ink-void) 0%, transparent 22%, transparent 72%, var(--ink-void) 100%)',
          }}
        />
      </div>
      <header className="flex items-center justify-between px-8 py-5">
        <span className="label-xs">dnthey</span>
        <div className="flex items-center gap-4">
          <ModelStatus />
          <ThemeToggle />
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-6 -mt-12">
        <p className="label-xs mb-5">A dungeon that runs itself</p>

        <h1
          className="text-center"
          style={{
            fontSize: 'clamp(2.75rem, 9vw, 6rem)',
            lineHeight: 0.95,
            color: 'var(--parchment)',
            textShadow: '0 0 60px rgba(200,162,74,0.12)',
          }}
        >
          The Table<br />
          <span style={{ color: 'var(--gold)' }}>Is Always Set</span>
        </h1>

        <div className="rule-gold w-72 my-8" />

        <p
          className="prose-ink text-center max-w-xl"
          style={{ color: 'var(--parchment-dim)', fontSize: '1.0625rem' }}
        >
          A full Dungeons &amp; Dragons campaign for one person. The Dungeon Master
          invents the world, calls for the rolls, and runs the monsters. Your party
          are players too — they argue, they improvise, and they can die.
          Everything thinks on your own machine.
        </p>

        <div className="flex gap-3 mt-10">
          <Link href="/create" className="btn btn-primary">Begin a new campaign</Link>
          <button className="btn" disabled>Continue</button>
        </div>

      </div>

      <footer className="px-8 py-5 flex justify-between items-end">
        <p className="label-xs" style={{ maxWidth: '38rem', lineHeight: 1.7, opacity: 0.55, textTransform: 'none', letterSpacing: 0 }}>
          Built on the System Reference Document 5.2.1, © Wizards of the Coast LLC,
          licensed under CC BY 4.0. Not affiliated with, endorsed, sponsored, or
          specifically approved by Wizards of the Coast LLC.
        </p>
      </footer>
    </main>
  );
}
