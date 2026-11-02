import Link from 'next/link';
import { ThemeToggle } from '@/ui/components/ThemeToggle';

export const metadata = { title: 'About: dnthey' };

/** Server Component. Nothing here needs the model. */
export default function AboutPage() {
  return (
    <main className="min-h-dvh">
      <header className="play__bar gutter">
        <Link href="/" className="label label-strong" style={{ textDecoration: 'none' }}>dnthey</Link>
        <ThemeToggle />
      </header>

      <div className="gutter" style={{ maxWidth: '44rem', margin: '0 auto', padding: '2rem 0 4rem' }}>
        <h1>About</h1>

        <p className="prose-ink" style={{ marginTop: '1rem' }}>
          A solo Dungeons and Dragons campaign. An AI Dungeon Master invents the world,
          decides when the dice come out, and runs the monsters. A small party of AI
          players travels with you and makes its own choices.
        </p>

        <h2 style={{ marginTop: '2rem' }}>Everything runs on your machine</h2>
        <p className="prose-ink" style={{ marginTop: '0.6rem' }}>
          The model is Chrome&rsquo;s built in Gemini Nano, reached through the Prompt API.
          There is no account, no API key and no server. Nothing you type is sent anywhere,
          and once the model has downloaded the game works without a connection.
        </p>

        <h2 style={{ marginTop: '2rem' }}>The dice are real</h2>
        <p className="prose-ink" style={{ marginTop: '0.6rem' }}>
          The model is never asked what a die said. Every roll, every attack, every hit
          point and every death save is computed by a rules engine and shown to you with
          its full working: the face, each modifier, the total, and the number it had to
          beat. The model is told the outcome and writes what it means. If you ever see a
          number in the prose that disagrees with the dice tray, that is a bug.
        </p>

        <h2 style={{ marginTop: '2rem' }}>What it does not do yet</h2>
        <ul className="prose-ink" style={{ marginTop: '0.6rem', paddingLeft: '1.1rem' }}>
          <li>Spellcasting in combat. Attacks only, for now.</li>
          <li>Companions fight on a simple profile rather than full character sheets.</li>
          <li>A campaign lives in this browser. There is no account to carry it between devices.</li>
        </ul>

        <h2 style={{ marginTop: '2rem' }}>Licence</h2>
        <p className="meta" style={{ marginTop: '0.6rem', lineHeight: 1.7 }}>
          This product includes material from the System Reference Document 5.2.1
          (&ldquo;SRD 5.2.1&rdquo;) by Wizards of the Coast LLC, available under the{' '}
          <a href="https://creativecommons.org/licenses/by/4.0/legalcode" rel="noreferrer noopener" target="_blank">
            Creative Commons Attribution 4.0 International License
          </a>. Not affiliated with, endorsed, sponsored, or specifically approved by
          Wizards of the Coast LLC.
        </p>
        <p className="meta-quiet" style={{ marginTop: '1rem' }}>
          Source at <a href="https://github.com/Eeman1113/dnthey" rel="noreferrer noopener" target="_blank">github.com/Eeman1113/dnthey</a>.
        </p>
      </div>
    </main>
  );
}
