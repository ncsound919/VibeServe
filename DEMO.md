# VibeServe Demo Walkthrough

This walks through the full VibeServe pipeline from intent to deployment.

## Prerequisites

```bash
pip install vibeserve
export OPENAI_API_KEY="sk-..."  # or leave blank for local/sampling
```

## Demo 1: Architecture Generation

```bash
vibeserve --interactive
```

Then at the prompt:
```
vibeserve> architect Build a SaaS analytics dashboard with KPI cards, real-time charts, dark mode, and mobile responsiveness
```

This generates:
- Architecture Decision Records (ADRs) explaining key choices
- Component tree for the UI
- Data flow diagram
- File structure plan
- Risk assessment

## Demo 2: Code Generation

```
vibeserve> code Build a SaaS analytics dashboard
```

Generates production TypeScript/React code with:
- ARIA accessibility attributes
- WCAG AAA color contrast
- Design token enforcement
- Responsive breakpoints

## Demo 3: Design Template

```
vibeserve> design A modern SaaS landing page with clean typography vercel
```

Uses the Vercel DESIGN.md template with Monte Carlo variation:
- Every build is visually unique
- Color mutations, spacing shifts, font swaps
- Senior-dev upgrade patterns applied

## Demo 4: Full Professional Build

```
vibeserve> pro Create a developer tools landing page supabase
```

One-command full pipeline:
1. Upgrades design template (responsive, a11y, perf, SEO, security)
2. Generates architecture plan
3. Generates production HTML
4. Verifies quality

## Demo 5: Multi-Agent Review

```
vibeserve> review
```

Three agents review the generated code in parallel:
- UX Designer: visual quality, design tokens, hierarchy
- Frontend Engineer: code quality, error handling, architecture
- Accessibility Advocate: ARIA, keyboard nav, WCAG compliance

## Demo 6: Benchmarking

```
vibeserve> benchmark 5
```

Self-audit loop:
- Security audit
- Performance review
- Code quality assessment
- ASCII trend charts
- Score tracking across iterations

## CLI Flags

```bash
# Interactive REPL
vibeserve --interactive

# Quick demo (no API key needed)
vibeserve --demo

# Agentic pipeline demo
vibeserve --vibe-demo

# Run as MCP server
vibeserve
```
