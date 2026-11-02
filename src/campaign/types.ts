import type { CharacterBuild, CharacterState } from '@/character/types';
import type { World } from '@/agents/schemas';
import type { CompanionCard } from '@/agents/dm';
import type { D20Result } from '@/engine/dtest';

export type BeatKind = 'scene' | 'action' | 'roll' | 'narration' | 'speech' | 'system';

export interface Beat {
  id: string;
  kind: BeatKind;
  text: string;
  /** Who is speaking, for speech beats. */
  speaker?: string;
  portraitId?: string;
  roll?: D20Result;
  at: number;
}

export interface Campaign {
  id: string;
  createdAt: number;
  tone: string;
  world: World;
  worldGenerated: boolean;
  pc: { build: CharacterBuild; state: CharacterState };
  companions: { card: CompanionCard; stance?: string }[];
  /** The current scene description handed to every agent. */
  scene: string;
  beats: Beat[];
  seed: string;
  /** Monotonic, so the seeded dice replay identically. */
  rollCount: number;
}
