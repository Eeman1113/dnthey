/**
 * Portrait selection. There is no image model on-device, so a companion the DM
 * invents at runtime cannot be painted, it is MATCHED against a pre-generated,
 * tagged library (BUILD_PROMPT.md §9.5).
 */

export interface PortraitEntry {
  id: string;
  species: string;
  /** Broad visual archetype, not the exact class, a paladin can wear a fighter. */
  archetype: 'martial' | 'arcane' | 'divine' | 'roguish' | 'bardic' | 'primal';
  mood: string;
  tags: string[];
}

export const PORTRAITS: PortraitEntry[] = [
  // martial
  { id: 'dwarf-fighter-scarred', species: 'dwarf', archetype: 'martial', mood: 'grim', tags: ['helm', 'beard', 'veteran'] },
  { id: 'human-paladin-stern', species: 'human', archetype: 'martial', mood: 'stern', tags: ['holy', 'armour', 'tired'] },
  { id: 'orc-barbarian-painted', species: 'orc', archetype: 'martial', mood: 'fierce', tags: ['warpaint', 'furs', 'tusks'] },
  { id: 'goliath-fighter-stone', species: 'goliath', archetype: 'martial', mood: 'impassive', tags: ['stone', 'huge'] },
  { id: 'dragonborn-paladin-bronze', species: 'dragonborn', archetype: 'martial', mood: 'noble', tags: ['holy', 'scales', 'bronze'] },
  { id: 'elf-fighter-cold', species: 'elf', archetype: 'martial', mood: 'cold', tags: ['scale', 'aloof'] },
  { id: 'goliath-barbarian-roaring', species: 'goliath', archetype: 'martial', mood: 'fierce', tags: ['tattoo', 'rage'] },
  { id: 'dragonborn-fighter-red', species: 'dragonborn', archetype: 'martial', mood: 'brutal', tags: ['scales', 'red', 'battered'] },
  // arcane
  { id: 'human-wizard-ancient', species: 'human', archetype: 'arcane', mood: 'wise', tags: ['old', 'hood', 'scholar'] },
  { id: 'elf-wizard-silver', species: 'elf', archetype: 'arcane', mood: 'cold', tags: ['silver', 'precise'] },
  { id: 'gnome-wizard-spectacles', species: 'gnome', archetype: 'arcane', mood: 'curious', tags: ['spectacles', 'scholar'] },
  { id: 'tiefling-sorcerer-violet', species: 'tiefling', archetype: 'arcane', mood: 'sly', tags: ['horns', 'charming'] },
  { id: 'halfling-sorcerer-copper', species: 'halfling', archetype: 'arcane', mood: 'eager', tags: ['young', 'glowing'] },
  { id: 'dragonborn-warlock-green', species: 'dragonborn', archetype: 'arcane', mood: 'ominous', tags: ['pact', 'scales'] },
  { id: 'tiefling-warlock-pale', species: 'tiefling', archetype: 'arcane', mood: 'ominous', tags: ['pact', 'blind-eye', 'eerie'] },
  // divine & primal
  { id: 'dwarf-cleric-stern-01', species: 'dwarf', archetype: 'divine', mood: 'stern', tags: ['beard', 'holy', 'veteran'] },
  { id: 'dwarf-cleric-braids', species: 'dwarf', archetype: 'divine', mood: 'resolute', tags: ['holy', 'scarred'] },
  { id: 'human-cleric-serene', species: 'human', archetype: 'divine', mood: 'serene', tags: ['holy', 'shaven'] },
  { id: 'goliath-cleric-stone', species: 'goliath', archetype: 'divine', mood: 'solemn', tags: ['holy', 'stone'] },
  { id: 'elf-druid-antler', species: 'elf', archetype: 'primal', mood: 'wild', tags: ['antler', 'nature'] },
  { id: 'halfling-druid-elder', species: 'halfling', archetype: 'primal', mood: 'kind', tags: ['old', 'leaves'] },
  { id: 'orc-druid-fetish', species: 'orc', archetype: 'primal', mood: 'wild', tags: ['bones', 'scarred'] },
  { id: 'gnome-druid-ancient', species: 'gnome', archetype: 'primal', mood: 'kind', tags: ['old', 'bird', 'nature'] },
  { id: 'orc-ranger-scarred', species: 'orc', archetype: 'primal', mood: 'watchful', tags: ['pelt', 'scarred'] },
  { id: 'elf-ranger-hooded', species: 'elf', archetype: 'primal', mood: 'watchful', tags: ['hood', 'bow', 'nature'] },
  { id: 'human-monk-still', species: 'human', archetype: 'divine', mood: 'serene', tags: ['shaven', 'ascetic'] },
  { id: 'halfling-monk-calm', species: 'halfling', archetype: 'divine', mood: 'serene', tags: ['young', 'ascetic'] },
  // roguish
  { id: 'halfling-rogue-scarred', species: 'halfling', archetype: 'roguish', mood: 'sly', tags: ['scar', 'hood'] },
  { id: 'human-rogue-hooded', species: 'human', archetype: 'roguish', mood: 'watchful', tags: ['hood', 'unshaven'] },
  { id: 'elf-rogue-blunt', species: 'elf', archetype: 'roguish', mood: 'cold', tags: ['hood', 'aloof'] },
  { id: 'gnome-rogue-hooded', species: 'gnome', archetype: 'roguish', mood: 'sly', tags: ['hood', 'tiny'] },
  { id: 'tiefling-rogue-masked', species: 'tiefling', archetype: 'roguish', mood: 'secretive', tags: ['masked', 'horns'] },
  { id: 'dwarf-rogue-soot', species: 'dwarf', archetype: 'roguish', mood: 'watchful', tags: ['soot', 'leathers'] },
  // bardic
  { id: 'human-bard-vain', species: 'human', archetype: 'bardic', mood: 'amused', tags: ['vain', 'courtly'] },
  { id: 'elf-bard-melancholy', species: 'elf', archetype: 'bardic', mood: 'melancholy', tags: ['courtly'] },
  { id: 'tiefling-bard-grinning', species: 'tiefling', archetype: 'bardic', mood: 'amused', tags: ['horns', 'theatrical'] },
  { id: 'gnome-bard-moustache', species: 'gnome', archetype: 'bardic', mood: 'cheerful', tags: ['moustache', 'theatrical'] },
];

const CLASS_ARCHETYPE: Record<string, PortraitEntry['archetype']> = {
  barbarian: 'martial', fighter: 'martial', paladin: 'martial',
  wizard: 'arcane', sorcerer: 'arcane', warlock: 'arcane',
  cleric: 'divine', monk: 'divine',
  druid: 'primal', ranger: 'primal',
  rogue: 'roguish', bard: 'bardic',
};

export interface MatchQuery {
  speciesId: string;
  classId: string;
  mood?: string;
  keywords?: string[];
  /** Portraits already taken by other party members. */
  exclude?: string[];
}

export interface MatchResult {
  entry: PortraitEntry | null;
  score: number;
  /** Below this, fall back to a procedural sigil rather than show a bad match. */
  confident: boolean;
  src: string | null;
  thumbSrc: string | null;
}

/**
 * Weighted scoring, per the manifest: species 3, archetype 2, mood 1, keyword 1 each.
 * Species dominates because a halfling face on an orc companion reads as a bug.
 */
export function matchPortrait(q: MatchQuery): MatchResult {
  const wantArchetype = CLASS_ARCHETYPE[q.classId];
  const exclude = new Set(q.exclude ?? []);
  let best: PortraitEntry | null = null;
  let bestScore = -1;

  for (const p of PORTRAITS) {
    if (exclude.has(p.id)) continue;
    let score = 0;
    if (p.species === q.speciesId) score += 3;
    if (wantArchetype && p.archetype === wantArchetype) score += 2;
    if (q.mood && p.mood === q.mood) score += 1;
    for (const k of q.keywords ?? []) {
      if (p.tags.includes(k.toLowerCase())) score += 1;
    }
    if (score > bestScore) { bestScore = score; best = p; }
  }

  const confident = bestScore >= 5; // species + archetype at minimum
  return {
    entry: best,
    score: bestScore,
    confident,
    src: confident && best ? `/assets/portraits/${best.id}.webp` : null,
    thumbSrc: confident && best ? `/assets/portraits/${best.id}@sm.webp` : null,
  };
}

/**
 * Deterministic fallback when nothing matches well: a seeded sigil, so the same
 * character always gets the same mark.
 */
export function sigilFor(seed: string): { hue: number; paths: string[] } {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  const rnd = () => { h = Math.imul(h ^ (h >>> 15), h | 1); return ((h ^ (h >>> 14)) >>> 0) / 4294967296; };
  const spokes = 5 + Math.floor(rnd() * 4);
  const paths: string[] = [];
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * Math.PI * 2;
    const r1 = 18 + rnd() * 10;
    const r2 = 30 + rnd() * 12;
    paths.push(
      `M ${50 + Math.cos(a) * r1} ${50 + Math.sin(a) * r1} L ${50 + Math.cos(a + 0.4) * r2} ${50 + Math.sin(a + 0.4) * r2}`,
    );
  }
  return { hue: Math.floor(rnd() * 360), paths };
}
