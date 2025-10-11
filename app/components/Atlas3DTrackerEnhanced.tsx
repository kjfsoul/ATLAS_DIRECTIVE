// Enhanced Atlas3DTrackerEnhanced.tsx - Phase 3: 3D Integration
import React, { useRef, useEffect, useState, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { TrackerNarrativeAction } from './atlas-directive-types-complete';

export interface Atlas3DTrackerEnhancedProps {
  startDate?: string;
  endDate?: string;
  stepSize?: string;
  autoPlay?: boolean;
  playbackSpeed?: number;
  showOrbitalPath?: boolean;
  narrativeAction?: TrackerNarrativeAction;
  onAnimationComplete?: (animation_key: string) => void;
  className?: string;
}

interface CameraPreset {
  position: THREE.Vector3;
  target: THREE.Vector3;
  fov?: number;
}

interface AnimationState {
  isActive: boolean;
  startTime: number;
  duration: number;
  animation_key: string;
  onComplete?: () => void;
}

export const Atlas3DTrackerEnhanced: React.FC<Atlas3DTrackerEnhancedProps> = ({
  startDate = '2025-10-01',
  endDate = '2025-10-31',
  stepSize = '6h',
  autoPlay = true,
  playbackSpeed = 1,
  showOrbitalPath = true,
  narrativeAction,
  onAnimationComplete,
  className = ''
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene>();
  const rendererRef = useRef<THREE.WebGLRenderer>();
  const cameraRef = useRef<THREE.PerspectiveCamera>();
  const controlsRef = useRef<any>(); // OrbitControls
  const animationFrameRef = useRef<number>();
  const performanceRef = useRef({
    frameCount: 0,
    lastTime: 0,
    fps: 60,
    lowPerformanceStart: 0,
    pixelRatio: 1.5
  });
  
  // 3D Objects
  const sunRef = useRef<THREE.Mesh>();
  const atlasRef = useRef<THREE.Mesh>();
  const orbitalPathRef = useRef<THREE.Line>();
  const effectsRef = useRef<{
    glow?: THREE.Mesh;
    trail?: THREE.Line;
    particles?: THREE.Points;
  }>({});

  // Animation State
  const [animationState, setAnimationState] = useState<AnimationState | null>(null);
  const [currentView, setCurrentView] = useState<string>('default');
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Camera Presets
  const cameraPresets = useMemo<Record<string, CameraPreset>>(() => ({
    default: {
      position: new THREE.Vector3(0, 10, 30),
      target: new THREE.Vector3(0, 0, 0),
      fov: 50
    },
    followComet: {
      position: new THREE.Vector3(5, 3, 8),
      target: new THREE.Vector3(0, 0, 0), // Will be updated to comet position
      fov: 45
    },
    topDown: {
      position: new THREE.Vector3(0, 50, 0),
      target: new THREE.Vector3(0, 0, 0),
      fov: 60
    },
    closeup: {
      position: new THREE.Vector3(2, 1, 3),
      target: new THREE.Vector3(0, 0, 0),
      fov: 35
    },
    rideComet: {
      position: new THREE.Vector3(0.5, 0.2, 0.8),
      target: new THREE.Vector3(0, 0, 0),
      fov: 40
    }
  }), []);

  // Initialize Three.js Scene
  useEffect(() => {
    if (!mountRef.current) return;

    // Scene Setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0a);
    sceneRef.current = scene;

    // Camera Setup
    const camera = new THREE.PerspectiveCamera(
      50,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 10, 30);
    cameraRef.current = camera;

    // Renderer Setup with Performance Optimization
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);

    // Mobile performance guard - cap pixel ratio for better performance
    const optimalPixelRatio = Math.min(window.devicePixelRatio, 1.5);
    performanceRef.current.pixelRatio = optimalPixelRatio;
    renderer.setPixelRatio(optimalPixelRatio);

    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    mountRef.current.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
    scene.add(ambientLight);

    const sunLight = new THREE.PointLight(0xffff88, 2, 100);
    sunLight.position.set(0, 0, 0);
    sunLight.castShadow = true;
    scene.add(sunLight);

    // Create Sun
    const sunGeometry = new THREE.SphereGeometry(1, 32, 32);
    const sunMaterial = new THREE.MeshBasicMaterial({
      color: 0xffff00
    });
    const sun = new THREE.Mesh(sunGeometry, sunMaterial);
    scene.add(sun);
    sunRef.current = sun;

    // Create Sun Glow Effect
    const glowGeometry = new THREE.SphereGeometry(1.2, 32, 32);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0xffff00,
      transparent: true,
      opacity: 0.3,
      side: THREE.BackSide
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    scene.add(glow);
    effectsRef.current.glow = glow;

    // Create 3I/ATLAS
    const atlasGeometry = new THREE.SphereGeometry(0.1, 16, 16);
    const atlasMaterial = new THREE.MeshPhongMaterial({
      color: 0x00ffff,
      emissive: 0x004444,
      shininess: 100
    });
    const atlas = new THREE.Mesh(atlasGeometry, atlasMaterial);
    atlas.position.set(10, 0, 0);
    atlas.castShadow = true;
    scene.add(atlas);
    atlasRef.current = atlas;

    // Grid Helper
    const gridHelper = new THREE.GridHelper(50, 20, 0x333333, 0x333333);
    scene.add(gridHelper);

    // Controls - SSR-safe OrbitControls setup
    if (typeof window !== 'undefined') {
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.screenSpacePanning = false;
      controls.minDistance = 5;
      controls.maxDistance = 100;
      controls.maxPolarAngle = Math.PI;
      controlsRef.current = controls;
    }

    // Performance monitoring and quality adjustment
    const updatePerformance = () => {
      const now = performance.now();
      performanceRef.current.frameCount++;

      if (now >= performanceRef.current.lastTime + 1000) {
        performanceRef.current.fps = Math.round((performanceRef.current.frameCount * 1000) / (now - performanceRef.current.lastTime));
        performanceRef.current.frameCount = 0;
        performanceRef.current.lastTime = now;

        // Auto-adjust quality based on performance
        if (performanceRef.current.fps < 30) {
          if (performanceRef.current.lowPerformanceStart === 0) {
            performanceRef.current.lowPerformanceStart = now;
          } else if (now - performanceRef.current.lowPerformanceStart > 1000) {
            // Drop pixel ratio if low FPS for > 1 second
            const newPixelRatio = Math.max(1.0, performanceRef.current.pixelRatio - 0.5);
            if (newPixelRatio !== performanceRef.current.pixelRatio) {
              performanceRef.current.pixelRatio = newPixelRatio;
              renderer.setPixelRatio(newPixelRatio);
              console.log(`Performance: Dropping pixel ratio to ${newPixelRatio} for better FPS`);
            }
          }
        } else {
          performanceRef.current.lowPerformanceStart = 0;
          // Restore quality if performance recovers
          if (performanceRef.current.pixelRatio < 1.5) {
            const newPixelRatio = Math.min(1.5, performanceRef.current.pixelRatio + 0.25);
            if (newPixelRatio !== performanceRef.current.pixelRatio) {
              performanceRef.current.pixelRatio = newPixelRatio;
              renderer.setPixelRatio(newPixelRatio);
              console.log(`Performance: Restoring pixel ratio to ${newPixelRatio}`);
            }
          }
        }
      }
    };

    // Animation Loop
    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);

      // Update performance monitoring
      updatePerformance();

      // Update controls if available
      if (controlsRef.current) {
        controlsRef.current.update();
      }

      // Handle active animations
      if (animationState) {
        handleActiveAnimation();
      }

      renderer.render(scene, camera);
    };

    animate();

    // Cleanup
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  // Handle Narrative Actions
  useEffect(() => {
    if (!narrativeAction || !sceneRef.current || !cameraRef.current) return;

    console.log('Processing narrative action:', narrativeAction);

    const { animation_key, view, seek_pct, date, fx } = narrativeAction;

    // Start animation sequence
    setAnimationState({
      isActive: true,
      startTime: Date.now(),
      duration: 2000, // 2 second transitions
      animation_key: animation_key || 'default',
      onComplete: () => {
        onAnimationComplete?.(animation_key || 'default');
        setAnimationState(null);
      }
    });

    // Handle camera view changes
    if (view && view !== currentView) {
      switchCameraView(view);
    }

    // Handle timeline seeking
    if (seek_pct !== undefined) {
      seekToPercentage(seek_pct);
    }

    if (date) {
      seekToDate(date);
    }

    // Handle visual effects
    if (fx) {
      applyVisualEffects(fx);
    }

  }, [narrativeAction, currentView, onAnimationComplete]);

  // Camera View Switching
  const switchCameraView = (targetView: string) => {
    if (!cameraRef.current || !controlsRef.current) return;

    const preset = cameraPresets[targetView];
    if (!preset) return;

    setIsTransitioning(true);
    setCurrentView(targetView);

    // Smooth camera transition
    const startPosition = cameraRef.current.position.clone();
    const startTarget = controlsRef.current.target.clone();
    const startFov = cameraRef.current.fov;

    let targetPosition = preset.position.clone();
    let targetTarget = preset.target.clone();

    // Special handling for followComet and rideComet views
    if ((targetView === 'followComet' || targetView === 'rideComet') && atlasRef.current) {
      const atlasPosition = atlasRef.current.position;
      const offset = preset.position.clone();
      targetPosition = atlasPosition.clone().add(offset);
      targetTarget = atlasPosition.clone();
    }

    // Animate camera transition
    const duration = 1500;
    const startTime = Date.now();

    const animateCamera = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeProgress = easeInOutCubic(progress);

      // Interpolate position and target
      cameraRef.current!.position.lerpVectors(startPosition, targetPosition, easeProgress);
      if (controlsRef.current) {
        controlsRef.current.target.lerpVectors(startTarget, targetTarget, easeProgress);
        controlsRef.current.update(); // Ensure controls are updated during transition
      }

      // Interpolate FOV
      if (preset.fov) {
        cameraRef.current!.fov = THREE.MathUtils.lerp(startFov, preset.fov, easeProgress);
        cameraRef.current!.updateProjectionMatrix();
      }

      if (progress < 1) {
        requestAnimationFrame(animateCamera);
      } else {
        setIsTransitioning(false);
      }
    };

    animateCamera();
  };

  // Timeline Seeking
  const seekToPercentage = (percentage: number) => {
    // Implementation would depend on your existing orbital data structure
    console.log(`Seeking to ${percentage}% of timeline`);
    // This would update the comet position based on percentage of orbital path
  };

  const seekToDate = (targetDate: string) => {
    console.log(`Seeking to date: ${targetDate}`);
    // This would update comet position based on specific date
    if (targetDate === '2025-10-28') {
      // Perihelion - closest approach animation
      triggerPerihelionSequence();
    }
  };

  // Visual Effects
  const applyVisualEffects = (fx: { trail?: boolean; glow?: boolean | string }) => {
    if (!sceneRef.current || !atlasRef.current) return;

    // Handle glow effect
    if (fx.glow && effectsRef.current.glow) {
      const glowColor = typeof fx.glow === 'string' ? fx.glow : '#00ffff';
      (effectsRef.current.glow.material as THREE.MeshBasicMaterial).color.setStyle(glowColor);
      effectsRef.current.glow.visible = true;
      
      // Animate glow intensity
      const glowMaterial = effectsRef.current.glow.material as THREE.MeshBasicMaterial;
      const startOpacity = glowMaterial.opacity;
      const targetOpacity = 0.6;
      
      animateProperty(startOpacity, targetOpacity, 1000, (value) => {
        glowMaterial.opacity = value;
      });
    }

    // Handle trail effect
    if (fx.trail) {
      createTrailEffect();
    }
  };

  // Animation Handlers
  const handleActiveAnimation = () => {
    if (!animationState) return;

    const elapsed = Date.now() - animationState.startTime;
    const progress = Math.min(elapsed / animationState.duration, 1);

    // Handle specific animation keys
    switch (animationState.animation_key) {
      case 'mission_start':
        handleMissionStartAnimation(progress);
        break;
      case 'perihelion_final':
        handlePerihelionAnimation(progress);
        break;
      case 'first_contact':
        handleFirstContactAnimation(progress);
        break;
      case 'error_state':
        handleErrorStateAnimation(progress);
        break;
      default:
        handleDefaultAnimation(progress);
    }

    // Complete animation
    if (progress >= 1) {
      animationState.onComplete?.();
    }
  };

  // Specific Animation Sequences
  const handleMissionStartAnimation = (progress: number) => {
    if (!atlasRef.current) return;
    
    // Gentle introduction - zoom to comet
    const scale = 1 + Math.sin(progress * Math.PI) * 0.1;
    atlasRef.current.scale.setScalar(scale);
  };

  const handlePerihelionAnimation = (progress: number) => {
    if (!atlasRef.current || !effectsRef.current.glow) return;
    
    // Dramatic perihelion sequence
    const intensity = 1 + Math.sin(progress * Math.PI * 4) * 0.3;
    effectsRef.current.glow.scale.setScalar(intensity);
  };

  const handleFirstContactAnimation = (progress: number) => {
    if (!atlasRef.current) return;
    
    // Pulsing effect for contact
    const pulse = 1 + Math.sin(progress * Math.PI * 8) * 0.2;
    atlasRef.current.scale.setScalar(pulse);
  };

  const handleErrorStateAnimation = (progress: number) => {
    if (!atlasRef.current) return;
    
    // Red error indication
    const material = atlasRef.current.material as THREE.MeshPhongMaterial;
    const errorColor = new THREE.Color(0xff4444);
    const normalColor = new THREE.Color(0x00ffff);
    material.color.lerpColors(normalColor, errorColor, Math.sin(progress * Math.PI * 6));
  };

  const handleDefaultAnimation = (progress: number) => {
    // Subtle default animation
    if (atlasRef.current) {
      atlasRef.current.rotation.y += 0.01;
    }
  };

  // Special Sequences
  const triggerPerihelionSequence = () => {
    console.log('Triggering perihelion sequence');
    
    // Switch to dramatic close-up view
    switchCameraView('closeup');
    
    // Enhanced visual effects
    applyVisualEffects({ glow: '#ffaa00', trail: true });
  };

  const createTrailEffect = () => {
    if (!atlasRef.current || !sceneRef.current) return;

    // Create trail geometry (simplified)
    const trailGeometry = new THREE.BufferGeometry();
    const trailMaterial = new THREE.LineBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.5
    });

    const trail = new THREE.Line(trailGeometry, trailMaterial);
    sceneRef.current.add(trail);
    effectsRef.current.trail = trail;
  };

  // Utility Functions
  const easeInOutCubic = (t: number): number => {
    return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
  };

  const animateProperty = (
    start: number, 
    end: number, 
    duration: number, 
    callback: (value: number) => void
  ) => {
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const value = THREE.MathUtils.lerp(start, end, easeInOutCubic(progress));
      
      callback(value);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    animate();
  };

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (!mountRef.current || !cameraRef.current || !rendererRef.current) return;

      const width = mountRef.current.clientWidth;
      const height = mountRef.current.clientHeight;

      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(width, height);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className={`atlas-3d-tracker-enhanced ${className}`}>
      <div 
        ref={mountRef} 
        className="tracker-canvas-container"
        style={{ width: '100%', height: '100%', position: 'relative' }}
      />
      
      {/* Overlay UI for debugging/info */}
      {animationState && (
        <div className="animation-overlay">
          <div className="animation-info">
            Animation: {animationState.animation_key}
          </div>
        </div>
      )}
      
      {isTransitioning && (
        <div className="transition-indicator">
          Transitioning to {currentView} view...
        </div>
      )}
    </div>
  );
};

export default Atlas3DTrackerEnhanced;
