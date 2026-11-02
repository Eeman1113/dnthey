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
