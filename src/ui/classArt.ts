/**
 * A representative portrait for each class, drawn from the generated library.
 * Chosen so the twelve cards read as twelve different people, varied species,
 * silhouette, age and mood rather than twelve armoured men.
 */
export const CLASS_ART: Record<string, { id: string; alt: string }> = {
  barbarian: { id: 'orc-barbarian-painted',   alt: 'An orc barbarian with war paint across the cheekbones and furs at the shoulder' },
  bard:      { id: 'tiefling-bard-grinning',  alt: 'A grinning tiefling bard with long back-swept horns and a ruffed collar' },
  cleric:    { id: 'human-cleric-serene',     alt: 'A serene shaven-headed human cleric wearing a heavy sunburst pendant' },
  druid:     { id: 'elf-druid-antler',        alt: 'An elf druid wearing an antler circlet tangled in dark braided hair' },
  fighter:   { id: 'dwarf-fighter-scarred',   alt: 'A scarred dwarf fighter in a dented iron helm with a braided black beard' },
  monk:      { id: 'halfling-monk-calm',      alt: 'A calm young halfling monk with a topknot and a plain wrapped collar' },
  paladin:   { id: 'human-paladin-stern',     alt: 'A stern human paladin with close-cropped grey hair and a polished gorget' },
  ranger:    { id: 'elf-ranger-hooded',       alt: 'A weathered elf ranger with a leaf-dappled hood and a bow stave at the shoulder' },
  rogue:     { id: 'halfling-rogue-scarred',  alt: 'A wiry halfling rogue with a scar through one eyebrow and a half-drawn hood' },
  sorcerer:  { id: 'tiefling-sorcerer-violet',alt: 'A tiefling sorcerer with swept-back horns and dusky violet skin' },
  warlock:   { id: 'tiefling-warlock-pale',   alt: 'A bone-pale tiefling warlock with backward-curling horns and one clouded eye' },
  wizard:    { id: 'human-wizard-ancient',    alt: 'An ancient hooded human wizard with a long thin white beard' },
};

export function classArtSrc(classId: string): { src: string; thumb: string; alt: string } | null {
  const a = CLASS_ART[classId];
  if (!a) return null;
  return {
    src: `/assets/portraits/${a.id}.webp`,
    thumb: `/assets/portraits/${a.id}@sm.webp`,
    alt: a.alt,
  };
}
