# BUILD PROMPT — "dnthey": A fully-dynamic, LLM-run D&D platform powered by Chrome's built-in on-device model

> This document is the master prompt/spec. Hand it to a coding agent (or follow it yourself).
> Everything in the game — world, NPCs, plot, encounters, when dice are rolled, what the other
> party members decide — is generated at runtime by language models. Nothing is a hardcoded
> storyline. The *rules* are hardcoded; the *fiction* never is.

---

## 0. One-paragraph brief

Build a browser-based Dungeons & Dragons platform where a single human player runs a full
campaign with an **AI Dungeon Master** and a party of **AI player-characters**. The AI DM
invents the setting, narrates, voices NPCs, decides when a check or save is needed and at what
DC, builds and runs combat encounters, and awards rewards. The AI party members each have their
own persona, voice, goals, and flaws, and make their own decisions in and out of combat — they
are *players*, not sidekicks, and they can disagree with the human. All inference runs
**on-device via Chrome's built-in Prompt API (`LanguageModel`, Gemini Nano)** — no API keys, no
server, no per-token cost, works offline after the model downloads. All *mechanics* (dice,
initiative, HP, slots, conditions, death saves, XP) run in a deterministic TypeScript rules
engine that the model may *request* changes to but never directly mutate.

---

## 1. Non-negotiable architectural law: Engine owns truth, LLM owns fiction

This is the single most important constraint. Every known failure mode of AI-GM projects traces
back to letting the model hold game state.

```
┌──────────────────────────────────────────────────────────────────────┐
│  RULES ENGINE (TypeScript, pure, deterministic, unit-tested)        │
│  - dice (seeded PRNG + audit log)   - HP / temp HP / death saves    │
│  - initiative & turn order          - conditions & durations        │
│  - attack/damage/AC resolution      - spell slots & concentration   │
│  - advantage/disadvantage stacking  - rests, hit dice, exhaustion   │
│  - XP, leveling, encumbrance        - legal-action enumeration      │
└──────────────────────────────────────────────────────────────────────┘
          ▲                                          │
          │ validated Intents                        │ Context Packets
          │ (engine validates, applies, logs)        │ (facts only, token-budgeted)
          │                                          ▼
┌──────────────────────────────────────────────────────────────────────┐
│  NARRATIVE LAYER (many small, single-purpose LanguageModel sessions) │
│  DM roles: Worldsmith, Narrator, Adjudicator, Resolver, Encounter    │
│            Director, Monster Tactician, Loremaster, Quartermaster     │
│  Player roles: one persistent session per AI character               │
└──────────────────────────────────────────────────────────────────────┘
```

Rules of engagement:

1. **The model never produces a number that matters.** It never rolls, never computes damage,
   never decides HP. It may *ask* for a roll (`request_check`) and *interpret* a result.
2. **The model never names an entity that doesn't exist.** Every prompt ships an *entity
   manifest* of valid IDs; the schema forces the model to reference `entity_id` from that list.
   Any unknown ID → validation failure → repair retry.
3. **The model emits Intents, not state.** Intents are schema-constrained JSON. The engine
   validates each against the current state (is that creature in range? does the caster have
   that slot? is it their turn?) and either applies it or rejects it with a machine-readable
   reason that is fed back for one repair attempt.
4. **Every state change is an event in an append-only log.** The log is the save file.
   State is a fold over the log. This gives free undo, replay, debugging, and session recaps.
5. **Determinism is auditable.** Every die roll records `{formula, seed, rolls[], modifiers[],
   total, reason, requestedBy}` and is shown in the UI dice tray. A player must always be able
   to see *why* a number happened.

---

## 2. Platform target: Chrome built-in AI (verified API surface)

Use the **Prompt API**, stable on the web since **Chrome 148** (and in extensions since 138).
Build for the web API; feature-detect everything.

### 2.1 Availability and warm-up

```ts
if (!('LanguageModel' in self)) → show UnsupportedScreen (with requirements + fallback offer)

const status = await LanguageModel.availability({
  expectedInputs:  [{ type: 'text', languages: ['en'] }],
  expectedOutputs: [{ type: 'text', languages: ['en'] }],
});
// 'unavailable' | 'downloadable' | 'downloading' | 'available'
```

- `downloadable`/`downloading` → show a first-run screen with a real progress bar driven by the
  `monitor` option's `downloadprogress` event. Frame it as "Summoning the Dungeon Master"
  (~ multi-GB one-time download). Do not block the character-creation UI behind it — let the
  player build their character while the model downloads.
- Hardware floor to surface honestly on the unsupported screen: Windows 10/11, macOS 13+,
  Linux, or ChromeOS (Chromebook Plus); **22 GB free storage**, **>4 GB VRAM**, 16 GB RAM,
  4+ CPU cores, unmetered connection for the initial download.
- Older Chrome: `chrome://flags/#prompt-api-for-gemini-nano` (on by default from Chrome 154 as
  `chrome://flags/#prompt-api`). Show a copy-able flag link, don't just fail.

### 2.2 Session creation

```ts
const base = await LanguageModel.create({
  initialPrompts: [{ role: 'system', content: SYSTEM_PROMPT_FOR_ROLE }],
  samplingMode: 'balanced',        // 'most-predictable' … 'most-creative' (web)
  monitor(m) { m.addEventListener('downloadprogress', e => …); },
  signal: abortController.signal,
  expectedInputs:  [{ type: 'text', languages: ['en'] }],
  expectedOutputs: [{ type: 'text', languages: ['en'] }],
});
```

- **System prompt at create time, never in the first `prompt()` call.** Faster first token.
- **Clone, don't re-create.** `base.clone()` preserves the system prompt and forks context —
  the canonical pattern for spawning a per-scene Adjudicator or a one-shot classifier.
- `session.append(messages)` to push context without generating.
- `session.destroy()` the moment a role goes idle. Long-lived sessions: the DM Narrator and one
  per AI player. Everything else is clone → prompt → destroy.
- Pre-warm the base session the instant the player clicks "New Campaign". Never on submit.
- `samplingMode` per role: Worldsmith/Narrator → `most-creative`; Adjudicator/Resolver/
  Tactician/validators → `most-predictable`. Creativity in prose, determinism in rulings.

### 2.3 Structured output — mandatory for every mechanical call

Pass a JSON Schema as `responseConstraint`. Supported keywords in practice: `type`,
`properties`, `items`, `required`, `enum`, `maxItems`, `pattern`, `additionalProperties`.

```ts
const raw = await session.prompt(userPacket, {
  responseConstraint: ADJUDICATION_SCHEMA,
  omitResponseConstraintInput: true,   // don't spend context echoing the schema when the
  signal,                              // system prompt already describes the shape
});
const parsed = AdjudicationZ.parse(JSON.parse(raw));   // Zod re-validates semantics
```

- Author schemas **once** in Zod, derive JSON Schema (`zod-to-json-schema`). Single source of
  truth for both the constraint and the runtime parse.
- Do **not** put strict `maxLength` on prose fields — truncate client-side instead.
- Never rely on "respond only in JSON" in natural language. Always the constraint.
- Use `session.measureContextUsage(input, { responseConstraint })` to price a call before
  sending it; schemas cost context.

### 2.4 Context window: 9,216 tokens, shared input+output

This is the hard design constraint of the whole project. A campaign cannot live in the window.
Budget every call explicitly and assert before sending.

| Slice | Budget | Content |
|---|---|---|
| System prompt (role card) | ≤ 700 | Role, voice, hard rules, output contract |
| Campaign Codex excerpt | ≤ 1,200 | Retrieved entity cards only (not the whole codex) |
| Rolling Chronicle | ≤ 900 | Compacted summaries of prior scenes |
| Scene state | ≤ 1,400 | Current location, present NPCs, party status line |
| Live transcript | ≤ 2,000 | Last N beats verbatim |
| Mechanical packet | ≤ 1,200 | Legal actions, roll results, entity manifest |
| Response headroom | ≥ 1,800 | Reserved for output |

- Track `session.contextUsage` / `session.contextWindow` after every call; surface a context
  gauge in a dev HUD.
- Handle `QuotaExceededError` (`err.requested`, `err.contextWindow`) by compacting the
  Chronicle and retrying once, then by dropping the oldest live beats.
- Listen for `contextoverflow` on long-lived sessions; when it fires, force a Loremaster
  compaction pass and `clone()` a fresh session seeded with the new summary. Treat an
  overflowing session as disposable; the *log* is the real memory.

### 2.5 Working with a small model — this changes the design, not just the prompts

Gemini Nano is a few-billion-parameter on-device model. It will not reliably run a 300-page
rulebook in its head. Therefore:

- **One job per call.** Never "narrate AND decide the DC AND pick the monster's target."
  Decompose into chained single-purpose calls, each schema-constrained.
- **Closed-set choices beat open generation.** Wherever possible the engine supplies an `enum`
  and the model picks. `"which skill?" → enum of 18 skills`. `"which action?" → enum of the
  legal actions the engine computed`. This is what makes a small model feel competent.
- **Rules are data, not model knowledge.** Ship the SRD as structured JSON; retrieve the 1–3
  relevant rule snippets and paste them into the packet. Never ask the model to recall a rule.
- **Pre-generate at idle.** While the player reads narration, speculatively generate the likely
  next beats, NPC lines, and encounter seeds. Cache keyed on normalized state hash.
- **Validate, repair once, then fall back.** Every call has a deterministic fallback: a generic
  but correct narration, a table-driven DC, a "nearest enemy" monster target. The game never
  stalls on a bad generation.
- **Pluggable provider.** Define `interface ModelProvider { createSession(role, opts), prompt(...) }`
  with `ChromeNanoProvider` as the default and shipped implementation. Keep a
  `RemoteProvider` seam (user-supplied endpoint + key, stored locally, off by default) so a
  player with weak hardware or a taste for richer prose can swap the brain without touching
  game code. Nano is the product; the seam is insurance.

---

## 3. Rules foundation: D&D 5e 2024 via SRD 5.2.1 (CC BY 4.0)

Implement against the **System Reference Document 5.2.1**, released by Wizards of the Coast
under **Creative Commons Attribution 4.0**. This is the legally safe, legitimately free
foundation. It contains: the full rules glossary, conditions, combat, magic and equipment
rules; **12 classes with one subclass each**; **9 species** (Dragonborn, Dwarf, Elf, Gnome,
Goliath, Halfling, Human, Orc, Tiefling); **4 backgrounds**; **17 feats** (incl. 4 fighting
styles); **339 spells**; **330 creatures**; **258 magic items**. Excluded: Artificer, Aasimar,
Beholder, and other product-identity content — do not reference them anywhere.

**Required**: a visible attribution notice in-app (About screen + footer) crediting
"System Reference Document 5.2.1, © Wizards of the Coast LLC, CC BY 4.0", and a clear
"not affiliated with or endorsed by Wizards of the Coast" line. Never use the D&D logo,
the ampersand logo, or Forgotten Realms/product-identity names.

### 3.1 Data to ship as JSON (`/src/data/srd/`)

`species.json`, `classes.json` (with level tables, features, subclass), `backgrounds.json`,
`feats.json`, `skills.json`, `equipment.json`, `weapons.json` (incl. mastery property),
`armor.json`, `spells.json`, `monsters.json` (full stat blocks + CR + XP), `magic-items.json`,
`conditions.json`, `rules-glossary.json` (chunked for retrieval).

Each monster entry needs machine-usable actions: `{name, type: 'melee'|'ranged'|'save'|'aoe',
toHit, reach/range, damage: '2d6+3', damageType, saveDC, saveAbility, effectOnSave, recharge,
usesPerDay, multiattack}` so the engine can resolve monster turns without the model.

### 3.2 Mechanics the engine must implement correctly (2024 rules)

**d20 Tests** — one unified concept: ability checks, attack rolls, saving throws.
- Advantage/disadvantage: roll 2d20 take higher/lower; **never stacks** — any number of
  sources of each cancel to a flat roll.
- **Heroic Inspiration**: reroll a d20 and must use the new roll. Party holds it as a token;
  the DM agent may grant it for good play (an Intent the engine applies).
- Proficiency bonus by level: +2 (1–4), +3 (5–8), +4 (9–12), +5 (13–16), +6 (17–20).
- DC ladder for the Adjudicator to choose from (enum, not free-form):
  Very Easy 5, Easy 10, Medium 15, Hard 20, Very Hard 25, Nearly Impossible 30.
- Passive score = 10 + modifiers (used for Perception/Insight so the DM can gate secrets
  without tipping the player off with a roll).

**Character build (2024 order)**: Class → Origin (Background + Species) → Ability Scores →
Alignment → Details.
- Ability scores from **Background**, not species: +2/+1 to two of the background's three
  abilities, or +1/+1/+1 to all three.
- Every character gets an **Origin Feat** from their background at level 1.
- Species grant traits only — no ability bonuses, no languages. Languages: Common + 2 chosen.
- Score generation: Standard Array `15,14,13,12,10,8`, Point Buy (27 points, 8–15 range), or
  roll `4d6` drop lowest ×6 (engine-rolled, logged).
- Derived: AC, initiative mod, HP (max hit die + CON at L1), spell save DC = `8 + prof +
  ability mod`, spell attack = `prof + ability mod`, carrying capacity = `STR × 15`.

**Combat**
- Initiative = DEX check (ties: higher DEX, then coin-flip logged).
- **No surprise round.** A surprised creature has **disadvantage on its initiative roll**.
- Turn economy: Move (speed, split freely) + one **Action** + optional **Bonus Action** +
  one free object interaction; **Reaction** once per round.
- Action enum the engine exposes: `Attack, Dash, Disengage, Dodge, Help, Hide, Influence,
  Magic, Ready, Search, Study, Utilize` (+ class/feature-granted actions).
- Attack: `d20 + ability mod + prof (+ magic) vs AC`. Nat 20 = **critical hit** → double the
  *damage dice* only (weapon/unarmed dice, not modifiers). Nat 1 = miss.
- **Weapon Mastery** properties for the martial classes and the Weapon Master feat:
  `Cleave, Graze, Nick, Push, Sap, Slow, Topple, Vex`. Implement each as an engine effect; the
  AI players must be told which masteries they have so they can use them tactically.
- Cover: half = +2 AC/+2 Dex saves, three-quarters = +5, total = cannot be targeted directly.
- Opportunity attacks, grapple/shove as unarmed-strike options (escape DC `8 + STR + prof`),
  two-weapon fighting, unarmed strike.
- Concentration: a save of DC `max(10, floor(damage/2))` on damage; one concentration effect.

**Dying**
- 0 HP → Unconscious. At start of turn at 0 HP: **Death Saving Throw**, DC 10. Three successes
  → Stable. Three failures → dead. Nat 1 = two failures, nat 20 = regain 1 HP and wake.
  Damage at 0 HP = one failure (crit = two). Damage ≥ max HP in one hit = instant death.
- Death saves are *not* ability checks and take no modifiers.

**Conditions (15)**: Blinded, Charmed, Deafened, Exhaustion, Frightened, Grappled,
Incapacitated, Invisible, Paralyzed, Petrified, Poisoned, Prone, Restrained, Stunned,
Unconscious. Implement as typed effects with sources, durations, save-ends, and
`endsOn: 'startOfTurn'|'endOfTurn'|'rest'|'duration'`.
- **Exhaustion (2024)**: cumulative levels; each level = **−2 to every d20 Test** and
  **−5 ft Speed**; **level 6 = death**; a Long Rest removes 1 level.

**Rests**: Short Rest = 1 hour, spend Hit Dice to heal. Long Rest = 8 hours, restore all HP,
regain half total Hit Dice (round down, min 1), reset slots and most features, −1 Exhaustion.

**Progression**: support both **XP** (standard thresholds) and **Milestone** leveling, chosen
at campaign creation. The DM agent proposes milestones; the engine awards.

**Encounter building (2024 DMG math)** — the Encounter Director must obey this, it is not
allowed to freehand difficulty:
- **XP Budget per Character** table, cross-referenced by party level and chosen difficulty
  (Low / Moderate / High), then **multiplied by party size**.
  Anchors: L1 = 50/75/100 · L3 = 150/225/400 · L5 = 500/750/1100 · L10 = 1600/2300/3100
  (ship the complete 1–20 table from SRD 5.2.1).
- **No 2014-style multiplier.** Sum the raw XP of chosen creatures and compare directly
  against the budget. The budget is a **ceiling**, not a target floor.
- The 2024 rules deliberately drop a fixed "encounters per day" quota. Instead, feed the
  Director the party's **resource state** (HP %, slots remaining, hit dice, exhaustion) and
  let it pace on attrition.
- The Director picks creatures **from the SRD bestiary by ID**, filtered by the engine to
  thematically-tagged, CR-appropriate, budget-fitting candidates. It may not invent stat
  blocks; it *may* reskin (new name + description, same block) via a `reskin` field.

---

## 4. The AI Dungeon Master: a committee of narrow roles

Do not build "one DM prompt." Build nine narrow agents the orchestrator calls in sequence.
Each has a ≤700-token system prompt, a strict output schema, and a deterministic fallback.

| Role | Sampling | Called when | Outputs |
|---|---|---|---|
| **Worldsmith** | creative | Campaign creation only | Setting, tone, map regions, factions, pantheon, 3 quest seeds, central mystery, opening hook |
| **Narrator** | creative | Every beat | Prose (2nd person, 80–180 words), sensory detail, NPC dialogue, 0 mechanical claims |
| **Adjudicator** | predictable | Player/AI declares a non-combat action | `{needsRoll, checkType, ability, skill, dc, advantage, consequenceOfFailure, autoSucceed, autoFail}` |
| **Resolver** | predictable | After a roll lands | `{outcomeTier, narration, stateIntents[]}` |
| **Encounter Director** | balanced | Tension/pacing threshold or narrative trigger | `{shouldStartCombat, creatures[{id,count,reskin}], terrain, objective, enemyMotivation, retreatCondition, surprisedSide}` |
| **Monster Tactician** | predictable | Each monster turn | `{actionId, targetEntityId, movement, reasoning, tauntLine}` chosen from engine-supplied legal actions |
| **Loremaster** | predictable | Scene end / context overflow | Compacted chronicle entry + new/updated Codex entities |
| **Quartermaster** | balanced | After victory/discovery | Loot from SRD item IDs, gold, XP proposal, with rarity sanity-checks |
| **Chronicler** | creative | Session end / on demand | "Previously on…" recap, in-world journal entry |

### 4.1 Narrator system prompt (write it roughly like this)

```
You are the Dungeon Master of a Dungeons & Dragons campaign. You narrate the world to one
human player and their companions.

VOICE: Second person for the human ("you"). Present tense. Concrete, sensory, specific.
80-180 words. One vivid image beats three adjectives. Let NPCs speak in their own idiom.

ABSOLUTE RULES — violating any of these breaks the game:
- You NEVER state a die result, a number of hit points, a DC, or whether an attack hit. The
  engine has already told you the outcome; narrate ONLY what you were given.
- You NEVER decide what the human player does, says, thinks, or feels. You narrate the world
  and stop. End on a moment that invites a choice. Never ask "what do you do?" outright more
  than occasionally.
- You NEVER mention any creature, person, place, or item that is not in the ENTITIES list.
- You NEVER break character, mention AI, models, prompts, or rules text.
- If the outcome given to you is a failure, make the failure INTERESTING, not a dead end.
  Fail forward: the lock holds but the guard's footsteps approach.

You will receive: SCENE, ENTITIES, CHRONICLE, RECENT, and OUTCOME. Narrate the next beat.
```

### 4.2 Adjudicator schema (the heart of "the AI decides when rolls happen")

```ts
const AdjudicationZ = z.object({
  interpretation: z.string(),                       // what the engine thinks the player meant
  resolution: z.enum(['auto_success','auto_failure','roll','needs_clarification','refuse_impossible']),
  rationale: z.string(),
  roll: z.object({
    kind:  z.enum(['ability_check','saving_throw','attack_roll','contested_check','group_check']),
    ability: z.enum(['str','dex','con','int','wis','cha']),
    skill:   z.enum([...18 SRD skills, 'none']),
    dc:      z.enum(['5','10','15','20','25','30']),   // locked to the ladder
    advantage: z.enum(['advantage','none','disadvantage']),
    advantageReason: z.string(),
    opposedBy: z.string().optional(),                  // entity_id for contested
  }).optional(),
  successMeans: z.string(),
  failureMeans: z.string(),                            // must be a complication, not a stop
  costOnAttempt: z.enum(['none','time','resource','risk']),
  secretRoll: z.boolean(),                             // DM rolls behind the screen
}).strict();
```

Engine post-checks before accepting: skill must be legal for the ability (or `none`); DC must
be on the ladder; `advantage` must be justified by an engine-visible fact or it's downgraded to
`none`; `auto_success` is rejected if the action is flatly impossible given state.

Fallback if the call fails twice: a deterministic heuristic table mapping action verbs to
(ability, skill, DC 15).

### 4.3 Monster Tactician — closed-set decision making

The engine computes, for the acting monster: every legal action, every valid target with
distance/cover/condition/HP-percentage, available movement destinations, and recharge state.
The model picks an index. It cannot hallucinate an attack the monster doesn't have.

Give each monster an **enemy doctrine** string from the Encounter Director (`"cowardly, targets
the weakest, flees below half"`, `"fanatical, ignores pain, protects the altar"`) so tactics
have personality without being unfair. The Director also sets a `retreatCondition` — the engine
evaluates it and monsters *actually* surrender or flee. Enemies that never run make every fight
feel like a video game.

---

## 5. The AI players: a party of characters, not a party of tools

Each AI companion is a **persistent `LanguageModel` session** with a persona card in its system
prompt. They are generated at campaign start by a **Companion Forge** pass (or hand-authored by
the player, or rolled randomly) and they are mechanically *real* characters built by the same
character-creation engine the human uses — same classes, same levels, same sheets, same death
saves.

### 5.1 Persona card (lives in the system prompt, ≤ 600 tokens)

```
NAME, pronouns, species, class/subclass, level
APPEARANCE: one line
VOICE: how they talk — vocabulary, rhythm, verbal tic, what they never say
WANT: the thing they are chasing (drives them to act)
FEAR: the thing they avoid (drives them to refuse)
FLAW: the way they reliably make things worse
BOND: a tie to the human PC or the world
SECRET: something they are hiding from the party (the DM knows; the player doesn't)
BOND LEVEL: 0-5, how much they trust the human PC (engine-tracked, grows with shared risk)
MORAL LINE: the thing they will argue against or refuse outright
TACTICAL STYLE: reckless / cautious / supportive / controlling / opportunist
```

### 5.2 AI player decision schema

```ts
const CompanionTurnZ = z.object({
  interiorThought: z.string(),              // shown only in a "party insight" dev panel
  speech: z.string().optional(),            // in-character dialogue, may be empty
  intent: z.enum(['act','speak_only','defer_to_player','object','ask_question','wait']),
  chosenActionIndex: z.number().int(),      // index into engine-supplied legal actions
  targetEntityId: z.string().optional(),
  bonusActionIndex: z.number().int().optional(),
  movementTo: z.string().optional(),        // engine-supplied zone id
  stanceTowardPlayerPlan: z.enum(['enthusiastic','onboard','reluctant','opposed']),
  flavorOfExecution: z.string(),            // how they do it, for the Narrator to use
}).strict();
```

### 5.3 Behavioral requirements — this is what makes solo play not feel lonely

- **They talk to each other, unprompted.** Between beats, run a lightweight **Banter**
  pass: pick two companions with narrative friction (opposing stances, clashing wants,
  unresolved argument) and generate 2–4 lines of cross-talk. Rate-limit it; silence has value.
- **They have opinions about the plan.** When the human declares a plan, each companion returns
  a `stanceTowardPlayerPlan`. `opposed` companions argue, and if the human overrules them, the
  engine drops Bond Level. A companion at Bond 0 can walk out of the party.
- **They act on their own initiative.** Out of combat, if the human idles or the scene has an
  obvious companion hook (a cleric at a desecrated shrine, a rogue near an unattended purse),
  a companion may take the initiative and *create* a problem.
- **They are mechanically competent.** They know their spell list, slots, masteries, and HP
  because the engine hands them a legal-action list. A companion wizard will not cast a spell
  it doesn't have.
- **They remember.** Each companion session accumulates its own compacted memory of what *it*
  witnessed — not the omniscient log. Companions can be wrong about offscreen events.
- **They can die.** Permadeath or revivify-if-available, set at campaign creation. Death is
  engine-adjudicated, narrated by the Narrator, and mourned in the Banter pass for sessions
  afterward.
- **They level up** with the party and the Forge picks their choices in-character (the brawler
  barbarian takes the aggressive option).

---

## 6. Memory: three tiers + local retrieval

The 9,216-token window makes this the second-hardest problem after rules fidelity.

1. **Live Window** (verbatim) — the last ~12 beats. In the session context directly.
2. **Rolling Chronicle** (compacted) — one 40–80 word entry per closed scene, written by the
   Loremaster at scene end. Chronological. Old entries get re-compacted into era summaries
   ("Act I: the party broke the Salt Cartel's hold on Arrowmouth").
3. **Campaign Codex** (structured, persistent, IndexedDB) — typed entity records, never prose
   blobs:

```ts
type CodexEntity = {
  id: string; kind: 'npc'|'location'|'faction'|'item'|'quest'|'secret'|'creature'|'event';
  name: string; aliases: string[];
  oneLine: string;                          // ≤ 25 words — this is what gets injected
  facts: string[];                          // atomic, appendable, each with a sourceEventId
  relations: {to: string; type: string}[];
  tags: string[];                           // for retrieval + thematic encounter filtering
  status: 'active'|'resolved'|'dead'|'hidden';
  knownToPlayer: boolean;                   // CRITICAL: gate DM-only knowledge
  lastSeenEventId: string; salience: number;
};
```

**Retrieval** (no embeddings available on-device): a local BM25/TF-IDF index over
`name+aliases+oneLine+facts+tags`, scored by `bm25 × recency × salience`, plus hard includes
for every entity present in the current scene and every active quest. Return the top-K
`oneLine`s that fit the 1,200-token Codex slice, expanding to `facts` only for scene-present
entities.

**`knownToPlayer` is a hard gate.** Entities and facts flagged DM-only are *never* sent to the
Narrator session (which could leak them into prose) or to any companion session. They go only
to the Adjudicator/Director, who may use them to shape consequences. A reveal is an explicit
engine Intent that flips the flag.

**Consistency guard**: before any Loremaster write, diff proposed facts against existing facts
for that entity; on contradiction, run a one-shot Contradiction Judge (`{contradicts: bool,
which: factIndex, resolution: 'keep_old'|'keep_new'|'both_true_reconcile', reconciliation}`).
Log every reconciliation so the player can see the world's seams being stitched.

---

## 7. The orchestrator: a deterministic turn loop

Model-driven control flow is where AI GMs go off the rails. Control flow is **code**; the model
only fills in slots.

```
EXPLORATION / SOCIAL BEAT
 1. Engine renders scene state + retrieves Codex slice
 2. Human submits free-text action (or picks an engine-suggested action chip)
 3. Adjudicator(packet) → Adjudication
 4. if resolution === 'roll': engine rolls (seeded, logged, animated in dice tray)
 5. Resolver(adjudication + rollResult) → outcomeTier + stateIntents[]
 6. Engine validates + applies Intents → events appended
 7. Narrator(scene + outcome) → prose, streamed into the log
 8. Companion pass: for each companion, CompanionTurn (parallel-ish, sequential on-device)
 9. Banter pass (rate-limited)
10. Pacing check: tension score, scene beat count, resource state
      → Encounter Director if threshold crossed
11. Loremaster compaction if scene closed or context pressure high

COMBAT ROUND
 1. Engine rolls initiative for all (surprised → disadvantage), builds turn order
 2. Narrator: combat-opening prose (once)
 3. For each turn in order:
      PC turn      → human picks from legal-action UI (full sheet available)
      Companion    → CompanionTurn over engine's legal-action list
      Monster      → Monster Tactician over engine's legal-action list
    Engine resolves every attack/save/damage, applies conditions, checks 0 HP → death saves
    Narrator: 1-2 sentence flash narration per impactful action (batch minor ones)
 4. End of round: durations tick, concentration checks, retreatCondition evaluation,
    environmental/terrain effects, lair actions
 5. Combat end → Quartermaster (loot/XP) → Narrator (aftermath) → Loremaster (chronicle entry)
```

**Pacing engine** (deterministic, not model-decided): track a `tension` value that rises with
unresolved threats, failed checks, time pressure, and falls with rests and resolutions. Track
`beatsSinceCombat`, `beatsSinceRevelation`, `partyResourcePct`. These feed the Encounter
Director as *inputs*; the Director decides *what* happens, the engine decides *when it's time
for something to happen*. This is how you avoid both "combat every 3 beats" and "40 minutes of
shopping."

---

## 8. Screens and UX

1. **Title** — "New Campaign", "Continue" (campaign cards with act/level/last-played),
   "Compendium" (browse SRD), "Settings", "About/License". Model status pill in the corner
   (downloading / ready / unsupported) that pre-warms the session on hover.
2. **Campaign Genesis** — a short wizard the Worldsmith turns into a world:
   - Tone sliders: *grim ↔ heroic*, *gritty ↔ pulpy*, *low ↔ high magic*, *political ↔ dungeon*
   - Genre tags (multi-select, free-text allowed)
   - Starting level, party size (1–5 companions), leveling mode, death rules
   - **Content safety**: Lines (never appear) & Veils (fade to black) — free text, injected as
     hard constraints into *every* narrative system prompt, plus an always-available **X-Card**
     button in play that retroactively vetoes the last beat and regenerates it.
   - Free-text "one thing you want to see in this campaign" → threaded into the quest seeds
   - Output: a one-page **Campaign Bible** card the player reads and can reroll per-section.
3. **Character Creation** — two parallel paths, same output:
   - **Guided**: 2024 order (Class → Origin → Scores → Details), with live derived-stat preview,
     inline SRD rules tooltips, legality validation, and a "why this is good" hint.
   - **Describe It**: the player writes a paragraph ("a disgraced temple guard who drinks too
     much and still prays") → a Character Interpreter call returns a schema-constrained build
     proposal (class, subclass, species, background, score allocation, skills, equipment,
     feat, name, personality) → shown as a **diff-able preview** the player edits before
     accepting. Never auto-commit a generated character.
   - Portrait: deterministic generated SVG/sigil from a seed (no image model on-device).
   - Backstory: LLM-expanded from the player's keywords, written into the Codex as
     `knownToPlayer: true` facts plus one `secret` the DM may use against them.
4. **Companion Forge** — the party is generated with visible personas; the player may reroll
   any companion, lock the ones they like, edit any field, or author one from scratch.
5. **Play View** — the core screen:
   - Center: **narration log** (streamed; distinct typographic treatment for DM prose, NPC
     dialogue, companion speech, mechanical events, and dice results)
   - Bottom: free-text action input + engine-suggested action chips + "roll manually" toggle
   - Right rail: party panel (HP bars, conditions, concentration, slots, Bond level, a one-line
     "mood") — click for the full sheet
   - Left rail: scene card (location, time of day, present entities, active quest, tension meter)
   - Overlay on combat: initiative tracker, zone/battlefield diagram (abstract zones, not a
     grid — zones are what a text engine can actually adjudicate), target picker, legal-action
     palette, range/cover indicators
   - **Dice tray**: every roll animates with its full breakdown (`d20[14] + 3 DEX + 2 prof =
     19 vs DC 15 → SUCCESS`). Non-negotiable for trust.
   - **Journal** drawer: Chronicle, Codex (player-known only), quest log, session recaps
6. **Rest & Level-Up** — hit-dice spending UI, slot reset, 2024-correct level-up flow with
   companion choices shown for approval.
7. **Dev HUD** (toggle): per-call latency, token usage vs window, which role was called, raw
   JSON in/out, validation failures and repairs, seed inspector, event-log scrubber with
   time-travel. Build this on day one; you cannot debug this system without it.

**Feel**: dark parchment-and-ink, a real text face for prose (not UI sans), restrained gold
accents, tactile dice. Streaming text should read like someone is *telling* you the story —
render streamed chunks safely (never `innerHTML +=`; use a streaming-safe renderer and the
Sanitizer API). Every AI output must be re-rollable, and an undo must walk back the event log.

---

## 9. Stack: Next.js + anime.js + MongoDB Atlas

**Decided stack** (all free tier, no paid service anywhere):

| Concern | Choice | Why |
|---|---|---|
| Framework | **Next.js 15+, App Router, TypeScript strict** | Required |
| Animation | **anime.js v4.5.0** (MIT, ESM, tree-shakeable) | Required |
| Database | **MongoDB Atlas M0** (512 MB, free forever) | Required; see §9.2 for its hard limits |
| Local store | **IndexedDB via Dexie** | Offline-first; the real authority during play |
| Hosting | **Vercel Hobby** | Free, first-class Next.js |
| Identity | **Anonymous device ID first**, Auth.js v5 + Mongo adapter later | Zero signup friction to first die roll (§12) |
| State | **Zustand** (+ event-log reducer) | Game state is a fold over the log |
| Contracts | **Zod + zod-to-json-schema** | One schema → `responseConstraint` *and* runtime parse *and* Mongo validation |
| Styling | **Tailwind v4** | Fast; theme tokens in CSS vars (see §8 feel) |
| Tests | **Vitest** (engine) + **Playwright** (flows, MockProvider) | Engine must be golden-tested |

### 9.1 THE critical Next.js constraint: the model is browser-only

`LanguageModel` is a **window API**. It does not exist in Node, in Server Components, in Route
Handlers, in Middleware, or in Edge functions. This is not a limitation to work around — it
dictates the whole app topology:

- **Every agent call, every session, the entire turn loop, and the whole rules engine run
  client-side** in `'use client'` modules. The engine must stay isomorphic-pure (no `window`
  dependency) so it can be unit-tested in Node, but it *executes* in the browser.
- **Server Components are for the shell only**: marketing/title page, SRD compendium browsing
  (static, cacheable, great RSC use case), About/license, campaign list skeleton.
- **Route Handlers are only a sync endpoint and a data API.** They never touch game logic.
- **Never** attempt SSR of a live scene. The play view is a client island, `ssr: false` where
  it touches model APIs, with a proper loading state.
- Guard every entry point: `if (typeof window === 'undefined') throw new Error('client only')`
  in `src/model/chrome-nano.ts`, so a bad import surfaces at build time, not at runtime.

```
app/
  layout.tsx                     RSC shell, theme tokens, fonts
  page.tsx                       RSC title screen (pre-warm trigger is a client child)
  compendium/[...slug]/page.tsx  RSC, static SRD browsing (generateStaticParams)
  about/page.tsx                 RSC, SRD attribution + non-affiliation notice
  play/[campaignId]/page.tsx     thin RSC → <PlayClient/> ('use client', ssr:false)
  api/
    campaigns/route.ts           GET list, POST create
    campaigns/[id]/route.ts      GET snapshot, PATCH meta, DELETE
    campaigns/[id]/sync/route.ts POST batched event push + pull since cursor
    assets/route.ts              GET manifest (served from /public, see §9.5)
src/
  model/     provider.ts chrome-nano.ts remote.ts session-pool.ts token-budget.ts repair.ts cache.ts
  agents/    dm/* player/* schemas/* prompts/*        ← as in §4, §5
  engine/    dice rng dtest combat initiative conditions hp death spells rest xp
             encounter-budget legal-actions intents validate events reducer
  character/ builder derive levelup sheet validate
  memory/    codex chronicle retrieval compaction contradiction
  pacing/    tension director-policy
  motion/    scope.ts dice.ts narration.ts combat.ts transitions.ts   ← §9.4
  data/srd/  *.json
  db/        client.ts collections.ts schemas.ts sync.ts migrate.ts
  ui/        screens/ components/ devhud/
```

### 9.2 Data layer: offline-first local log, MongoDB as durable sync target

Atlas M0's real limits, measured against this app's write pattern, force the design:
**512 MB storage · 500 connections · ~100 read+write ops/sec (excess is queued) · cluster
auto-pauses after 30 days with zero connections.**

A naive "write every event as it happens" design would burn the ops budget on a single player
and stall the game loop behind network latency. So:

1. **IndexedDB is the authority during play.** Every event appends locally and renders
   instantly. The game is fully playable offline — which matters, because the *model* works
   offline.
2. **Sync is batched and debounced.** Flush to `/api/campaigns/[id]/sync` on: scene close,
   combat end, level-up, rest, manual save, `visibilitychange → hidden`, and otherwise every
   ~30s *only if dirty*. One request carries an array of events → **one** `bulkWrite`. Target:
   a 90-minute session costs tens of ops, not thousands.
3. **Snapshots, not replays.** Every N events (N≈100) or at session end, write a compacted
   state snapshot. Loading a campaign = latest snapshot + events after it. Keeps reads O(1)
   and protects the 512 MB budget.
4. **Idempotent, append-only writes.** Each event has a client-generated `eventId` (ULID) and a
   monotonic `seq` per campaign. Sync upserts on `{campaignId, seq}`, so a retried flush is
   harmless. This gives safe multi-device continuation without conflict resolution.
5. **Keep the blobs out of Mongo.** Prompt/response transcripts, dev-HUD traces, and generated
   assets never go in the DB. Assets live in `/public` (§9.5); traces stay local.
6. **Serverless connection hygiene**: a single cached `MongoClient` on `globalThis` (survives
   HMR and warm lambda reuse) with `maxPoolSize: 10`. Never open a client per request — that is
   how you eat 500 connections.
7. **Handle the 30-day auto-pause**: catch the resume error on first query and show "waking the
   archive…" with a retry, rather than a 500.

**Collections** (all documents Zod-validated at the Route Handler boundary):

```
users        { _id, deviceId, createdAt, lastSeenAt }            // anonymous-first
campaigns    { _id, userId, name, bible, toneConfig, lines[], veils[], levelingMode,
               deathRules, promptVersions{}, act, partyLevel, createdAt, lastPlayedAt,
               seqHead, snapshotSeq }
events       { _id, campaignId, seq, eventId, type, payload, at }  // append-only; the save file
snapshots    { _id, campaignId, seq, state, at }                   // compacted fold
characters   { _id, campaignId, kind:'pc'|'companion', sheet, personaCard?, bondLevel? }
codex        { _id, campaignId, entityId, kind, name, aliases[], oneLine, facts[],
               relations[], tags[], status, knownToPlayer, salience, lastSeenEventId }
chronicle    { _id, campaignId, sceneIndex, entry, at }
```

**Indexes** (create in `migrate.ts`, idempotently):
`events: {campaignId:1, seq:1} unique` · `events: {campaignId:1, eventId:1} unique` ·
`snapshots: {campaignId:1, seq:-1}` · `campaigns: {userId:1, lastPlayedAt:-1}` ·
`codex: {campaignId:1, entityId:1} unique` · `codex: {campaignId:1, tags:1}` ·
`characters: {campaignId:1}`.

**Retrieval stays local.** The BM25 Codex index (§6) is built in the browser from synced codex
docs — do not put retrieval behind a network call; it runs on every beat and must be instant.

**`.env.local`**: `MONGODB_URI`, `MONGODB_DB`. Never expose either to the client; nothing in
`NEXT_PUBLIC_*` touches the database.

### 9.3 Degradation ladder (all four states must look deliberate)

1. Model available + online → full experience, synced.
2. Model available + offline → full play, local-only, visible "unsynced changes" badge.
3. Model unavailable (hardware/Chrome) → §2.1 unsupported screen + remote-provider seam;
   compendium and character builder still fully usable.
4. DB unreachable / M0 paused → play continues on IndexedDB, sync retries with backoff.
   **Never block a die roll on a database.**

### 9.4 Motion design with anime.js v4

anime.js is not decoration here — it is how a *text* game gets physicality. Import only what
you use (`import { animate, createTimeline, createScope, stagger, svg, utils } from 'animejs'`).

**React integration is non-negotiable:** wrap every component's animations in `createScope`
inside `useEffect`, keep the `scope` in a ref, and `scope.revert()` on cleanup. This scopes
selectors to the component root and batch-reverts on unmount — without it, React Strict Mode's
double-invoke and route transitions will leak and double-fire animations.

```ts
useEffect(() => {
  scope.current = createScope({ root }).add(self => {
    self.add('rollDie', (result) => { /* timeline */ });
  });
  return () => scope.current?.revert();
}, []);
```

What to animate, in priority order:

1. **The dice tray — the single most important animation in the app.** A d20 that tumbles,
   decelerates, and settles on the actual engine-rolled face, then the modifier chips flying in
   one by one (`stagger`) to assemble `14 + 3 + 2 = 19`, then a success/failure flare against
   the DC. Players trust numbers they watch land. Drive it from the roll's audit record so the
   animation is literally a visualization of the log, never a fake.
2. **Narration streaming** — a word/clause reveal keyed to the model's stream chunks
   (`stagger` over spans), not a fixed typewriter. It should feel like someone *telling* you
   the story, and it hides on-device latency as pacing rather than lag.
3. **Initiative tracker** — the active-turn marker sliding along the order; HP bars easing;
   damage numbers rising and fading; condition icons popping in with a spring.
4. **Combat impact** — short, sharp: a hit shakes the target card, a crit flashes and overshoots,
   a miss is a quick lateral slip. Keep all under 400ms. Restraint reads as quality.
5. **Scene transitions** — a parchment/ink wipe between scenes and screens; the Campaign Bible
   card dealing itself out section by section as the Worldsmith streams.
6. **SVG work** via anime.js's `svg` utilities — `createDrawable` line-draw for map region
   reveals, sigil/portrait generation strokes, and the tension meter's arc.

Rules: respect `prefers-reduced-motion` (swap to instant state changes, never just shorten);
never gate game state behind an animation completing — animations observe the event log, the
log does not wait for them; keep per-beat total motion budget under ~1.2s so play stays brisk.

### 9.5 Asset pipeline: generated via chat.com, baked into `/public`

There is **no image model on-device**, and the Prompt API is text/audio-in, text-out. So every
visual asset is **pre-generated at build time** (by me, in the browser, via chat.com using the
user's account and Chrome MCP) and shipped as a static file. Nothing is generated at runtime.

**Consequence for design: portraits must be picked, not painted.** A campaign invents its own
companions and NPCs at runtime, and we cannot render them on demand. So we pre-generate a
**tagged portrait library** and the engine selects the nearest match by tags
(species / class-archetype / build / mood / age), falling back to a procedurally generated
seed-sigil when nothing matches well. The player can reroll the match.

**Style bible — one prompt prefix, prepended to every single asset request.** Consistency is
the whole game here; 100 individually-beautiful images in 100 styles look like a scrapbook.

> `STYLE: hand-inked fantasy manuscript illustration. Dark desaturated palette — charcoal
> black, aged parchment cream, oxidised copper, muted blood red, one antique-gold accent.
> Visible pen hatching and ink-wash shading. Matte, no gloss, no lens flare, no neon.
> Slight paper grain. Composition centred and uncluttered. No text, no lettering, no borders,
> no watermark, no signature.`

Per-asset the request appends: subject, framing, aspect ratio, and background requirement
(`flat #0E0E11 background` for anything needing cutout, since background removal on inked art
is lossy).

**Manifest-driven, deterministic, resumable.** `assets/manifest.json` is the single source of
truth, authored *before* any generation:

```ts
type AssetSpec = {
  id: string;                  // 'portrait.dwarf.cleric.stern.01'
  category: 'portrait'|'creature'|'biome'|'texture'|'mask'|'icon'|'frame'|'brand';
  subjectPrompt: string;       // appended to the style bible
  aspect: '1:1'|'3:4'|'16:9';
  transparent: boolean;
  tags: string[];              // what the runtime matcher queries
  out: string;                 // 'public/assets/portraits/dwarf-cleric-stern-01.webp'
  status: 'todo'|'generated'|'accepted'|'rejected';
  sourceNote?: string;         // which chat, which revision
};
```

Generation loop (one asset = one deterministic cycle, so it can stop and resume):
`pick next 'todo'` → compose `styleBible + subjectPrompt + framing` → generate in chat.com →
review the result against the spec → accept or re-prompt once → download → convert to WebP
(and AVIF for large backdrops) at the target size → write to `out` → flip `status` →
commit. Rejected specs stay in the manifest with the reason, so nothing silently vanishes.

**Post-processing is mandatory** — raw model output is never shipped:
cutout where `transparent` (flat-background trick + alpha), resize to exact 1×/2× targets,
WebP/AVIF conversion, strip metadata, and `next/image` with explicit `width`/`height`
everywhere so nothing shifts layout. Budget: portraits ≤ 60 KB, biome backdrops ≤ 180 KB,
textures seamless and ≤ 40 KB. Total asset payload target **under 6 MB**, lazy-loaded by route.

**What gets generated vs. what stays vector/procedural** — resist generating things that should
be code:

| Generate (raster) | Keep as SVG / CSS / procedural |
|---|---|
| Portrait library (~40), tagged | The d20 and all dice (CSS 3D + SVG faces) |
| Common low-CR creature art (~40) | The 15 condition icons (line SVG, themable, crisp at 16px) |
| Biome/scene backdrops (~12) | Class & species glyphs (line SVG) |
| Seamless parchment/leather textures (3) | Tension meter, HP bars, initiative track |
| Ink-wipe transition masks (3, greyscale) | Unmatched-NPC fallback sigils (seeded SVG) |
| Rarity card frames (6) | Map region outlines (anime.js `createDrawable`) |
| Title backdrop, favicon, OG image | All UI chrome |

**Pilot before scale.** Generate **two** assets first — one portrait and one biome backdrop —
and integrate them into a real screen before generating the remaining ~100. The style bible
will need one or two revisions, and discovering that after 100 images is expensive.

**Licensing note to settle once, up front:** these assets come from the user's own chat.com
account under that provider's terms. Keep every spec and prompt in the manifest so the whole
library is reproducible, and keep the procedural-SVG fallbacks working so the app is never
*structurally* dependent on them. The SRD text attribution (§14) is separate and unaffected.

---

## 10. Reliability harness (build this with the features, not after)

- **Schema-first, validate-always, repair-once.** On validation failure, send one repair prompt
  containing the error and the offending output. On second failure, use the deterministic
  fallback and log a `generation_failure` event. Never show the player a crash or raw JSON.
- **Golden tests for the engine.** Every mechanic above gets unit tests with fixed seeds:
  crit damage doubling, advantage non-stacking, death-save edge cases, exhaustion stacking to
  6, concentration DC math, encounter budget arithmetic, XP thresholds.
- **Agent contract tests** with a `MockProvider` that returns canned/adversarial JSON:
  unknown entity IDs, out-of-ladder DCs, illegal action indices, prose containing numbers,
  attempts to narrate the player's choices. Each must be caught by validation.
- **Prose linter** on every Narrator output: reject (and repair) text containing die-roll
  notation, "you decide to", "hit points", explicit DCs, unknown proper nouns not in the
  entity manifest, or any Line the player declared.
- **Prompt versioning.** Every role card has a semver and is stored with each save, so an old
  campaign can be replayed against the prompts that produced it. When the model breaks a rule,
  the fix is a new clause in the role card plus a regression case in the contract tests.
- **Save integrity.** Append-only events + periodic snapshots; schema-versioned with
  migrations; JSON export/import so a campaign is portable and inspectable.

---

## 11. Build order (ship something playable at every step)

1. **M0 — Spike**: feature-detect, download UX, one schema-constrained `prompt()` round trip,
   token/latency numbers measured on real hardware. *Validate the premise before building on it.*
2. **M1 — Engine core**: dice + seeded RNG + d20 tests + character model + full 2024 character
   creation (guided path) + sheet UI + SRD data loaded. No AI yet. Fully tested.
3. **M2 — Narrative loop**: Worldsmith → Narrator → Adjudicator → Resolver, exploration/social
   play only, one human PC, no companions. Dice tray + event log + Dev HUD.
4. **M3 — Combat**: initiative, legal actions, attacks/saves/damage, conditions, death saves,
   Encounter Director + Monster Tactician, zone battlefield.
5. **M4 — The party**: Companion Forge, companion turns, stances, banter, Bond levels.
6. **M5 — Memory & persistence**: Codex, Chronicle, retrieval, compaction, contradiction judge,
   save/load/export, session recaps.
7. **M5.5 — Cloud sync & assets**: Atlas M0 wired, batched sync + snapshots, device-ID
   identity, multi-device continuation; asset manifest authored, pilot assets integrated,
   library generated (§9.5).
8. **M6 — Progression & polish**: rests, level-up, loot/XP, X-Card + Lines & Veils, pacing
   tuning, accessibility, performance (pre-warm, pre-generate, cache), license/About screen.

---

## 12. Acceptance criteria — "is it actually good?"

- A new player can go from Title to their first die roll in **under 3 minutes**.
- A 90-minute solo session produces: a coherent world, at least one memorable NPC the player can
  name, two combats whose difficulty matched the chosen budget, one companion disagreement that
  changed what happened, and a recap that is factually consistent with the event log.
- **Zero** instances of: a number asserted by the model, an entity invented out of thin air, a
  companion casting a spell it doesn't have, the player's own actions being narrated for them,
  or a rule in §3.2 applied incorrectly. Each of these is a P0 bug with a regression test.
- The game **never stalls**: every agent call has a fallback and the loop always returns control
  to the player.
- Median beat latency on target hardware: narration starts streaming in **< 2s**, a full beat
  (adjudicate → roll → resolve → narrate → companions) completes in **< 12s**, with the UI
  showing honest progress the whole time.
- Reload mid-combat restores exact state, including initiative position and condition durations.
- Works fully offline after the model download. No network calls in the play loop.
- SRD attribution and the non-affiliation notice are present and correct.

---

## 13. Explicitly out of scope for v1

Multiplayer/multiple humans · grid-and-token tactical maps with precise geometry · image or
voice generation · homebrew content editor · non-SRD content · mobile layout (desktop-first;
the model requires desktop-class hardware anyway) · real-time cross-device co-play (sync is
sequential hand-off, not concurrent) · accounts/login (anonymous device ID only in v1) ·
runtime image generation (§9.5 — all assets are build-time).

---

## 14. Attribution block to ship in the app

> This product includes material from the System Reference Document 5.2.1 ("SRD 5.2.1") by
> Wizards of the Coast LLC, available under the Creative Commons Attribution 4.0 International
> License. Not affiliated with, endorsed, sponsored, or specifically approved by Wizards of the
> Coast LLC.

---

### Appendix A — honest risks to design around

- **Nano's capability ceiling is the main product risk.** Role decomposition, closed-set enums,
  retrieved rules, and deterministic fallbacks are not optional polish — they are what make a
  small on-device model viable as a DM. Measure prose quality at M0 and decide then whether the
  Narrator (and only the Narrator) deserves an optional remote provider.
- **The 9,216-token window** means long-campaign coherence lives entirely in the Codex and
  Chronicle. Invest in retrieval quality early; it is the difference between a world and a
  sequence of unrelated scenes.
- **Sequential on-device inference** means the companion pass is the latency hot spot. Cap
  active companions at 3 for v1, stagger their calls behind streaming narration, and let
  `defer_to_player` short-circuit a full generation.
- **Availability**: a meaningful share of users won't meet the hardware bar. The unsupported
  screen must be gracious, specific about why, and offer the remote-provider seam.

---

### Appendix B — measured on the dev machine (Chrome 156, macOS, 2026-11-02)

Verified live in the target browser before writing any code:

- `'LanguageModel' in self` → **true**; `'Summarizer' in self` → **true**
- `LanguageModel.availability({expectedInputs/Outputs: text/en})` → **`"available"`** (no download needed)
- `LanguageModel.params()` → **does not exist on the web API** (extensions-only; do not call it —
  use `samplingMode` on the web instead of `temperature`/`topK`)
- `session.measureInputUsage()` → **does not exist**; the method is `measureContextUsage()`.
  Feature-detect both before calling either.
- **`LanguageModel.create()` did not resolve within ~80s**, both without and with a real user
  gesture (`navigator.userActivation.hasBeenActive === true`), on a third-party origin
  (example.com) with no console diagnostics emitted.

**Implication for M0 — treat this as the first thing to solve, before any feature work:**
`create()` is an unbounded-latency operation in practice. Therefore:

1. Always pass an `AbortSignal` with a **timeout** to `create()` (e.g. 120s) and render an
   honest "waking the Dungeon Master" state behind it — never a spinner with no exit.
2. Pre-warm on the **Title screen**, not at first use, and treat session creation as a
   first-class app lifecycle phase with its own UI.
3. Attach `monitor` on every `create()` and surface `downloadprogress` even when `availability`
   reports `"available"` — the status and the readiness-to-serve are not the same thing.
4. Re-run this spike on **localhost** and on the app's own origin; cold-start behaviour may be
   origin- or first-use-dependent. Record real numbers for `createMs` (cold/warm), `promptMs`,
   `contextWindow`, and `contextUsage` into a committed `docs/m0-measurements.md` before
   committing to the latency targets in §12.
