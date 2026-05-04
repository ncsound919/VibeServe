# Nexus Alpha: From Dashboard to Leading Coding System

## Transformation Blueprint

**Date**: 2026-04-30
**Current State**: Developer intelligence dashboard with 100% simulated pipeline
**Target State**: Autonomous full-stack coding system for non-developers — one-time fee, privacy-first, zero human-in-the-loop

---

## Competitive Positioning

| Factor | Cursor | Zed AI | Claude Code | Nexus Alpha (Target) |
|---|---|---|---|---|
| Pricing | $20/mo | $10/mo | API costs + sub | **$249 one-time** |
| Privacy | Cloud | Cloud | API calls | **Local-first, no data exfil** |
| Target | Developers | Developers | Developers | **Vibecoders (non-devs)** |
| UI | IDE | Editor | Terminal | **Single prompt, plain English** |
| Code gen | Inline edits | Inline edits | File ops + run | **Full-stack from one prompt** |
| Autonomy | Agent mode | Partial | Full agent | **No human in loop** |
| Deployment | Manual | Manual | Manual | **One-click publish** |

---

## Architecture: Current vs Target

### Current
```
User → Dashboard (8 tabs, React) → Express Server → SIMULATED Pipeline → Fake results
```

### Target
```
User → ONE PROMPT ("build me a...") → Coding Agent (LLM + FS + Shell) → REAL App
                                                          ↕
                          Dashboard becomes Monitoring Layer (optional for power users)
```

---

## Step Dependency Graph

```
Step 1 ──→ Step 2 ──→ Step 3 ──→ Step 4 ──→ Step 5
  │                     │                    │
  ├─────────────────────┘                    │
  │                                          │
  v                                          v
Step 6 (parallel with 3) ──→ Step 7 ──→ Step 8
                                      │
                                      v
                                  Step 9
```

### Legend
- **Serial**: Steps 1→2→3→4→5→6→7→8→9 (core path)
- **Parallel opportunities**: Steps 3 and 6
- **Strongest model needed**: Steps 1, 4, 9

---

## Step 1: Core Coding Agent — File Generation Engine

**Model tier**: Strongest (architecture decisions set foundation)
**Dependencies**: None (foundation)
**Risk**: High — must correctly scaffold real projects
**Rollback**: Restore deleted service files from git; new files can be deleted

### Context Brief
Nexus Alpha has zero code generation capability. The pipeline is entirely simulated. This step builds the core engine: a service that takes a natural language description and produces working project files on disk. It uses an LLM (Gemini initially, then any provider) to plan architecture, generate all files, and install dependencies.

### What to Build

**1. `src/coding-agent/codingAgentService.ts`** — The main orchestration class:

```typescript
class CodingAgentService {
  async generateApp(spec: AppSpec): Promise<GenerationResult>
  // 1. Plan phase: LLM generates architecture doc + file tree
  // 2. Generate phase: LLM creates each file's content
  // 3. Write phase: Write all files to disk atomically
  // 4. Install phase: npm install / pip install
  // 5. Build phase: real build command
  // 6. Fix phase: capture errors, LLM fixes, retry
  // 7. Result: working app path + summary
}
```

**2. `src/coding-agent/planner.ts`** — Architecture planner
- Sends spec to LLM → returns `{ fileTree, techStack, dependencies, scripts }`
- Validates the plan has no contradictions
- Handles common app types: SaaS, landing page, API, e-commerce, blog, dashboard

**3. `src/coding-agent/fileWriter.ts`** — File system operations
- Atomic directory creation
- Writes files with proper encoding
- Prevents path traversal
- Creates `.gitignore`, `tsconfig.json`, `vite.config.ts` boilerplate matching latest conventions

**4. `src/coding-agent/packageManager.ts`** — Dependency management
- Parses LLM-generated `package.json`
- Runs `npm install` with proper error handling
- Detects and retries on network failures
- Supports yarn/pnpm detection

**5. `src/coding-agent/buildRunner.ts`** — Real build execution
- Runs `npm run build` with timeout
- Captures stdout/stderr
- Returns structured error objects (not simulated)
- Memory-efficient for large outputs

**6. `src/coding-agent/templates/`** — Base templates
- Minimal React+TS+Vite scaffold
- Node.js+Express API scaffold
- Full-stack scaffold (React + Express + SQLite)
- Each template includes: package.json, tsconfig, vite.config, entry point, basic routing

### File Changes
- **NEW**: `src/coding-agent/codingAgentService.ts`
- **NEW**: `src/coding-agent/planner.ts`
- **NEW**: `src/coding-agent/fileWriter.ts`
- **NEW**: `src/coding-agent/packageManager.ts`
- **NEW**: `src/coding-agent/buildRunner.ts`
- **NEW**: `src/coding-agent/types.ts`
- **NEW**: `src/coding-agent/templates/react-ts-vite/` (scaffold files)
- **NEW**: `src/coding-agent/templates/express-api/`
- **NEW**: `src/coding-agent/templates/fullstack/`
- **MOD**: `src/server/index.ts` (add new API routes)
- **MOD**: `package.json` (any missing deps)

### Verification
```
npm run build  # Must pass
npm run lint   # Must pass
```

### Exit Criteria
- Can call `CodingAgentService.generateApp("build me a React todo app")` and get real files in an output directory
- `package.json` is valid JSON
- `npm install` succeeds on generated project
- `npm run build` produces a `dist/` folder with real assets
- All new code passes existing lint rules

---

## Step 2: Real Build Pipeline (Replace Simulation)

**Model tier**: Default
**Dependencies**: Step 1
**Risk**: Medium — pipeline API is already well-structured, just replace internals
**Rollback**: Revert pipelineService.ts to previous version

### Context Brief
The current pipeline (`pipelineService.ts`) has 10 phases that are entirely simulated with log templates, hardcoded E2E results, and fake metrics. This step replaces the simulation with calls to the real coding agent service from Step 1.

### What to Build

**1. Replace `LOG_TEMPLATES` in pipelineService.ts**
- Environment Setup → Check node version, disk space, network connectivity (REAL)
- Dependency Resolution → Run `npm install`, capture actual output (REAL)
- RAG Context Sync → Query wiki for relevant past builds (keep)
- MCP Context Resolution → Integration probes (keep as-is)
- Static Analysis → Run Biome, capture real output (REAL)
- Build & Compile → Run `vite build`, capture real output (REAL)
- Security Audit → Run npm audit, real vulnerability check (REAL)
- E2E Testing → Run Playwright tests against generated app (REAL)
- Optimization → Analyze bundle size from real build output (REAL)
- Finalizing → Compile wiki from real errors/insights (REAL)

**2. `src/coding-agent/pipelineAdapter.ts`** — Bridges pipeline phases to coding agent
- Each phase calls the appropriate real service
- Errors are captured as structured `BuildError` objects
- Progress is reported via existing WebSocket broadcast

**3. Real E2E test runner**
- Use Playwright (already configured) to run against served generated app
- Not simulated test results — actual page loads, assertions, screenshots

### File Changes
- **MOD**: `src/services/pipelineService.ts` — remove all LOG_TEMPLATES, call real services
- **NEW**: `src/coding-agent/pipelineAdapter.ts`
- **MOD**: `src/services/vibeCoderService.ts` — make checks run real tools instead of cached/fallback

### Verification
```
npm run dev &  # Start the server
curl http://localhost:3002/health  # Must respond
# Trigger a real pipeline via API
```

### Exit Criteria
- Pipeline phase output contains REAL log output (not template strings)
- Build & Compile runs actual `vite build` and shows real output
- Static Analysis shows real Biome lint results
- E2E Testing reports real pass/fail from Playwright
- Security audit shows real `npm audit` results

---

## Step 3: Auto-Fix + Debug Loop Activation

**Model tier**: Strongest
**Dependencies**: Step 2 (real errors needed)
**Risk**: Medium — LLM-driven code fixes can be unpredictable
**Rollback**: File-level git revert

### Context Brief
The `autoFixLoop.ts` has excellent scaffolding (checkpoints, fix history, diagnosis, retry) but it's never meaningfully triggered because the pipeline never produces real errors. Now that Step 2 produces real build failures, this step makes the auto-fix loop actually work.

### What to Build

**1. Wire real error types from build runner to autoFixLoop**
- Parse TypeScript compiler errors into structured `BuildError`
- Send real stderr/logs to `analyzeError` for diagnosis
- Generate targeted fixes (fix imports, add missing deps, fix type errors)

**2. `src/coding-agent/errorDiagnoser.ts`** — LLM-powered error diagnosis
- Takes error message + code context (surrounding 20 lines of each file mentioned in error)
- Returns: root cause, fix strategy (replace line, add dep, modify config), fix code
- Caches common error patterns to avoid repeated LLM calls

**3. Fix application improvements**
- Current `applyFix` only handles full file replacements or npm commands
- Add support for: line-level edits, config file patches, installing specific package versions
- Add fix templates for common errors (TS2307, TS2322, TS7016, etc.)

**4. Loop termination conditions**
- Max 5 fix attempts per phase
- If same error persists after 3 attempts with different fixes → escalate
- If error changes → continue (the fix is partially working)
- Track fix success rate per error pattern for learning

### File Changes
- **MOD**: `src/services/autoFixLoop.ts` — real error wiring, improved fix application
- **NEW**: `src/coding-agent/errorDiagnoser.ts`
- **MOD**: `src/services/errorAnalyzer.ts` — improve error analysis for real errors

### Verification
- Trigger a pipeline with deliberately broken code
- Observe auto-fix loop detect the error, diagnose it, generate fix, apply it, retry
- Check `uploads/nexus/fixes/fix-history.json` for real entries

### Exit Criteria
- Real TypeScript build errors are correctly captured and diagnosed
- Auto-fix loop applies at least one fix type successfully (e.g., adds missing import)
- Fix history is populated with real entries
- Pipeline resumes after successful fix

---

## Step 4: Vibecoder UX — Single Prompt Mode

**Model tier**: Strongest (UX architecture)
**Dependencies**: Step 1 (core agent exists to generate output)
**Risk**: Low — new UI layer on top, existing tabs stay for power users
**Rollback**: Remove new component, keep old tabs

### Context Brief
The current 8-tab dashboard is overwhelming for non-developers. Terms like "MCP Bridge", "Deterministic Brain", "RAG Context Sync" mean nothing to someone who just wants to build an app. This step creates a dead-simple single-prompt interface.

### What to Build

**1. `src/views/VibeCoderTab.tsx`** — New default landing view
- One input: "What do you want to build?"
- Type suggestions: "Build a landing page for my startup", "Create a todo app with login", "Make a blog with CMS", "E-commerce store"
- Single "Generate" button
- That's it. No settings, no config, no tabs.

**2. `src/coding-agent/vibecoderUI.tsx`** — Real-time progress in plain English
- Instead of "Phase 3: RAG Context Sync" → "Planning your app's architecture..."
- Instead of "Running Build & Compile... downloading 422 packages..." → "Installing dependencies and building your app..."
- Instead of "E2E Matrix: 100% pass rate" → "Testing your app — everything works!"
- Live output available but not required to see

**3. Simplified sidebar**
- Default view: VibeCoder tab (the only one most users need)
- Collapsible "Advanced" section for the old 8 tabs (power users only)

**4. Progress display**
- Animated progress bar (not technical, just "35% done")
- Section labels like "Planning", "Building", "Testing", "Finishing"
- "View details" expandable section for technical output

**5. Result screen**
- "Your app is ready! 🎉" 
- Path to generated files
- "Open in browser" button (starts dev server)
- "Run tests" button
- "Deploy" button
- Share/Screenshot option

### File Changes
- **NEW**: `src/views/VibeCoderTab.tsx`
- **NEW**: `src/features/vibecoder/VibeCoderPrompt.tsx`
- **NEW**: `src/features/vibecoder/VibeCoderProgress.tsx`
- **NEW**: `src/features/vibecoder/VibeCoderResult.tsx`
- **MOD**: `src/App.tsx` — add VibeCoder as default tab
- **MOD**: `src/layout/Sidebar.tsx` — simplified sidebar with "Advanced" section
- **MOD**: `src/index.css` — any new styles

### Verification
- Load app → see single prompt as default
- Type "build a calculator app" → see plain English progress
- App is generated and result screen shows

### Exit Criteria
- New default view loads on app start
- Single text input accepts app description
- Progress shows non-technical status messages
- Generated app path is shown on completion
- Old 8 tabs accessible via "Advanced" menu (not removed)

---

## Step 5: Privacy Layer — Local LLM Support

**Model tier**: Default
**Dependencies**: Step 1 (needs LLM integration point)
**Risk**: Medium — local model quality varies
**Rollback**: Keep cloud API configuration option

### Context Brief
Privacy is a key differentiator. Users should be able to run everything locally without any data leaving their machine. This step adds Ollama support as a local LLM provider and makes the system work entirely offline.

### What to Build

**1. `src/coding-agent/providers/ollamaProvider.ts`**
- Connect to local Ollama instance (default: `http://localhost:11434`)
- Auto-detect available models
- Fallback chain: Ollama → Gemini → OpenRouter
- Works offline (caches responses for repeated queries)

**2. `src/coding-agent/providers/localEmbeddings.ts`**
- Uses existing Transformers.js (already in package.json) for embeddings
- No cloud dependency for vector search
- Local-only mode for Qdrant (already has local-infra.ts)

**3. Privacy toggle in settings**
- "Offline Mode" toggle
- When ON: no API calls to external services
- When ON: uses Ollama for generation, local embeddings, local Qdrant
- Shows what works in offline mode vs what needs cloud

**4. First-run setup wizard**
- "Welcome to Nexus Alpha — the privacy-first coding assistant"
- Check for Ollama (offer to install if missing)
- "Would you like to use local AI (private) or cloud AI (faster)?"
- Token usage/cost tracker for cloud mode

### File Changes
- **NEW**: `src/coding-agent/providers/ollamaProvider.ts`
- **NEW**: `src/coding-agent/providers/localEmbeddings.ts`
- **NEW**: `src/views/SetupWizard.tsx`
- **MOD**: `src/services/modelRouter.ts` — add Ollama as provider option
- **MOD**: `src/services/geminiService.ts` — add local fallback
- **MOD**: `src/views/SettingsTab.tsx` — privacy controls

### Verification
- Start app without any API keys → should still work with Ollama
- Toggle offline mode → no external HTTP calls
- Generation works with local models

### Exit Criteria
- Ollama is detected and usable as a provider
- All core generation works with zero API keys in offline mode
- Privacy toggle is functional and honored throughout the app
- Setup wizard appears on first clean launch

---

## Step 6: Full-Stack Template Library

**Model tier**: Default
**Dependencies**: Step 1 (template mechanism exists)
**Risk**: Low — templates are static files
**Rollback**: Delete template directories

### Context Brief
To compete on speed, Nexus Alpha should offer instant app generation from templates. Rather than LLM-generating every file from scratch (which is slow and expensive), common app types start from curated templates and the LLM customizes them.

### What to Build

**1. Template registry** (`src/coding-agent/templates/registry.ts`)
- Maps app descriptions to best template
- "landing page" → react-ts-vite
- "blog" → react-ts-vite + react-router
- "saas" → fullstack template
- "ecommerce" → fullstack + SQLite
- "api" → express-api
- "dashboard" → react-ts-vite + chart lib
- "desktop app" → Electron template (future)

**2. Enhanced templates**
- Each template has: base files LLM can customize, a "prompt supplement" that tells the LLM what to change
- Templates include: auth (where applicable), routing, basic styling, responsive layout

**3. Template versioning**
- Templates ship with the app (versioned in repo)
- Can be updated independently

### File Changes
- **NEW**: `src/coding-agent/templates/registry.ts`
- **NEW**: `src/coding-agent/templates/react-ts-vite/` (enhance)
- **NEW**: `src/coding-agent/templates/express-api/` (enhance)
- **NEW**: `src/coding-agent/templates/fullstack/` (enhance)
- **NEW**: `src/coding-agent/templates/fullstack-with-auth/`

### Verification
- Generate app from template → measurable speed improvement over from-scratch generation

### Exit Criteria
- Template registry selects correct template from description
- Template-based generation is faster than from-scratch
- Each template produces a working app

---

## Step 7: Autonomous Deployment

**Model tier**: Default
**Dependencies**: Step 1 (working app)
**Risk**: Medium — deployment integrations require API keys
**Rollback**: Deployment is optional; app generation still works without it

### Context Brief
Vibecoders don't know how to deploy. Nexus Alpha should offer one-click publish to Vercel, Netlify, or Docker. The system handles build, config, and deploy.

### What to Build

**1. `src/coding-agent/deployer.ts`**
- Vercel CLI integration
- Netlify CLI integration
- Docker build + run
- Generates appropriate config files (vercel.json, netlify.toml, Dockerfile)

**2. Docker compose for generated apps**
- `docker-compose.yml` that serves the generated app
- One-click "Run in Docker" for local preview

### File Changes
- **NEW**: `src/coding-agent/deployer.ts`
- **NEW**: `src/coding-agent/deployerTypes.ts`
- **MOD**: VibeCoder result screen (add deploy buttons)

### Verification
- Generated app deploys to Vercel via one click
- Generated app runs in Docker locally

### Exit Criteria
- At least one deployment target works end-to-end
- Deploy configs are generated automatically

---

## Step 8: One-Time Fee + Licensing

**Model tier**: Default
**Dependencies**: Step 1 (product exists to sell)
**Risk**: Low — add-on, doesn't affect core functionality
**Rollback**: Remove license check, app works fully without it

### Context Brief
The core differentiator is one-time fee vs monthly subscription. This step adds a simple, privacy-respecting license system.

### What to Build

**1. License key system**
- Local machine fingerprint generation (CPU ID, MAC, disk serial — hashed, never stored)
- Offline activation: user enters key → validates locally via signature
- Online activation (optional): verify key against server

**2. Trial mode**
- Full functionality for 14 days or 5 generations
- Clear countdown: "You have 3 generations left in your free trial"
- CTA to purchase

**3. Payment integration**
- Stripe checkout session
- One-time payment ($249 suggested) or "Founder's Price" ($99 for first 1000 users)
- Digital delivery of license key via email

**4. Sales page** (existing `src/sales/` — enhance it)
- Compare table vs Cursor/Zed/Claude Code
- Feature highlights
- Privacy guarantee
- Vibe coder testimonials

### File Changes
- **NEW**: `src/services/licenseService.ts`
- **NEW**: `src/services/licenseValidator.ts`
- **MOD**: `src/App.tsx` — add license check on mount
- **MOD**: `src/sales/` — enhance with real pricing, Stripe integration

### Verification
- Generate app → license check runs
- Without license → trial mode activates
- With valid key → full access

### Exit Criteria
- License can be validated offline (no server needed)
- Trial mode works with clear countdown
- Stripe checkout generates valid license keys

---

## Step 9: Dashboard Consolidation

**Model tier**: Default
**Dependencies**: Steps 2, 3 (real pipeline data to display)
**Risk**: Low — purely cosmetic/UX
**Rollback**: Keep old tabs

### Context Brief
The 8-tab dashboard is now optionally accessible from the "Advanced" menu. This step consolidates it into a simpler monitoring view that shows real (not simulated) data from the coding agent's activities.

### What to Build

**1. "Activity" view**
- Shows history of generated apps
- Per-app: timestamp, description, status (success/failed), tech stack, path
- Click to open/rerun/deploy

**2. "Insights" view (power user)**
- Build quality scores (real, from vibeCoderService)
- Error patterns from actual failed builds
- Performance metrics from real builds
- Achievement badges (keep gamification)

**3. Remove or archive unused tabs**
- YouTube Pulse → low value, archive
- LLM Wiki → fold into activity log
- Repo Analysis → fold into "Discover" optional view
- Nexus Browser → fold into debug output
- Settings → simplify drastically

### File Changes
- **MOD**: `src/layout/Sidebar.tsx` — consolidate tabs
- **MOD**: `src/App.tsx` — route to consolidated views
- **MOD**: `src/views/` — consolidate views
- **Remove/archive**: YouTube Pulse tab, LLM Wiki tab (optional)

### Verification
- Dashboard shows real pipeline data
- Activity view has real entries
- No broken routes

### Exit Criteria
- Dashboard shows only relevant data (real, not simulated)
- Old tabs are either removed or hidden behind "Advanced"
- Activity view is the primary monitoring interface

---

## Anti-Pattern Catalog

| Anti-Pattern | Why It's Bad | How to Avoid |
|---|---|---|
| Simulation leaks into real code | Fake logs/mock data appear in output | Every new feature must produce REAL output or show clear "not available" message |
| API key required for basic function | User installs → broken | Step 5 (local LLM) must work completely offline |
| 8-tab complexity for vibecoders | Non-devs feel overwhelmed | Step 4 creates single-prompt default; old UI is hidden |
| Pipeline runs without real work | Looks impressive but produces nothing | Step 2 eliminates all LOG_TEMPLATES |
| Auto-fix makes things worse | LLM-generated code breaks other things | Always checkpoint before fix; support rollback |
| One-time fee doesn't cover costs | Need ongoing revenue | Consider: updates/priority support as optional paid add-ons |
| Privacy claim but sends all data to API | Users discover data leaks | Step 5 local mode must be 100% offline; label clearly |
| Vibecoder prompt too vague → bad output | "Make me an app" → nothing useful | Template matching + guided prompts with examples |

---

## Model Tier Assignments

| Step | Tier | Rationale |
|---|---|---|
| Step 1 | Strongest | Architecture decisions set foundation for everything |
| Step 2 | Default | Replacing internals of existing pipeline |
| Step 3 | Strongest | LLM-driven error diagnosis needs quality |
| Step 4 | Strongest | UX architecture decisions matter |
| Step 5 | Default | Local LLM wrappers are straightforward |
| Step 6 | Default | Static templates, low complexity |
| Step 7 | Default | Wrapper around existing CLIs |
| Step 8 | Default | Standard licensing patterns |
| Step 9 | Default | UI consolidation, low risk |

---

## Rollback Strategy by Step

| Step | Rollback Method |
|---|---|
| 1 | `git restore src/coding-agent/` — new files only |
| 2 | `git revert` pipelineService.ts changes |
| 3 | `git revert` autoFixLoop changes |
| 4 | `git revert` App.tsx + new view files |
| 5 | `git revert` provider files |
| 6 | `git restore src/coding-agent/templates/` |
| 7 | Revert deployer files |
| 8 | `git revert` license files |
| 9 | `git revert` sidebar + app routes |

---

## Success Criteria

When all 9 steps are complete:
1. A non-developer opens Nexus Alpha, types "build a SaaS dashboard with user auth"
2. The system plans architecture, generates all files, installs deps, builds, and tests
3. Any errors are automatically fixed by the AI debug loop
4. The user sees a "Your app is ready!" screen with path and deploy options
5. No data ever leaves their machine (in local mode)
6. They paid once ($249) with no subscription
7. Everything works without API keys

