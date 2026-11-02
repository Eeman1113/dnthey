'use client';

import { ABILITIES, ABILITY_NAMES, SKILL_NAMES, SKILLS, formatMod } from '@/engine/types';
import { derive } from '@/character/derive';
import type { CharacterBuild } from '@/character/types';
import { CLASSES_BY_ID } from '@/data/srd/classes';
import { SPECIES_BY_ID } from '@/data/srd/species';
import { BACKGROUNDS_BY_ID } from '@/data/srd/backgrounds';
import { MASTERY_TEXT } from '@/data/srd/equipment';

/** Live character sheet. Reads only from derive() so it can never disagree with the engine. */
export function Sheet({ build }: { build: CharacterBuild }) {
  let d;
  try {
    d = derive(build);
  } catch (e) {
    return <p style={{ color: 'var(--failure)' }}>{(e as Error).message}</p>;
  }

  const cls = CLASSES_BY_ID[build.classId]!;
  const species = SPECIES_BY_ID[build.speciesId]!;
  const bg = BACKGROUNDS_BY_ID[build.backgroundId]!;

  return (
    <div className="panel p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 style={{ fontSize: '1.6rem', lineHeight: 1.1 }}>
          {build.name || <span style={{ color: 'var(--parchment-faint)' }}>Unnamed</span>}
        </h2>
        <span className="label-xs">{build.pronouns}</span>
      </div>
      <p className="label-xs mt-1" style={{ color: 'var(--gold-dim)' }}>
        Level {build.level} {species.name} {cls.name} · {bg.name}
      </p>

      <div className="rule-gold my-4" />

      {/* Headline combat numbers */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <Stat label="Armor Class" value={d.armorClass} note={d.armorNote} />
        <Stat label="Hit Points" value={d.maxHp} note={`d${d.hitDie} hit die`} />
        <Stat label="Initiative" value={formatMod(d.initiative)} />
        <Stat label="Speed" value={`${d.speed} ft`} />
      </div>

      {/* Abilities */}
      <div className="grid grid-cols-6 gap-2 mb-4">
        {ABILITIES.map((a) => (
          <div key={a} className="panel-raised px-2 py-2 text-center">
            <div className="label-xs" style={{ fontSize: '0.5625rem' }}>{a}</div>
            <div className="stat-num" style={{ fontSize: '1.5rem', color: 'var(--parchment)' }}>
              {formatMod(d.mods[a])}
            </div>
            <div className="label-xs" style={{ fontSize: '0.625rem', color: 'var(--parchment-faint)' }}>
              {d.scores[a]}
            </div>
            <div
              className="label-xs mt-1"
              style={{ fontSize: '0.5625rem', color: d.saves[a].proficient ? 'var(--gold)' : 'var(--parchment-faint)' }}
              title={`${ABILITY_NAMES[a]} saving throw`}
            >
              save {formatMod(d.saves[a].mod)}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Skills */}
        <section>
          <h3 className="label-xs mb-2">Skills · prof +{d.proficiencyBonus}</h3>
          <ul style={{ fontSize: '0.8125rem' }}>
            {SKILLS.map((s) => {
              const sk = d.skills[s];
              return (
                <li
                  key={s}
                  className="flex justify-between py-[3px]"
                  style={{ color: sk.proficient ? 'var(--parchment)' : 'var(--parchment-faint)' }}
                >
                  <span>
                    {sk.expertise ? '◆ ' : sk.proficient ? '◇ ' : '　'}
                    {SKILL_NAMES[s]}
                  </span>
                  <span className="stat-num">{formatMod(sk.mod)}</span>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="flex flex-col gap-4">
          <div>
            <h3 className="label-xs mb-2">Passive</h3>
            <div style={{ fontSize: '0.8125rem' }}>
              <Row k="Perception" v={d.passivePerception} />
              <Row k="Insight" v={d.passiveInsight} />
              <Row k="Investigation" v={d.passiveInvestigation} />
            </div>
          </div>

          {d.attacks.length > 0 && (
            <div>
              <h3 className="label-xs mb-2">Attacks</h3>
              <div style={{ fontSize: '0.8125rem' }}>
                {d.attacks.map((a) => (
                  <div key={a.weapon.id} className="flex justify-between py-[3px]">
                    <span style={{ color: a.proficient ? 'var(--parchment)' : 'var(--failure)' }}>
                      {a.weapon.name}
                      {a.masteryActive && (
                        <span
                          style={{ color: 'var(--gold)', fontSize: '0.6875rem', marginLeft: 6 }}
                          title={MASTERY_TEXT[a.weapon.mastery]}
                        >
                          {a.weapon.mastery}
                        </span>
                      )}
                    </span>
                    <span className="stat-num" style={{ color: 'var(--parchment-dim)' }}>
                      {formatMod(a.attackBonus)} · {a.damage}
                      {a.damageBonus !== 0 ? formatMod(a.damageBonus) : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {d.spellSaveDc !== null && (
            <div>
              <h3 className="label-xs mb-2">Spellcasting</h3>
              <div style={{ fontSize: '0.8125rem' }}>
                <Row k="Save DC" v={d.spellSaveDc} />
                <Row k="Attack" v={formatMod(d.spellAttackBonus ?? 0)} />
                <Row
                  k="Slots"
                  v={d.spellSlots.length ? d.spellSlots.map((n, i) => `${i + 1}:${n}`).join(' ') : '—'}
                />
              </div>
            </div>
          )}

          {d.pactSlots && (
            <div>
              <h3 className="label-xs mb-2">Pact Magic</h3>
              <div style={{ fontSize: '0.8125rem' }}>
                <Row k="Slots" v={`${d.pactSlots.count} × level ${d.pactSlots.level}`} />
              </div>
            </div>
          )}

          <div>
            <h3 className="label-xs mb-2">Carry</h3>
            <div style={{ fontSize: '0.8125rem' }}>
              <Row k="Capacity" v={`${d.carryingCapacity} lb`} />
              {d.stealthDisadvantage && (
                <p style={{ color: 'var(--blood-lit)', fontSize: '0.75rem', marginTop: 4 }}>
                  Disadvantage on Stealth from armor
                </p>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <div className="panel-raised px-3 py-2">
      <div className="label-xs" style={{ fontSize: '0.5625rem' }}>{label}</div>
      <div className="stat-num" style={{ fontSize: '1.65rem', color: 'var(--gold)', lineHeight: 1.1 }}>
        {value}
      </div>
      {note && (
        <div className="label-xs" style={{ fontSize: '0.5625rem', textTransform: 'none', letterSpacing: 0 }}>
          {note}
        </div>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string | number }) {
  return (
    <div className="flex justify-between py-[3px]">
      <span style={{ color: 'var(--parchment-dim)' }}>{k}</span>
      <span className="stat-num">{v}</span>
    </div>
  );
}
