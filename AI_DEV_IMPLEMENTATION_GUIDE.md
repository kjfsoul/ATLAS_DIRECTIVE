# ATLAS DIRECTIVE STAGING DEPLOYMENT - AI DEV IMPLEMENTATION GUIDE

## **PHASE 0: PREPARATION & CONTEXT**

### **🎯 MISSION OVERVIEW**
You are implementing The ATLAS Directive - an interactive narrative discovery platform that combines:
- **120-node branching narrative** about 3I/ATLAS (real interstellar comet)
- **Real-time 3D visualization** using NASA data and Three.js
- **Educational content** teaching astrophysics through engaging choices
- **Achievement system** with legendary Golden Path (<1% completion rate)

### **📁 CONTEXT FILES TO REVIEW FIRST**
1. **3I_ATLAS_KNOWLEDGE_BASE.md** - Scientific facts for validation
2. **The-ATLAS-Directive_-Final-Consolidated-Execution-Plan.md** - Project requirements
3. **3D_TRACKER_IMPLEMENTATION.md** - Existing 3D system architecture

---

## **STEP 1: PROJECT INITIALIZATION**

### **1.1 Verify Node.js Environment**
```bash
# Ensure Node.js 18+ is installed
node --version  # Must be >=18.0.0
npm --version   # Latest npm recommended
```

### **1.2 Install Dependencies**
```bash
# Core dependencies
npm install react@^18.2.0 react-dom@^18.2.0 next@^14.0.0
npm install three@^0.158.0 @types/three@^0.158.0
npm install clsx@^2.0.0 date-fns@^2.30.0

# Development dependencies  
npm install -D typescript@^5.0.0
npm install -D @types/node@^20.0.0 @types/react@^18.2.0 @types/react-dom@^18.2.0
npm install -D @testing-library/react@^14.0.0 @testing-library/jest-dom@^6.0.0
npm install -D eslint@^8.0.0 eslint-config-next@^14.0.0
```

### **1.3 Create Project Configuration Files**

**Create tsconfig.json:**
```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "ES6"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{"name": "next"}],
    "baseUrl": ".",
    "paths": {"@/*": ["./*"]}
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

**Create .env.local:**
```bash
ATLAS_VERSION=1.0.0
NODE_ENV=staging
NEXT_PUBLIC_ATLAS_DEBUG=true
```

---

## **STEP 2: CORE FILE PLACEMENT**

### **2.1 Create Directory Structure**
```bash
mkdir -p components/atlas-directive
mkdir -p lib
mkdir -p types
mkdir -p data
mkdir -p scripts
mkdir -p docs
```

### **2.2 File Placement Map** 
**CRITICAL: Place these generated files EXACTLY as specified:**

```bash
# Core application files
narrative_tree_complete_120_nodes.json → data/narrative_tree.json
atlas-directive-types-complete.ts → types/atlas-directive-types.ts

# React components
AtlasDirective.tsx → components/atlas-directive/AtlasDirective.tsx
AtlasDirective.module.css → components/atlas-directive/AtlasDirective.module.css
Atlas3DTrackerEnhanced.tsx → components/Atlas3DTrackerEnhanced.tsx
achievement-system.tsx → components/AchievementSystem.tsx

# Integration logic
narrative-3d-integration.ts → lib/narrative-3d-integration.ts
phase3-implementation-utils.ts → lib/phase3-utils.ts

# Tools
validate-narrative.mjs → scripts/validate-narrative.mjs

# Configuration
package.json → package.json
next.config.js → next.config.js

# Main app integration
app-page-integration-example.tsx → app/page.tsx

# Documentation (KEEP for debugging context)
PHASE_1_COMPLETE_SUMMARY.md → docs/development/
PHASE_3_COMPLETE_SUMMARY.md → docs/development/
PHASES_4_5_COMPLETE.md → docs/development/
animation_key_mappings.md → docs/
golden_path_documentation.md → docs/
```

---

## **STEP 3: FIRST VALIDATION & TEST**

### **3.1 Run Content Validation**
```bash
# This MUST pass before proceeding
npm run narrative:validate
```

**Expected Output:**
```
🌌 THE ATLAS DIRECTIVE - NARRATIVE VALIDATION REPORT
📊 Total Nodes: 120
🎯 Ending Nodes: 15
✅ VALIDATION PASSED - Ready for deployment!
```

### **3.2 TypeScript Compilation Check**
```bash
npm run type-check
```

### **3.3 Initial Build Test**
```bash
npm run build
```

**If this fails:** Check Three.js imports and resolve any module resolution issues.

---

## **STEP 4: 3D INTEGRATION IMPLEMENTATION**

### **4.1 Install Three.js Dependencies**
```bash
# Install OrbitControls specifically
npm install three/examples/jsm/controls/OrbitControls
```

### **4.2 Update Atlas3DTrackerEnhanced.tsx**
**CRITICAL INTEGRATION POINT:**
- Import your existing NASA Horizons API from `lib/horizons-api.ts`
- Integrate the `narrativeAction` prop handling
- Connect camera presets to actual comet position data
- Test that animation keys trigger proper visual responses

### **4.3 Test 3D ↔ Narrative Communication**
```bash
npm run dev
```

**Navigate to localhost:3000 and verify:**
- ✅ Narrative loads with mission briefing
- ✅ 3D scene renders with Sun and 3I/ATLAS
- ✅ Making choices triggers 3D visual changes
- ✅ No console errors

---

## **STEP 5: ACHIEVEMENT SYSTEM INTEGRATION**

### **5.1 Add AchievementSystem to Main Layout**

**Update app/page.tsx to include:**
```typescript
import { AchievementSystem } from '../components/AchievementSystem';

// Add to render alongside AtlasDirective
<AchievementSystem 
  gameState={gameState} 
  onAchievementUnlocked={handleAchievementUnlocked}
/>
```

### **5.2 Test Achievement Flow**
- Make several narrative choices
- Verify achievement unlocks appear
- Check local storage for analytics events
- Confirm no personal data is stored

---

## **STEP 6: COMPREHENSIVE TESTING**

### **6.1 Functionality Testing**
```bash
# Run in dev mode for testing
npm run dev
```

**Test Sequence:**
1. **Start Mission** → Choice should trigger `mission_start` animation
2. **Make Skill Check** → Wrong answer should show red error glow
3. **Choose Path** → Camera should switch to appropriate view
4. **Progress to Ending** → Achievement should unlock with celebration

### **6.2 Mobile Responsiveness**
- Test on mobile device or browser dev tools
- Verify UI adapts properly
- Confirm touch interactions work
- Check performance on lower-end devices

### **6.3 Error Handling**
- Test with network disconnected (narrative_tree.json load failure)
- Test with invalid choices
- Verify graceful degradation

---

## **STEP 7: STAGING DEPLOYMENT**

### **7.1 Production Build**
```bash
npm run build
npm run start
```

### **7.2 Performance Verification**
- Check initial load time (<3 seconds)
- Verify smooth 60fps 3D animation
- Test achievement unlock animations
- Confirm narrative progression works flawlessly

### **7.3 Content Integrity Check**
```bash
# Final validation before go-live
npm run narrative:validate
```

---

## **STEP 8: LAUNCH READINESS**

### **8.1 Pre-Launch Checklist**
- [ ] All 120 narrative nodes load correctly
- [ ] 15 endings reachable through different paths
- [ ] Golden Path requires proper flag combinations
- [ ] 3D animations respond to narrative choices
- [ ] Achievement system tracks progress
- [ ] Mobile experience works smoothly
- [ ] No console errors in production build

### **8.2 Staging Environment Live**
**Once all tests pass, your staging environment will deliver:**
- **Immersive narrative experience** with real scientific learning
- **Dynamic 3D visualization** responding to user choices
- **Achievement-driven engagement** encouraging replay
- **Educational value** teaching real astrophysics concepts

---

## **🚨 TROUBLESHOOTING CONTEXT**

### **If Three.js Import Fails:**
- Check next.config.js transpilePackages configuration
- Verify @types/three installation
- Try importing OrbitControls directly

### **If Narrative Tree Fails to Load:**
- Verify narrative_tree.json is in public/data/ or data/
- Check fetch path in AtlasDirective.tsx
- Run validation script first

### **If Animations Don't Trigger:**
- Check onOutcomeDetermined callback connection
- Verify animation_key mappings exist
- Test event bus communication with console.logs

### **Performance Issues:**
- Enable FPS monitoring in development
- Check Animation Queue isn't overwhelming render loop
- Verify effects cleanup properly

---

## **💡 SUCCESS INDICATORS**

### **Working System Shows:**
✅ Users start with mission briefing and 3 Chrono Tokens
✅ Choices immediately impact 3D camera and effects
✅ Skill checks teach real astrophysics with error correction
✅ Achievement unlocks celebrate milestones
✅ Golden Path remains mysterious and challenging
✅ All 15 endings provide satisfying conclusions

### **Ready for User Testing When:**
- All technical integration works flawlessly
- Educational content flows naturally
- 3D visual responses feel connected to choices
- Achievement system encourages exploration
- Performance remains smooth on mobile

**This comprehensive guide ensures your AI dev has all context needed to implement the complete Atlas Directive experience successfully.**