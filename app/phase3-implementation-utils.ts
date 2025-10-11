// Enhanced OrbitControls Integration for Atlas3DTrackerEnhanced
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import * as THREE from 'three';

// Custom Controls Extension for Narrative Integration
export class NarrativeOrbitControls extends OrbitControls {
  private narrativeMode = false;
  private originalSettings: {
    enableZoom: boolean;
    enableRotate: boolean;
    enablePan: boolean;
    autoRotate: boolean;
  };

  constructor(camera: THREE.Camera, domElement: HTMLElement) {
    super(camera, domElement);
    
    // Store original settings
    this.originalSettings = {
      enableZoom: this.enableZoom,
      enableRotate: this.enableRotate,
      enablePan: this.enablePan,
      autoRotate: this.autoRotate
    };

    // Configure for Atlas experience
    this.enableDamping = true;
    this.dampingFactor = 0.05;
    this.screenSpacePanning = false;
    this.minDistance = 3;
    this.maxDistance = 100;
    this.maxPolarAngle = Math.PI;
  }

  // Enable narrative mode - restrict user control during animations
  setNarrativeMode(enabled: boolean) {
    this.narrativeMode = enabled;
    
    if (enabled) {
      this.enableZoom = false;
      this.enableRotate = false;
      this.enablePan = false;
    } else {
      this.enableZoom = this.originalSettings.enableZoom;
      this.enableRotate = this.originalSettings.enableRotate;
      this.enablePan = this.originalSettings.enablePan;
    }
  }

  // Smooth transition to target position
  transitionTo(
    targetPosition: THREE.Vector3, 
    targetTarget: THREE.Vector3, 
    duration: number = 1500
  ): Promise<void> {
    return new Promise((resolve) => {
      const startPosition = this.object.position.clone();
      const startTarget = this.target.clone();
      const startTime = Date.now();

      this.setNarrativeMode(true);

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeProgress = this.easeInOutCubic(progress);

        this.object.position.lerpVectors(startPosition, targetPosition, easeProgress);
        this.target.lerpVectors(startTarget, targetTarget, easeProgress);
        this.update();

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          this.setNarrativeMode(false);
          resolve();
        }
      };

      animate();
    });
  }

  private easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
  }
}

// Package.json dependencies needed
export const requiredDependencies = {
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0", 
    "three": "^0.158.0",
    "@types/three": "^0.158.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "typescript": "^5.0.0"
  }
};

// Next.js configuration for Three.js
export const nextConfigAdditions = `
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable transpilation of three.js modules
  transpilePackages: ['three'],
  
  // Webpack configuration for Three.js
  webpack: (config) => {
    // Handle Three.js examples
    config.resolve.alias = {
      ...config.resolve.alias,
      'three/examples/jsm': 'three/examples/jsm'
    };
    
    return config;
  },
  
  // Experimental features
  experimental: {
    esmExternals: 'loose'
  }
};

module.exports = nextConfig;
`;

// Directory structure for Phase 3
export const phase3DirectoryStructure = `
/Users/kfitz/3iatlas/
├── components/
│   ├── atlas-directive/
│   │   ├── AtlasDirective.tsx ✅
│   │   └── AtlasDirective.module.css ✅
│   ├── Atlas3DTrackerEnhanced.tsx ✅ (NEW)
│   └── NarrativeOrbitControls.ts ✅ (NEW)
├── lib/
│   ├── narrative-3d-integration.ts ✅ (NEW)
│   ├── horizons-api.ts (EXISTING)
│   └── horizons-cache.ts (EXISTING)
├── types/
│   └── atlas-directive-types.ts ✅
├── data/
│   └── narrative_tree.json ✅
├── app/
│   └── page.tsx (UPDATE NEEDED)
└── docs/
    ├── animation_mappings.md ✅
    ├── 3d_integration.md (EXISTING)
    └── phase3_integration_guide.md ✅ (NEW)
`;

// Installation script
export const installationScript = `#!/bin/bash
# Phase 3 Installation Script

echo "Installing Phase 3 - 3D Integration Dependencies..."

# Install Three.js and types
npm install three@^0.158.0 @types/three@^0.158.0

# Install additional dev dependencies if needed
npm install -D @types/react@^18.2.0 @types/react-dom@^18.2.0

echo "Dependencies installed successfully!"
echo ""
echo "Next steps:"
echo "1. Copy Atlas3DTrackerEnhanced.tsx to components/"
echo "2. Copy narrative-3d-integration.ts to lib/"
echo "3. Update app/page.tsx with integration example"
echo "4. Test narrative → 3D communication"
echo ""
echo "Phase 3 ready for testing!"
`;

// Testing checklist
export const phase3TestingChecklist = `
# Phase 3 Testing Checklist

## ✅ Basic Integration
- [ ] Atlas3DTrackerEnhanced renders without errors
- [ ] AtlasDirective loads and displays narrative tree
- [ ] No TypeScript compilation errors
- [ ] No console errors on initial load

## ✅ Narrative → 3D Communication
- [ ] Choice selection triggers onOutcomeDetermined
- [ ] CinematicPayload properly formatted
- [ ] 3D tracker receives narrativeAction prop
- [ ] Animation state updates correctly

## ✅ Camera View Switching
- [ ] default view works
- [ ] followComet view tracks comet
- [ ] topDown provides overview
- [ ] closeup focuses on comet
- [ ] rideComet gives immersive experience
- [ ] Smooth transitions between views

## ✅ Timeline Control
- [ ] seekToPercentage updates comet position
- [ ] seekToDate works for specific dates
- [ ] Perihelion date (2025-10-28) triggers special sequence
- [ ] Timeline seeking doesn't break animation

## ✅ Visual Effects
- [ ] Glow effects apply correctly
- [ ] Trail effects render properly
- [ ] Color changes work (glow: '#ff4444', etc.)
- [ ] Effects cleanup when animation ends

## ✅ Animation Key Mapping
- [ ] mission_start animation works
- [ ] error_state shows red warning
- [ ] perihelion_final triggers dramatic sequence
- [ ] first_contact creates appropriate effect
- [ ] All ending animations work correctly

## ✅ Performance
- [ ] Smooth 60fps animation
- [ ] No memory leaks during long sessions
- [ ] Animation queue prevents overwhelming
- [ ] Performance monitoring reports good FPS
- [ ] Mobile performance acceptable

## ✅ Error Handling
- [ ] Graceful fallback if 3D fails to load
- [ ] Animation errors don't crash app
- [ ] Invalid animation keys handled safely
- [ ] Network issues don't break experience

## ✅ User Experience
- [ ] Narrative choices feel connected to 3D
- [ ] Camera transitions feel natural
- [ ] Visual feedback for important moments
- [ ] No jarring or disorienting effects
- [ ] Accessible on mobile devices
`;