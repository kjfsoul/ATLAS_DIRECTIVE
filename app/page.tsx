// ATLAS Directive - Main Application Page
'use client';
import React, { useState } from 'react';
import { AtlasDirective } from './components/AtlasDirective';
import { Atlas3DTrackerEnhanced } from './components/Atlas3DTrackerEnhanced';
import type { CinematicPayload, TrackerNarrativeAction } from './components/atlas-directive-types-complete';

export default function HomePage() {
  const [narrativeAction, setNarrativeAction] = useState<TrackerNarrativeAction | undefined>();

  // Handle narrative outcomes and pass to 3D tracker
  const handleOutcomeDetermined = (payload: CinematicPayload) => {
    const actionWithMetadata: TrackerNarrativeAction = {
      ...payload,
      timestamp: new Date().toISOString(),
      source: 'narrative_engine'
    };

    setNarrativeAction(actionWithMetadata);
  };

  const handleAnimationComplete = (animation_key: string) => {
    console.log(`Animation completed: ${animation_key}`);
    // Clear narrative action when animation completes
    setNarrativeAction(undefined);
    // Optional: Track completion or trigger follow-up actions
  };

  return (
    <div className="app-container">
      {/* 3D Tracker - Main Visual Experience */}
      <div className="tracker-container">
        <Atlas3DTrackerEnhanced
          narrativeAction={narrativeAction}
          onAnimationComplete={handleAnimationComplete}
        />
      </div>

      {/* Atlas Directive - Narrative Panel */}
      <div className="narrative-container">
        <AtlasDirective
          onOutcomeDetermined={handleOutcomeDetermined}
          className="narrative-overlay"
        />
      </div>
    </div>
  );
}
