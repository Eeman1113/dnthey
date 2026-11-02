'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ulid } from 'ulid';
import { derive } from '@/character/derive';
import { exampleBuild, initialState, isPlayable } from '@/character/builder';
import { formatMod } from '@/engine/types';
import { Art } from '@/ui/components/Art';
import { DiceRoll } from '@/ui/components/DiceRoll';
import { ThemeToggle } from '@/ui/components/ThemeToggle';
import { classArtSrc } from '@/ui/classArt';
import { matchBiome } from '@/ui/scenery';
import { buildWorld, cleanProse } from '@/agents/dm';
import { modelAvailable, prewarm, destroyAll } from '@/agents/session';
import { NARRATOR, ADJUDICATOR } from '@/agents/prompts';
import {
  playBeat, maybeCompanionSpeaks, encounterFor, openingBeat, runCombatRound,
} from '@/campaign/beat';
import { startCombat, type CombatState } from '@/campaign/combat';
import { CombatPanel } from '@/ui/components/CombatPanel';
import type { Monster } from '@/data/srd/encounters';
import { pickCompanions } from '@/campaign/companions';
import { loadCampaign, saveCampaign, clearCampaign, loadCharacters } from '@/campaign/persist';
import type { Campaign, Beat } from '@/campaign/types';

type Phase = 'idle' | 'summoning' | 'playing';

export function PlayClient() {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [status, setStatus] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [combat, setCombat] = useState<CombatState | null>(null);
  const [foes, setFoes] = useState<Monster[]>([]);
  const [tone, setTone] = useState('grim, rain-soaked, low magic, a small personal stake');
  const logRef = useRef<HTMLDivElement>(null);
  const campaignRef = useRef<Campaign | null>(null);
  campaignRef.current = campaign;

  useEffect(() => {
    const saved = loadCampaign();
    if (saved) { setCampaign(saved); setPhase('playing'); }
    // The slow part is session creation, about 9.5s cold. Start it while the
    // player is still reading the setup screen.
    if (modelAvailable()) { prewarm('narrator', NARRATOR); prewarm('adjudicator', ADJUDICATOR); }
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
    const { world, generated } = await buildWorld(tone);
    const seed = ulid();

    const fresh: Campaign = {
      id: seed, createdAt: Date.now(), tone, world, worldGenerated: generated,
      pc: { build, state: initialState(build) },
      companions: pickCompanions(seed, 2).map((card) => ({ card })),
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
    };
    setCampaign(fresh);
    setStatus(null);
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
        setCombat(startCombat(after, encounter));
      } else if (after) {
        await maybeCompanionSpeaks(after, action, {
          onBeat: pushBeat, onNarrationChunk: patchNarration, onStatus: setStatus,
        });
      }
    } finally {
      setBusy(false);
      setStatus(null);
    }
  }

  async function attack(targetId: string) {
    const c = campaignRef.current;
    if (!c || !combat || busy) return;
    setBusy(true);
    try {
      const next = await runCombatRound(c, combat, foes, targetId, {
        onBeat: pushBeat, onNarrationChunk: patchNarration, onStatus: setStatus,
      });
      setCombat(next);
      // Keep the sheet honest: the player's hit points carry out of the fight.
      const pc = next.order.find((o) => o.id === 'pc');
      if (pc) setCampaign((p) => (p ? { ...p, pc: { ...p.pc, state: { ...p.pc.state, currentHp: pc.hp } } } : p));

      if (next.over) {
        pushBeat({
          id: ulid(), kind: 'combat', at: Date.now(),
          text: next.outcome === 'victory'
            ? `The fight is over. ${next.xpAwarded} XP.`
            : 'You are down. Someone drags you out of it.',
        });
        setCombat(null);
        setFoes([]);
      }
    } finally {
      setBusy(false);
      setStatus(null);
    }
  }

  /* ------------------------------------------------------------- views */

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
            <Link href="/create">Build a character first</Link> if you have not already.
            Otherwise the most recently saved one is used.
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

          {campaign.companions.map(({ card }) => (
            <div key={card.id} className="panel" style={{ padding: '0.8rem', display: 'flex', gap: '0.65rem', alignItems: 'center' }}>
              <Art className="rail-portrait" src={`/assets/classart/${card.portraitId}`} alt="" width={384} height={384} sizes="48px" />
              <div style={{ minWidth: 0 }}>
                <p className="card-title" style={{ fontSize: 'var(--text-sm)' }}>{card.name}</p>
                <p className="meta-quiet">{card.species} {card.klass}</p>
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
