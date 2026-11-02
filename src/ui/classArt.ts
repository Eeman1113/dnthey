/**
 * Class card artwork: bright, full-colour busts with transparent backgrounds.
 *
 * These are a deliberately different register from the campaign art. The scene
 * plates and bestiary are dark inked manuscript illustration, which is right
 * for atmosphere but turns to mud at thumbnail size. A class card is a UI
 * control, so its art has to stay legible at 80px: front-lit, saturated, strong
 * silhouette, and cut out so it sits on the card surface rather than carrying a
 * competing rectangle of its own background.
 */
export const CLASS_ART: Record<string, { id: string; alt: string }> = {
  barbarian: { id: 'barbarian', alt: 'A green-skinned orc barbarian with tusks, red war paint and a fur mantle' },
  bard:      { id: 'bard',      alt: 'A grinning lavender-skinned tiefling bard in an embroidered coat and feathered cap' },
  cleric:    { id: 'cleric',    alt: 'A serene shaven-headed human cleric in pale robes with a gold sun pendant' },
  druid:     { id: 'druid',     alt: 'An elf druid with an antler circlet and flowers in auburn braided hair' },
  fighter:   { id: 'fighter',   alt: 'A dwarf fighter in a polished steel helm with a copper-red braided beard' },
  monk:      { id: 'monk',      alt: 'A calm halfling monk with a topknot in a simple teal wrapped robe' },
  paladin:   { id: 'paladin',   alt: 'A silver-haired human paladin in a steel gorget over a coral-red tabard' },
  ranger:    { id: 'ranger',    alt: 'A wood elf ranger in a leaf-trimmed green hood with a bow over the shoulder' },
  rogue:     { id: 'rogue',     alt: 'A freckled halfling rogue with auburn curls and a dark teal hood' },
  sorcerer:  { id: 'sorcerer',  alt: 'A coral-skinned tiefling sorcerer with white hair and glowing periwinkle eyes' },
  warlock:   { id: 'warlock',   alt: 'A bone-pale tiefling warlock with curling black horns and one clouded eye' },
  wizard:    { id: 'wizard',    alt: 'An old human wizard with a long white beard in a deep blue pointed hood' },
};

export function classArtSrc(classId: string): { src: string; thumb: string; alt: string } | null {
  const a = CLASS_ART[classId];
  if (!a) return null;
  return {
    src: `/assets/classart/${a.id}`,
    thumb: `/assets/classart/${a.id}@sm`,
    alt: a.alt,
  };
}
