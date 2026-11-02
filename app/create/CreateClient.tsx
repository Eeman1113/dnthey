'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ABILITIES, ABILITY_NAMES, SKILL_NAMES, formatMod, type Ability, type Skill } from '@/engine/types';
import { CLASSES } from '@/data/srd/classes';
import { SPECIES } from '@/data/srd/species';
import { BACKGROUNDS, BACKGROUNDS_BY_ID } from '@/data/srd/backgrounds';
import { FEATS_BY_ID, ORIGIN_FEATS } from '@/data/srd/feats';
import { MASTERIES, MASTERY_TEXT, WEAPONS } from '@/data/srd/equipment';
import { emptyBuild, validateBuild } from '@/character/builder';
import {
  STANDARD_ARRAY, POINT_BUY_BUDGET, POINT_BUY_COST, pointBuyRemaining, emptyScores,
} from '@/character/scores';
import { rollAbilityScores } from '@/engine/dice';
import { Rng } from '@/engine/rng';
import type { CharacterBuild } from '@/character/types';
import { Sheet } from '@/ui/components/Sheet';
import { ThemeToggle } from '@/ui/components/ThemeToggle';

/** 2024 creation order: Class -> Origin -> Ability Scores -> Details. */
const STEPS = ['Class', 'Origin', 'Abilities', 'Details'] as const;
type Step = (typeof STEPS)[number];

export function CreateClient() {
  const [step, setStep] = useState<Step>('Class');
  const [build, setBuild] = useState<CharacterBuild>(() => ({
    ...emptyBuild(),
    classId: '',
    backgroundId: '',
    speciesId: '',
    originFeatId: '',
  }));

  const patch = (p: Partial<CharacterBuild>) => setBuild((b) => ({ ...b, ...p }));
  /**
   * Toggles must derive from the PREVIOUS state, not the render closure: two clicks
   * in the same tick would otherwise both compute from stale state and the last
   * would win, silently dropping a choice.
   */
  const patchWith = (fn: (b: CharacterBuild) => Partial<CharacterBuild>) =>
    setBuild((b) => ({ ...b, ...fn(b) }));

  const issues = useMemo(() => validateBuild(build), [build]);
  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');
  const ready = build.classId && build.speciesId && build.backgroundId;

  return (
    <main className="min-h-screen">
      <header className="flex items-center justify-between px-8 py-4 border-b" style={{ borderColor: 'var(--ink-line)' }}>
        <Link href="/" className="label-xs" style={{ textDecoration: 'none' }}>← dnthey</Link>
        <nav className="flex gap-1">
          {STEPS.map((s, i) => (
            <button
              key={s}
              onClick={() => setStep(s)}
              className="btn"
              data-active={step === s}
              style={{
                padding: '0.35rem 0.8rem',
                borderColor: step === s ? 'var(--gold)' : 'var(--ink-line)',
                color: step === s ? 'var(--gold)' : 'var(--parchment-faint)',
              }}
            >
              {i + 1}. {s}
            </button>
          ))}
        </nav>
        <div className="flex items-center gap-4">
          <span className="label-xs">{errors.length === 0 && ready ? 'playable' : `${errors.length} to resolve`}</span>
          <ThemeToggle />
        </div>
      </header>

      <div className="grid gap-6 px-8 py-6" style={{ gridTemplateColumns: 'minmax(0,1fr) 30rem' }}>
        <section>
          {step === 'Class' && <ClassStep build={build} patch={patch} patchWith={patchWith} onNext={() => setStep('Origin')} />}
          {step === 'Origin' && <OriginStep build={build} patch={patch} patchWith={patchWith} onNext={() => setStep('Abilities')} />}
          {step === 'Abilities' && <AbilitiesStep build={build} patch={patch} patchWith={patchWith} onNext={() => setStep('Details')} />}
          {step === 'Details' && <DetailsStep build={build} patch={patch} patchWith={patchWith} />}
        </section>

        <aside className="flex flex-col gap-4" style={{ position: 'sticky', top: '1.5rem', alignSelf: 'start' }}>
          {ready ? <Sheet build={build} /> : (
            <div className="panel p-8 text-center">
              <p className="prose-ink" style={{ color: 'var(--parchment-faint)' }}>
                Your sheet fills in as you choose.
              </p>
            </div>
          )}

          {(errors.length > 0 || warnings.length > 0) && (
            <div className="panel p-4">
              <h3 className="label-xs mb-2">Validation</h3>
              <ul style={{ fontSize: '0.8125rem', lineHeight: 1.6 }}>
                {errors.map((i, n) => (
                  <li key={`e${n}`} style={{ color: 'var(--blood-lit)' }}>• {i.message}</li>
                ))}
                {warnings.map((i, n) => (
                  <li key={`w${n}`} style={{ color: 'var(--gold-dim)' }}>• {i.message}</li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}

/* ---------------------------------------------------------------- Class */

function ClassStep({ build, patch, onNext }: StepProps) {
  const cls = CLASSES.find((c) => c.id === build.classId);
  return (
    <>
      <StepHeader
        n={1} title="Choose a class"
        blurb="In the 2024 rules you pick your class first — it is the biggest decision about how you will actually play."
      />
      <div className="grid grid-cols-3 gap-2">
        {CLASSES.map((c) => (
          <button
            key={c.id}
            className="card-select"
            data-selected={build.classId === c.id}
            onClick={() => patch({
              classId: c.id, classSkills: [], expertise: [], weaponMasteries: [],
              equippedWeaponIds: [], equippedArmorId: undefined, hasShield: false,
            })}
          >
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem' }}>{c.name}</div>
            <div className="label-xs" style={{ textTransform: 'none', letterSpacing: 0 }}>
              d{c.hitDie} · {c.primary.map((p) => p.toUpperCase()).join('/')}
              {c.caster !== 'none' && ' · caster'}
            </div>
          </button>
        ))}
      </div>

      {cls && (
        <div className="panel p-4 mt-4">
          <h3 style={{ fontSize: '1.2rem' }}>{cls.name}</h3>
          <p className="label-xs mt-1" style={{ textTransform: 'none', letterSpacing: 0 }}>
            Saves: {cls.savingThrows.map((s) => ABILITY_NAMES[s]).join(' & ')} ·
            Armor: {cls.armor.join(', ') || 'none'} ·
            Subclass at level {cls.subclassLevel}: {cls.subclassName}
          </p>
          <div className="rule-gold my-3" />
          <ul style={{ fontSize: '0.8125rem', lineHeight: 1.65 }}>
            {cls.features.filter((f) => f.level === 1).map((f) => (
              <li key={f.name} className="mb-2">
                <strong style={{ color: 'var(--gold)' }}>{f.name}.</strong>{' '}
                <span style={{ color: 'var(--parchment-dim)' }}>{f.text}</span>
              </li>
            ))}
          </ul>
          <button className="btn btn-primary mt-3" onClick={onNext}>Continue to Origin</button>
        </div>
      )}
    </>
  );
}

/* --------------------------------------------------------------- Origin */

function OriginStep({ build, patch, patchWith, onNext }: StepProps) {
  const cls = CLASSES.find((c) => c.id === build.classId);
  const species = SPECIES.find((s) => s.id === build.speciesId);
  const bg = BACKGROUNDS.find((b) => b.id === build.backgroundId);

  const toggleSkill = (s: Skill) => patchWith((b) => {
    const max = cls?.skillCount ?? 0;
    if (b.classSkills.includes(s)) return { classSkills: b.classSkills.filter((x) => x !== s) };
    if (b.classSkills.length >= max) return {};
    return { classSkills: [...b.classSkills, s] };
  });

  return (
    <>
      <StepHeader
        n={2} title="Choose your origin"
        blurb="Background and species. In the 2024 rules your ability increases and your first feat come from your background — your species gives traits only."
      />

      <h3 className="label-xs mb-2">Background</h3>
      <div className="grid grid-cols-4 gap-2 mb-5">
        {BACKGROUNDS.map((b) => (
          <button
            key={b.id} className="card-select" data-selected={build.backgroundId === b.id}
            onClick={() => patch({
              backgroundId: b.id, backgroundIncrease: {}, originFeatId: b.originFeat, expertise: [],
            })}
          >
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem' }}>{b.name}</div>
            <div className="label-xs" style={{ textTransform: 'none', letterSpacing: 0 }}>
              {b.abilities.map((a) => a.toUpperCase()).join(' ')}
            </div>
          </button>
        ))}
      </div>
      {bg && (
        <p className="prose-ink mb-5" style={{ fontSize: '0.875rem', color: 'var(--parchment-dim)' }}>
          {bg.description} Grants {SKILL_NAMES[bg.skills[0]]} and {SKILL_NAMES[bg.skills[1]]},
          proficiency with {bg.toolProficiency}, and the{' '}
          <strong style={{ color: 'var(--gold)' }}>{FEATS_BY_ID[bg.originFeat]?.name}</strong> feat.
        </p>
      )}

      <h3 className="label-xs mb-2">Species</h3>
      <div className="grid grid-cols-3 gap-2 mb-3">
        {SPECIES.map((s) => (
          <button
            key={s.id} className="card-select" data-selected={build.speciesId === s.id}
            onClick={() => patch({ speciesId: s.id, speciesChoice: undefined })}
          >
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem' }}>{s.name}</div>
            <div className="label-xs" style={{ textTransform: 'none', letterSpacing: 0 }}>
              {typeof s.size === 'string' ? s.size : 'small/medium'} · {s.speed} ft
            </div>
          </button>
        ))}
      </div>

      {species?.choice && (
        <div className="panel p-4 mb-4">
          <h3 className="label-xs mb-2">{species.choice.label}</h3>
          <div className="grid grid-cols-2 gap-2">
            {species.choice.options.map((o) => (
              <button
                key={o.id} className="card-select" data-selected={build.speciesChoice === o.id}
                onClick={() => patch({ speciesChoice: o.id })}
              >
                <div style={{ fontSize: '0.9rem', color: 'var(--parchment)' }}>{o.name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--parchment-faint)', marginTop: 2 }}>{o.text}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {species && (
        <div className="panel p-4 mb-5">
          <h3 className="label-xs mb-2">{species.name} traits</h3>
          <ul style={{ fontSize: '0.8125rem', lineHeight: 1.6 }}>
            {species.traits.map((t) => (
              <li key={t.name} className="mb-1.5">
                <strong style={{ color: 'var(--gold)' }}>{t.name}.</strong>{' '}
                <span style={{ color: 'var(--parchment-dim)' }}>{t.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {cls && (
        <>
          <h3 className="label-xs mb-2">
            Class skills — choose {cls.skillCount} ({build.classSkills.length} chosen)
          </h3>
          <div className="flex flex-wrap gap-1.5 mb-4">
            {cls.skillChoices.map((s) => {
              const chosen = build.classSkills.includes(s);
              const fromBg = bg?.skills.includes(s);
              return (
                <button
                  key={s} className="card-select" data-selected={chosen}
                  onClick={() => toggleSkill(s)}
                  style={{ padding: '0.35rem 0.7rem', fontSize: '0.8125rem', opacity: fromBg ? 0.5 : 1 }}
                  title={fromBg ? 'already granted by your background' : undefined}
                >
                  {SKILL_NAMES[s]}{fromBg ? ' ·bg' : ''}
                </button>
              );
            })}
          </div>
        </>
      )}

      <button className="btn btn-primary" onClick={onNext} disabled={!species || !bg}>
        Continue to Abilities
      </button>
    </>
  );
}

/* ------------------------------------------------------------ Abilities */

function AbilitiesStep({ build, patch, onNext }: StepProps) {
  const bg = BACKGROUNDS_BY_ID[build.backgroundId];
  const [rolled, setRolled] = useState<number[] | null>(null);

  const setScore = (a: Ability, v: number) =>
    patch({ baseScores: { ...build.baseScores, [a]: v } });

  const setIncrease = (pattern: '2-1' | '1-1-1', first?: Ability, second?: Ability) => {
    if (!bg) return;
    if (pattern === '1-1-1') {
      patch({ backgroundIncrease: Object.fromEntries(bg.abilities.map((a) => [a, 1])) });
    } else if (first && second) {
      patch({ backgroundIncrease: { [first]: 2, [second]: 1 } });
    }
  };

  const remaining = (() => {
    try { return pointBuyRemaining(build.baseScores); } catch { return null; }
  })();

  return (
    <>
      <StepHeader
        n={3} title="Set your ability scores"
        blurb="Pick a method, assign the numbers, then spend your background's increase."
      />

      <div className="flex gap-2 mb-4">
        {(['standard_array', 'point_buy', 'rolled'] as const).map((m) => (
          <button
            key={m} className="card-select" data-selected={build.scoreMethod === m}
            onClick={() => {
              setRolled(null);
              patch({
                scoreMethod: m,
                baseScores: m === 'point_buy' ? emptyScores(8) : emptyScores(10),
              });
            }}
            style={{ padding: '0.45rem 0.9rem', fontSize: '0.8125rem' }}
          >
            {m === 'standard_array' ? 'Standard Array' : m === 'point_buy' ? 'Point Buy (27)' : 'Roll 4d6'}
          </button>
        ))}
      </div>

      {build.scoreMethod === 'standard_array' && (
        <p className="label-xs mb-3" style={{ textTransform: 'none', letterSpacing: 0 }}>
          Assign each of 15, 14, 13, 12, 10, 8 exactly once.
        </p>
      )}
      {build.scoreMethod === 'point_buy' && (
        <p className="label-xs mb-3" style={{ textTransform: 'none', letterSpacing: 0, color: remaining === 0 ? 'var(--success)' : 'var(--gold)' }}>
          {remaining ?? 0} of {POINT_BUY_BUDGET} points remaining. Scores run 8–15 before your background increase.
        </p>
      )}
      {build.scoreMethod === 'rolled' && (
        <div className="mb-3 flex items-center gap-3">
          <button
            className="btn"
            onClick={() => {
              const rolls = rollAbilityScores(new Rng(`${build.id}-${Date.now() % 100000}`));
              setRolled(rolls.map((r) => r.score));
            }}
          >
            Roll 4d6 drop lowest ×6
          </button>
          {rolled && (
            <span className="stat-num" style={{ color: 'var(--gold)' }}>
              {[...rolled].sort((a, b) => b - a).join('  ')}
            </span>
          )}
        </div>
      )}

      <div className="panel p-4 mb-5">
        {ABILITIES.map((a) => (
          <div key={a} className="flex items-center gap-3 py-1.5">
            <span style={{ width: '7.5rem', fontSize: '0.875rem' }}>{ABILITY_NAMES[a]}</span>

            {build.scoreMethod === 'point_buy' ? (
              <div className="flex items-center gap-2">
                <button className="btn" style={{ padding: '0.1rem 0.5rem' }}
                  onClick={() => setScore(a, Math.max(8, build.baseScores[a] - 1))}>−</button>
                <span className="stat-num" style={{ width: '2rem', textAlign: 'center', fontSize: '1.1rem' }}>
                  {build.baseScores[a]}
                </span>
                <button className="btn" style={{ padding: '0.1rem 0.5rem' }}
                  onClick={() => setScore(a, Math.min(15, build.baseScores[a] + 1))}>+</button>
                <span className="label-xs" style={{ width: '3.5rem' }}>
                  {POINT_BUY_COST[build.baseScores[a]] ?? '—'} pts
                </span>
              </div>
            ) : (
              <select
                value={build.baseScores[a]}
                onChange={(e) => setScore(a, Number(e.target.value))}
                style={{ width: '6rem' }}
              >
                {(build.scoreMethod === 'rolled' && rolled ? rolled : [...STANDARD_ARRAY])
                  .concat(build.scoreMethod === 'rolled' && !rolled ? [10] : [])
                  .map((v, i) => <option key={`${v}-${i}`} value={v}>{v}</option>)}
              </select>
            )}

            <span className="label-xs" style={{ marginLeft: 'auto' }}>
              {formatMod(Math.floor((build.baseScores[a] + (build.backgroundIncrease[a] ?? 0) - 10) / 2))}
              {build.backgroundIncrease[a] ? (
                <span style={{ color: 'var(--gold)' }}> (+{build.backgroundIncrease[a]} bg)</span>
              ) : null}
            </span>
          </div>
        ))}
      </div>

      {bg && (
        <div className="panel p-4 mb-5">
          <h3 className="label-xs mb-1">{bg.name} ability increase</h3>
          <p className="label-xs mb-3" style={{ textTransform: 'none', letterSpacing: 0 }}>
            Spend 3 points among {bg.abilities.map((a) => ABILITY_NAMES[a]).join(', ')} — either +2/+1 or +1/+1/+1.
          </p>
          <div className="flex flex-wrap gap-2">
            <button className="card-select" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8125rem' }}
              data-selected={Object.values(build.backgroundIncrease).filter((v) => v === 1).length === 3}
              onClick={() => setIncrease('1-1-1')}>
              +1 / +1 / +1
            </button>
            {bg.abilities.map((first) =>
              bg.abilities.filter((s) => s !== first).map((second) => (
                <button
                  key={`${first}-${second}`} className="card-select"
                  style={{ padding: '0.4rem 0.8rem', fontSize: '0.8125rem' }}
                  data-selected={build.backgroundIncrease[first] === 2 && build.backgroundIncrease[second] === 1}
                  onClick={() => setIncrease('2-1', first, second)}
                >
                  +2 {first.toUpperCase()} / +1 {second.toUpperCase()}
                </button>
              )),
            )}
          </div>
        </div>
      )}

      <button className="btn btn-primary" onClick={onNext}>Continue to Details</button>
    </>
  );
}

/* -------------------------------------------------------------- Details */

function DetailsStep({ build, patch, patchWith }: StepProps) {
  const cls = CLASSES.find((c) => c.id === build.classId);
  const masteryCount = cls?.weaponMasteryCount ?? 0;

  const toggleMastery = (m: (typeof MASTERIES)[number]) => patchWith((b) => {
    if (b.weaponMasteries.includes(m)) return { weaponMasteries: b.weaponMasteries.filter((x) => x !== m) };
    if (b.weaponMasteries.length >= masteryCount) return {};
    return { weaponMasteries: [...b.weaponMasteries, m] };
  });

  const toggleWeapon = (id: string) => patchWith((b) => ({
    equippedWeaponIds: b.equippedWeaponIds.includes(id)
      ? b.equippedWeaponIds.filter((x) => x !== id)
      : [...b.equippedWeaponIds, id],
  }));

  return (
    <>
      <StepHeader n={4} title="Who are they?" blurb="The mechanical leftovers, and the part the Dungeon Master will actually use." />

      <div className="grid grid-cols-2 gap-3 mb-5">
        <div>
          <label className="label-xs">Name</label>
          <input type="text" value={build.name} placeholder="Veyra Ashlock"
            onChange={(e) => patch({ name: e.target.value })} />
        </div>
        <div>
          <label className="label-xs">Pronouns</label>
          <input type="text" value={build.pronouns}
            onChange={(e) => patch({ pronouns: e.target.value })} />
        </div>
      </div>

      <h3 className="label-xs mb-2">Origin feat</h3>
      <div className="flex flex-wrap gap-1.5 mb-5">
        {ORIGIN_FEATS.map((f) => (
          <button key={f.id} className="card-select" data-selected={build.originFeatId === f.id}
            onClick={() => patch({ originFeatId: f.id })}
            style={{ padding: '0.35rem 0.7rem', fontSize: '0.8125rem' }} title={f.text}>
            {f.name}
          </button>
        ))}
      </div>

      {masteryCount > 0 && (
        <>
          <h3 className="label-xs mb-1">
            Weapon mastery — choose {masteryCount} ({build.weaponMasteries.length} chosen)
          </h3>
          <p className="label-xs mb-2" style={{ textTransform: 'none', letterSpacing: 0 }}>
            New in the 2024 rules: each weapon has a mastery property your class can unlock.
          </p>
          <div className="flex flex-wrap gap-1.5 mb-5">
            {MASTERIES.map((m) => (
              <button key={m} className="card-select" data-selected={build.weaponMasteries.includes(m)}
                onClick={() => toggleMastery(m)} title={MASTERY_TEXT[m]}
                style={{ padding: '0.35rem 0.7rem', fontSize: '0.8125rem', textTransform: 'capitalize' }}>
                {m}
              </button>
            ))}
          </div>
        </>
      )}

      <h3 className="label-xs mb-2">Equipped weapons</h3>
      <div className="flex flex-wrap gap-1.5 mb-5">
        {WEAPONS.filter((w) =>
          cls?.weapons.some((cw) =>
            (cw === 'Simple' && w.category === 'simple') ||
            (cw === 'Martial' && w.category === 'martial') ||
            cw.startsWith('Martial weapons with'),
          ),
        ).map((w) => (
          <button key={w.id} className="card-select" data-selected={build.equippedWeaponIds.includes(w.id)}
            onClick={() => toggleWeapon(w.id)}
            style={{ padding: '0.35rem 0.7rem', fontSize: '0.8125rem' }}
            title={`${w.damage} ${w.damageType} · mastery: ${w.mastery}`}>
            {w.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 mb-5">
        <div>
          <label className="label-xs">Appearance</label>
          <textarea rows={3} value={build.appearance} placeholder="One line a stranger would notice first."
            onChange={(e) => patch({ appearance: e.target.value })} />
        </div>
        <div>
          <label className="label-xs">Flaw — the DM will use this</label>
          <textarea rows={3} value={build.personality.flaw}
            placeholder="The way they reliably make things worse."
            onChange={(e) => patch({ personality: { ...build.personality, flaw: e.target.value } })} />
        </div>
      </div>

      <button className="btn btn-primary" disabled>Begin the campaign (M2)</button>
    </>
  );
}

/* --------------------------------------------------------------- shared */

interface StepProps {
  build: CharacterBuild;
  patch: (p: Partial<CharacterBuild>) => void;
  patchWith: (fn: (b: CharacterBuild) => Partial<CharacterBuild>) => void;
  onNext?: () => void;
}

function StepHeader({ n, title, blurb }: { n: number; title: string; blurb: string }) {
  return (
    <div className="mb-5">
      <span className="label-xs">Step {n} of 4</span>
      <h2 style={{ fontSize: '1.9rem', marginTop: 2 }}>{title}</h2>
      <p className="prose-ink" style={{ color: 'var(--parchment-dim)', fontSize: '0.9375rem', marginTop: 4, maxWidth: '44rem' }}>
        {blurb}
      </p>
    </div>
  );
}
