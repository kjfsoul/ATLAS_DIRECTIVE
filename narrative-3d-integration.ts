// Event Bus for Narrative ↔ 3D Communication
class NarrativeEventBus {
  private listeners: Map<string, Array<(data: any) => void>> = new Map();

  subscribe(event: string, callback: (data: any) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  unsubscribe(event: string, callback: (data: any) => void) {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      const index = eventListeners.indexOf(callback);
      if (index > -1) {
        eventListeners.splice(index, 1);
      }
    }
  }

  emit(event: string, data?: any) {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  clear() {
    this.listeners.clear();
  }
}

// Singleton instance
export const narrativeEventBus = new NarrativeEventBus();

// Event Types
export interface NarrativeEvent {
  type: 'animation_trigger' | 'camera_change' | 'timeline_seek' | 'effect_apply';
  payload: any;
  timestamp: number;
  source: 'narrative' | '3d_tracker';
}

// Animation Key Mappings for 3D Integration
type AnimationConfig = {
  duration: number;
  camera: string;
  effects: { glow: boolean | string; trail: boolean };
  description: string;
  seekDate?: string;
};

export const animationKeyMappings: Record<string, AnimationConfig> = {
  // Mission Flow
  'mission_start': {
    duration: 2000,
    camera: 'default',
    effects: { glow: false, trail: false },
    description: 'Initial mission briefing - gentle intro'
  },
  
  // Skill Checks
  'error_state': {
    duration: 1500,
    camera: 'closeup',
    effects: { glow: '#ff4444', trail: false },
    description: 'Analysis error - red warning effect'
  },
  
  // Path Selection
  'specialization_choice': {
    duration: 3000,
    camera: 'topDown',
    effects: { glow: true, trail: false },
    description: 'Path selection - overview perspective'
  },
  
  // Scientific Path
  'scientific_analysis': {
    duration: 2500,
    camera: 'closeup',
    effects: { glow: '#00ffff', trail: true },
    description: 'Scientific analysis - detailed view with data trail'
  },
  
  'breakthrough_discovery': {
    duration: 4000,
    camera: 'rideComet',
    effects: { glow: '#ffff00', trail: true },
    description: 'Major discovery - dramatic close experience'
  },
  
  // Anomaly Path
  'anomaly_detected': {
    duration: 2000,
    camera: 'followComet',
    effects: { glow: '#9C27B0', trail: true },
    description: 'Anomaly detection - tracking mysterious signals'
  },
  
  'artificial_signals_detected': {
    duration: 3500,
    camera: 'closeup',
    effects: { glow: '#ff00ff', trail: true },
    description: 'Artificial signals - intense focus on comet'
  },
  
  'first_contact_transmission': {
    duration: 5000,
    camera: 'rideComet',
    effects: { glow: '#00ff00', trail: true },
    description: 'First contact attempt - immersive transmission'
  },
  
  'mathematical_response': {
    duration: 4000,
    camera: 'followComet',
    effects: { glow: '#ffaa00', trail: true },
    description: 'Mathematical response received'
  },
  
  // Golden Path
  'golden_revelation_1': {
    duration: 6000,
    camera: 'rideComet',
    effects: { glow: '#ffd700', trail: true },
    description: 'First golden path revelation'
  },
  
  'consciousness_network': {
    duration: 7000,
    camera: 'topDown',
    effects: { glow: '#ffd700', trail: true },
    description: 'Consciousness network visualization'
  },
  
  'three_visitors_unity': {
    duration: 8000,
    camera: 'rideComet',
    effects: { glow: '#ffd700', trail: true },
    description: 'Three visitors unity revelation'
  },
  
  'cosmic_purpose_revealed': {
    duration: 10000,
    camera: 'followComet',
    effects: { glow: '#ffd700', trail: true },
    description: 'Ultimate cosmic purpose revealed'
  },
  
  'final_cosmic_choice': {
    duration: 12000,
    camera: 'rideComet',
    effects: { glow: '#ffffff', trail: true },
    description: 'Final cosmic choice - maximum drama'
  },
  
  // Geopolitical Path
  'geopolitical_activation': {
    duration: 2500,
    camera: 'topDown',
    effects: { glow: '#2196F3', trail: false },
    description: 'Geopolitical phase - global overview'
  },
  
  'global_unity': {
    duration: 4000,
    camera: 'topDown',
    effects: { glow: '#4CAF50', trail: true },
    description: 'International cooperation achieved'
  },
  
  // Intervention Path
  'intervention_planning': {
    duration: 3000,
    camera: 'followComet',
    effects: { glow: '#FF5722', trail: false },
    description: 'Active intervention planning'
  },
  
  'mission_preparation': {
    duration: 3500,
    camera: 'closeup',
    effects: { glow: '#FF9800', trail: true },
    description: 'Mission preparation - technical focus'
  },
  
  // Major Events
  'solar_flare_warning': {
    duration: 3000,
    camera: 'topDown',
    effects: { glow: '#ff6600', trail: false },
    description: 'Solar flare crisis event'
  },
  
  'magnetic_breakthrough': {
    duration: 4500,
    camera: 'rideComet',
    effects: { glow: '#00aaff', trail: true },
    description: 'Magnetic field discovery'
  },
  
  // Perihelion Sequence
  'perihelion_convergence': {
    duration: 8000,
    camera: 'followComet',
    effects: { glow: '#ffaa00', trail: true },
    description: 'Perihelion approach - maximum intensity',
    seekDate: '2025-10-28'
  },
  
  'perihelion_final': {
    duration: 10000,
    camera: 'rideComet',
    effects: { glow: '#ffffff', trail: true },
    description: 'Final perihelion moment',
    seekDate: '2025-10-28'
  },
  
  // Endings
  'prime_revelation': {
    duration: 15000,
    camera: 'rideComet',
    effects: { glow: '#ffd700', trail: true },
    description: 'Prime Anomaly - Legendary ending'
  },
  
  'warning_cascade': {
    duration: 6000,
    camera: 'topDown',
    effects: { glow: '#ff4444', trail: true },
    description: 'The Warning - Epic ending'
  },
  
  'first_contact': {
    duration: 8000,
    camera: 'followComet',
    effects: { glow: '#00ff88', trail: true },
    description: 'First Contact - Rare ending'
  },
  
  'artifact_reveal': {
    duration: 5000,
    camera: 'closeup',
    effects: { glow: '#aa88ff', trail: false },
    description: 'The Artifact - Rare ending'
  },
  
  'biological_awakening': {
    duration: 7000,
    camera: 'rideComet',
    effects: { glow: '#00ff00', trail: true },
    description: 'Cosmic Awakening - Rare ending'
  },
  
  'tech_advance': {
    duration: 4000,
    camera: 'topDown',
    effects: { glow: '#00aaff', trail: true },
    description: 'Tech Revolution - Uncommon ending'
  },
  
  'catalyst_effect': {
    duration: 3500,
    camera: 'closeup',
    effects: { glow: '#ffff00', trail: false },
    description: 'The Catalyst - Uncommon ending'
  },
  
  'mentorship': {
    duration: 6000,
    camera: 'followComet',
    effects: { glow: '#9966ff', trail: true },
    description: 'Cosmic Mentorship - Uncommon ending'
  },
  
  'unity_achieved': {
    duration: 4500,
    camera: 'topDown',
    effects: { glow: '#4CAF50', trail: false },
    description: 'International Unity - Uncommon ending'
  },
  
  'messenger_departure': {
    duration: 5000,
    camera: 'followComet',
    effects: { glow: '#00ffff', trail: true },
    description: 'The Messenger - Common ending'
  },
  
  'study_complete': {
    duration: 3000,
    camera: 'topDown',
    effects: { glow: '#88aaff', trail: false },
    description: 'Comprehensive Study - Common ending'
  }
};

// Helper function to get animation config
export const getAnimationConfig = (animation_key: string): AnimationConfig => {
  return animationKeyMappings[animation_key] || {
    duration: 2000,
    camera: 'default',
    effects: { glow: false, trail: false },
    description: 'Default animation'
  };
};

// Performance monitoring
export class AnimationPerformanceMonitor {
  private frameCount = 0;
  private lastTime = 0;
  private fps = 0;
  
  update() {
    const now = performance.now();
    this.frameCount++;
    
    if (now >= this.lastTime + 1000) {
      this.fps = Math.round((this.frameCount * 1000) / (now - this.lastTime));
      this.frameCount = 0;
      this.lastTime = now;
    }
  }
  
  getFPS() {
    return this.fps;
  }
  
  shouldReduceQuality() {
    return this.fps < 30; // Reduce quality if below 30fps
  }
}

// Safe animation queue to prevent overwhelming the 3D loop
export class AnimationQueue {
  private queue: NarrativeEvent[] = [];
  private processing = false;
  private maxQueueSize = 10;
  
  enqueue(event: NarrativeEvent) {
    if (this.queue.length >= this.maxQueueSize) {
      console.warn('Animation queue full, dropping oldest event');
      this.queue.shift();
    }
    
    this.queue.push(event);
    this.processQueue();
  }
  
  private async processQueue() {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;
    
    while (this.queue.length > 0) {
      const event = this.queue.shift()!;
      
      try {
        await this.processEvent(event);
        // Small delay to prevent overwhelming the render loop
        await new Promise(resolve => setTimeout(resolve, 16)); // ~60fps spacing
      } catch (error) {
        console.error('Error processing animation event:', error);
      }
    }
    
    this.processing = false;
  }
  
  private async processEvent(event: NarrativeEvent): Promise<void> {
    return new Promise((resolve) => {
      const config = getAnimationConfig(event.payload.animation_key);
      
      // Emit to 3D tracker
      narrativeEventBus.emit('animation_request', {
        ...event.payload,
        config
      });
      
      // Wait for animation duration
      setTimeout(resolve, Math.min(config.duration, 1000)); // Cap at 1 second for queue processing
    });
  }
  
  clear() {
    this.queue = [];
    this.processing = false;
  }
  
  getQueueLength() {
    return this.queue.length;
  }
}

// Singleton instances
export const animationQueue = new AnimationQueue();
export const performanceMonitor = new AnimationPerformanceMonitor();
