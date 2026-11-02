'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
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
import { classArtSrc } from '@/ui/classArt';
import { derive } from '@/character/derive';
import {
  HIT_DIE_HINT, ABILITY_HINT, PRIMARY_ABILITY_HINT, CASTER_HINT, MARTIAL_HINT,
  SIZE_HINT, SPEED_HINT, BACKGROUND_ABILITY_HINT,
} from '@/ui/hints';
import { ThemeToggle } from '@/ui/components/ThemeToggle';

/** 2024 creation order: Class -> Origin -> Ability Scores -> Details. */
const STEPS = ['Class', 'Origin', 'Abilities', 'Details'] as const;
type Step = (typeof STEPS)[number];

/** One source of truth for "what happens next", used by both the inline
    continue button on desktop and the docked action button on a phone. */
const NEXT: Record<Step, Step | null> = {
  Class: 'Origin', Origin: 'Abilities', Abilities: 'Details', Details: null,
};
const NEXT_LABEL: Record<Step, string> = {
  Class: 'Continue to Origin',
  Origin: 'Continue to Abilities',
  Abilities: 'Continue to Details',
  Details: 'Begin the campaign (M2)',
};

export function CreateClient() {
  const [step, setStep] = useState<Step>('Class');
  /**
   * Compact width only: the live sheet is a bottom sheet with two detents, and
   * this is which one it rests at. It is never read on desktop, where the same
   * element is a sticky aside.
   */
  const [sheetOpen, setSheetOpen] = useState(false);
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
  const ready = Boolean(build.classId && build.speciesId && build.backgroundId);

  /** The two numbers worth showing on the collapsed sheet. */
  const peek = useMemo(() => {
    if (!ready) return null;
    try {
      const d = derive(build);
      return { ac: d.armorClass, hp: d.maxHp };
    } catch {
      return null;
    }
  }, [build, ready]);

  const cls = CLASSES.find((c) => c.id === build.classId);
  const species = SPECIES.find((sp) => sp.id === build.speciesId);
  const nextStep = NEXT[step];
  const nextBlocked =
    (step === 'Class' && !build.classId) ||
    (step === 'Origin' && !(species && build.backgroundId)) ||
    step === 'Details';

  // Tap the grabber to cycle detents; drag it to set one directly. The gesture
  // is never the only route in (accessibility.md > Mobility: "offer onscreen
  // ways to achieve the same outcome").
  const dragFrom = useRef<number | null>(null);
  const dragged = useRef(false);

  const statusText = errors.length === 0 && ready ? 'playable' : `${errors.length} to resolve`;

  return (
    <main className="min-h-screen">
      {/* Brand and controls on one row, the step rail on its own full-width row
          below at compact width; a single row on desktop. */}
      <header className="create-bar gutter border-b" style={{ borderColor: 'var(--hairline)' }}>
        <Link href="/" className="label label-strong create-bar__brand" style={{ textDecoration: 'none' }}>← dnthey</Link>

        <nav className="step-rail create-bar__rail" aria-label="Creation steps">
          {STEPS.map((s, i) => (
            <button
              key={s}
              onClick={() => setStep(s)}
              className="btn"
              data-active={step === s}
              aria-current={step === s ? 'step' : undefined}
            >
              <span className="step-n">{i + 1}.</span> {s}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-4 create-bar__trail">
          {/* On a phone this count lives on the sheet dock, where the problems
              it refers to are one tap away. */}
          <span className="label hide-compact">{statusText}</span>
          <ThemeToggle />
        </div>
      </header>

      <div className="create-grid gutter">
        <section>
          {step === 'Class' && <ClassStep build={build} patch={patch} patchWith={patchWith} onNext={() => setStep('Origin')} />}
          {step === 'Origin' && <OriginStep build={build} patch={patch} patchWith={patchWith} onNext={() => setStep('Abilities')} />}
          {step === 'Abilities' && <AbilitiesStep build={build} patch={patch} patchWith={patchWith} onNext={() => setStep('Details')} />}
          {step === 'Details' && <DetailsStep build={build} patch={patch} patchWith={patchWith} />}
        </section>

        {/* Tapping the scrim is the way out that is not the Done button
            (sheets.md > Best practices). Rendered only while expanded. */}
        {sheetOpen && (
          <button
            type="button"
            className="dock-scrim hide-wide"
            aria-label="Collapse the character sheet"
            onClick={() => setSheetOpen(false)}
          />
        )}

        {/*
          The same element, two jobs. Desktop: a sticky aside beside the form.
          Phone: a nonmodal bottom sheet, because the live sheet is feedback on
          the choice being made and must not move to another screen
          (sheets.md > Mobile: a nonmodal sheet suits "supplementary items that
          affect the main task in the parent view"). Collapsed it still shows
          who this character is, their armour class and hit points, and what is
          left to resolve; expanded it is the whole sheet.
        */}
        <aside className="live-aside" data-open={sheetOpen}>
          <button
            type="button"
            className="dock-handle hide-wide"
            aria-expanded={sheetOpen}
            aria-controls="live-sheet"
            onPointerDown={(e) => { dragFrom.current = e.clientY; dragged.current = false; }}
            onPointerUp={(e) => {
              if (dragFrom.current === null) return;
              const dy = e.clientY - dragFrom.current;
              dragFrom.current = null;
              if (Math.abs(dy) > 24) { dragged.current = true; setSheetOpen(dy < 0); }
            }}
            onClick={() => {
              if (dragged.current) { dragged.current = false; return; }
              setSheetOpen((v) => !v);
            }}
          >
            <span className="dock-handle__grabber" aria-hidden />
            <span className="dock-handle__title">
              <span className="label" style={{ display: 'block' }}>
                {sheetOpen ? 'Hide character sheet' : 'Character sheet'}
              </span>
              <span className="meta" style={{ display: 'block' }}>
                {ready
                  ? `${build.name || 'Unnamed'}, level ${build.level} ${species?.name ?? ''} ${cls?.name ?? ''}`
                  : 'Fills in as you choose'}
              </span>
            </span>
            <span className="dock-handle__stats">
              {peek ? (
                <>
                  <span className="meta-quiet">
                    AC <span className="stat-num" style={{ color: 'var(--content-1)' }}>{peek.ac}</span>
                  </span>
                  <span className="meta-quiet">
                    HP <span className="stat-num" style={{ color: 'var(--content-1)' }}>{peek.hp}</span>
                  </span>
                </>
              ) : (
                <span className="label" style={{ color: 'var(--rubric)' }}>{statusText}</span>
              )}
            </span>
          </button>

          <div id="live-sheet" className="live-aside__scroll">
            {ready ? <Sheet build={build} /> : (
              <div className="panel text-center" style={{ padding: '2rem' }}>
                <p className="prose-ink" style={{ color: 'var(--content-3)' }}>
                  Your sheet fills in as you choose.
                </p>
              </div>
            )}

            {(errors.length > 0 || warnings.length > 0) && (
              <div className="panel" style={{ padding: '1rem' }}>
                <h3 className="label mb-2">Validation</h3>
                <ul>
                  {errors.map((i, n) => <li key={`e${n}`} className="issue">{i.message}</li>)}
                  {warnings.map((i, n) => <li key={`w${n}`} className="issue issue-warn">{i.message}</li>)}
                </ul>
              </div>
            )}
          </div>

          {/* The step's primary action, low and within thumb reach rather than
              at the end of a long scroll (designing-for-ios.md > Best
              practices). Unavailable until the step's required data is there
              (entering-data.md > Best practices). */}
          <div className="dock-action hide-wide">
            <button
              className="btn btn-primary"
              disabled={nextBlocked}
              onClick={() => { if (nextStep) setStep(nextStep); }}
            >
              {NEXT_LABEL[step]}
            </button>
          </div>
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
        blurb="In the 2024 rules you pick your class first. It is the biggest decision about how you will actually play."
      />
      <div className="opt-grid" style={{ ['--opt-min' as string]: '16.5rem' }}>
        {CLASSES.map((c) => (
          <button
            key={c.id}
            className="card-select card-class"
            data-selected={build.classId === c.id}
            aria-label={
              `${c.name}. ${c.tagline}. Hit die d${c.hitDie}. ` +
              `Primary ability ${c.primary.map((pr) => ABILITY_NAMES[pr]).join(' or ')}. ` +
              `${c.caster !== 'none' ? 'Spellcaster.' : 'Not a spellcaster.'}`
            }
            onClick={() => patch({
              classId: c.id, classSkills: [], expertise: [], weaponMasteries: [],
              equippedWeaponIds: [], equippedArmorId: undefined, hasShield: false,
            })}
          >
            <span className="card-head">
              {(() => {
                const art = classArtSrc(c.id);
                return art ? (
                  <Image
                    className="card-portrait"
                    src={art.thumb}
                    alt=""
                    width={128}
                    height={128}
                    sizes="74px"
                    loading="lazy"
                  />
                ) : null;
              })()}
              <span className="card-head-text">
                <span className="card-title">{c.name}</span>
                <span className="card-tagline">{c.tagline}</span>
              </span>
            </span>
            <span className="card-meta">
              <span className="tag stat-num" data-hint={HIT_DIE_HINT(c.hitDie)}>d{c.hitDie}</span>
              <span className="tag" data-hint={PRIMARY_ABILITY_HINT(c.primary)}>
                {c.primary.map((pr) => pr.toUpperCase()).join(' / ')}
              </span>
              <span className="tag" data-hint={c.caster !== 'none' ? CASTER_HINT : MARTIAL_HINT}>
                {c.caster !== 'none' ? 'spellcaster' : 'no spells'}
              </span>
            </span>
          </button>
        ))}
      </div>

      {cls && (
        <div className="panel mt-5" style={{ padding: '1.25rem' }}>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h3 style={{ fontSize: '1.375rem' }}>{cls.name}</h3>
              <p className="prose-ink" style={{ fontSize: 'var(--text-base)', marginTop: '0.35rem', maxWidth: '52ch', color: 'var(--content-1)' }}>
                {cls.description}
              </p>
              <p className="meta" style={{ marginTop: '0.4rem' }}>
                Saves in {cls.savingThrows.map((sv) => ABILITY_NAMES[sv]).join(' and ')}
                {' · '}{cls.armor.length ? cls.armor.join(', ') + ' armor' : 'no armor training'}
                {' · '}{cls.subclassName} at level {cls.subclassLevel}
              </p>
            </div>
            <button className="btn btn-primary hide-compact" onClick={onNext}>Continue to Origin</button>
          </div>

          <hr className="rule" style={{ margin: '1rem 0' }} />

          <h4 className="label" style={{ marginBottom: '0.5rem' }}>What you get at level 1</h4>
          <ul style={{ display: 'grid', gap: '0.6rem' }}>
            {cls.features.filter((f) => f.level === 1).map((f) => (
              <li key={f.name} style={{ fontSize: 'var(--text-sm)', lineHeight: 1.6 }}>
                <strong>{f.name}.</strong>{' '}
                <span style={{ color: 'var(--content-2)' }}>{f.text}</span>
              </li>
            ))}
          </ul>
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
        blurb="Background and species. In the 2024 rules your ability increases and your first feat come from your background. Your species gives traits only."
      />

      <h3 className="label mb-2">Background</h3>
      <div className="opt-grid opt-grid--dense mb-5" style={{ ['--opt-min' as string]: '13rem' }}>
        {BACKGROUNDS.map((b) => (
          <button
            key={b.id} className="card-select" data-selected={build.backgroundId === b.id}
            onClick={() => patch({
              backgroundId: b.id, backgroundIncrease: {}, originFeatId: b.originFeat, expertise: [],
            })}
          >
            <span className="card-title">{b.name}</span>
            <span className="card-meta" data-hint={BACKGROUND_ABILITY_HINT}>
              {b.abilities.map((a) => (
                <span key={a} className="tag" title={ABILITY_HINT[a]}>{a.toUpperCase()}</span>
              ))}
            </span>
          </button>
        ))}
      </div>
      {bg && (
        <p className="prose-ink mb-5" style={{ fontSize: 'var(--text-sm)', color: 'var(--content-2)' }}>
          {bg.description} Grants {SKILL_NAMES[bg.skills[0]]} and {SKILL_NAMES[bg.skills[1]]},
          proficiency with {bg.toolProficiency}, and the{' '}
          <strong>{FEATS_BY_ID[bg.originFeat]?.name}</strong> feat.
        </p>
      )}

      <h3 className="label mb-2">Species</h3>
      <div className="opt-grid opt-grid--dense mb-3" style={{ ['--opt-min' as string]: '12rem' }}>
        {SPECIES.map((s) => (
          <button
            key={s.id} className="card-select" data-selected={build.speciesId === s.id}
            onClick={() => patch({ speciesId: s.id, speciesChoice: undefined })}
          >
            <span className="card-title">{s.name}</span>
            <span className="card-meta">
              <span className="tag" data-hint={SIZE_HINT}>
                {typeof s.size === 'string' ? s.size : 'small / medium'}
              </span>
              <span className="tag stat-num" data-hint={SPEED_HINT}>{s.speed} ft</span>
            </span>
          </button>
        ))}
      </div>

      {species?.choice && (
        <div className="panel p-4 mb-4">
          <h3 className="label mb-2">{species.choice.label}</h3>
          <div className="opt-grid" style={{ ['--opt-min' as string]: '17rem' }}>
            {species.choice.options.map((o) => (
              <button
                key={o.id} className="card-select" data-selected={build.speciesChoice === o.id}
                onClick={() => patch({ speciesChoice: o.id })}
              >
                <span className="card-title" style={{ fontSize: '1rem' }}>{o.name}</span>
                <span className="card-body">{o.text}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {species && (
        <div className="panel p-4 mb-5">
          <h3 className="label mb-2">{species.name} traits</h3>
          <ul style={{ fontSize: 'var(--text-sm)', lineHeight: 1.6 }}>
            {species.traits.map((t) => (
              <li key={t.name} className="mb-1.5">
                <strong>{t.name}.</strong>{' '}
                <span style={{ color: 'var(--content-2)' }}>{t.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {cls && (
        <>
          <h3 className="label mb-2">
            Class skills: choose {cls.skillCount} ({build.classSkills.length} chosen)
          </h3>
          <div className="flex flex-wrap gap-1.5 mb-4">
            {cls.skillChoices.map((s) => {
              const chosen = build.classSkills.includes(s);
              const fromBg = bg?.skills.includes(s);
              return (
                <button
                  key={s} className="chip" data-selected={chosen}
                  onClick={() => toggleSkill(s)}
                  title={fromBg ? 'already granted by your background' : undefined}
                >
                  {SKILL_NAMES[s]}{fromBg ? ' ·bg' : ''}
                </button>
              );
            })}
          </div>
        </>
      )}

      <button className="btn btn-primary hide-compact" onClick={onNext} disabled={!species || !bg}>
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

      <div className="flex flex-wrap gap-2 mb-4" role="group" aria-label="Score method">
        {(['standard_array', 'point_buy', 'rolled'] as const).map((m) => (
          <button
            key={m} className="chip" data-selected={build.scoreMethod === m}
            onClick={() => {
              setRolled(null);
              patch({
                scoreMethod: m,
                baseScores: m === 'point_buy' ? emptyScores(8) : emptyScores(10),
              });
            }}
            
          >
            {m === 'standard_array' ? 'Standard Array' : m === 'point_buy' ? 'Point Buy (27)' : 'Roll 4d6'}
          </button>
        ))}
      </div>

      {build.scoreMethod === 'standard_array' && (
        <p className="meta mb-3">
          Assign each of 15, 14, 13, 12, 10, 8 exactly once.
        </p>
      )}
      {build.scoreMethod === 'point_buy' && (
        <p className="meta mb-3" style={{ color: remaining === 0 ? 'var(--success)' : 'var(--rubric)' }}>
          {remaining ?? 0} of {POINT_BUY_BUDGET} points remaining. Scores run 8 to 15 before your background increase.
        </p>
      )}
      {build.scoreMethod === 'rolled' && (
        <div className="mb-3 flex flex-wrap items-center gap-3">
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
            <span className="stat-num" style={{ color: 'var(--rubric)' }}>
              {[...rolled].sort((a, b) => b - a).join('  ')}
            </span>
          )}
        </div>
      )}

      <div className="panel p-4 mb-5">
        {ABILITIES.map((a) => (
          <div key={a} className="ability-row">
            <label
              className="ability-row__name"
              htmlFor={build.scoreMethod === 'point_buy' ? undefined : `score-${a}`}
            >
              {ABILITY_NAMES[a]}
            </label>

            {build.scoreMethod === 'point_buy' ? (
              <div className="ability-row__control flex items-center gap-2">
                <button className="btn btn-step" aria-label={`Lower ${ABILITY_NAMES[a]}`}
                  onClick={() => setScore(a, Math.max(8, build.baseScores[a] - 1))}>−</button>
                <span className="stat-num" style={{ width: '2rem', textAlign: 'center', fontSize: '1.1rem' }}>
                  {build.baseScores[a]}
                </span>
                <button className="btn btn-step" aria-label={`Raise ${ABILITY_NAMES[a]}`}
                  onClick={() => setScore(a, Math.min(15, build.baseScores[a] + 1))}>+</button>
                <span className="meta-quiet" style={{ width: '3.5rem' }}>
                  {POINT_BUY_COST[build.baseScores[a]] ?? 'n/a'} pts
                </span>
              </div>
            ) : (
              <select
                id={`score-${a}`}
                className="ability-row__control"
                value={build.baseScores[a]}
                onChange={(e) => setScore(a, Number(e.target.value))}
                style={{ width: '6rem' }}
              >
                {(build.scoreMethod === 'rolled' && rolled ? rolled : [...STANDARD_ARRAY])
                  .concat(build.scoreMethod === 'rolled' && !rolled ? [10] : [])
                  .map((v, i) => <option key={`${v}-${i}`} value={v}>{v}</option>)}
              </select>
            )}

            <span className="meta stat-num ability-row__mod">
              {formatMod(Math.floor((build.baseScores[a] + (build.backgroundIncrease[a] ?? 0) - 10) / 2))}
              {build.backgroundIncrease[a] ? (
                <span style={{ color: 'var(--content-2)' }}> (+{build.backgroundIncrease[a]} bg)</span>
              ) : null}
            </span>
          </div>
        ))}
      </div>

      {bg && (
        <div className="panel p-4 mb-5">
          <h3 className="label mb-1">{bg.name} ability increase</h3>
          <p className="meta mb-3">
            Spend 3 points among {bg.abilities.map((a) => ABILITY_NAMES[a]).join(', ')}: either +2/+1 or +1/+1/+1.
          </p>
          <div className="flex flex-wrap gap-2">
            <button className="chip"
              data-selected={Object.values(build.backgroundIncrease).filter((v) => v === 1).length === 3}
              onClick={() => setIncrease('1-1-1')}>
              +1 / +1 / +1
            </button>
            {bg.abilities.map((first) =>
              bg.abilities.filter((s) => s !== first).map((second) => (
                <button
                  key={`${first}-${second}`} className="chip"
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

      <button className="btn btn-primary hide-compact" onClick={onNext}>Continue to Details</button>
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

      <div className="field-pair mb-5">
        <div>
          <label className="field-label">Name</label>
          <input type="text" value={build.name} placeholder="Veyra Ashlock"
            onChange={(e) => patch({ name: e.target.value })} />
        </div>
        <div>
          <label className="field-label">Pronouns</label>
          <input type="text" value={build.pronouns}
            onChange={(e) => patch({ pronouns: e.target.value })} />
        </div>
      </div>

      <h3 className="label mb-2">Origin feat</h3>
      <div className="flex flex-wrap gap-1.5 mb-5">
        {ORIGIN_FEATS.map((f) => (
          <button key={f.id} className="chip" data-selected={build.originFeatId === f.id}
            onClick={() => patch({ originFeatId: f.id })}
             title={f.text}>
            {f.name}
          </button>
        ))}
      </div>

      {masteryCount > 0 && (
        <>
          <h3 className="label mb-1">
            Weapon mastery: choose {masteryCount} ({build.weaponMasteries.length} chosen)
          </h3>
          <p className="meta mb-2">
            New in the 2024 rules: each weapon has a mastery property your class can unlock.
          </p>
          <div className="flex flex-wrap gap-1.5 mb-5">
            {MASTERIES.map((m) => (
              <button key={m} className="chip" data-selected={build.weaponMasteries.includes(m)}
                onClick={() => toggleMastery(m)} title={MASTERY_TEXT[m]}
                style={{ textTransform: 'capitalize' }}>
                {m}
              </button>
            ))}
          </div>
        </>
      )}

      <h3 className="label mb-2">Equipped weapons</h3>
      <div className="flex flex-wrap gap-1.5 mb-5">
        {WEAPONS.filter((w) =>
          cls?.weapons.some((cw) =>
            (cw === 'Simple' && w.category === 'simple') ||
            (cw === 'Martial' && w.category === 'martial') ||
            cw.startsWith('Martial weapons with'),
          ),
        ).map((w) => (
          <button key={w.id} className="chip" data-selected={build.equippedWeaponIds.includes(w.id)}
            onClick={() => toggleWeapon(w.id)}
            title={`${w.damage} ${w.damageType} · mastery: ${w.mastery}`}>
            {w.name}
          </button>
        ))}
      </div>

      <div className="field-pair mb-5">
        <div>
          <label className="field-label">Appearance</label>
          <textarea rows={3} value={build.appearance} placeholder="One line a stranger would notice first."
            onChange={(e) => patch({ appearance: e.target.value })} />
        </div>
        <div>
          <label className="field-label">Flaw (the DM will use this)</label>
          <textarea rows={3} value={build.personality.flaw}
            placeholder="The way they reliably make things worse."
            onChange={(e) => patch({ personality: { ...build.personality, flaw: e.target.value } })} />
        </div>
      </div>

      <button className="btn btn-primary hide-compact" disabled>Begin the campaign (M2)</button>
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
      <span className="label">Step {n} of 4</span>
      <h2 style={{ fontSize: '1.75rem', marginTop: '0.25rem' }}>{title}</h2>
      <p className="prose-ink" style={{ color: 'var(--content-2)', fontSize: 'var(--text-base)', marginTop: '0.4rem', maxWidth: '46rem' }}>
        {blurb}
      </p>
    </div>
  );
}
