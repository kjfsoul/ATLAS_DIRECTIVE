// Enhanced Achievement System with Production-Grade Requirements Engine
// Based on critique feedback - supports both flag-based and trait-based requirements

import React, { useState, useEffect } from 'react';
import type { GameState, Achievement, AnalyticsEvent } from './atlas-directive-types-complete';

// Production-ready requirement system
type TraitName = 
  | 'pragmatist' | 'mystic' | 'idealist' | 'cynic' 
  | 'risk_taker' | 'cautious' | 'leader' | 'analyst';

type Requirement = { 
  flag?: string; 
  trait?: { name: TraitName; gte: number } 
};

// Core requirement evaluation function
function meetsRequirements(requirements: Requirement[], state: GameState): boolean {
  return requirements.every(req => {
    if (req.flag) {
      return state.userProfile.flags?.includes(req.flag) ?? false;
    } else if (req.trait) {
      const traitValue = state.userProfile.traits[req.trait.name] ?? 0;
      return traitValue >= req.trait.gte;
    }
    return false;
  });
}

interface ProductionAchievementSystemProps {
  gameState: GameState;
  onAchievementUnlocked?: (achievement: Achievement) => void;
}

export const ProductionAchievementSystem: React.FC<ProductionAchievementSystemProps> = ({
  gameState,
  onAchievementUnlocked
}) => {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [recentUnlocks, setRecentUnlocks] = useState<Set<string>>(new Set());
  const [showUnlockToast, setShowUnlockToast] = useState<Achievement | null>(null);

  // Production-ready achievement definitions with mixed requirement types
  const achievementDefinitions: Achievement[] = [
    // Flag-based achievements (story progression)
    {
      id: 'mission_started',
      title: 'First Directive',
      description: 'Began the mission to investigate 3I/ATLAS',
      rarity: 'Common',
      requirements: [{ flag: 'mission_started' }],
      unlocked: false
    },
    {
      id: 'first_contact_attempt',
      title: 'Cosmic Communicator',
      description: 'Attempted to establish first contact with an alien intelligence',
      rarity: 'Epic',
      requirements: [
        { flag: 'first_contact_attempt' },
        { flag: 'artificial_signals' }
      ],
      unlocked: false
    },
    {
      id: 'prime_discovery',
      title: 'Prime Anomaly Discoverer',
      description: 'Unlocked the legendary Prime Anomaly ending',
      rarity: 'Legendary',
      requirements: [
        { flag: 'prime_discovery' },
        { flag: 'unity_comprehension' },
        { flag: 'cosmic_citizenship' }
      ],
      unlocked: false
    },

    // Trait-based achievements (psychological profile)
    {
      id: 'calculated_risk_taker',
      title: 'Calculated Risk-Taker',
      description: 'Balanced risk-taking with careful analysis',
      rarity: 'Uncommon',
      requirements: [
        { trait: { name: 'risk_taker', gte: 40 } },
        { trait: { name: 'analyst', gte: 30 } }
      ],
      unlocked: false
    },
    {
      id: 'visionary_leader',
      title: 'Visionary Leader',
      description: 'Demonstrated exceptional leadership and idealistic vision',
      rarity: 'Rare',
      requirements: [
        { trait: { name: 'leader', gte: 50 } },
        { trait: { name: 'idealist', gte: 40 } }
      ],
      unlocked: false
    },
    {
      id: 'mystical_pragmatist',
      title: 'Mystical Pragmatist',
      description: 'Combined intuitive wisdom with practical decision-making',
      rarity: 'Rare',
      requirements: [
        { trait: { name: 'mystic', gte: 35 } },
        { trait: { name: 'pragmatist', gte: 35 } }
      ],
      unlocked: false
    },

    // Mixed requirement achievements (flags + traits)
    {
      id: 'scientific_breakthrough',
      title: 'Scientific Breakthrough',
      description: 'Made a major discovery through analytical thinking',
      rarity: 'Rare',
      requirements: [
        { flag: 'breakthrough_discovery' },
        { trait: { name: 'analyst', gte: 45 } }
      ],
      unlocked: false
    },
    {
      id: 'diplomatic_unity',
      title: 'Diplomatic Unity',
      description: 'United global leadership through careful diplomacy',
      rarity: 'Epic',
      requirements: [
        { flag: 'global_leadership' },
        { flag: 'international_cooperation' },
        { trait: { name: 'leader', gte: 40 } },
        { trait: { name: 'cautious', gte: 25 } }
      ],
      unlocked: false
    },

    // Ending-based achievements
    {
      id: 'multiple_endings',
      title: 'Multiverse Explorer',
      description: 'Experienced multiple different story outcomes',
      rarity: 'Uncommon',
      requirements: [
        { flag: 'ending_common' },
        { flag: 'ending_uncommon' }
      ],
      unlocked: false
    },
    {
      id: 'perihelion_witness',
      title: 'Perihelion Witness',
      description: 'Observed 3I/ATLAS at its closest approach to the Sun',
      rarity: 'Uncommon',
      requirements: [{ flag: 'perihelion_observed' }],
      unlocked: false
    },

    // High-trait achievements
    {
      id: 'master_analyst',
      title: 'Master Analyst',
      description: 'Achieved exceptional analytical mastery',
      rarity: 'Rare',
      requirements: [{ trait: { name: 'analyst', gte: 70 } }],
      unlocked: false
    },
    {
      id: 'supreme_leader',
      title: 'Supreme Leader',
      description: 'Demonstrated unparalleled leadership capabilities',
      rarity: 'Epic',
      requirements: [{ trait: { name: 'leader', gte: 80 } }],
      unlocked: false
    }
  ];

  // Check for newly unlocked achievements (with deduplication)
  useEffect(() => {
    const updatedAchievements = achievementDefinitions.map(achievement => {
      const isUnlocked = meetsRequirements(achievement.requirements, gameState);
      
      // Check for new unlock (deduplicated)
      if (isUnlocked && !achievement.unlocked && !recentUnlocks.has(achievement.id)) {
        const unlockedAchievement = { ...achievement, unlocked: true };
        
        // Add to recent unlocks set for deduplication
        setRecentUnlocks(prev => new Set([...prev, achievement.id]));
        
        // Show unlock toast
        setShowUnlockToast(unlockedAchievement);
        setTimeout(() => setShowUnlockToast(null), 4000);
        
        // Notify parent component
        onAchievementUnlocked?.(unlockedAchievement);
        
        // Track achievement unlock
        trackAchievementUnlock(unlockedAchievement);
        
        return unlockedAchievement;
      }

      return { ...achievement, unlocked: isUnlocked };
    });

    setAchievements(updatedAchievements);
  }, [gameState.userProfile.flags, gameState.userProfile.traits]);

  const trackAchievementUnlock = (achievement: Achievement) => {
    const event: AnalyticsEvent = {
      eventType: 'achievement_unlocked',
      achievementId: achievement.id,
      achievementRarity: achievement.rarity,
      timestamp: new Date().toISOString(),
      userId: 'local_user'
    };

    // Store locally
    const events = JSON.parse(localStorage.getItem('atlas-analytics') || '[]');
    events.push(event);
    localStorage.setItem('atlas-analytics', JSON.stringify(events.slice(-100)));
  };

  // Calculate statistics
  const unlockedCount = achievements.filter(a => a.unlocked).length;
  const totalCount = achievements.length;
  const progressPercentage = (unlockedCount / totalCount) * 100;

  const rarityCount = achievements.reduce((acc, achievement) => {
    if (achievement.unlocked) {
      acc[achievement.rarity] = (acc[achievement.rarity] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  const getRarityColor = (rarity: string) => {
    const colors = {
      'Common': '#888888',
      'Uncommon': '#4CAF50',
      'Rare': '#2196F3', 
      'Epic': '#FF9800',
      'Legendary': '#FFD700'
    };
    return colors[rarity] || '#888888';
  };

  const getRarityIcon = (rarity: string) => {
    const icons = {
      'Common': '📋',
      'Uncommon': '🔸',
      'Rare': '💎',
      'Epic': '⭐',
      'Legendary': '👑'
    };
    return icons[rarity] || '📋';
  };

  return (
    <div className="production-achievement-system">
      {/* Achievement Summary */}
      <div className="achievement-header">
        <h3>Mission Achievements</h3>
        <div className="achievement-progress">
          <span className="progress-text">{unlockedCount}/{totalCount}</span>
          <div className="progress-bar">
            <div 
              className="progress-fill"
              style={{ 
                width: `${progressPercentage}%`,
                background: progressPercentage === 100 
                  ? 'linear-gradient(90deg, #FFD700, #FFA500)' 
                  : 'linear-gradient(90deg, #00ffff, #40e0d0)'
              }}
            />
          </div>
          <span className="progress-percentage">{Math.round(progressPercentage)}%</span>
        </div>
      </div>

      {/* Rarity Statistics */}
      <div className="rarity-stats">
        {Object.entries(rarityCount).map(([rarity, count]) => (
          <div key={rarity} className="rarity-stat">
            <span className="rarity-icon">{getRarityIcon(rarity)}</span>
            <span className="rarity-label">{rarity}</span>
            <span 
              className="rarity-count"
              style={{ color: getRarityColor(rarity) }}
            >
              {count}
            </span>
          </div>
        ))}
      </div>

      {/* Recent Achievements */}
      <div className="achievement-grid">
        {achievements
          .filter(a => a.unlocked)
          .slice(-6) // Show last 6 unlocked
          .map(achievement => (
            <div 
              key={achievement.id} 
              className={`achievement-card ${achievement.rarity.toLowerCase()}`}
            >
              <div className="achievement-icon">
                {getRarityIcon(achievement.rarity)}
              </div>
              <div className="achievement-content">
                <h4 className="achievement-title">{achievement.title}</h4>
                <p className="achievement-description">{achievement.description}</p>
                <span className={`achievement-rarity rarity-${achievement.rarity.toLowerCase()}`}>
                  {achievement.rarity}
                </span>
              </div>
            </div>
          ))}
      </div>

      {/* Unlock Toast Notification */}
      {showUnlockToast && (
        <div 
          className={`achievement-toast ${showUnlockToast.rarity.toLowerCase()}`}
          role="alert"
          aria-live="polite"
        >
          <div className="toast-icon">
            {getRarityIcon(showUnlockToast.rarity)}
          </div>
          <div className="toast-content">
            <h4>Achievement Unlocked!</h4>
            <h5>{showUnlockToast.title}</h5>
            <p>{showUnlockToast.description}</p>
          </div>
          <div className="toast-rarity">
            {showUnlockToast.rarity}
          </div>
        </div>
      )}

      {/* Debug Panel (development only) */}
      {process.env.NODE_ENV === 'development' && (
        <details className="debug-panel">
          <summary>🔧 Achievement Debug</summary>
          <div className="debug-content">
            <h5>Current Traits:</h5>
            <ul>
              {Object.entries(gameState.userProfile.traits).map(([trait, value]) => (
                <li key={trait}>
                  {trait}: {value}
                </li>
              ))}
            </ul>
            <h5>Current Flags:</h5>
            <ul>
              {gameState.userProfile.flags?.map(flag => (
                <li key={flag}>{flag}</li>
              )) || <li>None</li>}
            </ul>
          </div>
        </details>
      )}
    </div>
  );
};

// Enhanced CSS with accessibility and animation support
export const productionAchievementStyles = `
.production-achievement-system {
  display: grid;
  gap: 1.5rem;
  font-family: 'Inter', -apple-system, sans-serif;
  color: #e0e0e0;
}

.achievement-header {
  text-align: center;
  padding: 1.5rem;
  background: rgba(0, 255, 255, 0.05);
  border-radius: 12px;
  border: 1px solid rgba(0, 255, 255, 0.2);
}

.achievement-header h3 {
  margin: 0 0 1rem 0;
  color: #00ffff;
  font-size: 1.25rem;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.achievement-progress {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-top: 1rem;
}

.progress-text {
  color: #00ffff;
  font-weight: bold;
  min-width: 60px;
}

.progress-bar {
  flex: 1;
  height: 12px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1);
  border-radius: 6px;
}

.progress-percentage {
  color: #ffffff;
  font-weight: bold;
  min-width: 50px;
  text-align: right;
}

.rarity-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 1rem;
}

.rarity-stat {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.rarity-icon {
  font-size: 1.5rem;
}

.rarity-label {
  flex: 1;
  font-size: 0.9rem;
}

.rarity-count {
  font-weight: bold;
  font-size: 1.1rem;
}

.achievement-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1rem;
}

.achievement-card {
  display: flex;
  gap: 1rem;
  padding: 1.25rem;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 10px;
  border: 2px solid transparent;
  transition: all 0.3s ease;
  animation: achievement-unlock 0.6s ease-out;
}

.achievement-card:hover {
  transform: translateY(-2px);
  background: rgba(255, 255, 255, 0.05);
}

.achievement-card.common { border-color: #888888; }
.achievement-card.uncommon { border-color: #4CAF50; }
.achievement-card.rare { border-color: #2196F3; }
.achievement-card.epic { border-color: #FF9800; }
.achievement-card.legendary { 
  border-color: #FFD700; 
  box-shadow: 0 0 20px rgba(255, 215, 0, 0.3);
}

.achievement-icon {
  font-size: 2rem;
  display: flex;
  align-items: flex-start;
  padding-top: 0.25rem;
}

.achievement-content {
  flex: 1;
}

.achievement-title {
  margin: 0 0 0.5rem 0;
  color: #ffffff;
  font-size: 1rem;
  font-weight: 600;
}

.achievement-description {
  margin: 0 0 0.75rem 0;
  font-size: 0.85rem;
  color: #cccccc;
  line-height: 1.4;
}

.achievement-rarity {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.rarity-common { background: rgba(136, 136, 136, 0.2); color: #888888; }
.rarity-uncommon { background: rgba(76, 175, 80, 0.2); color: #4CAF50; }
.rarity-rare { background: rgba(33, 150, 243, 0.2); color: #2196F3; }
.rarity-epic { background: rgba(255, 152, 0, 0.2); color: #FF9800; }
.rarity-legendary { background: rgba(255, 215, 0, 0.2); color: #FFD700; }

/* Toast Notification */
.achievement-toast {
  position: fixed;
  top: 2rem;
  right: 2rem;
  display: flex;
  gap: 1rem;
  padding: 1.5rem;
  background: rgba(0, 0, 0, 0.9);
  border-radius: 12px;
  border: 2px solid;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  z-index: 1000;
  max-width: 400px;
  animation: toast-slide-in 0.5s ease-out;
}

.achievement-toast.legendary {
  border-color: #FFD700;
  background: rgba(255, 215, 0, 0.1);
  box-shadow: 0 8px 32px rgba(255, 215, 0, 0.3);
}

.toast-icon {
  font-size: 2.5rem;
}

.toast-content h4 {
  margin: 0 0 0.25rem 0;
  color: #00ffff;
  font-size: 0.9rem;
  text-transform: uppercase;
}

.toast-content h5 {
  margin: 0 0 0.5rem 0;
  color: #ffffff;
  font-size: 1.1rem;
}

.toast-content p {
  margin: 0;
  color: #cccccc;
  font-size: 0.85rem;
}

.toast-rarity {
  align-self: flex-start;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: bold;
  text-transform: uppercase;
  background: rgba(255, 255, 255, 0.1);
}

/* Debug Panel */
.debug-panel {
  margin-top: 2rem;
  padding: 1rem;
  background: rgba(255, 255, 0, 0.05);
  border: 1px solid rgba(255, 255, 0, 0.2);
  border-radius: 8px;
  font-size: 0.85rem;
}

.debug-panel summary {
  cursor: pointer;
  color: #ffff00;
  font-weight: bold;
}

.debug-content {
  margin-top: 1rem;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.debug-content ul {
  list-style: none;
  padding: 0;
  margin: 0.5rem 0 0 0;
}

.debug-content li {
  padding: 0.25rem 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

/* Animations */
@keyframes achievement-unlock {
  0% { opacity: 0; transform: scale(0.95); }
  50% { transform: scale(1.02); }
  100% { opacity: 1; transform: scale(1); }
}

@keyframes toast-slide-in {
  0% { transform: translateX(100%); opacity: 0; }
  100% { transform: translateX(0); opacity: 1; }
}

/* Accessibility */
@media (prefers-reduced-motion: reduce) {
  .achievement-card,
  .progress-fill,
  .achievement-toast {
    animation: none;
    transition: none;
  }
}

/* Mobile Responsive */
@media (max-width: 768px) {
  .achievement-toast {
    top: 1rem;
    right: 1rem;
    left: 1rem;
    max-width: none;
  }
  
  .rarity-stats {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .debug-content {
    grid-template-columns: 1fr;
  }
}
`;

export default ProductionAchievementSystem;
