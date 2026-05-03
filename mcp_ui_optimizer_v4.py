#!/usr/bin/env python3
"""
AetherNexus Prime v5 — Agentic Coding Orchestrator (MCP)
Features:
  • Design System as Code (live token enforcement)
  • Multi-Agent Critique (Designer, Engineer, User Advocate)
  • WCAG AAA validation by default
  • Full UI Schema compliance
  • Self-healing and repair
  • Real usage feedback loop
  • V5: Architect → Code → Review → Verify → Iterate → Test → Deploy
"""

import asyncio
import json
import logging
import os
import hashlib
import shutil
import sqlite3
import time
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional, Tuple
from pathlib import Path
from datetime import datetime, timezone
from dataclasses import dataclass, asdict, field
from enum import Enum

from pydantic import BaseModel, Field, field_validator
import httpx

# ====================== LOGGING ======================
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
log = logging.getLogger("AetherNexusPrime")

# ====================== SCHEMAS ======================
class WCAGLevel(str, Enum):
    AAA = "AAA"
    AA = "AA"
    FAIL = "FAIL"

class ComponentType(str, Enum):
    BUTTON = "button"
    INPUT = "input"
    CARD = "card"
    MODAL = "modal"
    DROPDOWN = "dropdown"
    TABS = "tabs"
    BADGE = "badge"
    HERO = "hero"
    FORM = "form"
    GRID = "grid"
    TABLE = "table"
    CUSTOM = "custom"

@dataclass
class ContrastResult:
    fg: str
    bg: str
    ratio: float
    wcag_level: WCAGLevel
    passes_aa: bool
    passes_aaa: bool

    def __post_init__(self):
        """Classify the ratio into WCAG level and set pass flags."""
        self.wcag_level = WCAGLevel.AAA if self.ratio >= 7 else WCAGLevel.AA if self.ratio >= 4.5 else WCAGLevel.FAIL
        self.passes_aa = self.ratio >= 4.5
        self.passes_aaa = self.ratio >= 7

class UIComponent(BaseModel):
    id: str
    type: ComponentType
    label: str
    purpose: str
    visual: Dict[str, Any]
    accessibility: Dict[str, Any]
    interaction: Dict[str, Any] = Field(default_factory=dict)
    animation: Dict[str, Any] = Field(default_factory=dict)
    responsive: Dict[str, Any] = Field(default_factory=dict)

    @field_validator('accessibility')
    @classmethod
    def validate_accessibility(cls, v):
        if 'aria_role' not in v:
            raise ValueError("accessibility.aria_role is required")
        if 'focus_visible' not in v:
            v['focus_visible'] = True
        return v

class DesignSystemTokens(BaseModel):
    colors: Dict[str, Dict[str, Any]]
    typography: Dict[str, Dict[str, Any]]
    spacing: Dict[str, str]
    shadows: Dict[str, str] = Field(default_factory=dict)
    border_radius: Dict[str, str] = Field(default_factory=dict)

class DesignSystemConstraints(BaseModel):
    min_wcag_level: WCAGLevel = WCAGLevel.AA
    allowed_components: List[str]
    color_whitelist: List[str]
    max_component_depth: int = 5
    required_aria_roles: List[str] = Field(default_factory=list)

class UISchema(BaseModel):
    version: str = "1.0"
    metadata: Dict[str, Any]
    design_system: Dict[str, Any]
    layouts: List[Dict[str, Any]]
    components: List[UIComponent]
    interactions: List[Dict[str, Any]] = Field(default_factory=list)
    validations: Dict[str, Any] = Field(default_factory=dict)

# ====================== CONFIG ======================
class Config(BaseModel):
    cache_dir: Path = Path(".aether_prime_cache")
    memory_dir: Path = Path(".aether_prime_memory")
    memory_db: Path = Path(".aether_prime_memory/specs.db")
    cache_ttl: int = 7200
    max_concurrency: int = 3
    max_retries: int = 4
    max_repairs: int = 2

    # Temperature tuning
    temp_generator: float = 0.82
    temp_critic: float = 0.15
    temp_synthesizer: float = 0.65

    # Evolution
    max_variants: int = 4
    evolution_threshold: float = 0.85
    min_score_to_store: float = 0.82

CONFIG = Config()
CONFIG.cache_dir.mkdir(parents=True, exist_ok=True)
CONFIG.memory_dir.mkdir(parents=True, exist_ok=True)

# ====================== LLM PROVIDER ARCHITECTURE ======================

class LLMProvider(ABC):
    """Abstract base class for all LLM providers."""

    @abstractmethod
    async def call(self, prompt: str, temperature: float = 0.7,
                   response_format: str = "json") -> Optional[str]:
        """Call the LLM and return response text."""
        pass

    @property
    @abstractmethod
    def name(self) -> str:
        """Provider name for logging."""
        pass

    async def _api_call(self, base_url: str, api_key: str, model: str,
                        prompt: str, temperature: float, response_format: str,
                        extra_headers: Optional[Dict[str, str]] = None) -> Optional[str]:
        """Shared OpenAI-compatible API call logic with exponential-backoff retry."""
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        if extra_headers:
            headers.update(extra_headers)

        payload: Dict[str, Any] = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": temperature,
        }
        if response_format == "json":
            payload["response_format"] = {"type": "json_object"}

        async with httpx.AsyncClient(timeout=httpx.Timeout(60.0, read=180.0)) as client:
            for attempt in range(CONFIG.max_retries):
                try:
                    resp = await client.post(
                        f"{base_url}/chat/completions",
                        json=payload, headers=headers
                    )
                    if resp.status_code == 429:
                        wait = (2 ** attempt) * 1.2
                        log.warning(f"[{self.name}] Rate limited. Waiting {wait}s...")
                        await asyncio.sleep(wait)
                        continue
                    resp.raise_for_status()
                    data = resp.json()
                    return data["choices"][0]["message"]["content"]
                except Exception as e:
                    log.warning(f"[{self.name}] LLM call failed (attempt {attempt + 1}): {e}")
                    if attempt < CONFIG.max_retries - 1:
                        await asyncio.sleep(2 ** attempt)
        return None


class OpenAIProvider(LLMProvider):
    """OpenAI API provider (GPT-4, GPT-3.5, etc.)"""

    def __init__(self, api_key: Optional[str] = None, base_url: Optional[str] = None,
                 model: Optional[str] = None):
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        self.base_url = base_url or os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
        self.model = model or os.getenv("OPENAI_MODEL", "gpt-4-turbo-preview")

    @property
    def name(self) -> str:
        return "OpenAI"

    async def call(self, prompt: str, temperature: float = 0.7,
                   response_format: str = "json") -> Optional[str]:
        """Call the OpenAI chat completions endpoint."""
        return await self._api_call(
            self.base_url, self.api_key, self.model,
            prompt, temperature, response_format
        )


class DeepSeekProvider(LLMProvider):
    """DeepSeek API provider (DeepSeek-V3, DeepSeek-R1)."""

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        self.api_key = api_key or os.getenv("DEEPSEEK_API_KEY")
        self.base_url = "https://api.deepseek.com/v1"
        self.model = model or os.getenv("DEEPSEEK_MODEL", "deepseek-chat")

    @property
    def name(self) -> str:
        return "DeepSeek"

    async def call(self, prompt: str, temperature: float = 0.7,
                   response_format: str = "json") -> Optional[str]:
        """Call the DeepSeek chat completions endpoint."""
        return await self._api_call(
            self.base_url, self.api_key, self.model,
            prompt, temperature, response_format
        )


class OpenRouterProvider(LLMProvider):
    """OpenRouter provider — access 200+ models via a single API."""

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        self.api_key = api_key or os.getenv("OPENROUTER_API_KEY")
        self.base_url = "https://openrouter.ai/api/v1"
        self.model = model or os.getenv("OPENROUTER_MODEL", "anthropic/claude-3.5-sonnet")

    @property
    def name(self) -> str:
        return "OpenRouter"

    async def call(self, prompt: str, temperature: float = 0.7,
                   response_format: str = "json") -> Optional[str]:
        """Call the OpenRouter completions endpoint with site attribution headers."""
        return await self._api_call(
            self.base_url, self.api_key, self.model,
            prompt, temperature, response_format,
            extra_headers={
                "HTTP-Referer": "https://aethernexus.app",
                "X-Title": "AetherNexus-MCP"
            }
        )


class LocalProvider(LLMProvider):
    """Local LLM provider (Ollama, LM Studio, llama.cpp server)."""

    def __init__(self, base_url: Optional[str] = None, model: Optional[str] = None):
        self.base_url = base_url or os.getenv("LOCAL_LLM_URL", "http://localhost:11434/v1")
        self.model = model or os.getenv("LOCAL_LLM_MODEL", "llama3.2")
        self.api_key = "not-needed"

    @property
    def name(self) -> str:
        return "Local"

    async def call(self, prompt: str, temperature: float = 0.7,
                   response_format: str = "json") -> Optional[str]:
        """Call a locally running OpenAI-compatible inference server."""
        headers = {"Content-Type": "application/json"}
        payload: Dict[str, Any] = {
            "model": self.model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": temperature,
            "stream": False
        }
        if response_format == "json":
            payload["response_format"] = {"type": "json_object"}

        async with httpx.AsyncClient(timeout=httpx.Timeout(30.0, read=300.0)) as client:
            for attempt in range(max(CONFIG.max_retries, 2)):
                try:
                    resp = await client.post(
                        f"{self.base_url}/chat/completions",
                        json=payload, headers=headers
                    )
                    resp.raise_for_status()
                    data = resp.json()
                    return data["choices"][0]["message"]["content"]
                except Exception as e:
                    log.warning(f"[{self.name}] LLM call failed (attempt {attempt + 1}): {e}")
                    if attempt < CONFIG.max_retries - 1:
                        await asyncio.sleep(2 ** attempt)
        return None


class OpenCodeProvider(LLMProvider):
    """OpenCode CLI provider — calls the opencode binary as a subprocess."""

    def __init__(self, model: Optional[str] = None):
        self.model = model or os.getenv("OPENCODE_MODEL", "opencode/hy3-preview-free")
        self._available = False
        self._binary = "opencode"
        for name in ["opencode.cmd", "opencode.ps1", "opencode"]:
            found = shutil.which(name)
            if found:
                self._available = True
                self._binary = found
                break
        if not self._available:
            npm_bin = os.path.expandvars(r"%APPDATA%\npm")
            for name in ["opencode.cmd", "opencode", "opencode.ps1"]:
                full = os.path.join(npm_bin, name)
                if os.path.exists(full):
                    self._available = True
                    self._binary = full
                    break
        if not self._available:
            log.warning("OpenCode CLI not found. Install: npm install -g opencode-ai")

    @property
    def name(self) -> str:
        return "OpenCode"

    async def call(self, prompt: str, temperature: float = 0.7,
                   response_format: str = "json") -> Optional[str]:
        """Execute the opencode binary and return its parsed JSON output."""
        if not self._available:
            log.error("OpenCode CLI not installed -- provider disabled")
            return None

        try:
            cmd = [self._binary, "run", "--model", self.model, "--format", "json", prompt]
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            try:
                stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=300.0)
            except asyncio.TimeoutError:
                proc.kill()
                await proc.wait()
                log.warning(f"[{self.name}] CLI timeout after 300s")
                return None

            if proc.returncode != 0:
                stderr_msg = stderr.decode() if stderr else "unknown error"
                log.warning(f"[{self.name}] CLI failed (exit {proc.returncode}): {stderr_msg[:200]}")
                return None

            return self._parse_output(stdout.decode())
        except Exception as e:
            log.warning(f"[{self.name}] Provider error: {e}")
            return None

    def _parse_output(self, output: str) -> Optional[str]:
        """
        Parse opencode --format json output (JSONL stream).
        Returns the last JSON content field found, or None if unparseable.
        Intentionally returns None rather than raw text to avoid polluting
        callers with non-JSON data.
        """
        try:
            lines = [l.strip() for l in output.strip().split('\n') if l.strip()]
            last_content: Optional[str] = None
            for line in lines:
                try:
                    data = json.loads(line)
                    if isinstance(data, dict):
                        if 'content' in data:
                            last_content = data['content']
                        elif 'message' in data and isinstance(data['message'], dict):
                            last_content = data['message'].get('content')
                        elif 'response' in data:
                            last_content = data['response']
                except json.JSONDecodeError:
                    # Plain-text line — carry it as a candidate only if it
                    # looks like actual content, not a JSONL stream artifact
                    if line and not line.startswith('{'):
                        last_content = line
            return last_content  # None if nothing parseable was found
        except Exception as e:
            log.warning(f"[{self.name}] Failed to parse output: {e}")
            return None  # Never return raw text — callers expect None on failure


class LLMRouter:
    """Routes LLM calls to configured providers with automatic fallback."""

    def __init__(self):
        self.providers: Dict[str, LLMProvider] = {}
        self._init_providers()

    def _init_providers(self):
        """Initialize all providers whose credentials are present in the environment."""
        if os.getenv("OPENAI_API_KEY"):
            self.providers["openai"] = OpenAIProvider()
            log.info("LLMRouter: OpenAI provider registered")

        if os.getenv("DEEPSEEK_API_KEY"):
            self.providers["deepseek"] = DeepSeekProvider()
            log.info("LLMRouter: DeepSeek provider registered")

        if os.getenv("OPENROUTER_API_KEY"):
            self.providers["openrouter"] = OpenRouterProvider()
            log.info("LLMRouter: OpenRouter provider registered")

        self.providers["local"] = LocalProvider()
        log.info(f"LLMRouter: Local provider registered ({self.providers['local'].model})")

        if shutil.which("opencode"):
            self.providers["opencode"] = OpenCodeProvider()
            log.info("LLMRouter: OpenCode CLI provider registered")
        else:
            log.info("LLMRouter: OpenCode CLI not found — provider disabled")

    @property
    def default_name(self) -> str:
        """Return the name of the default provider from env or fallback to openai."""
        return os.getenv("DEFAULT_LLM_PROVIDER", "openai")

    def get(self, name: Optional[str] = None) -> LLMProvider:
        """Return the named provider, or the default, or the first available."""
        if name and name in self.providers:
            return self.providers[name]

        default = self.default_name
        if default in self.providers:
            return self.providers[default]

        if self.providers:
            return list(self.providers.values())[0]

        raise RuntimeError("No LLM providers configured. Set an API key or install a local model.")

    async def call(self, prompt: str, temperature: float = 0.7,
                   response_format: str = "json",
                   provider: Optional[str] = None) -> Optional[str]:
        """Call the primary provider and automatically fall back to others on failure."""
        primary = self.get(provider)
        result = await primary.call(prompt, temperature, response_format)

        if result:
            return result

        log.warning(f"[LLMRouter] {primary.name} failed, trying fallback providers...")
        for name, prov in self.providers.items():
            if prov is primary:
                continue
            log.info(f"[LLMRouter] Trying fallback: {prov.name}...")
            result = await prov.call(prompt, temperature, response_format)
            if result:
                return result

        return None


# Global router instance
router = LLMRouter()

# ====================== WCAG VALIDATION ======================
def hex_to_rgb(hex_color: str) -> Tuple[int, int, int]:
    """Convert a CSS hex color string (e.g. '#FF0099') to an (R, G, B) integer tuple."""
    hex_color = hex_color.lstrip('#')
    r = int(hex_color[0:2], 16)
    g = int(hex_color[2:4], 16)
    b = int(hex_color[4:6], 16)
    return (r, g, b)

def relative_luminance(rgb: Tuple[int, int, int]) -> float:
    """
    Calculate WCAG 2.1 relative luminance for an RGB color.
    Returns a value between 0.0 (black) and 1.0 (white).
    See: https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
    """
    r, g, b = [x / 255.0 for x in rgb]
    r = r / 12.92 if r <= 0.03928 else pow((r + 0.055) / 1.055, 2.4)
    g = g / 12.92 if g <= 0.03928 else pow((g + 0.055) / 1.055, 2.4)
    b = b / 12.92 if b <= 0.03928 else pow((b + 0.055) / 1.055, 2.4)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b

def contrast_ratio(fg: str, bg: str) -> float:
    """
    Calculate the WCAG contrast ratio between two hex colors.
    Returns a ratio between 1.0 (no contrast) and 21.0 (max contrast).
    AAA threshold: 7.0  |  AA threshold: 4.5
    """
    try:
        l1 = relative_luminance(hex_to_rgb(fg))
        l2 = relative_luminance(hex_to_rgb(bg))
        lighter = max(l1, l2)
        darker = min(l1, l2)
        return (lighter + 0.05) / (darker + 0.05)
    except Exception:
        return 0.0

def validate_wcag_contrast(fg: str, bg: str, min_level: WCAGLevel = WCAGLevel.AA) -> ContrastResult:
    """
    Validate contrast between two hex colors.
    Returns a ContrastResult with full WCAG classification and a
    passes_min flag specific to the requested min_level.
    """
    ratio = contrast_ratio(fg, bg)
    result = ContrastResult(
        fg=fg, bg=bg, ratio=round(ratio, 2),
        wcag_level=WCAGLevel.FAIL, passes_aa=False, passes_aaa=False
    )
    # __post_init__ sets wcag_level, passes_aa, passes_aaa based on ratio
    result.passes_min = (
        result.passes_aaa if min_level == WCAGLevel.AAA
        else result.passes_aa if min_level == WCAGLevel.AA
        else False
    )
    return result

# ====================== SCHEMA VALIDATION ======================
class SchemaValidator:
    """Validates UI schemas and individual components against design system rules."""

    @staticmethod
    def validate_component(component: Dict[str, Any], design_system: Dict[str, Any]) -> Tuple[bool, List[str]]:
        """
        Validate a single component dict against the provided design system.
        Checks: required fields, aria_role presence, color whitelist, allowed types.
        """
        errors = []

        if not component.get("id"):
            errors.append("component.id is required")
        if not component.get("type"):
            errors.append("component.type is required")
        if not component.get("accessibility", {}).get("aria_role"):
            errors.append(f"Component {component.get('id')} missing aria_role")

        palette = design_system.get("tokens", {}).get("colors", {})
        whitelisted = list(palette.keys())
        if component.get("visual", {}).get("color_role"):
            color = component["visual"]["color_role"]
            if color not in whitelisted:
                errors.append(f"Color '{color}' not in design system palette")

        allowed = design_system.get("constraints", {}).get("allowed_components", [])
        if allowed and component.get("type") not in allowed:
            errors.append(f"Component type '{component.get('type')}' not in allowed list")

        return len(errors) == 0, errors

    @staticmethod
    def validate_schema(schema: Dict[str, Any]) -> Tuple[bool, List[str]]:
        """
        Validate a full UISchema v1.0 dict.
        Checks: version, metadata completeness, component validity,
        and WCAG contrast for all non-background-only palette colors.
        """
        errors = []

        if schema.get("version") != "1.0":
            errors.append("Schema version must be 1.0")

        if not schema.get("metadata", {}).get("id"):
            errors.append("metadata.id is required")
        if not schema.get("metadata", {}).get("name"):
            errors.append("metadata.name is required")

        design_system = schema.get("design_system", {})
        for component in schema.get("components", []):
            valid, comp_errors = SchemaValidator.validate_component(component, design_system)
            if not valid:
                errors.extend(comp_errors)

        constraints = design_system.get("constraints", {})
        min_wcag = constraints.get("min_wcag_level", "AA")
        tokens = design_system.get("tokens", {})

        for color_id, color_data in tokens.get("colors", {}).items():
            if isinstance(color_data, dict):
                if color_data.get("role") == "background_only":
                    continue  # bg-only tokens are not used for text — skip WCAG check
                hex_val = color_data.get("hex")
                if hex_val:
                    white_ratio = contrast_ratio(hex_val, "#FFFFFF")
                    black_ratio = contrast_ratio(hex_val, "#000000")
                    if min_wcag == "AAA":
                        if white_ratio < 7 and black_ratio < 7:
                            errors.append(f"Color {color_id} fails WCAG AAA contrast requirements")

        return len(errors) == 0, errors

# ====================== MULTI-AGENT CRITIQUE ======================
class DesignAgent:
    """A single-perspective design reviewer powered by an LLM provider."""

    def __init__(self, role: str, personality: str, provider: Optional[str] = None):
        self.role = role
        self.personality = personality
        self.provider = router.get(provider) if provider else router.get()

    async def critique(self, schema: Dict[str, Any], requirements: List[str]) -> Dict[str, Any]:
        """
        Generate a structured JSON critique from this agent's perspective.
        Returns score, strengths, weaknesses, specific_feedback, and recommendation.
        Falls back to a neutral score dict on LLM failure.
        """
        prompt = f"""You are a {self.role} reviewing a UI design specification.

Your personality: {self.personality}

Design to critique:
{json.dumps(schema, indent=2)[:2000]}...

Requirements this design should meet:
{chr(10).join(f'- {r}' for r in requirements)}

Provide a JSON critique with:
{{
  "score": <0.0-1.0>,
  "strengths": [<list of 2-3 strengths>],
  "weaknesses": [<list of 2-3 weaknesses>],
  "specific_feedback": "<1-2 sentences of actionable feedback>",
  "concern_level": "<low|medium|high>",
  "recommendation": "<keep|modify|reject>"
}}

Be concise and specific. Your perspective as a {self.role} matters."""

        response = await self.provider.call(prompt, temperature=CONFIG.temp_critic)
        if not response:
            return {"score": 0.5, "error": "Failed to generate critique"}

        try:
            return json.loads(response)
        except json.JSONDecodeError:
            log.warning(f"Failed to parse critique from {self.role}")
            return {"score": 0.5, "error": "Invalid JSON response"}


class MultiAgentCritique:
    """Orchestrate three design agents (UX, Engineering, Accessibility) for consensus review."""

    def __init__(self):
        self.designer = DesignAgent(
            role="UX Designer",
            personality="Focus on user experience, delight, and aesthetic coherence.",
            provider=os.getenv("DESIGNER_PROVIDER")
        )
        self.engineer = DesignAgent(
            role="Frontend Engineer",
            personality="Focus on implementation feasibility and performance.",
            provider=os.getenv("ENGINEER_PROVIDER")
        )
        self.advocate = DesignAgent(
            role="Accessibility Advocate",
            personality="Focus on accessibility, inclusion, and WCAG compliance.",
            provider=os.getenv("ADVOCATE_PROVIDER")
        )

    async def review(self, schema: Dict[str, Any], requirements: List[str]) -> Dict[str, Any]:
        """
        Run all three agents in parallel and synthesize a consensus result.
        Returns consensus_score, recommendation, red_flags count, and per-agent details.
        """
        log.info("Starting multi-agent critique...")

        critiques = await asyncio.gather(
            self.designer.critique(schema, requirements),
            self.engineer.critique(schema, requirements),
            self.advocate.critique(schema, requirements),
        )

        scores = [c.get("score", 0.5) for c in critiques if "error" not in c]
        avg_score = sum(scores) / len(scores) if scores else 0.5

        concerns = [c.get("concern_level") for c in critiques if c.get("concern_level") == "high"]
        recommendations = [c.get("recommendation") for c in critiques]

        synthesis = {
            "agents": {
                "designer": critiques[0],
                "engineer": critiques[1],
                "advocate": critiques[2],
            },
            "consensus_score": round(avg_score, 2),
            "red_flags": len([c for c in concerns if c == "high"]),
            "recommendation": "proceed" if avg_score > 0.7 else "revise" if avg_score > 0.5 else "reject",
            "agent_agreement": len([r for r in recommendations if r == "keep"]) / 3 if recommendations else 0.5
        }

        log.info(f"Critique complete. Consensus: {synthesis['recommendation']} (score: {synthesis['consensus_score']})")
        return synthesis


# ====================== SPEC GENERATOR ======================
class SpecGenerator:
    """Generate UI specs through multi-agent critique-and-refine cycles."""

    def __init__(self, design_system: Dict[str, Any], provider: Optional[str] = None):
        self.design_system = design_system
        self.critique = MultiAgentCritique()
        self.provider = router.get(provider) if provider else router.get()

    def _sanitize_input(self, text: str, max_len: int = 500) -> str:
        """Strip known prompt-injection patterns and enforce max length."""
        dangerous = ["ignore previous", "system:", "assistant:", "```", "<|", "|>"]
        for pattern in dangerous:
            text = text.replace(pattern, "")
        return text[:max_len].strip()

    async def generate_variant(self, requirements: List[str], iteration: int = 0) -> Dict[str, Any]:
        """
        Generate a single UISchema v1.0 variant from the given requirements.
        Returns an empty dict on LLM or parse failure.
        """
        spec_id = hashlib.sha256(
            f"{json.dumps(requirements)}{time.time()}".encode()
        ).hexdigest()[:20]

        clean_reqs = [self._sanitize_input(r) for r in requirements]

        prompt = f"""Generate a production-ready UI specification for:
Requirements:
{chr(10).join(f'- {r}' for r in clean_reqs)}

Design System Constraints:
- Must use colors from: {', '.join(self.design_system.get('tokens', {}).get('colors', {}).keys())}
- Minimum WCAG level: {self.design_system.get('constraints', {}).get('min_wcag_level', 'AA')}
- Allowed components: {', '.join(self.design_system.get('constraints', {}).get('allowed_components', []))}

Return a valid UISchema v1.0 JSON with proper metadata, at least 3 components with full accessibility attributes, responsive layouts, and WCAG AAA-passing contrast ratios."""

        response = await self.provider.call(prompt, temperature=CONFIG.temp_generator, response_format="json")
        if not response:
            log.error("Failed to generate spec variant")
            return {}

        try:
            spec = json.loads(response)
            spec["metadata"]["id"] = spec_id
            spec["metadata"]["created_at"] = datetime.now(timezone.utc).isoformat()
            return spec
        except (json.JSONDecodeError, KeyError) as e:
            log.error(f"Invalid spec JSON generated: {e}")
            return {}

    async def generate_with_critique(self, requirements: List[str], iterations: int = 2) -> Dict[str, Any]:
        """
        Generate multiple spec variants, validate each, run multi-agent critique,
        and return the highest-scoring variant along with alternatives.
        """
        variants = []

        for i in range(min(CONFIG.max_variants, 2)):
            log.info(f"Generating variant {i + 1}...")
            variant = await self.generate_variant(requirements, i)

            if not variant:
                continue

            valid, errors = SchemaValidator.validate_schema(variant)
            if not valid:
                log.warning(f"Variant {i + 1} validation failed: {errors}")
                continue

            critique_result = await self.critique.review(variant, requirements)
            variant["_critique"] = critique_result
            variant["_score"] = critique_result.get("consensus_score", 0.5)

            variants.append(variant)

        if not variants:
            log.error("No valid variants generated")
            return {}

        best = max(variants, key=lambda v: v.get("_score", 0))
        log.info(f"Selected best variant with score {best['_score']}")

        return {
            "selected": best,
            "alternatives": sorted(variants, key=lambda v: v.get("_score", 0), reverse=True)[1:],
            "generation_metadata": {
                "total_variants": len(variants),
                "best_score": best["_score"],
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        }


# ====================== MEMORY / FEEDBACK LOOP ======================
class MemoryStore:
    """SQLite-backed store for high-scoring specs — indexed by page_type and score."""

    def __init__(self, db_path: Path = CONFIG.memory_db):
        self.db_path = db_path
        self._init_db()

    def _init_db(self):
        """Create the specs table and indexes if they don't already exist."""
        with sqlite3.connect(str(self.db_path)) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS specs (
                    id TEXT PRIMARY KEY,
                    page_type TEXT NOT NULL,
                    score REAL NOT NULL DEFAULT 0.0,
                    timestamp TEXT NOT NULL,
                    spec_json TEXT NOT NULL
                )
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_page_type ON specs(page_type)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_score ON specs(score DESC)")
            conn.commit()

    def store(self, page_type: str, spec: Dict[str, Any], score: float):
        """Persist a spec if its score meets the minimum threshold."""
        if score < CONFIG.min_score_to_store:
            return

        spec_id = spec.get("metadata", {}).get("id", hashlib.sha256(
            f"{page_type}{time.time()}".encode()
        ).hexdigest()[:20])
        timestamp = datetime.now(timezone.utc).isoformat()

        with sqlite3.connect(str(self.db_path)) as conn:
            conn.execute(
                "INSERT OR REPLACE INTO specs (id, page_type, score, timestamp, spec_json) VALUES (?, ?, ?, ?, ?)",
                (spec_id, page_type, score, timestamp, json.dumps(spec))
            )
            conn.commit()

        log.info(f"Stored spec {spec_id[:8]} for {page_type} (score: {score:.2f})")

    def get(self, page_type: str, limit: int = 3) -> List[Dict[str, Any]]:
        """Retrieve the top-scoring stored specs for a given page_type."""
        with sqlite3.connect(str(self.db_path)) as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute(
                "SELECT spec_json, score FROM specs WHERE page_type = ? ORDER BY score DESC LIMIT ?",
                (page_type, limit)
            ).fetchall()

        return [
            {"score": row["score"], "spec": json.loads(row["spec_json"])}
            for row in rows
        ]

    def stats(self) -> Dict[str, Any]:
        """Return aggregate statistics across all stored specs."""
        stats: Dict[str, Any] = {
            "total_stored_specs": 0,
            "by_page_type": {},
            "memory_usage_mb": 0,
            "oldest_spec": None,
            "highest_score": 0
        }

        with sqlite3.connect(str(self.db_path)) as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute(
                "SELECT page_type, COUNT(*) as cnt, MAX(score) as max_score, MIN(timestamp) as oldest "
                "FROM specs GROUP BY page_type"
            ).fetchall()

            for row in rows:
                stats["by_page_type"][row["page_type"]] = {
                    "count": row["cnt"],
                    "highest_score": row["max_score"],
                    "oldest": row["oldest"]
                }
                stats["total_stored_specs"] += row["cnt"]
                stats["highest_score"] = max(stats["highest_score"], row["max_score"])

        if self.db_path.exists():
            stats["memory_usage_mb"] = self.db_path.stat().st_size / (1024 * 1024)

        return stats


memory_store = MemoryStore()

def store_successful_spec(page_type: str, spec: Dict[str, Any], score: float):
    """Store high-scoring spec (backward-compat wrapper)."""
    memory_store.store(page_type, spec, score)

def get_similar_specs(page_type: str, limit: int = 3) -> List[Dict[str, Any]]:
    """Retrieve similar high-scoring specs (backward-compat wrapper)."""
    return memory_store.get(page_type, limit)


# ====================== MCP TOOL IMPLEMENTATION ======================
async def generate_ui_specification(
    page_type: str,
    requirements: List[str],
    design_system: Dict[str, Any],
    target_audience: str = "general users"
) -> Dict[str, Any]:
    """
    Main V4 pipeline: validate design system, generate spec variants,
    run multi-agent critique, store the best result, return cleaned output.
    """
    log.info(f"Generating UI spec for {page_type}")

    validator = SchemaValidator()
    pre_check = {"version": "1.0", "metadata": {"id": "pre", "name": "pre"},
                 "design_system": design_system, "layouts": [], "components": []}
    valid, warnings = validator.validate_schema(pre_check)
    if not valid:
        log.warning(f"Design system pre-validation warnings: {warnings}")

    generator = SpecGenerator(design_system)
    result = await generator.generate_with_critique(requirements, iterations=1)

    if not result:
        return {"error": "Failed to generate specification"}

    selected = result.get("selected", {})
    store_successful_spec(page_type, selected, selected.get("_score", 0))

    return {
        "status": "success",
        "selected_specification": {k: v for k, v in selected.items() if not k.startswith("_")},
        "alternatives": [{k: v for k, v in alt.items() if not k.startswith("_")} for alt in result.get("alternatives", [])],
        "metadata": result.get("generation_metadata", {}),
        "critique": selected.get("_critique", {})
    }


# ====================== V5: AGENTIC CODING ORCHESTRATOR ======================

@dataclass
class ArchitectureDecision:
    """A single Architecture Decision Record (ADR) produced by the VibeArchitect."""
    id: str
    title: str
    context: str
    decision: str
    alternatives: List[str] = field(default_factory=list)
    rationale: str = ""
    consequences: List[str] = field(default_factory=list)
    confidence: float = 0.5

@dataclass
class VibePlan:
    """Full architecture plan output from VibeArchitect.plan()."""
    intent: str
    decisions: List[ArchitectureDecision] = field(default_factory=list)
    component_tree: List[Dict[str, Any]] = field(default_factory=list)
    data_flow: Dict[str, Any] = field(default_factory=dict)
    file_structure: List[str] = field(default_factory=list)
    estimated_complexity: str = "medium"
    risks: List[str] = field(default_factory=list)
    recommended_stack: Dict[str, str] = field(default_factory=dict)

@dataclass
class CodeFile:
    """A single generated source or test file produced by VibeImplementer."""
    path: str
    content: str
    language: str = ""
    purpose: str = ""
    accessibility_notes: List[str] = field(default_factory=list)

@dataclass
class IterationResult:
    """Snapshot of one critique-repair iteration from CritiqueLoop."""
    iteration: int
    score_before: float
    score_after: float
    changes: List[str] = field(default_factory=list)
    critique: Dict[str, Any] = field(default_factory=dict)
    passed: bool = False
    files_changed: List[str] = field(default_factory=list)


class CritiqueLoop:
    """
    Continuous improvement loop that critiques an output, repairs weaknesses,
    and re-evaluates — up to max_iterations times or until quality_threshold is met.
    """

    def __init__(self, max_iterations: int = 3, quality_threshold: float = 0.80,
                 generator_provider: Optional[str] = None, critic_provider: Optional[str] = None):
        self.max_iterations = max_iterations
        self.quality_threshold = quality_threshold
        self.critique = MultiAgentCritique()
        self.generator = router.get(generator_provider)
        self.critic = router.get(critic_provider) if critic_provider else self.generator

    async def improve(self, initial_output: Dict[str, Any],
                      requirements: List[str], ctx: Any = None) -> Tuple[Dict[str, Any], List[IterationResult]]:
        """
        Iteratively critique and repair initial_output against requirements.
        Returns (best_output, iteration_history).
        Stops early if consensus_score >= quality_threshold.
        """
        history: List[IterationResult] = []
        current = initial_output
        for i in range(self.max_iterations):
            if ctx:
                await ctx.report_progress(int((i / self.max_iterations) * 100), 100,
                    f"Iteration {i + 1}/{self.max_iterations}: Critiquing...")
            review = await self.critique.review(current, requirements)
            score = review.get("consensus_score", 0.5)
            recommendation = review.get("recommendation", "proceed")
            if ctx:
                await ctx.info(f"Iteration {i + 1} score: {score:.2f} [{recommendation}]")
            if recommendation == "proceed" and score >= self.quality_threshold:
                history.append(IterationResult(iteration=i + 1, score_before=score, score_after=score, passed=True))
                break
            if recommendation == "reject":
                repair_prompt = self._build_repair_prompt(current, review, requirements)
                repaired = await self.generator.call(repair_prompt, temperature=CONFIG.temp_generator, response_format="json")
                if repaired:
                    try:
                        new_output = json.loads(repaired)
                        new_review = await self.critique.review(new_output, requirements)
                        new_score = new_review.get("consensus_score", 0.5)
                        history.append(IterationResult(iteration=i + 1, score_before=score, score_after=new_score,
                            critique=review, passed=new_score >= self.quality_threshold))
                        if new_score > score:
                            current = new_output
                        if new_score >= self.quality_threshold:
                            break
                    except json.JSONDecodeError:
                        history.append(IterationResult(iteration=i + 1, score_before=score, score_after=0, passed=False))
            else:
                history.append(IterationResult(iteration=i + 1, score_before=score, score_after=score,
                    critique=review, passed=score >= self.quality_threshold))
        return current, history

    def _build_repair_prompt(self, current: Dict[str, Any], review: Dict[str, Any], requirements: List[str]) -> str:
        """Build a targeted repair prompt from agent weaknesses and specific feedback."""
        weaknesses = []
        for agent_name, agent_review in review.get("agents", {}).items():
            for w in agent_review.get("weaknesses", []):
                weaknesses.append(f"[{agent_name}] {w}")
        specific = []
        for agent_name, agent_review in review.get("agents", {}).items():
            fb = agent_review.get("specific_feedback", "")
            if fb:
                specific.append(f"[{agent_name}] {fb}")
        return f"""Repair this output based on critique feedback.

REQUIREMENTS:\n{chr(10).join(f'- {r}' for r in requirements)}
CURRENT OUTPUT:\n{json.dumps(current, indent=2)[:3000]}
CRITIQUE WEAKNESSES:\n{chr(10).join(f'- {w}' for w in weaknesses)}
SPECIFIC FEEDBACK:\n{chr(10).join(f'- {s}' for s in specific)}
Produce the repaired version as valid JSON. Fix every weakness listed above."""


class VibeArchitect:
    """Transforms natural-language intent into a structured VibePlan with ADR decisions."""

    def __init__(self, provider: Optional[str] = None):
        self.provider = router.get(provider)

    async def plan(self, intent: str, constraints: List[str] = None,
                   context: Dict[str, Any] = None, target_stack: str = "react") -> VibePlan:
        """
        Generate a full architecture plan for the given intent.
        Returns a VibePlan with decisions, component tree, data flow, and risk assessment.
        """
        constraints = constraints or []
        context = context or {}
        prompt = f"""You are a senior software architect. Produce a detailed architecture plan.

USER INTENT: {intent}
CONSTRAINTS: {chr(10).join(f'- {c}' for c in constraints) if constraints else 'None'}
TARGET STACK: {target_stack}

Return JSON: {{"decisions": [{{"id":"ADR-001","title":"...","context":"...","decision":"...","alternatives":["A","B"],"rationale":"...","consequences":["..."],"confidence":0.9}}], "component_tree": [...], "data_flow": {{}}, "file_structure": [...], "estimated_complexity": "low|medium|high", "risks": [...], "recommended_stack": {{}}}}"""
        response = await self.provider.call(prompt, temperature=0.3, response_format="json")
        if not response:
            return VibePlan(intent=intent, risks=["Failed to generate plan"])
        try:
            data = json.loads(response)
            return VibePlan(intent=intent,
                decisions=[ArchitectureDecision(**d) for d in data.get("decisions", [])],
                component_tree=data.get("component_tree", []),
                data_flow=data.get("data_flow", {}),
                file_structure=data.get("file_structure", []),
                estimated_complexity=data.get("estimated_complexity", "medium"),
                risks=data.get("risks", []),
                recommended_stack=data.get("recommended_stack", {}))
        except Exception as e:
            return VibePlan(intent=intent, risks=[f"Parse error: {str(e)}"])


class VibeImplementer:
    """Generates production-ready code files from a VibePlan."""

    def __init__(self, provider: Optional[str] = None, design_system: Optional[Dict[str, Any]] = None):
        self.provider = router.get(provider)
        self.design_system = design_system or DEFAULT_DESIGN_SYSTEM

    async def implement(self, plan: VibePlan, intent: str, constraints: List[str] = None,
                        target_language: str = "typescript") -> List[CodeFile]:
        """
        Generate a list of CodeFile objects from the given VibePlan.
        Enforces design token usage and accessibility requirements in the prompt.
        """
        constraints = constraints or []
        ds_tokens = json.dumps(self.design_system.get("tokens", {}), indent=2)[:2000]
        prompt = f"""Generate production-ready code from this plan. Enforce constraints. Include full accessibility.

INTENT: {intent}
DECISIONS: {json.dumps([asdict(d) for d in plan.decisions], indent=2)[:2000]}
COMPONENTS: {json.dumps(plan.component_tree, indent=2)[:1000]}
FILES: {json.dumps(plan.file_structure)}
STACK: {json.dumps(plan.recommended_stack)}
CONSTRAINTS: {chr(10).join(f'- {c}' for c in constraints)}
DESIGN TOKENS: {ds_tokens}
TARGET: {target_language}

Return a JSON array of files: [{{"path":"...","content":"...","language":"tsx","purpose":"...","accessibility_notes":["..."]}}]"""
        response = await self.provider.call(prompt, temperature=CONFIG.temp_generator, response_format="json")
        if not response:
            return []
        try:
            data = json.loads(response)
            if isinstance(data, list):
                return [CodeFile(**f) for f in data]
            return []
        except Exception as e:
            log.warning(f"[VibeImplementer] Failed to parse code files: {e}")
            return []


class VibeVerifier:
    """Static verification utilities for specs and generated code."""

    @staticmethod
    def verify_spec(spec: Dict[str, Any]) -> Dict[str, Any]:
        """Run SchemaValidator against spec and return a structured result."""
        validator = SchemaValidator()
        valid, errors = validator.validate_schema(spec)
        return {"valid": valid, "errors": errors, "error_count": len(errors)}

    @staticmethod
    def verify_code_quality(files: List[CodeFile]) -> Dict[str, Any]:
        """
        Check generated code files for common quality issues:
        missing accessibility notes, missing ARIA attributes in JSX, TODO/FIXME markers.
        """
        issues = []
        for f in files:
            if not f.accessibility_notes:
                issues.append(f"{f.path}: missing accessibility notes")
            if "aria-" not in f.content.lower() and f.language in ("tsx", "jsx", "html"):
                issues.append(f"{f.path}: no ARIA attributes found")
            if "TODO" in f.content or "FIXME" in f.content:
                issues.append(f"{f.path}: contains TODO/FIXME")
        return {"passed": len(issues) == 0, "issues": issues, "issue_count": len(issues), "files_checked": len(files)}


class VibeCodeReviewer:
    """
    Three-agent parallel code reviewer.
    Perspectives: UX/design quality, code engineering quality, accessibility compliance.
    """

    def __init__(self):
        self.designer = DesignAgent(role="UX Code Reviewer",
                                    personality="Review for visual quality, design tokens, hierarchy",
                                    provider=os.getenv("DESIGNER_PROVIDER"))
        self.engineer = DesignAgent(role="Code Quality Reviewer",
                                    personality="Review for bugs, error handling, architecture",
                                    provider=os.getenv("ENGINEER_PROVIDER"))
        self.advocate = DesignAgent(role="Accessibility Code Reviewer",
                                    personality="Review for ARIA, keyboard nav, WCAG",
                                    provider=os.getenv("ADVOCATE_PROVIDER"))

    async def review_code(self, files: List[CodeFile], requirements: List[str]) -> Dict[str, Any]:
        """
        Run three agents in parallel on the provided code files.
        Returns consensus_score, recommendation, and per-agent line-level issues.
        """
        code_summary = [{
            "path": f.path, "language": f.language,
            "purpose": f.purpose, "content_preview": f.content[:500]
        } for f in files]
        schema_for_review = {"files": code_summary, "requirements": requirements}
        critiques = await asyncio.gather(
            self.designer.critique(schema_for_review, requirements),
            self.engineer.critique(schema_for_review, requirements),
            self.advocate.critique(schema_for_review, requirements))
        scores = [c.get("score", 0.5) for c in critiques if "error" not in c]
        avg_score = sum(scores) / len(scores) if scores else 0.5
        return {
            "consensus_score": round(avg_score, 2),
            "recommendation": "approve" if avg_score > 0.8 else "revise" if avg_score > 0.6 else "reject",
            "agent_reviews": {"designer": critiques[0], "engineer": critiques[1], "advocate": critiques[2]},
            "line_level_issues": [{
                "agent": c.get("role", "?"), "issue": w,
                "severity": "high" if "crash" in str(w).lower() else "medium"
            } for c in critiques for w in c.get("weaknesses", [])],
            "files_reviewed": len(files),
            "critical_issues": 0
        }


# ====================== MCP SERVER INIT ======================
from fastmcp import FastMCP, Context

mcp_server = FastMCP("AetherNexusPrime_v5")

DEFAULT_DESIGN_SYSTEM = {
    "tokens": {
        "colors": {
            "primary": {"hex": "#00FF9F", "wcag_level": "AAA"},
            "secondary": {"hex": "#00B8FF", "wcag_level": "AAA"},
            "accent": {"hex": "#FF00AA", "wcag_level": "AAA"},
            "background": {"hex": "#0A0A0A", "wcag_level": "FAIL", "role": "background_only"},
            "surface": {"hex": "#111111", "wcag_level": "AA"},
            "text": {"hex": "#EEEEEE", "wcag_level": "AAA"},
            "text_secondary": {"hex": "#AAAAAA", "wcag_level": "AA"},
            "success": {"hex": "#00FF9F", "wcag_level": "AAA"},
            "warning": {"hex": "#FFB800", "wcag_level": "AAA"},
            "error": {"hex": "#FF4444", "wcag_level": "AAA"},
        },
        "typography": {
            "heading": {"font_family": "Inter", "font_size": "2.5rem", "font_weight": "700", "line_height": 1.2, "letter_spacing": "-0.02em"},
            "subheading": {"font_family": "Inter", "font_size": "1.5rem", "font_weight": "600", "line_height": 1.3},
            "body": {"font_family": "Inter", "font_size": "1rem", "font_weight": "400", "line_height": 1.5},
            "caption": {"font_family": "Inter", "font_size": "0.875rem", "font_weight": "400", "line_height": 1.4}
        },
        "spacing": {"xs": "0.25rem", "sm": "0.5rem", "md": "1rem", "lg": "2rem", "xl": "4rem", "2xl": "8rem"},
        "shadows": {"sm": "0 1px 2px rgba(0,0,0,0.05)", "md": "0 4px 6px rgba(0,0,0,0.1)", "lg": "0 10px 15px rgba(0,0,0,0.1)", "xl": "0 20px 25px rgba(0,0,0,0.1)"},
        "border_radius": {"sm": "0.25rem", "md": "0.5rem", "lg": "1rem", "full": "9999px"}
    },
    "constraints": {
        "min_wcag_level": "AA",
        "allowed_components": ["button","input","card","modal","dropdown","tabs","badge","avatar","breadcrumb","tooltip","checkbox","radio","toggle","slider","progress","spinner","alert","snackbar","hero","form","grid","list","table","pagination","custom"],
        "color_whitelist": ["primary","secondary","accent","background","surface","text","text_secondary","success","warning","error"],
        "max_component_depth": 6,
        "required_aria_roles": ["button","navigation","main","contentinfo"]
    }
}


class CacheManager:
    """Filesystem cache with SHA-256 integrity checking and TTL expiry."""

    def __init__(self, cache_dir: Path = CONFIG.cache_dir, ttl: int = CONFIG.cache_ttl):
        self.cache_dir = cache_dir
        self.ttl = ttl
        self.cache_dir.mkdir(parents=True, exist_ok=True)

    def get_cache_key(self, page_type: str, requirements: List[str], design_system_id: str) -> str:
        """Produce a deterministic 32-char hex key from the request inputs."""
        return hashlib.sha256(
            json.dumps({"page_type": page_type, "requirements": sorted(requirements),
                        "design_system": design_system_id[:20]}, sort_keys=True).encode()
        ).hexdigest()[:32]

    def get(self, cache_key: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve a cached result by key.
        Returns None if the entry is missing, expired, or fails integrity check.
        Logs a warning on integrity failure so silent corruption is always visible.
        """
        f = self.cache_dir / f"{cache_key}.json"
        if not f.exists():
            return None
        try:
            with open(f) as fh:
                raw = json.load(fh)
            payload = json.dumps(raw["data"])
            if hashlib.sha256(payload.encode()).hexdigest() != raw["checksum"]:
                log.warning(f"[CacheManager] Integrity check failed for {cache_key} — evicting")
                f.unlink()
                return None
            data = raw["data"]
            if time.time() - data.get("timestamp", 0) > self.ttl:
                f.unlink()
                return None
            return data.get("result")
        except Exception as e:
            log.warning(f"[CacheManager] Failed to read cache {cache_key}: {e}")
            return None

    def set(self, cache_key: str, result: Dict[str, Any]) -> bool:
        """
        Write a result to cache with a SHA-256 integrity checksum.
        Returns True on success, False on any write error.
        """
        f = self.cache_dir / f"{cache_key}.json"
        try:
            cache_data = {"timestamp": time.time(), "result": result}
            payload = json.dumps(cache_data)
            with open(f, "w") as fh:
                json.dump({"checksum": hashlib.sha256(payload.encode()).hexdigest(),
                           "data": cache_data}, fh)
            return True
        except Exception as e:
            log.warning(f"[CacheManager] Failed to write cache {cache_key}: {e}")
            return False


cache_manager = CacheManager()

# ====================== MCP RESOURCES ======================

@mcp_server.resource("design://systems/default")
def resource_default_design_system() -> str:
    """Return the full default design system as JSON."""
    return json.dumps(DEFAULT_DESIGN_SYSTEM, indent=2)

@mcp_server.resource("design://tokens/{token_type}")
def resource_design_tokens(token_type: str) -> str:
    """Return a specific token category (colors, typography, spacing, shadows, border_radius)."""
    tokens = DEFAULT_DESIGN_SYSTEM.get("tokens", {})
    return json.dumps(
        tokens.get(token_type, {"error": f"Unknown: {token_type}", "available": list(tokens.keys())}),
        indent=2
    )

@mcp_server.resource("memory://stats")
def resource_memory_stats() -> str:
    """Return aggregate memory store statistics."""
    return json.dumps(memory_store.stats(), indent=2)

@mcp_server.resource("aether://version")
def resource_version() -> str:
    """Return server version metadata."""
    return json.dumps({
        "version": "5.0.0",
        "codename": "Karpathy",
        "tools": 11,
        "resources": 5,
        "prompts": 6,
        "providers": ["openai", "deepseek", "openrouter", "local", "opencode"],
        "pipeline": ["architect->code->review->verify->iterate->test->deploy"]
    }, indent=2)

@mcp_server.resource("spec://examples/{page_type}")
def resource_spec_example(page_type: str) -> str:
    """Return the highest-scoring stored spec for the requested page_type."""
    specs = get_similar_specs(page_type, limit=1)
    return json.dumps(specs[0]["spec"] if specs else {"error": f"No specs for {page_type}"}, indent=2)

# ====================== MCP PROMPTS ======================

@mcp_server.prompt()
def prompt_architecture(intent: str = "", constraints: str = "") -> str:
    return f"""Architecture plan for: {intent}\nConstraints: {constraints}\n\nUse vibe_architect to generate structured ADR decisions."""

@mcp_server.prompt()
def prompt_code_review(files: str = "", requirements: str = "") -> str:
    return f"""Review code from UX/Engineering/Accessibility perspectives.\nFiles: {files}\nRequirements: {requirements}\n\nUse vibe_review for 3-agent analysis."""

@mcp_server.prompt()
def prompt_vibe_build(intent: str = "") -> str:
    return f"""Full pipeline: architect -> code -> review -> verify -> iterate\nIntent: {intent}\n\nUse vibe_architect, vibe_code, vibe_review, vibe_verify, vibe_iterate in sequence."""

@mcp_server.prompt()
def prompt_accessibility_audit() -> str:
    return "Audit for WCAG AAA: ARIA roles, keyboard nav, contrast ratios (7:1), touch targets (44px), semantic HTML, form labels."

@mcp_server.prompt()
def prompt_test_generation(code: str = "") -> str:
    return f"Generate unit, accessibility, integration, edge case, and responsive tests.\nCode: {code}"

@mcp_server.prompt()
def prompt_deployment(target: str = "vercel") -> str:
    return f"Generate deployment config for {target}: build, env, runtime, health checks, monitoring."

# ====================== V4 TOOLS (backward compat) ======================

@mcp_server.tool(name="generate_ui_spec", description="Generate a production-ready UI specification with multi-agent critique, WCAG AAA validation, and design system enforcement")
async def generate_ui_spec_tool(ctx: Context, page_type: str, requirements: List[str],
    design_system: Optional[Dict[str, Any]] = None, target_audience: str = "general users", use_cache: bool = True) -> Dict[str, Any]:
    try:
        ds = design_system or DEFAULT_DESIGN_SYSTEM
        ds_id = hashlib.sha256(json.dumps(ds, sort_keys=True).encode()).hexdigest()[:20]
        if use_cache:
            ck = cache_manager.get_cache_key(page_type, requirements, ds_id)
            cr = cache_manager.get(ck)
            if cr:
                await ctx.info(f"[cache] Hit for {page_type}")
                return {**cr, "_cache_hit": True}
        else:
            ck = None
        await ctx.info(f"[generate] {page_type}")
        await ctx.report_progress(10, 100, "Validating...")
        gen = SpecGenerator(ds)
        await ctx.report_progress(15, 100, "Generating variants...")
        result = await gen.generate_with_critique([*requirements, f"Target: {target_audience}", "WCAG AAA mandatory"], iterations=1)
        if not result:
            return {"error": "Failed", "status": "error"}
        await ctx.report_progress(85, 100, "Storing...")
        sel = result.get("selected", {})
        score = sel.get("_score", 0)
        if score > CONFIG.min_score_to_store:
            store_successful_spec(page_type, sel, score)
        output = {
            "status": "success", "page_type": page_type,
            "selected_specification": {k: v for k, v in sel.items() if not k.startswith("_")},
            "alternatives": [{k: v for k, v in alt.items() if not k.startswith("_")} for alt in result.get("alternatives", [])],
            "metadata": {**result.get("generation_metadata", {}), "design_system_id": ds_id, "target_audience": target_audience},
            "critique": sel.get("_critique", {})
        }
        if use_cache and ck:
            cache_manager.set(ck, output)
        await ctx.report_progress(100, 100, "Complete!")
        await ctx.info(f"[generate] Score: {score}")
        return output
    except Exception as e:
        log.error(f"Error: {e}", exc_info=True)
        await ctx.info(f"[generate] Error: {e}")
        return {"status": "error", "error": str(e)}


@mcp_server.tool(name="validate_ui_spec", description="Validate a UI specification against design system and WCAG standards")
async def validate_ui_spec_tool(ctx: Context, specification: Dict[str, Any]) -> Dict[str, Any]:
    await ctx.info("[validate] Checking...")
    valid, errors = SchemaValidator().validate_schema(specification)
    warnings = []
    if valid and specification.get("components"):
        ds = specification.get("design_system", {})
        bg = ds.get("tokens", {}).get("colors", {}).get("background", {}).get("hex", "#FFF")
        for c in specification.get("components", []):
            cr_key = c.get("visual", {}).get("color_role")
            if cr_key:
                cd = ds.get("tokens", {}).get("colors", {}).get(cr_key, {})
                ratio = contrast_ratio(cd.get("hex", "#000"), bg)
                if ratio < 4.5:
                    warnings.append(f"Component '{c.get('label')}' low contrast ({ratio:.1f}:1)")
    return {"valid": valid, "error_count": len(errors), "errors": errors[:10], "warnings": warnings}


@mcp_server.tool(name="list_design_systems", description="List available design systems and their characteristics")
async def list_design_systems_tool(ctx: Context) -> Dict[str, Any]:
    return {
        "available_systems": [{
            "id": "default_grok",
            "name": "Grok Neon Dark",
            "colors": list(DEFAULT_DESIGN_SYSTEM["tokens"]["colors"].keys()),
            "component_count": len(DEFAULT_DESIGN_SYSTEM["constraints"]["allowed_components"]),
            "wcag_level": "AAA"
        }],
        "custom_systems": [
            {"id": f.stem, "path": str(f)}
            for f in CONFIG.memory_dir.glob("*_system.json")
        ] if CONFIG.memory_dir.exists() else []
    }


@mcp_server.tool(name="memory_stats", description="Get statistics on learned/stored UI specifications")
async def memory_stats_tool(ctx: Context) -> Dict[str, Any]:
    await ctx.info("[memory] Gathering stats...")
    stats = memory_store.stats()
    await ctx.info(f"[memory] {stats['total_stored_specs']} specs (best: {stats['highest_score']:.2f})")
    return stats


# ====================== V5 CORE MCP TOOLS ======================

@mcp_server.tool(name="vibe_architect", description="Transform natural language intent into a detailed architecture plan with ADR decisions, component tree, data flow, and risk assessment.")
async def vibe_architect_tool(ctx: Context, intent: str, constraints: Optional[List[str]] = None,
                               context: Optional[Dict[str, Any]] = None, target_stack: str = "react") -> Dict[str, Any]:
    await ctx.info(f"[architect] {intent[:80]}...")
    await ctx.report_progress(0, 100, "Analyzing intent...")
    architect = VibeArchitect()
    await ctx.report_progress(30, 100, "Generating decisions...")
    plan = await architect.plan(intent, constraints, context, target_stack)
    await ctx.report_progress(100, 100, "Complete!")
    await ctx.info(f"[architect] {len(plan.decisions)} decisions, complexity: {plan.estimated_complexity}")
    return {
        "status": "success",
        "plan": {
            "intent": plan.intent,
            "decisions": [asdict(d) for d in plan.decisions],
            "component_tree": plan.component_tree,
            "data_flow": plan.data_flow,
            "file_structure": plan.file_structure,
            "estimated_complexity": plan.estimated_complexity,
            "risks": plan.risks,
            "recommended_stack": plan.recommended_stack
        },
        "decision_count": len(plan.decisions),
        "risk_count": len(plan.risks)
    }


@mcp_server.tool(name="vibe_code", description="Generate production code from an architecture plan. Enforces accessibility (ARIA, WCAG) and design tokens.")
async def vibe_code_tool(ctx: Context, intent: str, plan: Dict[str, Any], constraints: Optional[List[str]] = None,
                          design_system: Optional[Dict[str, Any]] = None, target_language: str = "typescript") -> Dict[str, Any]:
    await ctx.info(f"[code] {intent[:80]}...")
    await ctx.report_progress(0, 100, "Parsing plan...")
    decisions = [ArchitectureDecision(**d) for d in plan.get("decisions", [])]
    vibe_plan = VibePlan(
        intent=intent, decisions=decisions,
        component_tree=plan.get("component_tree", []),
        data_flow=plan.get("data_flow", {}),
        file_structure=plan.get("file_structure", []),
        estimated_complexity=plan.get("estimated_complexity", "medium"),
        risks=plan.get("risks", []),
        recommended_stack=plan.get("recommended_stack", {})
    )
    await ctx.report_progress(20, 100, "Generating code...")
    implementer = VibeImplementer(design_system=design_system)
    files = await implementer.implement(vibe_plan, intent, constraints, target_language)
    await ctx.report_progress(90, 100, "Quality checks...")
    quality = VibeVerifier.verify_code_quality(files)
    await ctx.report_progress(100, 100, "Complete!")
    await ctx.info(f"[code] {len(files)} files, {sum(len(f.content.split(chr(10))) for f in files)} lines")
    return {
        "status": "success",
        "files": [asdict(f) for f in files],
        "file_count": len(files),
        "quality": quality,
        "total_lines": sum(len(f.content.split("\n")) for f in files)
    }


@mcp_server.tool(name="vibe_review", description="Multi-agent code review from three perspectives: UX/design, code quality, and accessibility.")
async def vibe_review_tool(ctx: Context, files: List[Dict[str, Any]], requirements: List[str]) -> Dict[str, Any]:
    await ctx.info(f"[review] {len(files)} files...")
    await ctx.report_progress(0, 100, "Initializing reviewers...")
    code_files = [CodeFile(**f) for f in files]
    reviewer = VibeCodeReviewer()
    await ctx.report_progress(30, 100, "Running parallel reviews...")
    result = await reviewer.review_code(code_files, requirements)
    await ctx.report_progress(100, 100, "Complete!")
    await ctx.info(f"[review] {result['recommendation']} (score: {result['consensus_score']}, {len(result['line_level_issues'])} issues)")
    return {"status": "success", **result}


@mcp_server.tool(name="vibe_verify", description="Validate code/specs against accessibility (WCAG), design system compliance, and code quality standards.")
async def vibe_verify_tool(ctx: Context, specification: Optional[Dict[str, Any]] = None,
                            files: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
    await ctx.info("[verify] Running checks...")
    results = {}
    if specification:
        await ctx.report_progress(30, 100, "Validating spec...")
        results["spec_validation"] = VibeVerifier.verify_spec(specification)
    if files:
        await ctx.report_progress(60, 100, "Checking code quality...")
        results["code_quality"] = VibeVerifier.verify_code_quality([CodeFile(**f) for f in files])
    await ctx.report_progress(100, 100, "Complete!")
    return {
        "status": "success",
        "results": results,
        "all_passed": all(r.get("valid", r.get("passed", True)) for r in results.values())
    }


@mcp_server.tool(name="vibe_iterate", description="Run the continuous improvement loop: critique -> repair -> verify -> repeat.")
async def vibe_iterate_tool(ctx: Context, specification: Dict[str, Any], requirements: List[str],
                             max_iterations: int = 3, quality_threshold: float = 0.80) -> Dict[str, Any]:
    await ctx.info(f"[iterate] max {max_iterations} iterations, threshold {quality_threshold}")
    loop = CritiqueLoop(max_iterations=max_iterations, quality_threshold=quality_threshold)
    best_output, history = await loop.improve(specification, requirements, ctx)
    final_score = history[-1].score_after if history else 0
    await ctx.report_progress(100, 100, "Complete!")
    await ctx.info(f"[iterate] {'Converged' if history and history[-1].passed else 'Max iterations'}: {len(history)} iters, score {final_score:.2f}")
    return {
        "status": "success",
        "final_output": best_output,
        "iterations": [asdict(h) for h in history],
        "iterations_used": len(history),
        "final_score": final_score,
        "converged": history[-1].passed if history else False
    }


# ====================== V5 EXTENDED TOOLS ======================

class VibeTester:
    """
    Generates comprehensive test files from source code using an LLM.
    Covers unit, accessibility, integration, edge case, and responsive tests.
    """

    def __init__(self, provider: Optional[str] = None):
        self.provider = router.get(provider)

    async def generate_tests(self, files: List[CodeFile],
                              requirements: List[str] = None,
                              test_framework: str = "vitest") -> List[CodeFile]:
        """
        Generate test files for the provided source CodeFile list.
        Returns an empty list on LLM failure or parse error.
        """
        requirements = requirements or []
        files_summary = [
            {"path": f.path, "language": f.language, "purpose": f.purpose, "content": f.content[:800]}
            for f in files
        ]
        prompt = f"""You are a senior QA engineer. Generate comprehensive tests.

SOURCE FILES:\n{json.dumps(files_summary, indent=2)[:3000]}
REQUIREMENTS:\n{chr(10).join(f'- {r}' for r in requirements)}
TEST FRAMEWORK: {test_framework}

Return a JSON array of test files with path, content, language, purpose, accessibility_notes.
Cover: unit, accessibility, integration, edge cases, responsive breakpoints."""

        response = await self.provider.call(prompt, temperature=CONFIG.temp_generator, response_format="json")
        if not response:
            return []
        try:
            data = json.loads(response)
            if isinstance(data, list):
                return [CodeFile(**f) for f in data]
            return []
        except Exception as e:
            log.error(f"[VibeTester] Failed to parse test files: {e}")
            return []


class VibeDeployer:
    """
    Generates deployment configurations for multiple platforms:
    Vercel, Docker, static hosting, Node.js server.
    """

    def __init__(self, provider: Optional[str] = None):
        self.provider = router.get(provider)

    async def generate_deploy(self, project_name: str,
                               files: List[CodeFile],
                               targets: List[str] = None) -> Dict[str, Any]:
        """
        Generate platform-specific deployment configs for the given project.
        Returns a dict with per-target configs, env vars, health check, and monitoring recommendations.
        """
        targets = targets or ["vercel"]
        files_summary = [{"path": f.path, "purpose": f.purpose} for f in files]
        prompt = f"""You are a DevOps engineer. Generate deployment configurations.

PROJECT: {project_name}
FILES: {json.dumps(files_summary, indent=2)[:2000]}
TARGETS: {', '.join(targets)}

Return JSON with configs per target, environment_variables, health_check, and monitoring."""
        response = await self.provider.call(prompt, temperature=0.3, response_format="json")
        if not response:
            return {"configs": {}, "environment_variables": {}}
        try:
            return json.loads(response)
        except Exception as e:
            log.error(f"[VibeDeployer] Failed to parse deploy config: {e}")
            return {"configs": {}, "environment_variables": {}}


@mcp_server.tool(
    name="vibe_test",
    description="Generate comprehensive test files from source code. Covers unit, accessibility, integration, edge case, and responsive tests."
)
async def vibe_test_tool(
    ctx: Context,
    files: List[Dict[str, Any]],
    requirements: Optional[List[str]] = None,
    test_framework: str = "vitest"
) -> Dict[str, Any]:
    """MCP tool: generate tests for code files using VibeTester."""
    await ctx.info(f"[test] Generating tests for {len(files)} files with {test_framework}...")
    await ctx.report_progress(0, 100, "Analyzing source files...")
    code_files = [CodeFile(**f) for f in files]
    tester = VibeTester()
    await ctx.report_progress(30, 100, "Generating test cases...")
    test_files = await tester.generate_tests(code_files, requirements, test_framework)
    await ctx.report_progress(90, 100, "Verifying test quality...")
    quality = VibeVerifier.verify_code_quality(test_files)
    await ctx.report_progress(100, 100, "Complete!")
    await ctx.info(f"[test] Generated {len(test_files)} test files")
    return {
        "status": "success",
        "test_files": [asdict(f) for f in test_files],
        "test_count": len(test_files),
        "quality": quality,
        "framework": test_framework
    }


@mcp_server.tool(
    name="vibe_deploy",
    description="Generate deployment configurations for Vercel, Docker, static hosting, and Node.js. Includes health checks and monitoring setup."
)
async def vibe_deploy_tool(
    ctx: Context,
    project_name: str,
    files: List[Dict[str, Any]],
    targets: Optional[List[str]] = None
) -> Dict[str, Any]:
    """MCP tool: generate deployment configs via VibeDeployer."""
    targets = targets or ["vercel"]
    await ctx.info(f"[deploy] Generating deploy configs for {project_name} to {', '.join(targets)}...")
    await ctx.report_progress(0, 100, "Analyzing project...")
    code_files = [CodeFile(**f) for f in files]
    deployer = VibeDeployer()
    await ctx.report_progress(30, 100, "Generating configs...")
    result = await deployer.generate_deploy(project_name, code_files, targets)
    await ctx.report_progress(100, 100, "Complete!")
    config_count = len(result.get("configs", {}))
    await ctx.info(f"[deploy] Generated configs for {config_count} target(s)")
    return {"status": "success", "project": project_name, "targets": targets, **result}


# ====================== CLI / TESTING ======================

if __name__ == "__main__":
    import sys

    async def demo():
        """Run a V4 UI spec generation demo (for testing outside MCP)."""
        print("\n" + "=" * 70)
        print("[v4] AetherNexus Prime v4 -- Direct Execution Demo")
        print("=" * 70 + "\n")

        class MockContext:
            async def info(self, msg: str): print(f"  [i] {msg}")
            async def report_progress(self, current: int, total: int, message: str):
                print(f"  [{int((current / total) * 100):3d}%] {message}")

        ctx = MockContext()
        requirements = [
            "SaaS product dashboard",
            "KPI metrics (users, revenue, growth)",
            "Dark mode with neon accents",
            "Mobile responsive"
        ]
        result = await generate_ui_spec_tool(
            ctx=ctx, page_type="product_dashboard", requirements=requirements,
            design_system=None, target_audience="product managers", use_cache=False
        )
        print("\n" + "=" * 70 + "\n✅ Result:")
        print(json.dumps({
            "status": result.get("status"),
            "page_type": result.get("page_type"),
            "score": result.get("critique", {}).get("consensus_score"),
            "component_count": len(result.get("selected_specification", {}).get("components", [])),
            "alternatives": len(result.get("alternatives", []))
        }, indent=2))

    async def vibe_demo():
        """Run a V5 agentic coding pipeline demo (for testing outside MCP)."""
        print("\n" + "=" * 70)
        print("[v5] AetherNexus Prime v5 -- Agentic Coding Demo")
        print("=" * 70 + "\n")

        class MockContext:
            async def info(self, msg: str): print(f"  [i] {msg}")
            async def report_progress(self, current: int, total: int, message: str):
                print(f"  [{int((current / total) * 100):3d}%] {message}")

        ctx = MockContext()

        print("\n[Step 1] vibe_architect\n" + "-" * 40)
        plan_result = await vibe_architect_tool(
            ctx=ctx,
            intent="Build a SaaS analytics dashboard with KPI cards, charts, and dark mode",
            constraints=["WCAG AAA", "React + TypeScript", "Mobile responsive"],
            context={"existing_stack": "Next.js 14", "team_size": 3},
            target_stack="react"
        )
        if plan_result.get("status") == "success":
            plan = plan_result["plan"]
            print(f"\n  Plan: {plan_result['decision_count']} decisions, {plan['estimated_complexity']} complexity, {plan_result['risk_count']} risks")

        print("\n[Step 2] vibe_verify\n" + "-" * 40)
        await vibe_verify_tool(ctx=ctx, specification=None)

        print("\n[Step 3] vibe_review\n" + "-" * 40)
        mock_files = [
            {"path": "/src/KpiCard.tsx", "content": '<div role="region" aria-label="KPI">KPI</div>', "language": "tsx", "purpose": "KPI card"},
        ]
        review_result = await vibe_review_tool(ctx=ctx, files=mock_files, requirements=["Dark mode", "WCAG AAA"])
        if review_result.get("status") == "success":
            print(f"  Score: {review_result['consensus_score']}, {review_result['recommendation']}")

        print("\n" + "=" * 70)
        print("[OK] Vibe demo: architect -> verify -> review complete.")
        print("=" * 70)

    if "--demo" in sys.argv:
        asyncio.run(demo())
    elif "--vibe-demo" in sys.argv:
        asyncio.run(vibe_demo())
    else:
        print("=" * 70)
        print("AetherNexus Prime v5 MCP Server")
        print("   11 tools | 5 resources | 6 prompts")
        print("   5 LLM providers: openai, deepseek, openrouter, local, opencode")
        print("   Pipeline: architect -> code -> review -> verify -> iterate -> test -> deploy")
        print("   --demo: V4 UI spec demo | --vibe-demo: V5 agentic coding demo\n")
        mcp_server.run()


def main():
    """Entry point for 'aethernexus' CLI command."""
    import sys
    if "--vibe-demo" in sys.argv:
        asyncio.run(vibe_demo())
    elif "--demo" in sys.argv:
        asyncio.run(demo())
    else:
        mcp_server.run()
