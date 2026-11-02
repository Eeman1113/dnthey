/**
 * Biome backdrops and creature art, selected by tag at runtime.
 * Same principle as portraits (§9.5): the DM invents a location, we match a plate.
 */

export interface BiomeEntry { id: string; label: string; tags: string[] }

export const BIOMES: BiomeEntry[] = [
  { id: 'dungeon-corridor', label: 'Dungeon', tags: ['dungeon', 'underground', 'stone', 'corridor', 'crypt', 'tomb', 'vault'] },
  { id: 'deep-forest', label: 'Deep Forest', tags: ['forest', 'wood', 'trees', 'wilderness', 'grove', 'jungle'] },
  { id: 'city-street', label: 'City Street', tags: ['city', 'street', 'town', 'urban', 'alley', 'market', 'slum'] },
  { id: 'tavern-interior', label: 'Tavern', tags: ['tavern', 'inn', 'alehouse', 'interior', 'hearth', 'common room'] },
  { id: 'crypt', label: 'Crypt', tags: ['crypt', 'tomb', 'catacomb', 'undead', 'burial', 'ossuary'] },
  { id: 'mountain-pass', label: 'Mountain Pass', tags: ['mountain', 'pass', 'cliff', 'peak', 'highland', 'ridge'] },
  { id: 'swamp', label: 'Swamp', tags: ['swamp', 'marsh', 'bog', 'fen', 'mire', 'wetland'] },
  { id: 'ancient-ruin', label: 'Ancient Ruin', tags: ['ruin', 'ruins', 'temple', 'overgrown', 'ancient', 'shrine'] },
  { id: 'keep-hall', label: 'Keep Hall', tags: ['keep', 'castle', 'hall', 'fortress', 'manor', 'court', 'throne'] },
  { id: 'underdark', label: 'Underdark', tags: ['underdark', 'cavern', 'cave', 'subterranean', 'deep', 'grotto'] },
  { id: 'open-road', label: 'Open Road', tags: ['road', 'moor', 'travel', 'plain', 'field', 'countryside', 'hills'] },
  { id: 'sea-coast', label: 'Sea Coast', tags: ['coast', 'sea', 'shore', 'cliffs', 'harbour', 'beach', 'ocean'] },
];

/** The SRD creatures we have art for. Everything else falls back to a glyph. */
export const CREATURE_ART = new Set([
  'goblin', 'kobold', 'bandit', 'skeleton', 'zombie', 'giant-rat',
  'orc', 'hobgoblin', 'gnoll', 'wolf', 'dire-wolf', 'giant-spider',
  'ghoul', 'wight', 'ogre', 'bugbear', 'harpy', 'animated-armor',
  'owlbear', 'troll', 'wraith', 'cultist', 'giant-boar', 'swarm-of-rats',
]);

export function creatureArt(monsterId: string): string | null {
  const slug = monsterId.toLowerCase().replace(/[\s_]+/g, '-');
  return CREATURE_ART.has(slug) ? `/assets/creatures/${slug}.webp` : null;
}

/**
 * Score a free-text location description against the biome tags. The DM writes
 * "the drowned causeway beneath Gallowmere" and we need a backdrop for it.
 */
export function matchBiome(description: string): { entry: BiomeEntry; score: number; src: string } {
  const text = description.toLowerCase();
  let best = BIOMES[0]!;
  let bestScore = 0;
  for (const b of BIOMES) {
    let score = 0;
    for (const tag of b.tags) if (text.includes(tag)) score += 1;
    if (score > bestScore) { bestScore = score; best = b; }
  }
  return { entry: best, score: bestScore, src: `/assets/biomes/${best.id}.webp` };
}
