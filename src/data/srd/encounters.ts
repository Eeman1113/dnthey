/**
 * Playable stat blocks for the creatures we have art for.
 * Trimmed to what combat actually needs: the engine resolves attacks, so each
 * creature needs AC, HP, an attack bonus and a damage die, nothing more.
 */
export interface Monster {
  id: string; name: string; cr: number; xp: number;
  ac: number; hp: number; speed: number;
  attack: { name: string; toHit: number; damage: string; bonus: number };
  /** Flavour the Narrator is handed so fights are not all identical. */
  doctrine: string;
}

export const MONSTERS: Monster[] = [
  { id: 'goblin', name: 'Goblin', cr: 0.25, xp: 50, ac: 15, hp: 7, speed: 30,
    attack: { name: 'scimitar', toHit: 4, damage: '1d6', bonus: 2 },
    doctrine: 'darts in, strikes, scurries behind cover' },
  { id: 'kobold', name: 'Kobold', cr: 0.125, xp: 25, ac: 12, hp: 5, speed: 30,
    attack: { name: 'dagger', toHit: 4, damage: '1d4', bonus: 2 },
    doctrine: 'only brave in numbers, flees alone' },
  { id: 'bandit', name: 'Bandit', cr: 0.125, xp: 25, ac: 12, hp: 11, speed: 30,
    attack: { name: 'scimitar', toHit: 3, damage: '1d6', bonus: 1 },
    doctrine: 'in it for coin, surrenders when losing' },
  { id: 'skeleton', name: 'Skeleton', cr: 0.25, xp: 50, ac: 13, hp: 13, speed: 30,
    attack: { name: 'shortsword', toHit: 4, damage: '1d6', bonus: 2 },
    doctrine: 'feels nothing, never retreats' },
  { id: 'zombie', name: 'Zombie', cr: 0.25, xp: 50, ac: 8, hp: 22, speed: 20,
    attack: { name: 'slam', toHit: 3, damage: '1d6', bonus: 1 },
    doctrine: 'slow, relentless, absorbs punishment' },
  { id: 'giant-rat', name: 'Giant Rat', cr: 0.125, xp: 25, ac: 12, hp: 7, speed: 30,
    attack: { name: 'bite', toHit: 4, damage: '1d4', bonus: 2 },
    doctrine: 'swarms, bites, scatters' },
  { id: 'wolf', name: 'Wolf', cr: 0.25, xp: 50, ac: 13, hp: 11, speed: 40,
    attack: { name: 'bite', toHit: 4, damage: '2d4', bonus: 2 },
    doctrine: 'circles, cuts off escape, goes for the weakest' },
  { id: 'orc', name: 'Orc', cr: 0.5, xp: 100, ac: 13, hp: 15, speed: 30,
    attack: { name: 'greataxe', toHit: 5, damage: '1d12', bonus: 3 },
    doctrine: 'charges the strongest thing it can see' },
  { id: 'hobgoblin', name: 'Hobgoblin', cr: 0.5, xp: 100, ac: 18, hp: 11, speed: 30,
    attack: { name: 'longsword', toHit: 3, damage: '1d8', bonus: 1 },
    doctrine: 'disciplined, holds formation, exploits openings' },
  { id: 'cultist', name: 'Cultist', cr: 0.125, xp: 25, ac: 12, hp: 9, speed: 30,
    attack: { name: 'sickle', toHit: 3, damage: '1d4', bonus: 1 },
    doctrine: 'fanatical, fights past the point of sense' },
];

export const MONSTERS_BY_ID = Object.fromEntries(MONSTERS.map((m) => [m.id, m]));

/**
 * XP Budget per Character (2024 DMG). The budget is a CEILING and there is no
 * 2014 style multiplier: the raw XP of the chosen creatures is compared to it
 * directly.
 */
export const XP_BUDGET: Record<number, { low: number; moderate: number; high: number }> = {
  1: { low: 50, moderate: 75, high: 100 },
  2: { low: 100, moderate: 150, high: 200 },
  3: { low: 150, moderate: 225, high: 400 },
  4: { low: 250, moderate: 375, high: 500 },
  5: { low: 500, moderate: 750, high: 1100 },
};

/** Build an encounter that fits the budget. Never exceeds it. */
export function buildEncounter(
  partyLevel: number, partySize: number, difficulty: 'low' | 'moderate' | 'high',
  pick: (n: number) => number, themeIds?: string[],
): Monster[] {
  const perHead = XP_BUDGET[Math.min(5, Math.max(1, partyLevel))]!;
  let budget = perHead[difficulty] * partySize;

  const pool = themeIds?.length
    ? MONSTERS.filter((m) => themeIds.includes(m.id))
    : MONSTERS;
  const affordable = () => pool.filter((m) => m.xp <= budget);

  const out: Monster[] = [];
  while (out.length < 6) {
    const options = affordable();
    if (!options.length) break;
    const m = options[pick(options.length)]!;
    out.push(m);
    budget -= m.xp;
  }
  return out.length ? out : [MONSTERS_BY_ID['kobold']!];
}
