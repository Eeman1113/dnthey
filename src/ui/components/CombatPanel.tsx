'use client';

import { Art } from '@/ui/components/Art';
import type { CombatState, Combatant } from '@/campaign/combat';

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
  onAttack: (targetId: string) => void;
  busy: boolean;
}) {
  const active = combat.order[combat.turn];
  const yourTurn = active?.id === 'pc' && !combat.over;
  const foes = combat.order.filter((c) => c.side === 'foe');

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
          <span className="label" style={{ display: 'block', marginBottom: '0.4rem' }}>Attack</span>
          <div className="combat__targets">
            {foes.filter((f) => f.hp > 0 && !f.fled).map((f) => (
              <button key={f.id} className="btn" disabled={busy} onClick={() => onAttack(f.id)}>
                {f.name}
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
      {c.portraitId
        ? <Art className="combat__art" src={`/assets/classart/${c.portraitId}`} alt="" width={384} height={384} sizes="30px" />
        : <span className="combat__art combat__art--foe" aria-hidden />}
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
