# Nexus Alpha UI Professionalization — Design Spec

**Date:** 2026-05-05  
**Status:** Approved  
**Scope:** Full sidebar reorganization, dashboard redesign, notification system, visual polish

---

## Overview

Redesign the Nexus Alpha IDE interface around a **progressive build pipeline sidebar**, a consolidated **dashboard** as the default main view, a **4-tier toast notification system**, and production-grade visual refinement across all components.

### Goals
- Sidebar guides users through build steps sequentially with status indicators
- Dashboard shows live metrics, activity feed, agent status at a glance
- Color-coded notifications inform users of pipeline events
- Professional card system, progress bars, gauges, and controls feel engineered

---

## Section 1: Progressive Pipeline Sidebar

### 1.1 Structure (10 items total)

```
┌─────────────────────────┐
│ ◉ Architect        ✅   │  green checkmark, slight bg tint
│ ◉ Plan             ✅   │
│ ● Build          ⟳ NOW  │  pulsing glow border + progress %
│  └─ Editor               │  contextual tool suggestion
│  └─ Memory               │
│ ○ Review                 │  dimmed, upcoming
│ ○ Audit                  │
│ ◎ Fix & Retest           │  grouped: Fix→E2E→Re-fix→Re-audit
│ ○ Verify                 │
│ ○ Deploy                 │
│  └─ Preview              │  contextual tool suggestion
├─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┤
│ ⚙ Settings               │  settings + remaining tools
└─────────────────────────┘
```

### 1.2 Step Status Indicators

| State | Glyph | Color | Behavior |
|-------|-------|-------|----------|
| Completed | ◉ solid dot | emerald-500 | Subtle green bg tint, optional timestamp |
| Active | ● pulsing ring | emerald-400 + animate-pulse | Glow border, "NOW" badge, progress % |
| Failed | ◎ solid dot | rose-500 | Red bg tint, inline [Retry] button |
| Pending | ○ hollow | #4a4b50 | Dim, low opacity, no interaction |

### 1.3 Group Expansion (Fix & Retest)

When active, the grouped step expands inline:

```
◎ Fix & Retest     ⟳   ACTIVE
  ├─ ✅ Fix                 12s
  ├─ ⟳ E2E Testing          running…
  ├─ ○ Re-fix               pending
  └─ ○ Re-audit             pending
```

Sub-steps inherit parent state color. Active sub-step pulses. Completed sub-steps show timestamps. Failed sub-steps show retry affordances inline.

### 1.4 Contextual Tool Suggestions

At the Build step, Editor and Memory appear as clickable hints below the step label. At Deploy, Preview appears. These are contextual — they only show at the relevant step, not always.

### 1.5 Transition Behavior

Completed steps collapse slightly (reduced padding) to conserve space. Active step expands. Clicking a completed step opens its output in the main panel.

### 1.6 Settings Section

Single link at sidebar bottom. Opens Settings panel with sub-panels: System Settings, AI Provider, Pipeline Configuration, Agent Registry.

**Removed from sidebar:** Activity, History, Memory, Editor, Preview, Agent Eval, Mission Control, Overview (moved to Dashboard or contextual tools).

---

## Section 2: Dashboard (Default Main View)

### 2.1 Layout

```
┌─────────────────────────────────────────────────────────┐
│ ┌──────────────┐  ┌──────────────────────────────┐      │
│ │ Live Metrics │  │ Activity Feed (scrollable)    │      │
│ │              │  │                              │      │
│ │ CPU ████░░░  │  │ 14:32 Build completed    ✅  │      │
│ │ Mem ███░░░░  │  │ 14:28 Review passed      ✅  │      │
│ │ Disk ██░░░░  │  │ 14:25 E2E tests 3/3     ✅  │      │
│ │ WS   ● active│  │ 14:22 Audit: 2 findings  ⚠  │      │
│ │ MCP  ● active│  │ 14:18 Fix applied        ✅  │      │
│ │ Pipe ████████│  │ 14:15 Build started       ○  │      │
│ │              │  │                              │      │
│ └──────────────┘  └──────────────────────────────┘      │
│                                                          │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Mission Control — Agent Status                      │ │
│ │ ▶ Agent-1  active  ████████░░  80%  Build step     │ │
│ │ ⏸ Agent-2  paused  ████░░░░░░  40%  Review step    │ │
│ │ ▶ Agent-3  active  ██████░░░░  60%  Audit step     │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                          │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│ │ Pipeline │ │ Projects │ │ Repos    │ │ Quality  │   │
│ │   12/15  │ │   3 live │ │   8      │ │   B+ 73% │   │
│ │  streak 5│ │   2 done │ │ scanned  │ │   ↑ +8%  │   │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Live Metrics Zone

Six gauges with color thresholds:
- CPU, Memory, Disk: linear gauge, green→amber→red at 70/90%
- WebSocket: dot indicator (green connected, amber reconnecting, red disconnected)
- MCP Bridge: same dot model
- Pipeline Health: 0-100% bar, glow at completion

### 2.3 Activity Feed

Color-coded event stream, scrollable, newest first:
- ✅ green = completed/passed
- ⚠ amber = warning/needs attention
- ❌ red = failed/error
- ○ gray = in progress

Each row clickable → opens detail in main panel.

### 2.4 Mission Control Panel

Agent status cards showing: agent name, status icon (▶ running, ⏸ paused, ✓ idle), progress bar with percentage, current task label (which pipeline step).

### 2.5 Stat Cards (Bottom Row)

Four summary tiles with trend arrows:
- Pipeline runs (with streak count)
- Projects (live/completed breakdown)
- Repos scanned
- Quality score with delta from last run

---

## Section 3: Notifications & Pipeline Indicators

### 3.1 Toast Notification System

#### Visual Model
Each toast: compact high-contrast card with left color rail, icon + title, optional description, optional inline actions, close button.

#### Examples

```
┌──────────────────────────────────────────────┐
│ ▌  Build complete — 32s                 ✕     │  success (emerald-500)
│     3 files generated, 0 errors               │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│ ▌  Audit: 2 findings                    ✕     │  warning (amber-500)
│     [View]   [Fix automatically]              │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│ ▌  E2E failed — 1/4 tests               ✕     │  error (rose-500)
│     [View failures]   [Retry]                 │
└──────────────────────────────────────────────┘
```

#### Behavior
- **Placement:** bottom-right stack, newest on top
- **Types & Timing:**
  - Info — indigo-400, auto-dismiss 4s
  - Success — emerald-500, auto-dismiss 6s
  - Warning — amber-500, persistent
  - Error — rose-500, persistent
- **Actions:** inline buttons appear only when applicable
- **Pipeline Pause Toast:** shows ▶ Resume and ■ Stop, amber rail with subtle pulse

### 3.2 Sidebar Pipeline Indicators

Each step shows compact status glyph:
- ◉ Completed — solid emerald dot + faint green bg
- ● Active — pulsing emerald ring + "NOW" badge + progress %
- ◎ Failed — solid rose dot + rose tint + [Retry] link
- ○ Pending — hollow gray circle, low opacity

Fix & Retest expands to sub-step timeline when active.

### 3.3 Header Status Bar

Global pipeline indicator, only visible when work is active:

```
┌─────────────────────────────────────────────────────────┐
│ ● Pipeline: Build   ██████████░░   80%  │ 3 remaining   │
└─────────────────────────────────────────────────────────┘
```

- **Location:** between header and main content
- **Active:** emerald pulse
- **Paused:** amber static
- **Failed:** rose flash
- **Contents:** current phase, progress %, ETA, remaining steps
- **Auto-collapse:** shrinks to thin progress bar when not hovered
- **Auto-hide:** disappears when idle

### 3.4 Standardized Color System

| State | Color Token | Usage |
|-------|-------------|-------|
| Success / Complete | `emerald-500` | checks, completed steps, passed tests |
| Active / Running | `emerald-400` + `animate-pulse` | current step, live agents |
| Warning / Paused | `amber-500` | findings, paused, needs attention |
| Error / Failed | `rose-500` | failures, broken steps |
| Info / Neutral | `indigo-400` | suggestions, tips, metrics |
| Pending / Idle | `#4a4b50` / `#8E9299` | inactive, not yet reached |

---

## Section 4: Professional Polish

### 4.1 Card System — Four Material Layers

#### Layer 1 — Base Cards (Stat Cards)
Purpose: dense information, low elevation, fast scanning.

- Surface: `#0d0d10`
- Border: `#1a1b1e`
- Radius: `rounded-xl`
- Padding: `p-4`
- Zero shadow, grounded and stable

#### Layer 2 — Content Cards (Primary Surfaces)
Purpose: reading, editing, interaction.

- Surface: `#151619`
- Border: `#2d2e32`
- Radius: `rounded-2xl`
- Padding: `p-6`
- Default canvas for content

#### Layer 3 — Glass Cards (Overlay Material)
Purpose: modals, inspectors, contextual layers.

- `backdrop-blur-md` with translucent bg
- Border: `rgba(255,255,255,0.08)`
- Scale-in animation
- Premium, OS-level feel

#### Layer 4 — Elevated Cards (Interactive Objects)
Purpose: selectable items, navigation, agent tiles.

- Hover: `translate-y-[-2px]`
- Shadow: `0 4px 12px rgba(0,0,0,0.35)`
- Crisp border
- Micro-tilt on hover (1-2°)

### 4.2 Progress Bars — Semantic & Stateful

```
Standard:  ████████░░░░░░░░░░  45%     fill: emerald gradient
Warning:   ████████████████░░  78%     fill: amber transition
Critical:  █████████████████░  92%     fill: rose transition
Pulsing:   ████████░░░░░░░░░░  45%     active: shimmer animation
```

- Height: `h-1.5`, radius: `rounded-full`
- Track: `#1a1b1e`
- Fill: gradient with semantic color transitions at 70% and 90%
- Micro-interactions: shimmer (active), glow (100%), pulse (waiting), flash (failure)

### 4.3 Metric Gauges — Precision Instruments

```
┌──────────┐
│    ●      │  label: "CPU"
│   42%     │  value: large, white
│  ████░░   │  radial or linear gauge
└──────────┘
```

- Large numeric value (primary)
- Label in muted gray (`#8E9299`)
- Inner shadow for depth
- Smooth sweep animation
- Color thresholds: green→amber→red with eased transitions

### 4.4 Controls — Sliders, Toggles, Knobs

**Sliders:**
- Track: `h-2 rounded-full bg-[#1a1b1e]`
- Thumb: emerald-500 with soft glow
- Value label right-aligned, numeric
- Thumb expands 10% on drag

**Toggles:**
- Pill: `w-9 h-5 rounded-full`
- Off: `#2d2e32`, On: emerald-500 with halo
- 180ms smooth glide with overshoot easing

**Knobs:**
- Circular drag with rotational inertia
- Active state: emerald ring + pulse
- For temperature, thresholds, model parameters

### 4.5 Grid System — Spatial Rhythm

| Density | Grid Classes | Gap | Use |
|---------|-------------|-----|-----|
| Tight | `grid-cols-2 sm:grid-cols-4` | `gap-3` | Stat cards, telemetry |
| Standard | `grid-cols-1 lg:grid-cols-2` | `gap-6` | Content, forms, logs |
| Wide | `grid-cols-1 xl:grid-cols-3` | `gap-8` | Large cards, pipeline |

- Vertical rhythm: `space-y-6` between sections
- Horizontal rhythm: consistent gutters at all breakpoints

---

## Section 5: VibeServe MCP-Assisted Code Generation

### Approach
Feed this design spec into the VibeServe MCP pipeline to auto-generate UI components:
1. **aethernexus_vibe_architect** — parse spec into structured component tree
2. **aethernexus_vibe_code** — generate React/TSX components with Tailwind
3. **aethernexus_vibe_review** — multi-agent code review against design system
4. **aethernexus_vibe_verify** — validate against WCAG AAA, color contrast, accessibility
5. **aethernexus_vibe_iterate** — refine based on review feedback

### Generated output targets
- Sidebar with 8 progressive steps + 1 settings link
- Dashboard with live metrics, activity feed, mission control, stat cards
- Toast notification system with 4 tiers and action buttons
- Header status bar with progress, pause/resume
- Professional card system, progress bars, gauges, controls
- Updated App.tsx to wire new sidebar and dashboard

### Manual refinement
After generation, manually verify:
- WebSocket integration (TrajectorySidebar, live metrics)
- Existing Zustand store compatibility
- Contextual tool suggestions wiring
- Animation timing and easing curves
- E2E test updates

---

## Implementation Notes

### Files to create/modify
- **New:** `src/layout/PipelineSidebar.tsx` — replaces current Sidebar.tsx
- **New:** `src/features/dashboard/DashboardView.tsx` — consolidated dashboard
- **New:** `src/components/ToastContainer.tsx` — toast notification stack
- **New:** `src/components/HeaderStatusBar.tsx` — pipeline progress bar
- **Modify:** `src/components/App.tsx` — new sidebar, dashboard default view
- **Modify:** `src/index.css` — new card classes, progress bar variants

### Backward compatibility
- Existing tab components preserved but accessed via contextual suggestions or Settings
- Current Sidebar.tsx retained as reference during transition
- Color system extends existing tokens, no breaking changes

### Testing
- E2E: Verify all 10 sidebar items render with correct states
- E2E: Toast notifications appear/dismiss with correct timing
- E2E: Dashboard loads live metrics, activity feed, mission control
- Unit: Sidebar step state transitions (completed→active→failed)
- Unit: Toast queue management (stack, dismiss, action callbacks)
