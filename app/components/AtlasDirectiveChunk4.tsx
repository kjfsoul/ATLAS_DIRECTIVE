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
  narrativeChunk?: string; // Optional: specify which chunk to load, defaults to chunk4
  enableMultiChunk?: boolean; // Optional: enable loading multiple chunks
}

/**
 * ATLAS Directive Component - Chunk4 Velocity, Age & Discovery Support
 *
 * Specialized for kinematic, chronological, and discovery analysis with enhanced
 * visualization capabilities for velocity vectors, age determination methods,
 * and telescope system integration.
 *
 * Features:
 * - Dynamic chunk4 loading from /data folder
 * - Enhanced kinematic visualization components
 * - Age determination methodology display
 * - Discovery telescope system integration
 * - Advanced error handling and retry mechanisms
 */
export const AtlasDirective: React.FC<AtlasDirectiveProps> = ({
  onOutcomeDetermined,
  className = '',
  narrativeChunk = 'narrative_tree_chunk4_velocity.json',
  enableMultiChunk = false
}) => {
  // Core state management
  const [narrativeTree, setNarrativeTree] = useState<NarrativeTree | null>(null);
  const [gameState, setGameState] = useState<GameState>({
    currentStage: 'velocity_age_entry',
    userProfile: {
      traits: {
        pragmatist: 0, mystic: 0, idealist: 0, cynic: 0,
        risk_taker: 0, cautious: 0, leader: 0, analyst: 0
      },
      choices: [],
      path: ['velocity_age_entry'],
      flags: []
    },
    completedStages: [],
    chronoTokens: 3,
    unlockedOutcomes: []
  });

  // Enhanced UI state management
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chunkLoadError, setChunkLoadError] = useState<string | null>(null);

  /**
   * Enhanced narrative tree loading with chunk4-specific validation
   */
  useEffect(() => {
    const loadNarrativeTree = async () => {
      try {
        setChunkLoadError(null);
        setError(null);

        // Construct proper path for chunk loading
        const chunkPath = narrativeChunk.startsWith('/data/')
          ? narrativeChunk
          : `/data/${narrativeChunk}`;

        console.log(`Loading Chunk4 narrative: ${chunkPath}`);

        const response = await fetch(chunkPath, {
          cache: 'no-store',
          headers: {
            'Content-Type': 'application/json',
          }
        });

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error(`Chunk4 not found: ${chunkPath}. Ensure narrative_tree_chunk4_velocity.json exists in /data folder.`);
          }
          throw new Error(`Failed to load Chunk4: ${response.status} ${response.statusText}`);
        }

        const data: NarrativeTree = await response.json();

        // Enhanced chunk4 validation
        if (!data.nodes || !Array.isArray(data.nodes)) {
          throw new Error('Invalid Chunk4: missing or invalid nodes array');
        }

        if (!data.root_id) {
          throw new Error('Invalid Chunk4: missing root_id');
        }

        if (data.meta && data.nodes.length !== data.meta.total_nodes) {
          console.warn(`Chunk4 node count mismatch: meta claims ${data.meta.total_nodes} but found ${data.nodes.length} nodes`);
        }

        // Validate root_id exists in nodes
        if (!data.nodes.find(n => n.id === data.root_id)) {
          throw new Error(`Chunk4 root node "${data.root_id}" not found in chunk nodes`);
        }

        // Chunk4-specific content validation
        const hasVelocityContent = data.nodes.some(node =>
          node.body_md?.includes('137,000') ||
          node.body_md?.includes('velocity') ||
          node.body_md?.includes('kinematic')
        );

        const hasAgeContent = data.nodes.some(node =>
          node.body_md?.includes('billion years') ||
          node.body_md?.includes('age') ||
          node.body_md?.includes('formation')
        );

        const hasDiscoveryContent = data.nodes.some(node =>
          node.body_md?.includes('ATLAS') ||
          node.body_md?.includes('telescope') ||
          node.body_md?.includes('discovery')
        );

        if (!hasVelocityContent || !hasAgeContent || !hasDiscoveryContent) {
          console.warn('Chunk4 may be missing expected velocity/age/discovery content');
        }

        setNarrativeTree(data);

        // Initialize tokens from chunk configuration
        if (data.tokens?.chrono?.start) {
          setGameState(prev => ({
            ...prev,
            chronoTokens: data.tokens.chrono.start
          }));
        }

        console.log(`Successfully loaded Chunk4: ${data.meta?.title || 'Unknown'} with ${data.nodes.length} nodes`);
      } catch (err) {
        console.error('Chunk4 loading failed:', err);
        const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
        setChunkLoadError(`Failed to load Chunk4 content: ${errorMessage}`);

        // Set generic error state for UI
        setError('Narrative content unavailable');

        // Attempt fallback to default chunk if multi-chunk is enabled
        if (enableMultiChunk && narrativeChunk !== 'narrative_tree_complete_12_nodes.json') {
          console.log('Attempting fallback to default chunk from Chunk4...');
        }
      }
    };

    loadNarrativeTree();
  }, [narrativeChunk, enableMultiChunk]);

  // Get current stage from loaded narrative tree
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

  // Enhanced behavioral trait analysis for kinematic/chronological choices
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

    // Analytical choices (including kinematic and chronological)
    if (choiceText.includes('analyze') || choiceText.includes('study') || choiceText.includes('research') ||
        choiceId.includes('scientific') || choiceId.includes('kinematic') || choiceId.includes('velocity') ||
        choiceId.includes('age') || choiceId.includes('discovery')) {
      updatedState = bumpTrait(updatedState, 'analyst', 3); // Higher increment for technical analysis
    }

    // Precision-focused choices (velocity/age analysis)
    if (choiceText.includes('precise') || choiceText.includes('accurate') || choiceText.includes('verify') ||
        choiceId.includes('velocity') || choiceId.includes('age')) {
      updatedState = bumpTrait(updatedState, 'pragmatist', 2);
    }

    // Discovery and exploration mindset
    if (choiceText.includes('discover') || choiceText.includes('explore') || choiceText.includes('reveal') ||
        choiceId.includes('discovery')) {
      updatedState = bumpTrait(updatedState, 'idealist', 2);
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

  // Enhanced choice making with chunk4-specific handling
  const makeChoice = useCallback(async (choice: Choice) => {
    if (isTransitioning) return;

    // Check requirements
    if (!checkRequirements(choice.requires)) {
      console.warn('Chunk4 choice requirements not met:', choice.requires);
      return;
    }

    // Check token cost
    if (choice.cost && gameState.chronoTokens < choice.cost) {
      console.warn('Insufficient tokens for Chunk4 choice:', choice.label, 'Cost:', choice.cost, 'Available:', gameState.chronoTokens);
      return;
    }

    setIsTransitioning(true);

    // Track analytics event locally
    const analyticsEvent: AnalyticsEvent = {
      eventType: 'choice_made',
      stageId: gameState.currentStage,
      choiceText: choice.label,
      traits: choice.grants?.filter(g => g.startsWith('trait_')),
      timestamp: new Date().toISOString(),
      userId: 'local_user'
    };

    // Store analytics locally
    try {
      const events = JSON.parse(localStorage.getItem('atlas-analytics') || '[]');
      events.push(analyticsEvent);
      localStorage.setItem('atlas-analytics', JSON.stringify(events.slice(-100)));
    } catch (storageError) {
      console.warn('Failed to store Chunk4 analytics event:', storageError);
    }

    // Process choice after transition delay
    setTimeout(() => {
      try {
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

          try {
            const events = JSON.parse(localStorage.getItem('atlas-analytics') || '[]');
            events.push(completionEvent);
            localStorage.setItem('atlas-analytics', JSON.stringify(events.slice(-100)));
          } catch (storageError) {
            console.warn('Failed to store Chunk4 completion event:', storageError);
          }
        }
      } catch (error) {
        console.error('Error processing Chunk4 choice:', error);
        setError('Error processing choice. Please try again.');
      } finally {
        setIsTransitioning(false);
      }
    }, 400);
  }, [isTransitioning, checkRequirements, gameState, narrativeTree, onOutcomeDetermined, bumpTrait, applyBehavioralTraits]);

  // Use chrono token to reset to previous stage
  const useChrono = useCallback((targetStageId: string) => {
    if (gameState.chronoTokens > 0) {
      setGameState(prev => ({
        ...prev,
        currentStage: targetStageId,
        chronoTokens: prev.chronoTokens - 1
      }));
    }
  }, [gameState.chronoTokens]);

  // Enhanced error state rendering with chunk4-specific information
  if (error || chunkLoadError) {
    return (
      <div className={`atlas-directive ${className}`}>
        <div className="narrative-error">
          <div className="error-content">
            <h3>⚠️ System Status</h3>
            <p>{error || chunkLoadError}</p>
            {chunkLoadError && (
              <div className="error-details">
                <p>Chunk4: {narrativeChunk}</p>
                <button onClick={() => window.location.reload()}>
                  Retry Loading Chunk4
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Enhanced loading state with chunk4 information
  if (!narrativeTree || !currentStage) {
    return (
      <div className={`atlas-directive ${className}`}>
        <div className="loading-state">
          <div className="loading-spinner">
            <div className="orbit-animation"></div>
          </div>
          <p>Loading Chunk4: Velocity, Age & Discovery Analysis...</p>
          {narrativeChunk && (
            <p className="loading-chunk">Chunk: {narrativeChunk}</p>
          )}
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
                <h3>🎯 Chunk4 Analysis Complete</h3>
                <p>Velocity, Age & Discovery analysis concluded.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Enhanced Side Panel UI for Chunk4 */}
      <div className="ui-sidebar">
        {/* Chrono Tokens */}
        <div className="token-display">
          <h4>Chunk4 Tokens</h4>
          <div className="token-count">
            {'⧗'.repeat(gameState.chronoTokens)}
            <span className="token-number">{gameState.chronoTokens}</span>
          </div>
          {narrativeTree.tokens?.chrono?.earn_rules && (
            <div className="token-rules">
              <small>Earn: {narrativeTree.tokens.chrono.earn_rules.map(r => `${r.action} (+${r.amount})`).join(', ')}</small>
            </div>
          )}
        </div>

        {/* Chunk4-Specific Achievement Display */}
        <div className="achievement-display">
          <h4>Chunk4 Achievements</h4>
          <div className="achievement-count">
            {gameState.userProfile.flags?.length || 0} unlocked
          </div>
          {gameState.userProfile.flags && gameState.userProfile.flags.length > 0 && (
            <div className="achievement-list">
              {gameState.userProfile.flags.filter(flag =>
                flag.includes('velocity') ||
                flag.includes('age') ||
                flag.includes('discovery') ||
                flag.includes('kinematic')
              ).slice(-3).map(flag => (
                <div key={flag} className="achievement-flag">🏆 {flag.replace(/_/g, ' ')}</div>
              ))}
            </div>
          )}
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

        {/* Enhanced Chunk4 Mission Stats */}
        <div className="mission-stats">
          <h4>Chunk4 Progress</h4>
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
          {narrativeTree.meta && (
            <div className="stat-row">
              <span>Chunk Progress:</span>
              <span>{gameState.completedStages.length}/{narrativeTree.meta.total_nodes}</span>
            </div>
          )}
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
            ⧗ Use Chunk4 Token
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
            <p>Processing Chunk4 analysis...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default AtlasDirective;