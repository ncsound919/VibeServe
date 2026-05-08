┌────────────────────────────────────────────────────────────────┐
│                    MCP CLIENT LAYER                            │
│  (Claude, Python SDK, CURL, HTTP Client, etc.)               │
└──────────────────────────┬─────────────────────────────────────┘
                           │
                    MCP Protocol (stdio)
                           │
┌──────────────────────────▼─────────────────────────────────────┐
│           AetherNexus Prime v4 MCP Server                      │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ FastMCP Framework                                       │  │
│  │  - Route requests to tools                             │  │
│  │  - Handle progress reporting                           │  │
│  │  - Serialize/deserialize JSON                          │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ Tool: generate_ui_spec                                  │  │
│  │  1. Validate inputs + design system                    │  │
│  │  2. Check cache                                         │  │
│  │  3. Generate spec variants                              │  │
│  │  4. Run multi-agent critique                            │  │
│  │  5. Select best + store in memory                       │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────┬──────────────────┬────────────────────┐ │
│  │ Tool: validate   │ Tool: list_      │ Tool: memory_     │ │
│  │ _ui_spec         │ design_systems   │ stats             │ │
│  └──────────────────┴──────────────────┴────────────────────┘ │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ Core Engine                                             │  │
│  │  ┌──────────────────┬──────────────────────────────┐   │  │
│  │  │ SpecGenerator    │ MultiAgentCritique         │   │  │
│  │  │  - LLM calls     │  - DesignAgent            │   │  │
│  │  │  - Validation    │  - EngineerAgent          │   │  │
│  │  │  - Variant gen   │  - AdvocateAgent          │   │  │
│  │  │  - Memory store  │  - Synthesis              │   │  │
│  │  └──────────────────┴──────────────────────────────┘   │  │
│  │  ┌──────────────────┬──────────────────────────────┐   │  │
│  │  │ SchemaValidator  │ CacheManager               │   │  │
│  │  │  - JSONSchema    │  - Key generation          │   │  │
│  │  │  - WCAG contrast │  - TTL expiry              │   │  │
│  │  │  - Accessibility │  - Hit/miss tracking       │   │  │
│  │  │  - Auto-repair   │  - Memory cleanup          │   │  │
│  │  └──────────────────┴──────────────────────────────┘   │  │
│  └─────────────────────────────────────────────────────────┘  │
└──────────────┬─────────────────┬──────────────────┬──────────┘
               │                 │                  │
        ┌──────▼─────────┐  ┌───▼──────────┐  ┌───▼──────────┐
        │ Cache Storage  │  │ Memory DB    │  │ LLM APIs     │
        │                │  │              │  │              │
        │ .cache/        │  │ .memory/     │  │ OpenAI GPT   │
        │ <hash>.json    │  │ <page>...    │  │ DeepSeek     │
        │ (2h TTL)       │  │ .jsonl       │  │ Anthropic    │
        └────────────────┘  └──────────────┘  └──────────────┘
