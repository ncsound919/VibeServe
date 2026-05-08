# AetherNexus Prime v4 — Deployment & Integration Guide

## Overview

This is a production-ready MCP (Model Context Protocol) server that generates UI specifications at enterprise scale. It enforces design systems, validates accessibility at WCAG AAA level, and uses multi-agent critique for quality assurance.

**Key Features:**
- ✅ UISchema v1.0 standard compliance
- ✅ Multi-agent design review (Designer, Engineer, Accessibility Advocate)
- ✅ Automatic WCAG AAA validation
- ✅ Design system enforcement
- ✅ Feedback loop learning
- ✅ Full async support
- ✅ Production error handling

---

## Installation

### Prerequisites
- Python 3.10+
- LLM API key (OpenAI, DeepSeek, or compatible)
- pip or conda

> ⚠️  SECURITY WARNING: Never hardcode your API key in claude_desktop_config.json.
> Instead, create a .env file and add it to .gitignore:
> ```
>   echo "OPENAI_API_KEY=sk-..." > .env
>   echo ".env" >> .gitignore
> ```
> Then reference it via your shell profile or a wrapper script.

### Quick Start (5 minutes)

```bash
# 1. Clone or download the repo
git clone <repo> aether-nexus
cd aether-nexus

# 2. Install dependencies
pip install -r requirements.txt

# 3. Set environment variables (create a .env file — never hardcode keys)
# Copy .env.example to .env and fill in your keys:
export OPENAI_API_KEY="your-key-here"
export OPENAI_BASE_URL="https://api.openai.com/v1"
export LLM_MODEL="gpt-4-turbo-preview"

# 4. Run the MCP server
python mcp_ui_optimizer_v4.py
```

The server will start listening for MCP connections.

### MCP Client Integration

#### Claude.ai / Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "aether-nexus": {
      "command": "python",
      "args": ["/absolute/path/to/mcp_ui_optimizer_v4.py"],
      "env": {
        "OPENAI_API_KEY": "${env:OPENAI_API_KEY}",
        "LLM_MODEL": "gpt-4-turbo-preview",
        "OPENAI_BASE_URL": "https://api.openai.com/v1"
      }
    }
  }
}
```

Then restart Claude Desktop. The server will appear in the left sidebar under "Tools".

#### Python Client

```python
import asyncio
import json
from pathlib import Path

async def test_mcp():
    # Start the MCP server in subprocess
    import subprocess
    server = subprocess.Popen(
        ["python", "mcp_ui_optimizer_v4.py"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )
    try:
        server.wait(timeout=30)
    except subprocess.TimeoutExpired:
        server.kill()
        server.wait()
    
    # Client code here (via stdio transport)
    # See fastmcp documentation for client examples
```

#### Standalone (Testing)

Run directly without MCP wrapper (useful for testing):

```bash
python mcp_ui_optimizer_v4.py --demo
```

This executes the demo mode, showing how the tool works without requiring an MCP client.

---

## MCP Tools Exposed

### 1. `generate_ui_spec` — The Core Tool

Generates a complete UI specification with multi-agent critique.

**Parameters:**
```json
{
  "page_type": "dashboard",           // Type of page (string)
  "requirements": [                   // List of design requirements
    "Show KPIs",
    "Dark mode",
    "Mobile responsive"
  ],
  "design_system": {                  // Optional: custom design system
    "tokens": {...},
    "constraints": {...}
  },
  "target_audience": "product managers",  // Optional: user demographic
  "use_cache": true                   // Optional: use cached results (default: true)
}
```

**Returns:**
```json
{
  "status": "success",
  "page_type": "dashboard",
  "selected_specification": {         // Primary spec (best consensus score)
    "version": "1.0",
    "metadata": {...},
    "design_system": {...},
    "components": [...],
    "validations": {...}
  },
  "alternatives": [...],              // Alternative specs (lower scores)
  "critique": {
    "agents": {
      "designer": {...},
      "engineer": {...},
      "advocate": {...}
    },
    "consensus_score": 0.87,
    "recommendation": "proceed"
  },
  "metadata": {
    "design_system_id": "abc123...",
    "cache_key": "xyz789...",          // For future lookups
    "timestamp": "2025-05-03T..."
  }
}
```

**Example (Claude):**
```
User: Generate a UI spec for a marketing dashboard with dark mode and neon accents. 
      Target product managers.

Claude (via MCP):
```
generate_ui_spec(
  page_type="marketing_dashboard",
  requirements=[
    "KPI metrics (users, revenue, growth)",
    "Dark mode with neon accents",
    "Mobile responsive"
  ],
  design_system=None,  // Uses default Grok palette
  target_audience="product managers"
)
```

Claude gets back a complete spec with 3-agent critique and renders it.
```

---

### 2. `validate_ui_spec` — Quality Assurance

Validates an existing spec against design system and WCAG AAA standards.

**Parameters:**
```json
{
  "specification": {                  // Complete UI spec to validate
    "version": "1.0",
    "metadata": {...},
    "components": [...]
  }
}
```

**Returns:**
```json
{
  "valid": true,
  "error_count": 0,
  "errors": [],
  "warnings": [
    "Component 'Submit Button' has insufficient contrast (3.2:1)"
  ]
}
```

**Use Case:**
Before committing a design spec, validate it:
```
User: Check if this spec meets WCAG AAA requirements
Claude: validate_ui_spec(specification=<your_spec>)
```

---

### 3. `list_design_systems` — Discovery

Lists available design systems (built-in and custom).

**Returns:**
```json
{
  "available_systems": [
    {
      "id": "default_grok",
      "name": "Grok Default (Neon Dark)",
      "colors": ["primary", "secondary", "accent", ...],
      "component_count": 20,
      "wcag_level": "AAA"
    }
  ],
  "custom_systems": [
    {
      "id": "brand_2025",
      "path": "/path/to/brand_2025_system.json"
    }
  ]
}
```

---

### 4. `memory_stats` — Learning System

Get statistics on stored/learned specs and memory usage.

**Returns:**
```json
{
  "total_stored_specs": 47,
  "by_page_type": {
    "dashboard": {
      "count": 12,
      "highest_score": 0.91,
      "oldest": "2025-05-01T..."
    },
    "landing_page": {
      "count": 8,
      "highest_score": 0.88,
      "oldest": "2025-04-28T..."
    }
  },
  "memory_usage_mb": 2.3,
  "highest_score": 0.91
}
```

**Use Case:**
Monitor system performance and learning:
```
User: How many successful designs have we generated?
Claude: memory_stats() → "47 specs stored, best score: 0.91"
```

---

## LLM Provider Configuration

AetherNexus supports multiple LLM backends via a multi-provider router with automatic fallback.

### Setting the Default Provider

```bash
export DEFAULT_LLM_PROVIDER=openai  # openai, deepseek, openrouter, local, opencode
```

If your primary provider fails, the router automatically tries all other available providers.

### OpenAI (Default)

```bash
export OPENAI_API_KEY="your-key-here"
export OPENAI_MODEL="gpt-4-turbo-preview"  # Optional
export OPENAI_BASE_URL="https://api.openai.com/v1"  # Optional, for proxies/azure
```

### DeepSeek

```bash
export DEEPSEEK_API_KEY="your-deepseek-key"
export DEEPSEEK_MODEL="deepseek-chat"  # Optional, also: deepseek-reasoner
```

### OpenRouter (200+ Models)

Single API key gives access to models from OpenAI, Anthropic, Google, Meta, DeepSeek, and others.

```bash
export OPENROUTER_API_KEY="sk-or-..."
export OPENROUTER_MODEL="anthropic/claude-3.5-sonnet"  # Format: provider/model
```

### Local Models (Ollama, LM Studio, llama.cpp)

No API key required. No rate limits. No cost.

```bash
# 1. Install Ollama
curl -fsSL https://ollama.com/install.sh | sh
ollama pull llama3.2

# 2. Configure
export LOCAL_LLM_URL="http://localhost:11434/v1"  # Ollama default
export LOCAL_LLM_MODEL="llama3.2"                   # Any pulled model
```

Also works with:
- **LM Studio**: `LOCAL_LLM_URL=http://localhost:1234/v1`
- **llama.cpp server**: `LOCAL_LLM_URL=http://localhost:8080/v1`

### OpenCode CLI

Runs opencode as a local subprocess — no API keys, no rate limits.

```bash
# Install
npm install -g opencode-ai

# Configure (optional)
export OPENCODE_MODEL="opencode/hy3-preview-free"
export DEFAULT_LLM_PROVIDER="opencode"
```

### Per-Agent Provider Assignment

Route different critique agents to different LLMs:

```bash
export DESIGNER_PROVIDER="openai"     # Creative quality → GPT-4
export ENGINEER_PROVIDER="deepseek"   # Code reasoning → DeepSeek
export ADVOCATE_PROVIDER="local"      # Cost-effective → Ollama
```

### Provider Comparison

| Provider | Cost | Speed | Quality | Offline | Setup |
|----------|------|-------|---------|---------|-------|
| OpenAI | $$$ | Fast | Highest | No | API key |
| DeepSeek | $ | Fast | High | No | API key |
| OpenRouter | $$ | Fast | Varies by model | No | API key |
| Local (Ollama) | Free | Medium | Mid | Yes | Install app |
| OpenCode CLI | Free | Slow | Good | Yes | npm install |

---

## Advanced Features

### Caching

Results are cached by default (7200 seconds = 2 hours).

Cache key is based on:
- page_type
- requirements (sorted)
- design_system hash

**Benefits:**
- Identical requests return instantly
- Saves API costs
- Enables rapid iteration

**Disable caching:**
```json
{
  "use_cache": false
}
```

### Progress Reporting

During long operations, the MCP server reports progress:

```
[  0%] Starting generation...
[ 10%] Validating design system...
[ 15%] Initializing generators...
[ 25%] Generating variant 1/4...
[ 50%] Running multi-agent critique...
[ 85%] Finalizing and storing...
[100%] Complete!
```

Useful in UI clients to show real-time feedback.

### Default Design System

If no design system provided, uses **Grok's default** (built-in):
- ✅ 10 carefully chosen colors (all AAA-validated)
- ✅ 4 typography scales (heading, subheading, body, caption)
- ✅ Complete spacing scale (xs → 2xl)
- ✅ Shadow and border-radius tokens
- ✅ 20+ allowed components
- ✅ WCAG AAA constraints

Fallback is robust and production-ready.

### Custom Design Systems

Pass your own design system to enforce your brand:

```python
await generate_ui_spec_tool(
    ctx=ctx,
    page_type="dashboard",
    requirements=["Show metrics"],
    design_system={
        "tokens": {
            "colors": {
                "primary": {"hex": "#FF0000", "wcag_level": "AAA"},
                # ... your colors
            },
            "typography": {...},
            "spacing": {...}
        },
        "constraints": {
            "min_wcag_level": "AAA",
            "allowed_components": ["button", "card"],
            # ... your constraints
        }
    }
)
```

---

## Error Handling

All MCP tools handle errors gracefully:

```json
{
  "status": "error",
  "error": "Design system validation failed: color palette incomplete",
  "page_type": "dashboard"
}
```

Common errors:
- **Invalid design system** → Fallback to default
- **LLM rate limit** → Automatic exponential backoff
- **Malformed spec** → Auto-repair + warning
- **Cache corruption** → Automatic cache invalidation

---

## Monitoring & Logging

All activity is logged to stdout with timestamps:

```
2025-05-03 10:00:00 [INFO] AetherNexusPrime: 🚀 Generating UI spec for: dashboard
2025-05-03 10:00:01 [INFO] AetherNexusPrime: ✅ Cache hit for dashboard
2025-05-03 10:00:05 [INFO] AetherNexusPrime: ✅ Generated spec with consensus score: 0.87
```

For production, redirect to a logging service:

```bash
python mcp_ui_optimizer_v4.py 2>&1 | tee /var/log/aether_nexus.log
python mcp_ui_optimizer_v4.py 2>&1 | logger -t aether_nexus  # syslog
```

---

## Performance Tuning

### Reduce latency:

```python
CONFIG.max_variants = 2  # Instead of 4
CONFIG.temp_critic = 0.1  # Faster decisions
# Use faster LLM model
```

### Reduce cost:

```python
CONFIG.cache_ttl = 86400  # Cache longer (1 day)
# Use cheaper model (gpt-4-turbo vs gpt-4)
```

### Increase quality:

```python
CONFIG.max_variants = 6  # More options
CONFIG.evolution_threshold = 0.90  # Higher bar
# Use better model
```

---

## Output Schema

The tool returns a complete UISchema v1.0 with:

```json
{
  "status": "success",
  "selected_specification": {
    "version": "1.0",
    "metadata": {
      "id": "abc123...",
      "name": "Marketing Dashboard",
      "created_at": "2025-05-03T10:00:00Z"
    },
    "design_system": {...},
    "layouts": [...],
    "components": [
      {
        "id": "comp_001",
        "type": "button",
        "label": "Primary Action",
        "accessibility": {
          "aria_role": "button",
          "aria_label": "Submit form",
          "focus_visible": true
        },
        "visual": {
          "color_role": "primary",
          "size": "md"
        }
      }
    ],
    "validations": {
      "wcag_checks": {
        "contrast_ratio": 7.2,
        "min_touch_target": "44px",
        "keyboard_navigable": true
      }
    }
  },
  "alternatives": [...],
  "critique": {
    "agents": {
      "designer": {...},
      "engineer": {...},
      "advocate": {...}
    },
    "consensus_score": 0.87,
    "recommendation": "proceed"
  }
}
```

---

## Configuration

Edit `CONFIG` in `mcp_ui_optimizer_v4.py`:

```python
class Config(BaseModel):
    cache_dir: Path = Path(".aether_prime_cache")  # Cache location
    memory_dir: Path = Path(".aether_prime_memory")  # Learning storage
    cache_ttl: int = 7200  # Cache time-to-live (seconds)
    max_concurrency: int = 3  # Max parallel operations
    max_retries: int = 4  # LLM call retries
    max_repairs: int = 2  # Self-repair attempts
    
    # Temperature tuning (0.0 = deterministic, 1.0 = creative)
    temp_generator: float = 0.82  # Spec generation
    temp_critic: float = 0.15  # Multi-agent critique
    temp_synthesizer: float = 0.65  # Final synthesis
    
    # Evolution
    max_variants: int = 4  # Variants per generation
    evolution_threshold: float = 0.85  # Score threshold
    min_score_to_store: float = 0.82  # Store threshold
```

---

## Design System Format

Required design system structure:

```python
design_system = {
    "tokens": {
        "colors": {
            "primary": {"hex": "#00FF9F", "wcag_level": "AAA"},
            # All colors must specify hex and WCAG level
        },
        "typography": {
            "heading": {
                "font_family": "Inter",
                "font_size": "2.5rem",
                "font_weight": "700",
                "line_height": 1.2
            }
        },
        "spacing": {
            "xs": "0.25rem",
            "sm": "0.5rem",
            # etc.
        }
    },
    "constraints": {
        "min_wcag_level": "AA",  # or "AAA"
        "allowed_components": ["button", "card", "form"],
        "color_whitelist": ["primary", "secondary"],
        "max_component_depth": 5,
        "required_aria_roles": ["button", "navigation"]
    }
}
```

---

## Testing

### Run Unit Tests

```bash
python -m pytest test_aether_nexus.py -v
```

### Manual Test

```bash
python mcp_ui_optimizer_v4.py
# Runs example from __main__
```

### Test Multi-Agent Critique

```python
from mcp_ui_optimizer_v4 import MultiAgentCritique

async def test_critique():
    spec = {...}  # Your spec
    critique = MultiAgentCritique()
    result = await critique.review(spec, ["Requirement 1", "Requirement 2"])
    print(result)
```

### Validate WCAG Contrast

```python
from mcp_ui_optimizer_v4 import validate_wcag_contrast, WCAGLevel

result = validate_wcag_contrast("#EEEEEE", "#0A0A0A", WCAGLevel.AAA)
print(f"Ratio: {result.ratio}, Passes AAA: {result.passes_aaa}")
```

---

## Monitoring & Logging

The tool logs everything to stdout with timestamps:

```
2025-05-03 10:00:00 [INFO] AetherNexusPrime: Generating UI spec for marketing_dashboard
2025-05-03 10:00:01 [INFO] AetherNexusPrime: Starting multi-agent critique...
2025-05-03 10:00:05 [INFO] AetherNexusPrime: Critique complete. Consensus: proceed (score: 0.87)
2025-05-03 10:00:05 [INFO] AetherNexusPrime: Stored successful spec for marketing_dashboard (score: 0.87)
```

For production, pipe to a logging service:

```bash
python mcp_ui_optimizer_v4.py 2>&1 | tee /var/log/aether_nexus.log
```

---

## Performance Notes

### Speed Expectations
- **Single spec generation**: 15-30 seconds (including 3-agent critique)
- **4 variants with critique**: 60-120 seconds
- **Schema validation**: <100ms

### Cost Estimation (OpenAI GPT-4)
- Per spec: ~$0.30-0.50 (3 agent calls + generation)
- Per 100 specs: ~$30-50

### Optimization Tips
1. **Reduce max_variants** from 4 to 2 for speed
2. **Lower temp_critic** from 0.15 to 0.1 for faster decision-making
3. **Use gpt-4-turbo-preview** or faster model if available
4. **Cache similar design systems** to avoid re-validation

---

## Advanced: Custom Design Agents

Create your own agent for domain-specific critique:

```python
from mcp_ui_optimizer_v4 import DesignAgent

class BrandGuidelineAgent(DesignAgent):
    def __init__(self):
        super().__init__(
            role="Brand Manager",
            personality="Ensure the design aligns with brand voice, tone, and visual identity"
        )

# Use in critique:
custom_agent = BrandGuidelineAgent()
critique = await custom_agent.critique(spec, requirements)
```

---

## Troubleshooting

### "Failed to parse critique from {role}"
- LLM returned invalid JSON. Check API response.
- Solution: Retry or reduce `max_retries`

### "Color not in design system palette"
- Component using unlisted color.
- Solution: Add color to `design_system.tokens.colors`

### "WCAG AA contrast failed"
- Text color doesn't meet contrast ratio.
- Solution: Use lighter text on dark backgrounds, or vice versa

### Rate limiting
- Too many LLM calls too fast.
- Solution: Increase CONFIG.max_retries or reduce CONFIG.max_variants

---

## Future Roadmap

- [ ] Figma plugin integration (auto-sync specs)
- [ ] React/Vue codegen from specs
- [ ] A/B testing framework integration
- [ ] Real-time design collaboration
- [ ] Design token versioning
- [ ] Component library integration

---

## License & Support

This tool is production-ready. For issues or feature requests:
1. Check logs for error details
2. Validate design system format
3. Ensure LLM API credentials are correct
4. Open an issue with reproduction steps

---

## Key Differentiators

**Why This Beats Other UI Generators:**

1. **Multi-Agent Critique**: Three independent agents review each design (designer, engineer, accessibility expert)
2. **WCAG AAA by Default**: Accessibility is enforced, not optional
3. **Design System Enforcement**: No hallucinations—every token comes from your system
4. **Production-Ready Specs**: Output is 100% usable, not prototype-y
5. **Learning Loop**: Successful specs inform future generations
6. **Open Standard**: UISchema v1.0 works beyond just this tool

This isn't a prompt wrapper. This is a design operating system.
