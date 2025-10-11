import React, { useState, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import type {
  NarrativeTree,
  Stage,
  Choice,
  GameState,
  UserProfile,
  AnalyticsEvent
} from './atlas-directive-types-complete';

interface AtlasDirectiveProps {
  onOutcomeDetermined?: (payload: {
    animation_key?: string;
    view?: string;
    seek_pct?: number;
    date?: string;
    fx?: { trail?: boolean; glow?: boolean | string };
  }) => void;
  className?: string;
}

export const AtlasDirective: React.FC<AtlasDirectiveProps> = ({
  onOutcomeDetermined,
  className = ''
}) => {
  const [narrativeTree, setNarrativeTree] = useState<NarrativeTree | null>(null);
  const [gameState, setGameState] = useState<GameState>({
    currentStage: 'mission_briefing',
    userProfile: {
      traits: {
        pragmatist: 0, mystic: 0, idealist: 0, cynic: 0,
        risk_taker: 0, cautious: 0, leader: 0, analyst: 0
      },
      choices: [],
      path: ['mission_briefing'],
      flags: []
    },
    completedStages: [],
    chronoTokens: 3,
    unlockedOutcomes: []
  });

  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load narrative tree on mount
  useEffect(() => {
    const loadNarrativeTree = async () => {
      try {
        const response = await fetch('/narrative_tree_complete_12_nodes.json', { cache: 'no-store' });
        if (!response.ok) {
          throw new Error(`Failed to load narrative tree: ${response.status}`);
        }
        const data = await response.json();
        setNarrativeTree(data);
        
        // Initialize tokens from tree configuration
        if (data.tokens?.chrono?.start) {
          setGameState(prev => ({
            ...prev,
            chronoTokens: data.tokens.chrono.start
          }));
        }
      } catch (err) {
        console.error('Narrative tree loading failed:', err);
        setError('Narrative content unavailable');
      }
    };

    loadNarrativeTree();
  }, []);

  // Get current stage
  const currentStage = narrativeTree?.nodes?.find(
    node => node.id === gameState.currentStage
  );

  // Check if choice requirements are met
  const checkRequirements = useCallback((requires?: string[]): boolean => {
    if (!requires || requires.length === 0) return true;
    return requires.every(req => gameState.userProfile.flags?.includes(req));
  }, [gameState.userProfile.flags]);

  // Utility function to bump traits with proper clamping
  const bumpTrait = useCallback((state: GameState, traitName: keyof GameState['userProfile']['traits'], increment: number): GameState => {
    const currentValue = state.userProfile.traits[traitName] ?? 0;
    const newValue = Math.max(0, Math.min(100, currentValue + increment));
    return {
      ...state,
      userProfile: {
        ...state.userProfile,
        traits: {
          ...state.userProfile.traits,
          [traitName]: newValue
        }
      }
    };
  }, []);

  // Analyze choice and apply behavioral trait increments
  const applyBehavioralTraits = useCallback((state: GameState, choice: Choice): GameState => {
    let updatedState = { ...state };

    // Analyze choice patterns for behavioral traits
    const choiceText = choice.label.toLowerCase();
    const choiceId = choice.id.toLowerCase();

    // Risk-taking vs Cautious choices
    if (choiceText.includes('risk') || choiceText.includes('danger') || choiceText.includes('bold') || choiceId.includes('intervention')) {
      updatedState = bumpTrait(updatedState, 'risk_taker', 2);
    } else if (choiceText.includes('safe') || choiceText.includes('caution') || choiceText.includes('careful') || choiceId.includes('diplomatic')) {
      updatedState = bumpTrait(updatedState, 'cautious', 2);
    }

    // Leadership choices
    if (choiceText.includes('lead') || choiceText.includes('command') || choiceText.includes('direct') || choiceId.includes('leader')) {
      updatedState = bumpTrait(updatedState, 'leader', 2);
    }

    // Analytical choices
    if (choiceText.includes('analyze') || choiceText.includes('study') || choiceText.includes('research') || choiceId.includes('scientific')) {
      updatedState = bumpTrait(updatedState, 'analyst', 2);
    }

    // Mystical/Intuitive choices
    if (choiceText.includes('intuition') || choiceText.includes('feel') || choiceText.includes('sense') || choiceId.includes('anomaly')) {
      updatedState = bumpTrait(updatedState, 'mystic', 2);
    }

    // Pragmatic choices
    if (choiceText.includes('practical') || choiceText.includes('logical') || choiceText.includes('efficient')) {
      updatedState = bumpTrait(updatedState, 'pragmatist', 2);
    }

    // Idealistic choices
    if (choiceText.includes('hope') || choiceText.includes('believe') || choiceText.includes('principle')) {
      updatedState = bumpTrait(updatedState, 'idealist', 2);
    }

    // Cynical choices
    if (choiceText.includes('doubt') || choiceText.includes('skeptic') || choiceText.includes('question')) {
      updatedState = bumpTrait(updatedState, 'cynic', 2);
    }

    return updatedState;
  }, [bumpTrait]);

  // Calculate dominant trait
  const getDominantTrait = useCallback((): string => {
    const traits = gameState.userProfile.traits;
    const traitKeys = Object.keys(traits) as Array<keyof typeof traits>;
    return traitKeys.reduce((a, b) =>
      traits[a] > traits[b] ? a : b
    );
  }, [gameState.userProfile.traits]);

  // Make choice and update game state
  const makeChoice = useCallback(async (choice: Choice) => {
    if (isTransitioning) return;

    // Check requirements
    if (!checkRequirements(choice.requires)) {
      return; // Requirements not met - choice should be disabled
    }

    // Check token cost
    if (choice.cost && gameState.chronoTokens < choice.cost) {
      return; // Insufficient tokens - choice should be disabled
    }

    setIsTransitioning(true);

    // Track analytics event locally
    const analyticsEvent: AnalyticsEvent = {
      eventType: 'choice_made',
      stageId: gameState.currentStage,
      choiceText: choice.label,
      traits: choice.grants?.filter(g => g.startsWith('trait_')),
      timestamp: new Date().toISOString(),
      userId: 'local_user' // Local only for Phase 1
    };

    // Store analytics locally
    const events = JSON.parse(localStorage.getItem('atlas-analytics') || '[]');
    events.push(analyticsEvent);
    localStorage.setItem('atlas-analytics', JSON.stringify(events.slice(-100)));

    // Simulate transition delay for better UX
    setTimeout(() => {
      // Update traits from grants using bumpTrait function
      let updatedGameState = { ...gameState };
      choice.grants?.forEach(grant => {
        if (grant.startsWith('trait_')) {
          const traitName = grant.replace('trait_', '') as keyof GameState['userProfile']['traits'];
          updatedGameState = bumpTrait(updatedGameState, traitName, 12);
        }
      });

      // Apply behavioral trait increments based on choice patterns
      updatedGameState = applyBehavioralTraits(updatedGameState, choice);

      // Update flags from grants
      const updatedFlags = [...(gameState.userProfile.flags || [])];
      choice.grants?.forEach(grant => {
        if (!grant.startsWith('trait_') && !updatedFlags.includes(grant)) {
          updatedFlags.push(grant);
        }
      });

      // Calculate new token count
      const newTokenCount = Math.max(0, gameState.chronoTokens - (choice.cost || 0));

      // Update game state
      const newGameState: GameState = {
        currentStage: choice.next_id,
        userProfile: {
          ...updatedGameState.userProfile,
          choices: [...gameState.userProfile.choices, choice],
          path: [...gameState.userProfile.path, choice.next_id],
          flags: updatedFlags
        },
        completedStages: [...gameState.completedStages, gameState.currentStage],
        chronoTokens: newTokenCount,
        unlockedOutcomes: gameState.unlockedOutcomes
      };

      setGameState(newGameState);

      // Check for cinematic triggers
      const nextStage = narrativeTree?.nodes?.find(node => node.id === choice.next_id);
      if (nextStage?.cinematic && onOutcomeDetermined) {
        const cinematicPayload = {
          animation_key: nextStage.cinematic.animation_key,
          view: nextStage.cinematic.view,
          seek_pct: nextStage.cinematic.timeline?.seek_pct,
          date: nextStage.cinematic.timeline?.date,
          fx: nextStage.cinematic.fx
        };
        onOutcomeDetermined(cinematicPayload);
      }

      // Check for ending reached
      if (!nextStage?.choices || nextStage.choices.length === 0) {
        // Ending reached - track completion
        const completionEvent: AnalyticsEvent = {
          eventType: 'outcome_reached',
          stageId: choice.next_id,
          timestamp: new Date().toISOString(),
          userId: 'local_user'
        };
        events.push(completionEvent);
        localStorage.setItem('atlas-analytics', JSON.stringify(events.slice(-100)));
      }

      setIsTransitioning(false);
    }, 400);
  }, [isTransitioning, checkRequirements, gameState, narrativeTree, onOutcomeDetermined]);

  // Use chrono token to reset
  const useChrono = useCallback((targetStageId: string) => {
    if (gameState.chronoTokens > 0) {
      setGameState(prev => ({
        ...prev,
        currentStage: targetStageId,
        chronoTokens: prev.chronoTokens - 1
      }));
    }
  }, [gameState.chronoTokens]);

  // Error state
  if (error) {
    return (
      <div className={`atlas-directive ${className}`}>
        <div className="narrative-error">
          <div className="error-content">
            <h3>⚠️ System Status</h3>
            <p>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (!narrativeTree || !currentStage) {
    return (
      <div className={`atlas-directive ${className}`}>
        <div className="loading-state">
          <div className="loading-spinner">
            <div className="orbit-animation"></div>
          </div>
          <p>Initializing ATLAS Directive...</p>
        </div>
      </div>
    );
  }

  const isEnding = !currentStage.choices || currentStage.choices.length === 0;

  return (
    <div className={`atlas-directive ${className} ${isTransitioning ? 'transitioning' : ''}`}>
      {/* Main Narrative Panel */}
      <div className="narrative-panel">
        {/* Stage Header */}
        <div className="stage-header">
          <h2 className={`stage-title ${currentStage.title?.toLowerCase().replace(/\s+/g, '-')}`}>
            {currentStage.title}
          </h2>
          
          {currentStage.id.includes('fatal') && (
            <div className="error-indicator">⚠️ ANALYSIS ERROR</div>
          )}
        </div>

        {/* Stage Content */}
        <div className="stage-content">
          <div className="stage-text">
            <ReactMarkdown rehypePlugins={[rehypeSanitize]}>
              {currentStage.body_md ?? ''}
            </ReactMarkdown>
          </div>

          {/* Choices */}
          {currentStage.choices && currentStage.choices.length > 0 && (
            <div className="choices-container">
              {currentStage.choices.map((choice, index) => {
                const requirementsMet = checkRequirements(choice.requires);
                const canAfford = !choice.cost || gameState.chronoTokens >= choice.cost;
                const isEnabled = requirementsMet && canAfford && !isTransitioning;

                return (
                  <button
                    key={choice.id || index}
                    className={`choice-button ${!isEnabled ? 'disabled' : ''} ${choice.grants?.filter(g => g.startsWith('trait_')).join(' ') || ''}`}
                    onClick={() => isEnabled && makeChoice(choice)}
                    disabled={!isEnabled}
                    title={!requirementsMet ? 'Requirements not met' : 
                           !canAfford ? `Requires ${choice.cost} tokens` : ''}
                  >
                    <div className="choice-text">{choice.label}</div>
                    
                    {choice.cost && (
                      <div className="choice-cost">⧗ {choice.cost}</div>
                    )}
                    
                    {choice.requires && (
                      <div className="choice-requirements">
                        Requires: {choice.requires.join(', ')}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Ending State */}
          {isEnding && (
            <div className="ending-state">
              <div className="outcome-complete">
                <h3>🎯 Mission Status: Complete</h3>
                <p>Analysis concluded. Final directive achieved.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Side Panel UI */}
      <div className="ui-sidebar">
        {/* Chrono Tokens */}
        <div className="token-display">
          <h4>Chrono Tokens</h4>
          <div className="token-count">
            {'⧗'.repeat(gameState.chronoTokens)}
            <span className="token-number">{gameState.chronoTokens}</span>
          </div>
        </div>

        {/* Analysis Toggle */}
        <div className="analysis-section">
          <button 
            className="analysis-toggle"
            onClick={() => setShowAnalysis(!showAnalysis)}
          >
            Psychological Analysis {showAnalysis ? '▼' : '▶'}
          </button>
          
          {showAnalysis && (
            <div className="trait-analysis">
              <div className="dominant-trait">
                <strong>Primary: {getDominantTrait().replace('_', ' ')}</strong>
              </div>
              
              <div className="trait-bars">
                {Object.entries(gameState.userProfile.traits)
                  .sort(([,a], [,b]) => b - a)
                  .slice(0, 4) // Show top 4 traits
                  .map(([trait, score]) => (
                    <div key={trait} className="trait-bar">
                      <div className="trait-label">
                        {trait.replace('_', ' ')}
                        <span className="trait-score">{score}%</span>
                      </div>
                      <div className="progress-track">
                        <div 
                          className={`progress-fill trait-${trait}`}
                          style={{ width: `${score}%` }}
                        />
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* Quick Stats */}
        <div className="mission-stats">
          <h4>Mission Progress</h4>
          <div className="stat-row">
            <span>Decisions:</span>
            <span>{gameState.userProfile.choices.length}</span>
          </div>
          <div className="stat-row">
            <span>Path Depth:</span>
            <span>{gameState.userProfile.path.length}</span>
          </div>
          <div className="stat-row">
            <span>Flags:</span>
            <span>{gameState.userProfile.flags?.length || 0}</span>
          </div>
        </div>

        {/* Chrono Reset */}
        {gameState.chronoTokens > 0 && gameState.completedStages.length > 0 && (
          <button 
            className="chrono-button"
            onClick={() => {
              const lastStage = gameState.completedStages[gameState.completedStages.length - 1];
              useChrono(lastStage);
            }}
          >
            ⧗ Use Chrono Token
          </button>
        )}
      </div>

      {/* Transition Overlay */}
      {isTransitioning && (
        <div className="transition-overlay">
          <div className="processing-indicator">
            <div className="orbit-loader">
              <div className="orbit-ring"></div>
              <div className="orbit-dot"></div>
            </div>
            <p>Processing directive...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default AtlasDirective;
