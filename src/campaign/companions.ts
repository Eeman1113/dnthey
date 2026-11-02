import type { CompanionCard } from '@/agents/dm';

/**
 * A small cast with real friction. Two is deliberate: each companion costs a
 * model call per beat, and at about 5s a call a party of four would add
 * twenty seconds of waiting to every turn.
 */
export const COMPANION_POOL: CompanionCard[] = [
  {
    id: 'brakka', name: 'Brakka', pronouns: 'she/her', species: 'orc', klass: 'barbarian',
    voice: 'Blunt, short sentences, allergic to plans. Calls the player "little one" regardless of their size.',
    want: 'To settle a debt owed to her by someone in this region.',
    flaw: 'Solves problems by hitting them, then apologises later, badly.',
    portraitId: 'barbarian',
  },
  {
    id: 'veladrin', name: 'Veladrin', pronouns: 'he/him', species: 'human', klass: 'wizard',
    voice: 'Precise, faintly condescending, fond of correcting details nobody asked about.',
    want: 'To find a page torn from a book he was supposed to be guarding.',
    flaw: 'Cannot leave a mystery alone, even when leaving is the sensible move.',
    portraitId: 'wizard',
  },
  {
    id: 'pell', name: 'Pell', pronouns: 'they/them', species: 'halfling', klass: 'rogue',
    voice: 'Cheerful, quick, deflects everything with a joke. Never answers a question directly the first time.',
    want: 'To get far away from the city they grew up in, and stay away.',
    flaw: 'Takes things. Small things, constantly, without really deciding to.',
    portraitId: 'rogue',
  },
  {
    id: 'ysolde', name: 'Ysolde', pronouns: 'she/her', species: 'human', klass: 'cleric',
    voice: 'Calm and unhurried. Asks the question everyone else is avoiding.',
    want: 'To understand why her god stopped answering three years ago.',
    flaw: 'Will not lie, even when a lie would save everyone a great deal of trouble.',
    portraitId: 'cleric',
  },
];

export function pickCompanions(seed: string, count = 2): CompanionCard[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  const pool = [...COMPANION_POOL];
  const out: CompanionCard[] = [];
  for (let i = 0; i < count && pool.length; i++) {
    h = Math.imul(h ^ (h >>> 15), h | 1);
    out.push(pool.splice(Math.abs(h) % pool.length, 1)[0]!);
  }
  return out;
}
