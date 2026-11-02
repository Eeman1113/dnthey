'use client';

/**
 * Local persistence. Static export means no server, so a campaign lives in
 * this browser only. Everything is wrapped because localStorage throws
 * outright in private mode rather than returning null.
 */
import type { Campaign } from './types';
import type { CharacterBuild } from '@/character/types';

const CAMPAIGN_KEY = 'dnthey.campaign';
const CHARACTERS_KEY = 'dnthey.characters';

export function saveCampaign(c: Campaign): boolean {
  try {
    // Beats are the bulk of it and grow without bound; keep the recent tail.
    const trimmed: Campaign = { ...c, beats: c.beats.slice(-120) };
    localStorage.setItem(CAMPAIGN_KEY, JSON.stringify(trimmed));
    return true;
  } catch { return false; }
}

export function loadCampaign(): Campaign | null {
  try {
    const raw = localStorage.getItem(CAMPAIGN_KEY);
    return raw ? (JSON.parse(raw) as Campaign) : null;
  } catch { return null; }
}

export function clearCampaign(): void {
  try { localStorage.removeItem(CAMPAIGN_KEY); } catch { /* nothing to do */ }
}

export function loadCharacters(): CharacterBuild[] {
  try {
    const raw = localStorage.getItem(CHARACTERS_KEY);
    const v = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? (v as CharacterBuild[]) : [];
  } catch { return []; }
}

export function saveCharacter(b: CharacterBuild): boolean {
  try {
    const all = loadCharacters().filter((c) => c.id !== b.id);
    all.push(b);
    localStorage.setItem(CHARACTERS_KEY, JSON.stringify(all.slice(-20)));
    return true;
  } catch { return false; }
}
