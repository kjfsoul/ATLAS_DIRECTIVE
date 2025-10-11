// Updated TypeScript interfaces for The ATLAS Directive

export interface Choice {
  id: string;
  label: string;
  next_id: string;
  cost?: number;
  grants?: string[];
  requires?: string[];
}

export interface Stage {
  id: string;
  title: string;
  body_md: string;
  choices: Choice[];
  grants?: string[];
  requires?: string[];
  cinematic?: {
    animation_key?: string;
    view?: "default" | "followComet" | "topDown" | "closeup" | "rideComet";
    timeline?: { 
      date?: string; 
      seek_pct?: number; 
    };
    fx?: { 
      trail?: boolean; 
      glow?: boolean | string; 
    };
  };
}

export interface UserProfile {
  traits: {
    pragmatist: number;
    mystic: number;
    idealist: number;
    cynic: number;
    risk_taker: number;
    cautious: number;
    leader: number;
    analyst: number;
  };
  choices: Choice[];
  path: string[];
  flags?: string[];
  outcome?: Outcome;
}

export interface GameState {
  currentStage: string;
  userProfile: UserProfile;
  completedStages: string[];
  chronoTokens: number;
  unlockedOutcomes: string[];
}

export interface NarrativeTree {
  meta: {
    version: string;
    updated_utc: string;
    title: string;
    description: string;
    total_nodes: number;
    endings: number;
    golden_path_nodes: number;
    skill_checks?: number;
    branching_points?: number;
  };
  root_id: string;
  tokens: {
    chrono: {
      start: number;
      earn_rules: Array<{
        action: string;
        amount: number;
      }>;
    };
  };
  nodes: Stage[];
}

export interface Outcome {
  title: string;
  narrative: string;
  rarity: 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary';
  animation_key: string;
  art_direction?: string;
}

export interface AnalyticsEvent {
  eventType: 'choice_made' | 'stage_completed' | 'outcome_reached' | 'token_used';
  stageId: string;
  choiceText?: string;
  traits?: string[];
  timestamp: string;
  userId: string;
}

export interface CinematicPayload {
  animation_key?: string;
  view?: string;
  seek_pct?: number;
  date?: string;
  fx?: { 
    trail?: boolean; 
    glow?: boolean | string; 
  };
}

// Validation types
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    totalNodes: number;
    endings: number;
    unreachableNodes: string[];
    danglingReferences: string[];
  };
}

// Achievement system types
export interface Achievement {
  id: string;
  title: string;
  description: string;
  rarity: 'Common' | 'Rare' | 'Epic' | 'Legendary';
  requirements: string[];
  unlocked: boolean;
}

export interface AchievementTracker {
  achievements: Achievement[];
  totalUnlocked: number;
  rarityCount: {
    Common: number;
    Rare: number;
    Epic: number;
    Legendary: number;
  };
}

// Component prop types
export interface AtlasDirectiveProps {
  onOutcomeDetermined?: (payload: CinematicPayload) => void;
  className?: string;
  debugMode?: boolean;
}

export interface NarrativeEngineProps extends AtlasDirectiveProps {
  narrativeTree?: NarrativeTree;
  initialState?: Partial<GameState>;
  onAnalyticsEvent?: (event: AnalyticsEvent) => void;
}

// 3D Tracker integration types
export interface TrackerNarrativeAction extends CinematicPayload {
  timestamp: string;
  source: 'narrative_engine';
}

export interface Atlas3DTrackerProps {
  narrativeAction?: TrackerNarrativeAction;
  onAnimationComplete?: (animation_key: string) => void;
}