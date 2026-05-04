# Nexus Alpha - Complete Build Resources Guide
## Build Pipeline, UI/UX & Differentiating Features

---

# PART 1: BUILD PIPELINE TOOLS

## CI/CD Orchestration

| Tool | Stars | License | Why Integrate |
|------|-------|---------|---------------|
| **Dagger** | 15.6k | Apache 2.0 | Programmable CI/CD, runs anywhere, containerized workflows, OpenTelemetry |
| **GitHub Agentic Workflows (gh-aw)** | 4.4k | MIT | Agentic workflows in natural language, security guardrails, MCP gateway |
| **SuperPlane** | 1.8k | Apache 2.0 | Event-driven workflow orchestration, 50+ integrations, platform engineering |
| **Conveyor CI** | 79 | Apache 2.0 | Headless CI/CD orchestration engine for building custom CI platforms |
| **Docker Agent** | 2.8k | Apache 2.0 | Multi-agent orchestration, YAML config, MCP servers, RAG support |

## AI-Powered Development

| Tool | Stars | License | Why Integrate |
|------|-------|---------|---------------|
| **Aperant** (formerly AutoClaude) | 14k | AGPL-3 | Autonomous multi-agent coding, parallel execution, self-validating QA |
| **ForgeGod** | 4k+ | Apache 2.0 | 5-tier cognitive memory, multi-model routing, 24/7 autonomous loops, $0 local mode |
| **Open SWE** | 3k+ | - | Cloud sandboxes, subagent orchestration, auto PR creation |
| **Loom** | 9 | MIT | Label-driven autonomous workflow, shepherd orchestration, forge-agnostic |
| **Automaker** | 3k+ | NOASSERTION | Kanban + AI agents, Claude Agent SDK, git worktree isolation |
| **RA.Aid** | 2.2k | Apache 2.0 | LangGraph-based, web research, human-in-the-loop, 3-stage architecture |
| **Dexto** | 612 | NOASSERTION | Agent harness, YAML config, 50+ LLMs, MCP integration |

## Terraform/IaC

| Tool | Stars | License | Why Integrate |
|------|-------|---------|---------------|
| **Digger** (now OpenTaco) | 4.9k | MIT | Terraform in existing CI, PR automation, OPA support, drift detection |
| **v0** | - | - | (Reference) Next-generation terraform tool |

---

# PART 2: UI/UX LIBRARIES

## Animation Libraries

| Library | Stars | License | Components | Why Use |
|---------|-------|---------|------------|---------|
| **Motion Primitives** | 5 | MIT | 155+ | Free alternative to Aceternity/Magic UI, GSAP ScrollTrigger, 3D Three.js |
| **Animate UI** | 3.5k | NOASSERTION | 50+ | React + Tailwind + Motion, shadcn compatible |
| **SmoothUI** | 747 | MIT | 30+ | Dynamic island, fluid morph, cursor follow, shadcn registry |
| **ScrollX UI** | 279 | NOASSERTION | 140+ | Text animations, motion interactions, blocks |
| **React Animation Kit** | 0 | MIT | 142 | 0.5-1KB per component, tree-shakeable, SSR-safe |
| **Mochi Motion** | 107 | MIT | 8 | Professional spring physics, drop-in |
| **CuiCui** | 944 | MIT | 40+ | CSS-heavy (less JS), creative components |
| **Magic UI** | - | - | 20+ | Premium landing page blocks |
| **Aceternity UI** | - | MIT | 50+ | Aurora backgrounds, 3D effects, copy-paste |

## Design Systems

| Tool | Focus | Why Use |
|------|-------|---------|
| **shadcn/ui** | Radix + Tailwind | Base for everything, copy-paste not import |
| **Radix UI** | Headless primitives | Accessibility built-in |
| **Tailwind CSS** | Utility-first | Already in use |

---

# PART 3: UNIQUE/DIFFERENTIATING FEATURES

## Features No Other IDEs Have

### 1. **ForgeGod's 5-Tier Cognitive Memory**
- Episodic (what happened)
- Semantic (what I know)  
- Procedural (how I do things)
- Graph (how things connect)
- Error-Solutions (what fixes what)
- **Why unique**: Memory decays, consolidates, reinforces automatically

### 2. **Aperant's Self-Validating QA Loop**
- Built-in quality assurance catches issues before human review
- AI-powered merge with automatic conflict resolution
- **Why unique**: Most IDEs rely on external CI; this has internal validation

### 3. **ForgeGod's Reflexion Coder**
- 3-attempt code gen with escalating models:
  1. Local (free) → 2. Cloud (cheap) → 3. Frontier (when it matters)
- **Why unique**: Automatic model escalation based on failure

### 4. **Dexto's YAML-Driven Agent Config**
- Swap models and tools without code changes
- Session management, tool orchestration, memory out of the box
- **Why unique**: Configuration-driven, not code-driven

### 5. **Loom's Label-Driven Workflow**
- `loom:issue` → `loom:building` → `loom:review-requested` → `loom:pr`
- Shepherd orchestration with Curator → Builder → Judge
- **Why unique**: Git-native autonomous workflow tied to labels

### 6. **Automaker's Kanban + AI**
- Feature cards with images/screenshots for visual context
- Spec/full/phased planning modes
- **Why unique**: Visual AI development management

### 7. **nWave's Wave-Based Development**
- DISCOVER → DISCUSS → DESIGN → DISTILL → DELIVER → DEVOPS
- TDD enforcement, 98+ skills
- **Why unique**: Methodology baked into AI workflow

### 8. **AnyTool's Universal Tool Layer**
- Progressive MCP tool filtering (4 stages)
- MCP + Shell + GUI + Web backends
- **Why unique**: Intelligent tool selection, not just availability

### 9. **Open SWE's Middleware System**
- `check_message_queue_before_model` - inject follow-up mid-run
- `open_pr_if_needed` - safety net PR creation
- **Why unique**: Production-grade middleware for agentic systems

---

# PART 4: RECOMMENDED INTEGRATIONS FOR NEXUS

## Immediate (This Week)

```
1. Dagger SDK - Pipeline orchestration in code
2. Motion Primitives / SmoothUI - Premium UI animations  
3. ForgeGod patterns - 5-tier memory system
4. AnyTool - Intelligent MCP routing
```

## Short-term (This Month)

```
1. Aperant-like self-validating QA
2. Loom-style label-driven workflows
3. Dexto's YAML agent config
4. nWave's wave methodology
```

## Unique Features to Build

| Feature | Inspired By | Differentiation |
|---------|-------------|-----------------|
| **Context Compression Engine** | Dexto, ForgeGod | Aggressive context management |
| **Cost-aware Model Routing** | ForgeGod | Auto-switch models by budget |
| **Memory Decay System** | ForgeGod | Biological memory simulation |
| **Human-in-the-Loop Gates** | Aperant, Open SWE | Approval workflows |
| **Git-worktree Isolation** | Loom, Automaker | Safe multi-agent |
| **Audit-first Planning** | Open SWE | Blockers before planning |

---

# PART 5: TECH STACK DECISIONS

## Recommended Stack for Nexus

| Layer | Choice | Rationale |
|-------|--------|-----------|
| **Build Pipeline** | Dagger SDK | Programmable, portable |
| **Agent Runtime** | Dexto patterns | YAML config, extensible |
| **Memory** | ForgeGod 5-tier | Most sophisticated |
| **Validation** | Aperant QA loop | Built-in quality |
| **UI Animations** | Motion Primitives | 155+ free components |
| **Workflow** | Loom labels | Git-native |
| **Tools** | AnyTool | Intelligent MCP routing |

---

## Quick Start Integration Commands

```bash
# UI Components
npm install motion framer-motion
npm install @magicui/react

# Agent Patterns
# Study Dexto, ForgeGod, Aperant architectures

# Build Pipeline  
# Integrate Dagger SDK for CI/CD

# Memory System
# Implement 5-tier memory like ForgeGod
```

---

*Last updated: May 2026*