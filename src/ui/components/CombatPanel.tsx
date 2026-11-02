'use client';

import { Art } from '@/ui/components/Art';
import { useState } from 'react';
import { canCast, type CombatState, type Combatant } from '@/campaign/combat';
import type { Spell } from '@/data/srd/spells';

/**
 * Initiative tracker and target picker.
 *
 * Every number here comes from the engine. The panel shows whose turn it is,
 * what each combatant can still take, and nothing the player is not entitled
 * to know: enemy hit points are shown as a bar, not a figure, because a player
 * at the table cannot read a monster's remaining health either.
 */
export function CombatPanel({
  combat, onAttack, busy,
}: {
  combat: CombatState;
  onAttack: (targetId: string, spellId?: string) => void;
  busy: boolean;
}) {
  const [spell, setSpell] = useState<Spell | null>(null);
  const active = combat.order[combat.turn];
  const yourTurn = active?.id === 'pc' && !combat.over;
  const foes = combat.order.filter((c) => c.side === 'foe');
  const pc = combat.order.find((c) => c.id === 'pc');

  // A healing spell targets the party, everything else targets the enemy.
  const healing = spell?.effect.kind === 'heal';
  const targets = (healing
    ? combat.order.filter((c) => c.side === 'party' && !c.dead)
    : foes.filter((f) => f.hp > 0 && !f.fled && !f.dead));

  const slotLabel = (lv: number) => {
    if (lv === 0) return 'cantrip';
    const have = pc?.slots?.[lv - 1] ?? 0;
    const used = pc?.slotsUsed?.[lv - 1] ?? 0;
    return `${have - used} of ${have} left`;
  };

  return (
    <div className="combat panel" role="region" aria-label="Combat">
      <div className="combat__head">
        <span className="label" style={{ color: 'var(--rubric)' }}>
          Round {combat.round}
        </span>
        <span className="meta-quiet">
          {combat.over
            ? combat.outcome === 'victory' ? 'The fight is over' : 'You are down'
            : yourTurn ? 'Your turn' : `${active?.name ?? ''} is acting`}
        </span>
      </div>

      <ol className="combat__order">
        {combat.order.map((c, i) => (
          <Row key={c.id} c={c} active={i === combat.turn && !combat.over} />
        ))}
      </ol>

      {yourTurn && (
        <div className="combat__actions">
          {pc?.spells?.length ? (
            <>
              <span className="label" style={{ display: 'block', marginBottom: '0.4rem' }}>
                {spell ? `Casting ${spell.name}` : 'Action'}
              </span>
              <div className="combat__targets" style={{ marginBottom: '0.6rem' }}>
                <button
                  className="chip" data-selected={spell === null}
                  onClick={() => setSpell(null)} disabled={busy}
                >
                  Weapon
                </button>
                {pc.spells.map((sp) => {
                  const ok = canCast(pc, sp);
                  return (
                    <button
                      key={sp.id} className="chip" data-selected={spell?.id === sp.id}
                      disabled={busy || !ok}
                      onClick={() => setSpell(sp)}
                      data-hint={`${sp.text} ${slotLabel(sp.level)}.`}
                      style={ok ? undefined : { opacity: 0.4 }}
                    >
                      {sp.name}
                      <span className="meta-quiet" style={{ marginLeft: '0.35rem' }}>
                        {sp.level === 0 ? 'cantrip' : `lv ${sp.level}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <span className="label" style={{ display: 'block', marginBottom: '0.4rem' }}>Attack</span>
          )}

          <span className="label" style={{ display: 'block', marginBottom: '0.4rem' }}>
            {healing ? 'Heal who' : 'Target'}
          </span>
          <div className="combat__targets">
            {targets.map((t) => (
              <button
                key={t.id} className="btn" disabled={busy}
                onClick={() => { onAttack(t.id, spell?.id); setSpell(null); }}
              >
                {t.name}
                {healing && <span className="meta-quiet" style={{ marginLeft: '0.3rem' }}>{t.hp}/{t.maxHp}</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ c, active }: { c: Combatant; active: boolean }) {
  const down = c.hp === 0;
  const pct = Math.round((c.hp / c.maxHp) * 100);
  return (
    <li className="combat__row" data-active={active} data-down={down || c.fled}>
      <span className="combat__init stat-num">{c.initiative}</span>
      {c.portraitId ? (
        <Art className="combat__art" src={`/assets/classart/${c.portraitId}`} alt="" width={384} height={384} sizes="30px" />
      ) : c.monsterId ? (
        <Art className="combat__art" src={`/assets/monsters/${c.monsterId}`} alt="" width={384} height={384} sizes="30px" />
      ) : (
        <span className="combat__art combat__art--foe" aria-hidden />
      )}
      <span className="combat__name">
        {c.name}
        {c.fled && <span className="meta-quiet"> fled</span>}
        {down && !c.fled && <span className="meta-quiet"> down</span>}
      </span>
      {c.side === 'party' ? (
        <span className="stat-num combat__hp">{c.hp}/{c.maxHp}</span>
      ) : (
        <span className="combat__bar" aria-label={`${pct} percent remaining`}>
          <span style={{ width: `${pct}%` }} />
        </span>
      )}
    </li>
  );
}
