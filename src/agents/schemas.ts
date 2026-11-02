import { z } from 'zod';
import { ABILITIES, SKILLS } from '@/engine/types';

/** Authored once in Zod, used for both the response constraint and the parse. */
const json = (s: z.ZodType) => z.toJSONSchema(s, { io: 'input' });

export const AdjudicationZ = z.object({
  resolution: z.enum(['roll', 'auto_success', 'auto_failure', 'impossible']),
  ability: z.enum(ABILITIES),
  skill: z.enum([...SKILLS, 'none']),
  dc: z.enum(['5', '10', '15', '20', '25', '30']),
  successMeans: z.string(),
  failureMeans: z.string(),
  /** True when this action starts, or walks into, a fight. */
  startsCombat: z.boolean(),
  /** Who or what is attacking, if combat begins. Used to theme the encounter. */
  threat: z.string(),
}).strict();
export type Adjudication = z.infer<typeof AdjudicationZ>;
export const ADJUDICATION_SCHEMA = json(AdjudicationZ);

export const WorldZ = z.object({
  realmName: z.string(),
  openingLocation: z.string(),
  locationKind: z.enum([
    'dungeon', 'forest', 'city', 'tavern', 'crypt', 'mountain',
    'swamp', 'ruin', 'keep', 'underdark', 'road', 'coast',
  ]),
  hook: z.string(),
  threat: z.string(),
  openingScene: z.string(),
}).strict();
export type World = z.infer<typeof WorldZ>;
export const WORLD_SCHEMA = json(WorldZ);

export const CompanionReplyZ = z.object({
  speech: z.string(),
  stance: z.enum(['enthusiastic', 'onboard', 'reluctant', 'opposed']),
}).strict();
export type CompanionReply = z.infer<typeof CompanionReplyZ>;
export const COMPANION_SCHEMA = json(CompanionReplyZ);


/** What the Loremaster extracts from a closed beat. */
export const LoreZ = z.object({
  /** One compacted line for the chronicle, under 25 words. */
  summary: z.string(),
  entities: z.array(z.object({
    name: z.string(),
    kind: z.enum(['npc', 'place', 'faction', 'item', 'quest', 'event']),
    oneLine: z.string(),
    knownToPlayer: z.boolean(),
  })),
}).strict();
export type Lore = z.infer<typeof LoreZ>;
export const LORE_SCHEMA = json(LoreZ);


/** Two companions talking to each other rather than at the player. */
export const BanterZ = z.object({
  lines: z.array(z.object({ who: z.string(), says: z.string() })),
}).strict();
export type Banter = z.infer<typeof BanterZ>;
export const BANTER_SCHEMA = json(BanterZ);


/** The Monster Tactician picks an index, never a name it could invent. */
export const TacticZ = z.object({
  targetIndex: z.number().int(),
  taunt: z.string(),
}).strict();
export type Tactic = z.infer<typeof TacticZ>;
export const TACTIC_SCHEMA = json(TacticZ);
