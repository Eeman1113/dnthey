'use client';

/**
 * One turn of play.
 *
 * The engine owns every number. The model is asked what KIND of check this is
 * and what the outcome MEANS, never what the dice said (BUILD_PROMPT.md
 * section 1). Narration is streamed so the reader sees words within about a
 * second rather than staring at nothing for five.
 */
import { ulid } from 'ulid';
import { Rng } from '@/engine/rng';
import { rollD20, outcomeTier, type D20Result } from '@/engine/dtest';
import { derive } from '@/character/derive';
import { SKILL_ABILITY, type Skill } from '@/engine/types';
import {
  adjudicate, narrate, companionReact, companionBanter, chooseTarget, cleanProse, extractLore,
  type AdjudicationResult,
} from '@/agents/dm';
import { retrieve, renderCodex, renderChronicle, upsert, prune } from '@/memory/codex';
import type { Campaign, Beat } from './types';
import { buildEncounter, MONSTERS, type Monster } from '@/data/srd/encounters';
import {
  startCombat, resolveAttack, advance, checkEnd, living, rollDeathSave,
  type CombatState, type Combatant,
} from './combat';

export interface BeatHandlers {
  onBeat: (b: Beat) => void;
  /** Called repeatedly as narration streams in, for the same beat id. */
  onNarrationChunk: (id: string, textSoFar: string) => void;
  onStatus: (s: string | null) => void;
}

const beat = (kind: Beat['kind'], text: string, extra: Partial<Beat> = {}): Beat => ({
  id: ulid(), kind, text, at: Date.now(), ...extra,
});

/** Modifier the character actually brings to this check. */
function modifierFor(c: Campaign, adj: AdjudicationResult) {
  const d = derive(c.pc.build);
  if (adj.skill !== 'none') {
    const sk = d.skills[adj.skill as Skill];
    return { value: sk.mod, label: `${adj.skill.replace(/_/g, ' ')} ${sk.proficient ? '(proficient)' : ''}`.trim() };
  }
  return { value: d.mods[adj.ability], label: adj.ability.toUpperCase() };
}

/**
 * What the agents are told about the past.
 *
 * `forNarrator` drops DM only entities: the Narrator writes prose and would
 * spend a secret the moment it knew one (BUILD_PROMPT.md section 6).
 */
export function contextFor(campaign: Campaign, query: string, forNarrator: boolean): string {
  const hits = retrieve(campaign.codex, `${campaign.scene} ${query}`, campaign.beats.length, {
    limit: 4, forNarrator,
  });
  const known = renderCodex(hits, 600);
  const story = renderChronicle(campaign.chronicle, 5);
  return [
    story ? `SO FAR: ${story}` : '',
    known ? `WHAT YOU KNOW:\n${known}` : '',
  ].filter(Boolean).join('\n');
}

export async function playBeat(
  campaign: Campaign,
  action: string,
  h: BeatHandlers,
): Promise<{ roll: D20Result | null; adjudication: AdjudicationResult }> {
  h.onBeat(beat('action', action));

  const dmContext = contextFor(campaign, action, false);
  h.onStatus('The Dungeon Master considers it');
  const adj = await adjudicate(`${dmContext}\nNOW: ${campaign.scene}`.trim(), action);

  let roll: D20Result | null = null;
  let success = true;
  let tier = 'success';

  // Starting a fight is not an ability check: in the 2024 rules you roll
  // initiative, which combat does for you. Rolling, say, an Intelligence check
  // to draw a weapon is noise, and a failure on it means nothing.
  if (adj.startsCombat) {
    h.onStatus(null);
    return { roll: null, adjudication: adj };
  }

  if (adj.resolution === 'roll') {
    const mod = modifierFor(campaign, adj);
    // Seeded per roll index so a campaign replays identically from its log.
    const rng = new Rng(`${campaign.seed}:${campaign.rollCount}`);
    roll = rollD20(rng, {
      kind: 'ability_check',
      modifiers: [{ label: mod.label, value: mod.value }],
      dc: Number(adj.dc),
      reason: action,
      exhaustionLevel: campaign.pc.state.exhaustion,
    });
    success = roll.success ?? false;
    tier = outcomeTier(roll);
    h.onBeat(beat('roll', `${adj.skill !== 'none' ? adj.skill.replace(/_/g, ' ') : adj.ability.toUpperCase()} check`, { roll }));
  } else if (adj.resolution === 'auto_failure' || adj.resolution === 'impossible') {
    success = false;
    tier = 'failure';
  }

  const consequence = success ? adj.successMeans : adj.failureMeans;

  // Stream the narration into a single beat that grows.
  h.onStatus('Narrating');
  const narration = beat('narration', '');
  h.onBeat(narration);
  let text = '';
  const narratorContext = contextFor(campaign, action, true);
  for await (const chunk of narrate({
    scene: `${narratorContext}\nNOW: ${campaign.scene}`.trim(),
    action, outcome: success ? 'success' : 'failure', tier, consequence,
    lines: campaign.lines,
  })) {
    text += chunk;
    h.onNarrationChunk(narration.id, cleanProse(text));
  }
  if (!text.trim()) h.onNarrationChunk(narration.id, consequence);

  h.onStatus(null);
  return { roll, adjudication: adj };
}

/**
 * A companion speaks, sometimes. Not every beat: constant chatter from the
 * same two voices stops reading as character and starts reading as noise.
 */
/**
 * A companion speaks, sometimes.
 *
 * Not every beat: constant chatter from the same two voices stops reading as
 * character and starts reading as noise. When they do speak they also take a
 * stance on what the player just did, which is what Bond moves on.
 */
export async function maybeCompanionSpeaks(
  campaign: Campaign, action: string, h: BeatHandlers,
): Promise<{ id: string; stance: string } | null> {
  const present = campaign.companions.filter((c) => !c.gone);
  if (!present.length) return null;
  const rng = new Rng(`${campaign.seed}:speech:${campaign.beats.length}`);
  if (rng.next() > 0.55) return null;

  const who = rng.pick(present);
  h.onStatus(`${who.card.name} has something to say`);
  const reply = await companionReact(who.card, campaign.scene, action);
  h.onStatus(null);
  if (!reply?.speech?.trim()) return null;

  h.onBeat(beat('speech', cleanProse(reply.speech), {
    speaker: who.card.name, portraitId: who.card.portraitId, stance: reply.stance,
  }));
  return { id: who.card.id, stance: reply.stance };
}

/**
 * Apply the consequence of a stance.
 *
 * Being overruled costs trust, being agreed with earns it, and a companion
 * whose trust runs out leaves. Without a cost, disagreement is decoration.
 */
export function applyStance(
  campaign: Campaign, id: string, stance: string,
): { companions: Campaign['companions']; left: string | null } {
  let left: string | null = null;
  const companions = campaign.companions.map((c) => {
    if (c.card.id !== id) return c;
    const delta = stance === 'opposed' ? -1 : stance === 'enthusiastic' ? 1 : 0;
    const bond = Math.max(0, Math.min(5, c.bond + delta));
    if (bond === 0 && !c.gone) { left = c.card.name; return { ...c, stance: stance as never, bond, gone: true }; }
    return { ...c, stance: stance as never, bond };
  });
  return { companions, left };
}

/**
 * Two companions talking to each other rather than at the player. Rare on
 * purpose: silence has value, and overheard conversation only lands when it
 * is not constant.
 */
export async function maybeBanter(campaign: Campaign, h: BeatHandlers): Promise<void> {
  const present = campaign.companions.filter((c) => !c.gone);
  if (present.length < 2) return;
  const rng = new Rng(`${campaign.seed}:banter:${campaign.beats.length}`);
  if (rng.next() > 0.22) return;

  const [a, b] = rng.shuffle(present);
  if (!a || !b) return;
  h.onStatus('The others are talking');
  const out = await companionBanter(a.card, b.card, campaign.scene);
  h.onStatus(null);
  if (!out?.lines?.length) return;

  for (const line of out.lines.slice(0, 3)) {
    const card = present.find((c) => c.card.name.toLowerCase() === line.who.trim().toLowerCase())?.card;
    if (!card || !line.says?.trim()) continue;
    h.onBeat(beat('speech', cleanProse(line.says), {
      speaker: card.name, portraitId: card.portraitId,
    }));
  }
}

/* ------------------------------------------------------------------ combat */

/**
 * Pick an encounter that fits the budget, themed by whatever the DM said is
 * attacking. The model names the threat in prose; the engine still chooses
 * real stat blocks and still obeys the XP ceiling.
 */
export function encounterFor(campaign: Campaign, threat: string): Monster[] {
  const rng = new Rng(`${campaign.seed}:enc:${campaign.beats.length}`);
  const words = threat.toLowerCase();
  const themed = MONSTERS.filter((m) => words.includes(m.id.replace('-', ' ')) || words.includes(m.name.toLowerCase()));
  const level = campaign.pc.build.level;
  const party = 1 + campaign.companions.length;
  return buildEncounter(level, party, 'low', (n) => rng.int(0, n - 1), themed.map((m) => m.id));
}

export function openingBeat(foes: Monster[], threat: string): Beat {
  // Tally duplicates so three goblins read as "three goblins", not a list.
  const counts = new Map<string, number>();
  for (const f of foes) counts.set(f.name, (counts.get(f.name) ?? 0) + 1);
  const WORDS = ['', '', 'two', 'three', 'four', 'five', 'six'];
  // English plurals the naive way produce "two Wolfs".
  const plural = (n: string) =>
    /f$/i.test(n) ? n.replace(/f$/i, 'ves')
    : /(s|x|z|ch|sh)$/i.test(n) ? `${n}es`
    : `${n}s`;
  const names = [...counts]
    .map(([n, c]) => (c === 1 ? n : `${WORDS[c] ?? c} ${plural(n)}`))
    .join(', ');

  // The model's threat line is flavour and the stat blocks are mechanics. If
  // they disagree, print only the mechanics rather than contradicting
  // ourselves in the same sentence.
  const agrees = threat.trim() && [...counts.keys()]
    .some((n) => threat.toLowerCase().includes(n.toLowerCase()));
  return beat('combat', agrees ? `${threat}. Roll initiative.` : `${names}. Roll initiative.`);
}

/**
 * Run whoever is ahead of the player in the initiative order.
 *
 * Without this the player always acted first no matter what they rolled,
 * which quietly threw away the initiative roll the tracker was showing them.
 */
export async function runUpToPlayer(
  campaign: Campaign, state: CombatState, foes: Monster[], h: BeatHandlers,
): Promise<CombatState> {
  let s = { ...state, order: state.order.map((c) => ({ ...c })) };
  let guard = 0;
  while (!s.over && s.order[s.turn]!.id !== 'pc' && guard++ < 24) {
    const actor = s.order[s.turn]!;
    if (actor.dying) {
      h.onBeat(beat('combat', describeDeathSave(actor, rollDeathSave(campaign.seed, s, actor))));
      s = checkEnd(s, foes);
    } else {
      const other: Combatant['side'] = actor.side === 'party' ? 'foe' : 'party';
      const options = living(s, other);
      if (options.length) {
        const victim = await pickVictim(campaign, s, actor, options, h);
        h.onBeat(beat('combat', describeAttack(resolveAttack(s, campaign.seed, actor, victim))));
        s = checkEnd(s, foes);
      }
    }
    if (s.over) break;
    s = advance(s);
  }
  return s;
}

/** One attack by the player, then every other combatant takes its turn. */
export async function runCombatRound(
  campaign: Campaign,
  state: CombatState,
  foes: Monster[],
  targetId: string,
  h: BeatHandlers,
): Promise<CombatState> {
  let s = { ...state, order: state.order.map((c) => ({ ...c })) };
  const pc = s.order.find((c) => c.id === 'pc')!;
  const target = s.order.find((c) => c.id === targetId);
  if (!target) return s;

  const report = resolveAttack(s, campaign.seed, pc, target);
  h.onBeat(beat('combat', describeAttack(report)));
  s = checkEnd(s, foes);
  if (s.over) return s;

  // Everyone else acts until it is the player's turn again.
  let guard = 0;
  s = advance(s);
  while (!s.over && s.order[s.turn]!.id !== 'pc' && guard++ < 24) {
    const actor = s.order[s.turn]!;
    if (actor.dying) {
      h.onBeat(beat('combat', describeDeathSave(actor, rollDeathSave(campaign.seed, s, actor))));
      s = checkEnd(s, foes);
    } else {
      const enemySide: Combatant['side'] = actor.side === 'party' ? 'foe' : 'party';
      const options = living(s, enemySide);
      if (options.length) {
        const victim = await pickVictim(campaign, s, actor, options, h);
        h.onBeat(beat('combat', describeAttack(resolveAttack(s, campaign.seed, actor, victim))));
        s = checkEnd(s, foes);
      }
    }
    if (s.over) break;
    s = advance(s);
  }
  return s;
}

/**
 * Who a combatant goes for.
 *
 * A monster with a doctrine asks the model to choose from the targets the
 * engine says are legal, passed as a numbered list so it picks an index and
 * cannot invent anyone. Party members, and anything whose choice the model
 * declines or fumbles, fall back to a seeded random pick.
 */
async function pickVictim(
  campaign: Campaign, s: CombatState, actor: Combatant,
  options: Combatant[], h: BeatHandlers,
): Promise<Combatant> {
  const rng = new Rng(`${campaign.seed}:${s.id}:${s.round}:${s.turn}:pick`);
  if (actor.side !== 'foe' || !actor.doctrine || options.length < 2) return rng.pick(options);

  const choice = await chooseTarget(
    { name: actor.name, doctrine: actor.doctrine },
    options.map((o) => ({ name: o.name, hpPct: Math.round((o.hp / o.maxHp) * 100) })),
  );
  if (!choice) return rng.pick(options);
  if (choice.taunt.trim()) {
    h.onBeat(beat('speech', choice.taunt.trim(), { speaker: actor.name }));
  }
  return options[choice.index] ?? rng.pick(options);
}

function describeDeathSave(
  c: Combatant,
  r: { natural: number; saves: { successes: number; failures: number }; outcome: string },
): string {
  const tally = `${r.saves.successes} successes, ${r.saves.failures} failures`;
  switch (r.outcome) {
    case 'revived': return `${c.name} rolls a natural 20 on the death save and comes back up on 1 hit point.`;
    case 'dead':    return `${c.name} fails a third death save. ${c.name} is dead.`;
    case 'stable':  return `${c.name} makes a third death save and stabilises. Still down, no longer dying.`;
    default:        return `${c.name} rolls ${r.natural} on a death save against DC 10. ${tally}.`;
  }
}

function describeAttack(r: {
  attacker: string; target: string; weapon: string; hit: boolean; crit: boolean;
  natural: number; total: number; ac: number; damage: number;
  targetDown: boolean; targetFled: boolean; targetDead: boolean;
}): string {
  if (!r.hit) {
    return `${r.attacker} swings ${r.weapon} at ${r.target} and misses. ` +
      `${r.natural} on the die, ${r.total} against AC ${r.ac}.`;
  }
  const crit = r.crit ? 'Critical hit. ' : '';
  const after = r.targetDead ? ` ${r.target} is killed outright.`
    : r.targetDown ? ` ${r.target} goes down and starts dying.`
    : r.targetFled ? ` ${r.target} breaks and runs.` : '';
  return `${crit}${r.attacker} hits ${r.target} with ${r.weapon} for ${r.damage}. ` +
    `${r.natural} on the die, ${r.total} against AC ${r.ac}.${after}`;
}


/* ---------------------------------------------------------------- memory */

/**
 * Fold what just happened into the campaign's memory.
 *
 * Deliberately runs AFTER the player has their narration, so the extra model
 * call costs them no waiting. If it fails, the campaign simply remembers a
 * little less; it never blocks a turn.
 */
export async function rememberBeat(
  campaign: Campaign, action: string, outcome: string,
): Promise<Pick<Campaign, 'codex' | 'chronicle'> | null> {
  const lore = await extractLore(campaign.scene, action, outcome);
  if (!lore) return null;

  let codex = campaign.codex;
  for (const e of lore.entities.slice(0, 3)) {
    if (!e.name?.trim()) continue;
    codex = upsert(codex, {
      kind: e.kind, name: e.name.trim(), oneLine: cleanProse(e.oneLine),
      facts: [], tags: [], knownToPlayer: e.knownToPlayer,
      lastSeenBeat: campaign.beats.length,
    });
  }
  codex = prune(codex, 60, campaign.beats.length);

  const summary = cleanProse(lore.summary).trim();
  const chronicle = summary
    ? { entries: [...campaign.chronicle.entries, { scene: campaign.beats.length, text: summary }].slice(-40) }
    : campaign.chronicle;

  return { codex, chronicle };
}
