import type { CharacterBuild, CharacterState } from '@/character/types';
import type { World } from '@/agents/schemas';
import type { CompanionCard } from '@/agents/dm';
import type { D20Result } from '@/engine/dtest';
import type { DiceRoll } from '@/engine/dice';
import type { CombatState } from './combat';
import type { Monster } from '@/data/srd/encounters';
import type { CodexEntity, Chronicle } from '@/memory/codex';

export type BeatKind = 'scene' | 'action' | 'roll' | 'narration' | 'speech' | 'system' | 'combat';

export interface Beat {
  id: string;
  kind: BeatKind;
  text: string;
  /** Who is speaking, for speech beats. */
  speaker?: string;
  portraitId?: string;
  roll?: D20Result;
  /** A plain dice roll such as a Hit Die, which is not a d20 test. */
  dice?: DiceRoll;
  stance?: string;
  at: number;
}

export interface Campaign {
  id: string;
  createdAt: number;
  tone: string;
  /**
   * Content the player never wants to see. Injected into every narrative
   * system prompt as a hard constraint, not filtered afterwards.
   */
  lines: string;
  world: World;
  worldGenerated: boolean;
  pc: { build: CharacterBuild; state: CharacterState };
  companions: {
    card: CompanionCard;
    /** How they felt about the player's last plan. */
    stance?: 'enthusiastic' | 'onboard' | 'reluctant' | 'opposed';
    /**
     * Trust, 0 to 5, starting at 2. Rises when the player acts with them,
     * falls when the player overrules an objection. At 0 they leave.
     */
    bond: number;
    gone?: boolean;
  }[];
  /** The current scene description handed to every agent. */
  scene: string;
  beats: Beat[];
  seed: string;
  /** Monotonic, so the seeded dice replay identically. */
  rollCount: number;
  /**
   * Live combat, persisted with everything else. Reloading mid fight has to
   * restore the initiative position and every combatant's state, which is a
   * stated acceptance criterion and was previously lost on refresh.
   */
  combat: CombatState | null;
  foes: Monster[];
  /** Campaign memory. See src/memory/codex.ts. */
  codex: CodexEntity[];
  chronicle: Chronicle;
}
