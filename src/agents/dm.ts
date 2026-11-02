'use client';

/**
 * The Dungeon Master, split into narrow roles.
 *
 * Every call has a deterministic fallback, so a refusal, a timeout or a
 * missing model degrades the game instead of stopping it.
 */
import { getSession, askJson, askProse } from './session';
import { ADJUDICATOR, NARRATOR, WORLDSMITH, companionCard } from './prompts';
import {
  ADJUDICATION_SCHEMA, AdjudicationZ, type Adjudication,
  WORLD_SCHEMA, WorldZ, type World,
  COMPANION_SCHEMA, CompanionReplyZ, type CompanionReply,
} from './schemas';
import { SKILL_ABILITY, type Ability, type Skill } from '@/engine/types';

/* ------------------------------------------------------------- worldsmith */

const FALLBACK_WORLD: World = {
  realmName: 'The Saltmarch',
  openingLocation: 'the Drowned Bell tavern, Arrowmouth',
  locationKind: 'tavern',
  hook: 'A revenue clerk has gone missing with the harbour ledgers.',
  threat: 'The Salt Cartel wants those ledgers burned, and you found them first.',
  openingScene:
    'Rain hammers the shutters of the Drowned Bell. The common room has emptied in a hurry, ' +
    'tankards still half full, a chair on its back by the hearth. On the table in front of you ' +
    'sits a satchel nobody has claimed, its strap cut clean through. Outside, boots are crossing ' +
    'the yard, more than two, not hurrying.',
};

export async function buildWorld(tone: string): Promise<{ world: World; generated: boolean }> {
  try {
    const s = await getSession('worldsmith', WORLDSMITH);
    const out = await askJson(
      s,
      `Tone: ${tone}. Invent the opening. Make the threat immediate and personal.`,
      WORLD_SCHEMA,
      (v) => WorldZ.parse(v),
      { timeoutMs: 60_000 },
    );
    if (out) return { world: out, generated: true };
  } catch { /* fall through */ }
  return { world: FALLBACK_WORLD, generated: false };
}

/* ------------------------------------------------------------ adjudicator */

export interface AdjudicationResult extends Adjudication {
  /** True when the engine supplied this rather than the model. */
  fallback: boolean;
}

/** Verb heuristics, used when the model is unavailable or returns nonsense. */
const VERB_TABLE: { match: RegExp; ability: Ability; skill: Skill | 'none' }[] = [
  { match: /\b(sneak|hide|creep|slip past|quietly)\b/i, ability: 'dex', skill: 'stealth' },
  { match: /\b(climb|jump|leap|force|lift|shove|break)\b/i, ability: 'str', skill: 'athletics' },
  { match: /\b(persuade|convince|plead|charm|ask)\b/i, ability: 'cha', skill: 'persuasion' },
  { match: /\b(lie|bluff|deceive|pretend)\b/i, ability: 'cha', skill: 'deception' },
  { match: /\b(threaten|intimidate|scare)\b/i, ability: 'cha', skill: 'intimidation' },
  { match: /\b(search|examine|inspect|study|look for)\b/i, ability: 'int', skill: 'investigation' },
  { match: /\b(listen|watch|notice|spot|peer)\b/i, ability: 'wis', skill: 'perception' },
  { match: /\b(recall|remember|know|identify)\b/i, ability: 'int', skill: 'history' },
  { match: /\b(pick|lockpick|disarm|palm|steal)\b/i, ability: 'dex', skill: 'sleight_of_hand' },
  { match: /\b(dodge|balance|tumble|roll)\b/i, ability: 'dex', skill: 'acrobatics' },
  { match: /\b(heal|treat|bandage)\b/i, ability: 'wis', skill: 'medicine' },
];

function heuristic(action: string): AdjudicationResult {
  const hit = VERB_TABLE.find((v) => v.match.test(action));
  const skill = hit?.skill ?? 'none';
  const ability = hit?.ability ?? 'wis';
  return {
    resolution: 'roll', ability, skill, dc: '15',
    successMeans: 'It works, more or less.',
    failureMeans: 'It goes wrong, and something notices.',
    fallback: true,
  };
}

export async function adjudicate(scene: string, action: string): Promise<AdjudicationResult> {
  try {
    const s = await getSession('adjudicator', ADJUDICATOR);
    const out = await askJson(
      s,
      `SCENE: ${scene}\nPLAYER ACTION: ${action}`,
      ADJUDICATION_SCHEMA,
      (v) => AdjudicationZ.parse(v),
    );
    if (out) {
      // The model picks a skill and an ability independently, so reconcile them:
      // the SRD already defines which ability each skill uses.
      const ability = out.skill !== 'none' ? SKILL_ABILITY[out.skill as Skill] : out.ability;
      return { ...out, ability, fallback: false };
    }
  } catch { /* fall through */ }
  return heuristic(action);
}

/**
 * The model sometimes wraps prose in markdown emphasis or quotes the whole
 * passage. That is formatting intent, not content, and it renders literally
 * as "**" in the log, so strip it before anything sees it.
 */
export function cleanProse(t: string): string {
  return t
    .replace(/\*\*/g, '')
    .replace(/(^|\s)\*(\S)/g, '$1$2')
    .replace(/(\S)\*(\s|$)/g, '$1$2')
    .replace(/^#+\s*/gm, '')
    .replace(/^\s*["'“]|["'”]\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trimStart();
}

/* ---------------------------------------------------------------- narrator */

export interface NarrationContext {
  scene: string;
  action: string;
  outcome: string;
  tier: string;
  consequence: string;
}

export function fallbackNarration(c: NarrationContext): string {
  return c.outcome === 'success'
    ? `${c.consequence} The moment holds, and the room waits on what you do next.`
    : `${c.consequence} Whatever advantage you had is gone, and something has shifted against you.`;
}

export async function* narrate(c: NarrationContext): AsyncGenerator<string> {
  try {
    const s = await getSession('narrator', NARRATOR);
    const prompt =
      `SCENE: ${c.scene}\n` +
      `THE PLAYER TRIED: ${c.action}\n` +
      `OUTCOME: ${c.tier} (${c.outcome})\n` +
      `WHAT THAT MEANS: ${c.consequence}\n\n` +
      `Narrate the next beat.`;
    let any = false;
    for await (const chunk of askProse(s, prompt)) { any = true; yield chunk; }
    if (!any) yield fallbackNarration(c);
  } catch {
    yield fallbackNarration(c);
  }
}

/* --------------------------------------------------------------- companion */

export interface CompanionCard {
  id: string; name: string; pronouns: string; species: string; klass: string;
  voice: string; want: string; flaw: string; portraitId: string;
}

export async function companionReact(
  card: CompanionCard, scene: string, action: string,
): Promise<CompanionReply | null> {
  try {
    const s = await getSession('companion', companionCard(card), `companion:${card.id}`);
    return await askJson(
      s,
      `SCENE: ${scene}\nTHE PLAYER JUST DID: ${action}\nSay one line.`,
      COMPANION_SCHEMA,
      (v) => CompanionReplyZ.parse(v),
      { timeoutMs: 30_000 },
    );
  } catch {
    return null;
  }
}
