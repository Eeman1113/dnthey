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
import { adjudicate, narrate, companionReact, cleanProse, type AdjudicationResult } from '@/agents/dm';
import type { Campaign, Beat } from './types';
import { buildEncounter, MONSTERS, type Monster } from '@/data/srd/encounters';
import {
  startCombat, resolveAttack, advance, checkEnd, living,
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

export async function playBeat(
  campaign: Campaign,
  action: string,
  h: BeatHandlers,
): Promise<{ roll: D20Result | null; adjudication: AdjudicationResult }> {
  h.onBeat(beat('action', action));

  h.onStatus('The Dungeon Master considers it');
  const adj = await adjudicate(campaign.scene, action);

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
  for await (const chunk of narrate({
    scene: campaign.scene, action, outcome: success ? 'success' : 'failure', tier, consequence,
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
export async function maybeCompanionSpeaks(
  campaign: Campaign, action: string, h: BeatHandlers,
): Promise<void> {
  if (!campaign.companions.length) return;
  const rng = new Rng(`${campaign.seed}:speech:${campaign.beats.length}`);
  if (rng.next() > 0.55) return;

  const who = rng.pick(campaign.companions);
  h.onStatus(`${who.card.name} has something to say`);
  const reply = await companionReact(who.card, campaign.scene, action);
  h.onStatus(null);
  if (reply?.speech?.trim()) {
    h.onBeat(beat('speech', reply.speech.trim(), {
      speaker: who.card.name, portraitId: who.card.portraitId,
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
  const names = [...counts].map(([n, c]) => (c === 1 ? n : `${WORDS[c] ?? c} ${n}s`)).join(', ');

  // The model's threat line is flavour and the stat blocks are mechanics. If
  // they disagree, print only the mechanics rather than contradicting
  // ourselves in the same sentence.
  const agrees = threat.trim() && [...counts.keys()]
    .some((n) => threat.toLowerCase().includes(n.toLowerCase()));
  return beat('combat', agrees ? `${threat}. Roll initiative.` : `${names}. Roll initiative.`);
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
    const enemySide: Combatant['side'] = actor.side === 'party' ? 'foe' : 'party';
    const options = living(s, enemySide);
    if (options.length) {
      const rng = new Rng(`${campaign.seed}:${s.id}:${s.round}:${s.turn}:pick`);
      const victim = rng.pick(options);
      h.onBeat(beat('combat', describeAttack(resolveAttack(s, campaign.seed, actor, victim))));
      s = checkEnd(s, foes);
    }
    if (s.over) break;
    s = advance(s);
  }
  return s;
}

function describeAttack(r: {
  attacker: string; target: string; weapon: string; hit: boolean; crit: boolean;
  natural: number; total: number; ac: number; damage: number; targetDown: boolean; targetFled: boolean;
}): string {
  if (!r.hit) {
    return `${r.attacker} swings ${r.weapon} at ${r.target} and misses. ` +
      `${r.natural} on the die, ${r.total} against AC ${r.ac}.`;
  }
  const crit = r.crit ? 'Critical hit. ' : '';
  const after = r.targetDown ? ` ${r.target} goes down.`
    : r.targetFled ? ` ${r.target} breaks and runs.` : '';
  return `${crit}${r.attacker} hits ${r.target} with ${r.weapon} for ${r.damage}. ` +
    `${r.natural} on the die, ${r.total} against AC ${r.ac}.${after}`;
}
