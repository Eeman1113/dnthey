'use client';

import { ABILITIES, ABILITY_NAMES, SKILL_NAMES, SKILLS, formatMod } from '@/engine/types';
import { derive } from '@/character/derive';
import type { CharacterBuild } from '@/character/types';
import { CLASSES_BY_ID } from '@/data/srd/classes';
import { SPECIES_BY_ID } from '@/data/srd/species';
import { BACKGROUNDS_BY_ID } from '@/data/srd/backgrounds';
import { MASTERY_TEXT } from '@/data/srd/equipment';
import { ABILITY_HINT, PROFICIENCY_HINT, SAVE_HINT, EXPERTISE_HINT } from '@/ui/hints';

/**
 * Live character sheet. Reads only from derive(), so it can never disagree
 * with the engine.
 *
 * Typography floor: nothing here is below 13px. The previous version used 9px
 * labels, which is well under the 13px desktop minimum and was unreadable.
 */
export function Sheet({ build }: { build: CharacterBuild }) {
  let d;
  try {
    d = derive(build);
  } catch (e) {
    return <p className="issue">{(e as Error).message}</p>;
  }

  const cls = CLASSES_BY_ID[build.classId]!;
  const species = SPECIES_BY_ID[build.speciesId]!;
  const bg = BACKGROUNDS_BY_ID[build.backgroundId]!;

  return (
    <div className="panel" style={{ padding: '1.25rem' }}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 style={{ fontSize: '1.5rem' }}>
          {build.name || <span style={{ color: 'var(--content-3)' }}>Unnamed</span>}
        </h2>
        <span className="meta-quiet">{build.pronouns}</span>
      </div>
      <p className="meta" style={{ marginTop: '0.2rem', color: 'var(--content-2)' }}>
        Level {build.level} {species.name} {cls.name} · {bg.name}
      </p>

      <hr className="rule" style={{ margin: '1rem 0' }} />

      <div className="grid grid-cols-4 gap-2 mb-4">
        <Stat label="Armor Class" value={d.armorClass} note={d.armorNote} />
        <Stat label="Hit Points" value={d.maxHp} note={`d${d.hitDie} hit die`} />
        <Stat label="Initiative" value={formatMod(d.initiative)} />
        <Stat label="Speed" value={`${d.speed} ft`} />
      </div>

      <div className="grid grid-cols-6 gap-1.5 mb-5">
        {ABILITIES.map((a) => (
          <div
            key={a}
            className="panel-raised"
            style={{ padding: '0.5rem 0.25rem', textAlign: 'center' }}
          >
            <div
              className="label"
              style={{ fontSize: '0.75rem', letterSpacing: '0.07em' }}
              data-hint={ABILITY_HINT[a]}
            >
              {a}
            </div>
            <div
              className="stat-num"
              style={{ fontSize: '1.5rem', color: 'var(--content-1)', lineHeight: 1.2 }}
            >
              {formatMod(d.mods[a])}
            </div>
            <div className="meta-quiet" style={{ fontSize: '0.75rem' }}>{d.scores[a]}</div>
            <div
              className="meta-quiet"
              style={{
                fontSize: '0.75rem',
                marginTop: '0.2rem',
                color: d.saves[a].proficient ? 'var(--rubric)' : 'var(--content-3)',
              }}
              data-hint={d.saves[a].proficient
                ? `${SAVE_HINT} You are proficient in ${ABILITY_NAMES[a]} saves.`
                : `${ABILITY_NAMES[a]} saving throw. You are not proficient, so no proficiency bonus is added.`}
            >
              {d.saves[a].proficient ? '◆' : '·'} {formatMod(d.saves[a].mod)}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-5">
        <section>
          <h3 className="label" style={{ marginBottom: '0.5rem' }}>
            Skills ·{' '}
            <span data-hint={PROFICIENCY_HINT} style={{ borderBottom: '1px dashed var(--hairline-lit)', cursor: 'help' }}>
              prof {formatMod(d.proficiencyBonus)}
            </span>
          </h3>
          <ul>
            {SKILLS.map((s) => {
              const sk = d.skills[s];
              return (
                <li
                  key={s}
                  className="flex justify-between items-baseline"
                  style={{
                    padding: '0.18rem 0',
                    fontSize: '0.8125rem',
                    color: sk.proficient ? 'var(--content-1)' : 'var(--content-2)',
                  }}
                >
                  <span>
                    <span
                      aria-hidden
                      data-hint={sk.expertise ? EXPERTISE_HINT : sk.proficient
                        ? 'Proficient: your proficiency bonus is added to this skill.'
                        : undefined}
                      style={{
                        display: 'inline-block', width: '0.9rem',
                        color: sk.expertise ? 'var(--rubric)' : 'var(--content-3)',
                      }}
                    >
                      {sk.expertise ? '◆' : sk.proficient ? '◇' : ''}
                    </span>
                    {SKILL_NAMES[s]}
                    {sk.expertise && <span className="sr-only"> (expertise)</span>}
                  </span>
                  <span className="stat-num" style={{ fontSize: '0.875rem' }}>{formatMod(sk.mod)}</span>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="flex flex-col gap-5">
          <Group title="Passive">
            <Row k="Perception" v={d.passivePerception} />
            <Row k="Insight" v={d.passiveInsight} />
            <Row k="Investigation" v={d.passiveInvestigation} />
          </Group>

          {d.attacks.length > 0 && (
            <Group title="Attacks">
              {d.attacks.map((a) => (
                <div key={a.weapon.id} className="flex justify-between items-baseline" style={{ padding: '0.18rem 0', fontSize: '0.8125rem' }}>
                  <span style={{ color: a.proficient ? 'var(--content-1)' : 'var(--content-3)' }}>
                    {a.weapon.name}
                    {a.masteryActive && (
                      <span
                        style={{
                          color: 'var(--rubric)', fontSize: '0.75rem', marginLeft: '0.4rem',
                          textTransform: 'uppercase', letterSpacing: '0.04em',
                        }}
                        title={MASTERY_TEXT[a.weapon.mastery]}
                      >
                        {a.weapon.mastery}
                      </span>
                    )}
                    {!a.proficient && (
                      <span title="Not proficient — no proficiency bonus on this attack">
                        <span aria-hidden style={{ color: 'var(--warning)', marginLeft: '0.3rem' }}>△</span>
                        <span className="sr-only"> (not proficient)</span>
                      </span>
                    )}
                  </span>
                  <span className="stat-num" style={{ color: 'var(--content-2)', fontSize: '0.875rem' }}>
                    {formatMod(a.attackBonus)} · {a.damage}
                    {a.damageBonus !== 0 ? formatMod(a.damageBonus) : ''}
                  </span>
                </div>
              ))}
            </Group>
          )}

          {d.spellSaveDc !== null && (
            <Group title="Spellcasting">
              <Row k="Save DC" v={d.spellSaveDc} />
              <Row k="Attack" v={formatMod(d.spellAttackBonus ?? 0)} />
              <Row k="Slots" v={d.spellSlots.length ? d.spellSlots.map((n, i) => `${i + 1}:${n}`).join('  ') : '—'} />
            </Group>
          )}

          {d.pactSlots && (
            <Group title="Pact Magic">
              <Row k="Slots" v={`${d.pactSlots.count} × level ${d.pactSlots.level}`} />
            </Group>
          )}

          <Group title="Carry">
            <Row k="Capacity" v={`${d.carryingCapacity} lb`} />
            {d.stealthDisadvantage && (
              <p className="issue issue-warn" style={{ marginTop: '0.3rem' }}>
                Disadvantage on Stealth from armor
              </p>
            )}
          </Group>
        </section>
      </div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="label" style={{ marginBottom: '0.4rem' }}>{title}</h3>
      {children}
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <div className="panel-raised" style={{ padding: '0.6rem 0.7rem' }}>
      <div className="label" style={{ fontSize: '0.75rem', letterSpacing: '0.05em' }}>{label}</div>
      <div className="stat-num" style={{ fontSize: '1.625rem', color: 'var(--content-1)', lineHeight: 1.15 }}>
        {value}
      </div>
      {note && <div className="meta-quiet" style={{ fontSize: '0.75rem' }}>{note}</div>}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string | number }) {
  return (
    <div className="flex justify-between items-baseline" style={{ padding: '0.18rem 0', fontSize: '0.8125rem' }}>
      <span style={{ color: 'var(--content-2)' }}>{k}</span>
      <span className="stat-num" style={{ color: 'var(--content-1)', fontSize: '0.875rem' }}>{v}</span>
    </div>
  );
}
