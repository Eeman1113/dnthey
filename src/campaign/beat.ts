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
