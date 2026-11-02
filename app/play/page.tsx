import { PlayClient } from './PlayClient';

export const metadata = { title: 'Play: dnthey' };

/** Thin server wrapper. All play logic is a client island: the model is a window API. */
export default function PlayPage() {
  return <PlayClient />;
}
