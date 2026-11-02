import type { Metadata } from 'next';
import { IM_Fell_English, IM_Fell_English_SC, Libre_Caslon_Text } from 'next/font/google';
import localFont from 'next/font/local';
import './globals.css';
import { HintLayer } from '@/ui/components/HintLayer';

/**
 * Typography: 17th-century types. IM Fell was cut for the Oxford University Press
 * in the 1600s — it carries the ink-bleed and irregularity of letterpress, which is
 * exactly the register this game wants. Self-hosted at build time by next/font.
 */
const fellSC = IM_Fell_English_SC({
  weight: '400', subsets: ['latin'], display: 'swap', variable: '--f-display',
});
const fell = IM_Fell_English({
  weight: '400', style: ['normal', 'italic'], subsets: ['latin'], display: 'swap', variable: '--f-fell',
});
const caslon = Libre_Caslon_Text({
  weight: ['400', '700'], style: ['normal', 'italic'], subsets: ['latin'], display: 'swap', variable: '--f-prose',
});

/** Yinit: public-domain illuminated capitals, subset to A–Z for drop caps. */
const yinit = localFont({
  src: '../public/fonts/yinit-caps.woff2',
  display: 'swap',
  variable: '--f-initial',
  preload: false,
});

export const metadata: Metadata = {
  title: 'dnthey — a dungeon that runs itself',
  description:
    'A solo Dungeons & Dragons campaign with an AI Dungeon Master and a party of AI players, running entirely on-device in your browser.',
  openGraph: {
    title: 'dnthey — a dungeon that runs itself',
    description: 'A full D&D campaign for one person, with an AI Dungeon Master and a party of AI players.',
    images: ['/assets/brand/og.webp'],
  },
};

export const viewport = {
  // `cover` is what makes env(safe-area-inset-*) report real numbers, so the
  // bottom dock and the page gutters can clear the home indicator and the
  // rounded corners (layout.md › Guides and safe areas). Zoom is deliberately
  // left unrestricted — no maximumScale, no userScalable.
  viewportFit: 'cover' as const,
  // Tells the browser chrome (address bar, scrollbars) which theme is active.
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#e4dcc6' },
    { media: '(prefers-color-scheme: dark)', color: '#0b0b0e' },
  ],
};

/**
 * Runs before first paint so a stored light/dark choice never flashes the wrong
 * theme. "system" deliberately sets no attribute and lets the media query decide.
 */
const themeScript = `(function(){try{var p=localStorage.getItem('dnthey.theme');
if(p==='light'||p==='dark'){document.documentElement.setAttribute('data-theme',p);}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${fellSC.variable} ${fell.variable} ${caslon.variable} ${yinit.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        {children}
        <HintLayer />
      </body>
    </html>
  );
}
