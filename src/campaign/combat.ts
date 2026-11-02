'use client';

/**
 * Combat. The engine resolves everything; the model only narrates it.
 *
 * Deliberately a focused subset of the 2024 rules: initiative, attack rolls
 * against AC, damage, death saves, and enemies that actually break and run.
 * No grid and no positioning, because a text interface cannot adjudicate
 * geometry honestly and pretending otherwise would be worse than omitting it.
 */
import { ulid } from 'ulid';
import { Rng } from '@/engine/rng';
import { rollD20 } from '@/engine/dtest';
import { rollDamage } from '@/engine/dice';
import { derive } from '@/character/derive';
import type { Monster } from '@/data/srd/encounters';
import type { Campaign } from './types';

export interface Combatant {
  id: string;
  name: string;
  side: 'party' | 'foe';
  ac: number;
  hp: number;
  maxHp: number;
  initiative: number;
  portraitId?: string;
  monsterId?: string;
  doctrine?: string;
  /** Foes break when hurt badly enough, unless their doctrine says otherwise. */
  fled?: boolean;
  attack: { name: string; toHit: number; damage: string; bonus: number };
}

export interface CombatState {
  id: string;
  round: number;
  turn: number;
  order: Combatant[];
  over: boolean;
  outcome?: 'victory' | 'defeat' | 'fled';
  xpAwarded: number;
}

const NEVER_FLEES = /never retreats|feels nothing|fanatical|relentless/i;

export function startCombat(campaign: Campaign, foes: Monster[]): CombatState {
  const rng = new Rng(`${campaign.seed}:combat:${campaign.beats.length}`);
  const d = derive(campaign.pc.build);
  const best = d.attacks[0];

  const party: Combatant[] = [{
    id: 'pc', name: campaign.pc.build.name || 'You', side: 'party',
    ac: d.armorClass, hp: campaign.pc.state.currentHp, maxHp: d.maxHp,
    initiative: rollD20(rng, { kind: 'initiative', modifiers: [{ label: 'DEX', value: d.initiative }], reason: 'initiative' }).total,
    portraitId: campaign.pc.build.classId,
    attack: best
      ? { name: best.weapon.name, toHit: best.attackBonus, damage: best.damage, bonus: best.damageBonus }
      : { name: 'unarmed strike', toHit: d.mods.str + d.proficiencyBonus, damage: '1d4', bonus: d.mods.str },
  }];

  // Companions fight with a simple level-appropriate profile. They are real
  // bodies in the fight, not scenery, but they do not get full sheets yet.
  for (const { card } of campaign.companions) {
    party.push({
      id: card.id, name: card.name, side: 'party', ac: 14, hp: 12, maxHp: 12,
      initiative: rollD20(rng, { kind: 'initiative', modifiers: [{ label: 'DEX', value: 2 }], reason: 'initiative' }).total,
      portraitId: card.portraitId,
      attack: { name: 'weapon', toHit: 4, damage: '1d8', bonus: 2 },
    });
  }

  // Number duplicates per type, so two wolves are Wolf 1 and Wolf 2 rather
  // than taking their number from a position in the mixed list.
  const seen = new Map<string, number>();
  const total = new Map<string, number>();
  for (const m of foes) total.set(m.id, (total.get(m.id) ?? 0) + 1);

  const enemies: Combatant[] = foes.map((m, i) => ({
    id: `${m.id}-${i}`,
    name: (total.get(m.id) ?? 1) > 1
      ? `${m.name} ${(seen.set(m.id, (seen.get(m.id) ?? 0) + 1), seen.get(m.id))}`
      : m.name,
    side: 'foe', ac: m.ac, hp: m.hp, maxHp: m.hp,
    initiative: rollD20(rng, { kind: 'initiative', modifiers: [{ label: 'DEX', value: 1 }], reason: 'initiative' }).total,
    monsterId: m.id, doctrine: m.doctrine, attack: m.attack,
  }));

  const order = [...party, ...enemies].sort((a, b) => b.initiative - a.initiative);
  return { id: ulid(), round: 1, turn: 0, order, over: false, xpAwarded: 0 };
}

export interface AttackReport {
  attacker: string; target: string; weapon: string;
  hit: boolean; crit: boolean; natural: number; total: number; ac: number;
  damage: number; targetDown: boolean; targetFled: boolean;
}

export function resolveAttack(
  state: CombatState, seed: string, attacker: Combatant, target: Combatant,
): AttackReport {
  const rng = new Rng(`${seed}:${state.id}:${state.round}:${state.turn}`);
  const roll = rollD20(rng, {
    kind: 'attack_roll',
    modifiers: [{ label: 'attack', value: attacker.attack.toHit }],
    dc: target.ac,
    reason: `${attacker.name} attacks ${target.name}`,
  });
  const hit = roll.success ?? false;
  let damage = 0;
  if (hit) {
    const dmg = rollDamage(rng, attacker.attack.damage, 'damage', {
      critical: roll.isNat20,
      modifiers: [{ label: 'mod', value: attacker.attack.bonus }],
    });
    damage = dmg.total;
    target.hp = Math.max(0, target.hp - damage);
  }

  // A foe at or below a third of its health breaks, unless its doctrine says
  // it cannot. Enemies that never run make every fight feel like a video game.
  let fled = false;
  if (target.side === 'foe' && target.hp > 0 && target.hp <= target.maxHp / 3) {
    if (!NEVER_FLEES.test(target.doctrine ?? '') && rng.next() < 0.45) {
      target.fled = true; fled = true;
    }
  }

  return {
    attacker: attacker.name, target: target.name, weapon: attacker.attack.name,
    hit, crit: roll.isNat20, natural: roll.natural, total: roll.total, ac: target.ac,
    damage, targetDown: target.hp === 0, targetFled: fled,
  };
}

export const living = (s: CombatState, side: 'party' | 'foe') =>
  s.order.filter((c) => c.side === side && c.hp > 0 && !c.fled);

export function checkEnd(s: CombatState, foes: Monster[]): CombatState {
  if (living(s, 'foe').length === 0) {
    return { ...s, over: true, outcome: 'victory', xpAwarded: foes.reduce((a, m) => a + m.xp, 0) };
  }
  if (living(s, 'party').length === 0) return { ...s, over: true, outcome: 'defeat' };
  return s;
}

export function advance(s: CombatState): CombatState {
  let turn = s.turn + 1;
  let round = s.round;
  if (turn >= s.order.length) { turn = 0; round += 1; }
  // Skip anyone who is down or gone.
  let guard = 0;
  while (guard++ < s.order.length * 2) {
    const c = s.order[turn]!;
    if (c.hp > 0 && !c.fled) break;
    turn += 1;
    if (turn >= s.order.length) { turn = 0; round += 1; }
  }
  return { ...s, turn, round };
}
