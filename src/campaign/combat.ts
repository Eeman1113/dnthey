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
import type { ConditionName } from '@/engine/types';

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
  /**
   * A player character at 0 HP is dying, not dead: they roll a death save at
   * the start of each of their turns. Monsters simply drop.
   */
  dying?: boolean;
  dead?: boolean;
  stable?: boolean;
  deathSaves?: { successes: number; failures: number };
  conditions?: { name: ConditionName; source: string }[];
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
  damage: number; targetDown: boolean; targetFled: boolean; targetDead: boolean;
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

    // Damage taken while already down is an automatic death save failure, and
    // two of them on a critical hit.
    if (target.hp === 0 && target.dying) {
      const saves = target.deathSaves ?? { successes: 0, failures: 0 };
      saves.failures += roll.isNat20 ? 2 : 1;
      target.deathSaves = saves;
      if (saves.failures >= 3) { target.dead = true; target.dying = false; }
    } else {
      const before = target.hp;
      target.hp = Math.max(0, target.hp - damage);
      if (target.hp === 0 && before > 0) {
        // Damage at or beyond the maximum in a single hit kills outright.
        if (damage - before >= target.maxHp) { target.dead = true; }
        else if (target.side === 'party') { target.dying = true; target.deathSaves = { successes: 0, failures: 0 }; }
        else { target.dead = true; }
      }
    }
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
    damage,
    targetDown: target.hp === 0 && !!target.dying,
    targetFled: fled,
    targetDead: !!target.dead,
  };
}

/**
 * Who can still act. A dying player character is not acting but is also not
 * out of the fight: the party has not lost while someone can still be revived.
 */
export const living = (s: CombatState, side: 'party' | 'foe') =>
  s.order.filter((c) => c.side === side && c.hp > 0 && !c.fled && !c.dead);

/** Still in the fight in the sense that matters for ending it. */
export const standing = (s: CombatState, side: 'party' | 'foe') =>
  s.order.filter((c) => c.side === side && !c.fled && !c.dead);

/**
 * A death saving throw: DC 10, three successes stabilise, three failures kill.
 * A natural 20 brings them back up on 1 HP, a natural 1 counts as two failures.
 * It takes no modifiers at all, not even exhaustion (2024 rules).
 */
export function rollDeathSave(
  seed: string, state: CombatState, c: Combatant,
): { natural: number; success: boolean; saves: { successes: number; failures: number }; outcome: 'stable' | 'dead' | 'revived' | 'ongoing' } {
  const rng = new Rng(`${seed}:${state.id}:death:${c.id}:${state.round}`);
  const r = rollD20(rng, { kind: 'death_save', dc: 10, reason: `${c.name} death save` });
  const saves = c.deathSaves ?? { successes: 0, failures: 0 };

  if (r.isNat20) {
    c.hp = 1; c.dying = false; c.deathSaves = { successes: 0, failures: 0 };
    return { natural: r.natural, success: true, saves: c.deathSaves, outcome: 'revived' };
  }
  if (r.isNat1) saves.failures += 2;
  else if (r.success) saves.successes += 1;
  else saves.failures += 1;

  c.deathSaves = saves;
  if (saves.failures >= 3) { c.dead = true; c.dying = false; return { natural: r.natural, success: false, saves, outcome: 'dead' }; }
  if (saves.successes >= 3) { c.stable = true; c.dying = false; return { natural: r.natural, success: true, saves, outcome: 'stable' }; }
  return { natural: r.natural, success: r.success ?? false, saves, outcome: 'ongoing' };
}

export function checkEnd(s: CombatState, foes: Monster[]): CombatState {
  if (living(s, 'foe').length === 0) {
    return { ...s, over: true, outcome: 'victory', xpAwarded: foes.reduce((a, m) => a + m.xp, 0) };
  }
  // The party loses only when nobody is left who could still be saved.
  if (standing(s, 'party').length === 0) return { ...s, over: true, outcome: 'defeat' };
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
    // A dying character still gets a turn: it is when they roll their save.
    if ((c.hp > 0 || c.dying) && !c.fled && !c.dead) break;
    turn += 1;
    if (turn >= s.order.length) { turn = 0; round += 1; }
  }
  return { ...s, turn, round };
}
