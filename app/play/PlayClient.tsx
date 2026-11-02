'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ulid } from 'ulid';
import { derive } from '@/character/derive';
import { shortRest, longRest, awardXp } from '@/engine/rest';
import { exampleBuild, initialState, isPlayable } from '@/character/builder';
import { formatMod } from '@/engine/types';
import { Art } from '@/ui/components/Art';
import { DiceRoll } from '@/ui/components/DiceRoll';
import { ThemeToggle } from '@/ui/components/ThemeToggle';
import { DevHud } from '@/ui/components/DevHud';
import { classArtSrc } from '@/ui/classArt';
import { matchBiome } from '@/ui/scenery';
import { buildWorld, cleanProse, companionIntro } from '@/agents/dm';
import { modelAvailable, prewarm, destroyAll } from '@/agents/session';
import { NARRATOR, ADJUDICATOR } from '@/agents/prompts';
import { AUX_SYSTEM } from '@/agents/session';
import {
  playBeat, maybeCompanionSpeaks, maybeBanter, applyStance, encounterFor, openingBeat,
  runCombatRound, runUpToPlayer, rememberBeat,
} from '@/campaign/beat';
import { startCombat, type CombatState } from '@/campaign/combat';
import { CombatPanel } from '@/ui/components/CombatPanel';
import type { Monster } from '@/data/srd/encounters';
import { pickCompanions } from '@/campaign/companions';
import { loadCampaign, saveCampaign, clearCampaign, loadCharacters } from '@/campaign/persist';
import type { Campaign, Beat } from '@/campaign/types';

/**
 * The sequence is deliberately a sequence: you make a character, the world is
 * built around them, you meet the people you are travelling with, and only
 * then does play start. Dropping someone straight into a prose log with two
 * strangers already in the sidebar skips the part that makes them a party.
 */
/** Used when the model declines or times out, so the party still forms. */
function fallbackIntro(name: string): string {
  return `${name} looks you over, says nothing, and falls in beside you.`;
}

type Phase = 'idle' | 'summoning' | 'meeting' | 'playing';

export function PlayClient() {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [status, setStatus] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  // Combat lives on the campaign so a reload restores the fight exactly,
  // including whose turn it is. It used to be component state and was lost.
  const combat = campaign?.combat ?? null;
  const foes = campaign?.foes ?? [];
  const setCombat = useCallback((c: CombatState | null) => {
    setCampaign((p) => (p ? { ...p, combat: c } : p));
  }, []);
  const setFoes = useCallback((f: Monster[]) => {
    setCampaign((p) => (p ? { ...p, foes: f } : p));
  }, []);
  const [tone, setTone] = useState('grim, rain-soaked, low magic, a small personal stake');
  const [safetyLines, setSafetyLines] = useState('');
  const [intros, setIntros] = useState<{ id: string; line: string }[]>([]);
  const [pending, setPending] = useState<Campaign | null>(null);
  const [hasCharacter, setHasCharacter] = useState(true);
  const logRef = useRef<HTMLDivElement>(null);
  const campaignRef = useRef<Campaign | null>(null);
  campaignRef.current = campaign;

  useEffect(() => {
    const saved = loadCampaign();
    if (saved) { setCampaign(saved); setPhase('playing'); }
    setHasCharacter(loadCharacters().length > 0);
    // The slow part is session creation, about 9.5s cold. Start it while the
    // player is still reading the setup screen.
    if (modelAvailable()) {
      prewarm('narrator', NARRATOR);
      prewarm('adjudicator', ADJUDICATOR);
      prewarm('aux', AUX_SYSTEM);
    }
    return () => destroyAll();
  }, []);

  useEffect(() => { if (campaign) saveCampaign(campaign); }, [campaign]);
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' });
  }, [campaign?.beats.length, status]);

  const pushBeat = useCallback((b: Beat) => {
    setCampaign((c) => (c ? { ...c, beats: [...c.beats, b] } : c));
  }, []);

  const patchNarration = useCallback((id: string, text: string) => {
    setCampaign((c) => c && ({
      ...c, beats: c.beats.map((b) => (b.id === id ? { ...b, text } : b)),
    }));
  }, []);

  /* ------------------------------------------------------------ start */

  async function begin() {
    setPhase('summoning');
    setStatus('Inventing a corner of the world');

    const saved = loadCharacters();
    const build = saved.length ? saved[saved.length - 1]! : exampleBuild();
    const { world, generated } = await buildWorld(tone, safetyLines);
    const seed = ulid();

    const fresh: Campaign = {
      id: seed, createdAt: Date.now(), tone, lines: safetyLines, world, worldGenerated: generated,
      pc: { build, state: initialState(build) },
      companions: pickCompanions(seed, 2).map((card) => ({ card, bond: 2 })),
      scene: `${world.openingLocation}. ${world.openingScene}`,
      // The model sometimes fills `hook` with the whole opening scene, which
      // would print the same paragraph twice. Only show the hook when it is
      // genuinely a separate, shorter line.
      beats: [
        {
          id: ulid(), kind: 'system', at: Date.now(),
          text: world.hook.length < 140 && !world.openingScene.includes(world.hook.slice(0, 40))
            ? `${world.realmName}. ${world.hook}`
            : world.realmName,
        },
        { id: ulid(), kind: 'scene', text: cleanProse(world.openingScene), at: Date.now() },
      ],
      seed, rollCount: 0,
      combat: null, foes: [],
      codex: [], chronicle: { entries: [] },
    };
    setPending(fresh);
    setStatus('The others are already here');

    // Meet them in their own words. These run in sequence rather than in
    // parallel: the device runs one model, so firing both at once only makes
    // each of them slower.
    const lines: { id: string; line: string }[] = [];
    for (const { card } of fresh.companions) {
      const line = await companionIntro(card, `${world.realmName}, ${world.openingLocation}`);
      lines.push({ id: card.id, line: line ?? fallbackIntro(card.name) });
      setIntros([...lines]);
    }

    setStatus(null);
    setPhase('meeting');
  }

  function enterWorld() {
    if (!pending) return;
    // The introductions are part of the story, so they go into the log.
    const spoken: Beat[] = intros.map(({ id, line }) => {
      const card = pending.companions.find((c) => c.card.id === id)!.card;
      return {
        id: ulid(), kind: 'speech', text: line, speaker: card.name,
        portraitId: card.portraitId, at: Date.now(),
      };
    });
    setCampaign({ ...pending, beats: [...spoken, ...pending.beats] });
    setPending(null);
    setPhase('playing');
  }

  /* ------------------------------------------------------------- turn */

  async function submit() {
    const c = campaignRef.current;
    const action = input.trim();
    if (!c || !action || busy) return;
    setInput('');
    setBusy(true);
    try {
      const { adjudication } = await playBeat(c, action, {
        onBeat: pushBeat, onNarrationChunk: patchNarration, onStatus: setStatus,
      });
      setCampaign((p) => (p ? { ...p, rollCount: p.rollCount + 1 } : p));
      const after = campaignRef.current;

      if (adjudication.startsCombat && after) {
        // The DM decides a fight has begun; the engine picks real stat blocks
        // inside the 2024 XP budget and rolls initiative.
        const encounter = encounterFor(after, adjudication.threat);
        setFoes(encounter);
        pushBeat(openingBeat(encounter, adjudication.threat));
        // Anyone who beat the player on initiative acts before their turn.
        const opened = await runUpToPlayer(after, startCombat(after, encounter), encounter, {
          onBeat: pushBeat, onNarrationChunk: patchNarration, onStatus: setStatus,
        });
        setCombat(opened);
        const pcNow = opened.order.find((o) => o.id === 'pc');
        if (pcNow) setCampaign((p) => (p ? { ...p, pc: { ...p.pc, state: { ...p.pc.state, currentHp: pcNow.hp } } } : p));
      } else if (after) {
        const handlers = { onBeat: pushBeat, onNarrationChunk: patchNarration, onStatus: setStatus };
        const said = await maybeCompanionSpeaks(after, action, handlers);
        if (said) {
          // Disagreement has to cost something or it is decoration.
          const { companions, left } = applyStance(campaignRef.current ?? after, said.id, said.stance);
          setCampaign((p) => (p ? { ...p, companions } : p));
          if (left) {
            pushBeat({
              id: ulid(), kind: 'system', at: Date.now(),
              text: `${left} has had enough and walks away.`,
            });
          }
        }
        const latest = campaignRef.current;
        if (latest) await maybeBanter(latest, handlers);
      }

      // Fold the beat into memory. Deliberately not awaited inside the busy
      // state: the player already has their narration, so this costs them
      // nothing, and if it fails the campaign just remembers a little less.
      const consequence = adjudication.successMeans || adjudication.failureMeans;
      void rememberBeat(campaignRef.current ?? c, action, consequence).then((mem) => {
        if (mem) setCampaign((p) => (p ? { ...p, ...mem } : p));
      });
    } finally {
      setBusy(false);
      setStatus(null);
    }
  }

  async function attack(targetId: string, spellId?: string) {
    const c = campaignRef.current;
    if (!c || !combat || busy) return;
    setBusy(true);
    try {
      const next = await runCombatRound(c, combat, foes, targetId, {
        onBeat: pushBeat, onNarrationChunk: patchNarration, onStatus: setStatus,
      }, spellId);
      setCombat(next);
      // Keep the sheet honest: the player's hit points carry out of the fight.
      const pc = next.order.find((o) => o.id === 'pc');
      if (pc) setCampaign((p) => (p ? { ...p, pc: { ...p.pc, state: { ...p.pc.state, currentHp: pc.hp } } } : p));

      if (next.over) {
        if (next.outcome === 'victory' && next.xpAwarded > 0) {
          const { build, levelUp } = awardXp(c.pc.build, next.xpAwarded);
          setCampaign((p) => (p ? { ...p, pc: { ...p.pc, build } } : p));
          pushBeat({
            id: ulid(), kind: 'combat', at: Date.now(),
            text: `The fight is over. ${next.xpAwarded} XP.`,
          });
          if (levelUp) {
            pushBeat({
              id: ulid(), kind: 'system', at: Date.now(),
              text: `Level ${levelUp.to}. Maximum hit points up by ${levelUp.hpGain}.`,
            });
          }
        } else {
          pushBeat({
            id: ulid(), kind: 'combat', at: Date.now(),
            text: 'You are down. Someone drags you out of it.',
          });
        }
        setCombat(null);
        setFoes([]);
      }
    } finally {
      setBusy(false);
      setStatus(null);
    }
  }

  function rest(kind: 'short' | 'long') {
    const c = campaignRef.current;
    if (!c || busy || c.combat) return;
    const r = kind === 'short'
      ? shortRest(c.pc.build, c.pc.state, `${c.seed}:${c.beats.length}`, c.pc.state.hitDiceRemaining)
      : longRest(c.pc.build, c.pc.state);

    setCampaign((p) => (p ? { ...p, pc: { ...p.pc, state: r.state } } : p));
    pushBeat({
      id: ulid(), kind: 'combat', at: Date.now(),
      text: `${r.note}${r.healed > 0 ? ` You recover ${r.healed} hit points.` : ''}`,
    });
    for (const dice of r.rolls) {
      pushBeat({ id: ulid(), kind: 'roll', text: 'Hit Die', dice, at: Date.now() });
    }
  }

  /* ------------------------------------------------------------- views */

  if (phase === 'meeting' && pending) {
    return (
      <main className="min-h-dvh gutter" style={{ padding: '2rem 0 3rem' }}>
        <div style={{ maxWidth: '46rem', margin: '0 auto' }}>
          <p className="label">{pending.world.realmName}</p>
          <h1 style={{ fontSize: 'clamp(1.8rem, 5vw, 2.5rem)', marginTop: '0.3rem' }}>
            {pending.world.openingLocation}
          </h1>
          <p className="prose-ink dropcap" style={{ marginTop: '1rem' }}>
            {pending.world.openingScene}
          </p>

          <hr className="rule" style={{ margin: '1.75rem 0' }} />

          <p className="label" style={{ marginBottom: '0.9rem' }}>You are not alone</p>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {pending.companions.map(({ card }) => {
              const line = intros.find((i) => i.id === card.id)?.line;
              return (
                <div key={card.id} className="meet-card panel">
                  <Art className="meet-card__art" src={`/assets/classart/${card.portraitId}`}
                       alt="" width={384} height={384} sizes="76px" />
                  <div style={{ minWidth: 0 }}>
                    <p className="card-title">{card.name}</p>
                    <p className="meta-quiet">{card.species} {card.klass} · {card.pronouns}</p>
                    <p className="prose-ink meet-card__line">
                      {line ? `"${line}"` : <span className="meta-quiet">thinking of what to say</span>}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            className="btn btn-primary"
            style={{ marginTop: '1.75rem', width: '100%' }}
            onClick={enterWorld}
            disabled={intros.length < pending.companions.length}
          >
            {intros.length < pending.companions.length ? 'Waiting on introductions' : 'Begin'}
          </button>
        </div>
      </main>
    );
  }

  if (phase !== 'playing' || !campaign) {
    return (
      <main className="min-h-dvh gutter" style={{ display: 'grid', placeItems: 'center', padding: '2rem 1rem' }}>
        <div style={{ maxWidth: '34rem', width: '100%' }}>
          <h1 style={{ fontSize: 'clamp(1.9rem, 5vw, 2.6rem)' }}>Begin a campaign</h1>
          <p className="prose-ink" style={{ color: 'var(--content-2)', marginTop: '0.6rem' }}>
            The Dungeon Master will invent a corner of the world and drop you into it with
            something already going wrong. Everything is generated on your machine.
          </p>

          <label className="field-label" style={{ marginTop: '1.5rem' }}>What kind of story?</label>
          <textarea rows={3} value={tone} onChange={(e) => setTone(e.target.value)} />

          <label className="field-label" style={{ marginTop: '1.25rem' }}>
            Anything you would rather not see?
          </label>
          <textarea
            rows={2}
            value={safetyLines}
            placeholder="Left blank, nothing is excluded. For example: harm to animals, body horror."
            onChange={(e) => setSafetyLines(e.target.value)}
          />
          <p className="meta-quiet" style={{ marginTop: '0.4rem' }}>
            Whatever you put here is given to the Dungeon Master as a rule before it
            writes, not filtered out afterwards.
          </p>

          <button
            className="btn btn-primary"
            style={{ marginTop: '1rem', width: '100%' }}
            onClick={begin}
            disabled={phase === 'summoning'}
          >
            {phase === 'summoning' ? (status ?? 'Summoning') : 'Begin'}
          </button>

          {!modelAvailable() && (
            <p className="issue issue-warn" style={{ marginTop: '0.9rem' }}>
              No on-device model here, so the Dungeon Master will fall back to a written
              opening and simple rulings. The dice and the rules are unaffected.
            </p>
          )}
          <p className="meta-quiet" style={{ marginTop: '1rem' }}>
            {hasCharacter
              ? <>Playing as your most recently saved character. <Link href="/create">Make another</Link>.</>
              : <>No character saved yet, so a ready-made one is used. <Link href="/create">Make your own</Link>.</>}
          </p>
        </div>
      </main>
    );
  }

  const d = derive(campaign.pc.build);
  const art = classArtSrc(campaign.pc.build.classId);
  const biome = matchBiome(`${campaign.world.locationKind} ${campaign.world.openingLocation}`);

  return (
    <main className="play">
      <div aria-hidden className="play__backdrop">
        <Art src={biome.src.replace('.webp', '')} alt="" width={1280} height={720} sizes="100vw" priority />
      </div>

      <header className="play__bar gutter">
        <Link href="/" className="label label-strong" style={{ textDecoration: 'none' }}>dnthey</Link>
        <span className="meta-quiet hide-compact">{campaign.world.realmName}</span>
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
          <button className="btn btn-quiet" disabled={busy || !!combat} onClick={() => rest('short')}
            data-hint="Short rest: one hour. Spend your Hit Dice to heal.">
            Short rest
          </button>
          <button className="btn btn-quiet" disabled={busy || !!combat} onClick={() => rest('long')}
            data-hint="Long rest: eight hours. All hit points back, half your Hit Dice, one level of exhaustion gone.">
            Long rest
          </button>
          <button
            className="btn btn-quiet"
            onClick={() => { if (confirm('Abandon this campaign and start over?')) { clearCampaign(); setCampaign(null); setPhase('idle'); } }}
          >
            New
          </button>
          <ThemeToggle />
        </div>
      </header>

      <div className="play__grid gutter">
        <section className="play__log panel" ref={logRef} aria-live="polite">
          {campaign.beats.map((b) => <BeatView key={b.id} beat={b} />)}
          {status && <p className="play__status">{status}<span className="play__dots" /></p>}
        </section>

        <aside className="play__rail">
          {combat && <CombatPanel combat={combat} onAttack={attack} busy={busy} />}
          <div className="panel" style={{ padding: '0.9rem' }}>
            <div style={{ display: 'flex', gap: '0.7rem', alignItems: 'center' }}>
              {art && <Art className="rail-portrait" src={art.src} alt="" width={384} height={384} sizes="56px" />}
              <div style={{ minWidth: 0 }}>
                <p className="card-title">{campaign.pc.build.name || 'Unnamed'}</p>
                <p className="meta">Level {campaign.pc.build.level} {campaign.pc.build.classId}</p>
              </div>
            </div>
            <div className="rail-stats">
              <Stat label="AC" v={d.armorClass} />
              <Stat label="HP" v={`${campaign.pc.state.currentHp}/${d.maxHp}`} />
              <Stat label="Init" v={formatMod(d.initiative)} />
            </div>
          </div>

          {campaign.companions.filter((c) => !c.gone).map(({ card, bond, stance }) => (
            <div key={card.id} className="panel companion-row">
              <Art className="rail-portrait" src={`/assets/classart/${card.portraitId}`} alt="" width={384} height={384} sizes="48px" />
              <div style={{ minWidth: 0, flex: 1 }}>
                <p className="card-title" style={{ fontSize: 'var(--text-sm)' }}>{card.name}</p>
                <p className="meta-quiet">{card.species} {card.klass}</p>
                <span
                  className="bond"
                  title={`Trust ${bond} of 5${stance ? `. Last reaction: ${stance}` : ''}`}
                  data-hint={`Trust: how much ${card.name} is willing to follow your lead. It rises when they agree with you and falls when you overrule them. At zero they leave.`}
                >
                  {[0, 1, 2, 3, 4].map((i) => (
                    <span key={i} className="bond__pip" data-on={i < bond} />
                  ))}
                  <span className="sr-only">Trust {bond} of 5</span>
                </span>
              </div>
            </div>
          ))}
        </aside>
      </div>

      <form
        className="play__action gutter"
        onSubmit={(e) => { e.preventDefault(); void submit(); }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            combat ? 'In combat: choose a target, or describe something else'
              : busy ? 'The table is waiting' : 'What do you do?'
          }
          disabled={busy}
          aria-label="What do you do"
        />
        <button className="btn btn-primary" type="submit" disabled={busy || !input.trim()}>
          {busy ? 'Resolving' : 'Do it'}
        </button>
      </form>
      <DevHud />
    </main>
  );
}

function Stat({ label, v }: { label: string; v: string | number }) {
  return (
    <div className="rail-stat">
      <div className="label" style={{ fontSize: 'var(--text-xs)' }}>{label}</div>
      <div className="stat-num" style={{ fontSize: '1.2rem', color: 'var(--content-1)' }}>{v}</div>
    </div>
  );
}

function BeatView({ beat }: { beat: Beat }) {
  if (beat.kind === 'roll' && beat.roll) return <DiceRoll roll={beat.roll} />;
  if (beat.kind === 'roll' && beat.dice) {
    const faces = beat.dice.dice.map((d) => d.value).join(' + ');
    const mods = beat.dice.modifiers.map((m) => `${m.value >= 0 ? '+' : ''}${m.value} ${m.label}`).join(' ');
    return <p className="beat-combat">{beat.text}: {faces} {mods} = {beat.dice.total} healed.</p>;
  }
  if (beat.kind === 'action') return <p className="beat-action">{beat.text}</p>;
  if (beat.kind === 'system') return <p className="beat-system label">{beat.text}</p>;
  // Combat lines are sentences carrying real numbers, so they are set as text
  // rather than as an uppercase eyebrow.
  if (beat.kind === 'combat') return <p className="beat-combat">{beat.text}</p>;
  if (beat.kind === 'speech') {
    return (
      <div className="beat-speech">
        <Art className="beat-speech__art" src={`/assets/classart/${beat.portraitId}`} alt="" width={384} height={384} sizes="36px" />
        <p><span className="beat-speech__who">{beat.speaker}</span>{beat.text}</p>
      </div>
    );
  }
  // The drop cap only works on a real opening letter; a stray symbol would be
  // rendered three times the size of the paragraph.
  const canDropCap = beat.kind === 'scene' && /^[A-Za-z]/.test(beat.text);
  return <p className={`prose-ink beat-prose${canDropCap ? ' dropcap' : ''}`}>{beat.text}</p>;
}
