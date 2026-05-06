"""Data models, schemas, and enums for VibeServe."""

from __future__ import annotations
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field
from enum import Enum

from pydantic import BaseModel, Field, field_validator


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


@dataclass
class ArchitectureDecision:
    id: str
    title: str
    context: str
    decision: str
    alternatives: List[str] = field(default_factory=list)
    rationale: str = ""
    consequences: List[str] = field(default_factory=list)
    confidence: float = 0.5

    def model_dump(self) -> Dict[str, Any]:
        return {
            "id": self.id, "title": self.title, "context": self.context,
            "decision": self.decision, "alternatives": self.alternatives,
            "rationale": self.rationale, "consequences": self.consequences,
            "confidence": self.confidence,
        }


@dataclass
class VibePlan:
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
    path: str
    content: str
    language: str = ""
    purpose: str = ""
    accessibility_notes: List[str] = field(default_factory=list)

    def model_dump(self) -> Dict[str, Any]:
        return {
            "path": self.path, "content": self.content,
            "language": self.language, "purpose": self.purpose,
            "accessibility_notes": self.accessibility_notes,
        }


@dataclass
class IterationResult:
    iteration: int
    score_before: float
    score_after: float
    changes: List[str] = field(default_factory=list)
    critique: Dict[str, Any] = field(default_factory=dict)
    passed: bool = False
    files_changed: List[str] = field(default_factory=list)

    def model_dump(self) -> Dict[str, Any]:
        return {
            "iteration": self.iteration, "score_before": self.score_before,
            "score_after": self.score_after, "changes": self.changes,
            "critique": self.critique, "passed": self.passed,
            "files_changed": self.files_changed,
        }


# ====================== RESPONSE DTOs ======================

class ToolResponse(BaseModel):
    status: str = "success"


class SpecResponse(ToolResponse):
    page_type: str = ""
    selected_specification: Dict[str, Any] = Field(default_factory=dict)
    alternatives: List[Dict[str, Any]] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    critique: Dict[str, Any] = Field(default_factory=dict)


class ArchitectResponse(ToolResponse):
    plan: Dict[str, Any] = Field(default_factory=dict)
    decision_count: int = 0
    risk_count: int = 0


class CodeResponse(ToolResponse):
    files: List[Dict[str, Any]] = Field(default_factory=list)
    file_count: int = 0
    quality: Dict[str, Any] = Field(default_factory=dict)
    total_lines: int = 0


class ReviewResponse(ToolResponse):
    consensus_score: float = 0.0
    recommendation: str = ""
    agent_reviews: Dict[str, Any] = Field(default_factory=dict)
    line_level_issues: List[Dict[str, Any]] = Field(default_factory=list)
    files_reviewed: int = 0
    critical_issues: int = 0


class VerifyResponse(ToolResponse):
    results: Dict[str, Any] = Field(default_factory=dict)
    all_passed: bool = True


class IterateResponse(ToolResponse):
    final_output: Dict[str, Any] = Field(default_factory=dict)
    iterations: List[Dict[str, Any]] = Field(default_factory=list)
    iterations_used: int = 0
    final_score: float = 0.0
    converged: bool = False
    score_improvement: float = 0.0


class TestResponse(ToolResponse):
    test_files: List[Dict[str, Any]] = Field(default_factory=list)
    test_count: int = 0
    quality: Dict[str, Any] = Field(default_factory=dict)
    framework: str = ""


class DeployResponse(ToolResponse):
    project: str = ""
    targets: List[str] = Field(default_factory=list)
    configs: Dict[str, Any] = Field(default_factory=dict)
    environment_variables: Dict[str, Any] = Field(default_factory=dict)


# ====================== INPUT VALIDATION MODELS ======================

class ArchitectInput(BaseModel):
    intent: str = Field(min_length=1, max_length=5000)
    constraints: Optional[List[str]] = None
    context: Optional[str] = None
    target_stack: str = Field(default="react", max_length=50)

    @field_validator("target_stack")
    @classmethod
    def validate_stack(cls, v):
        allowed = {"react", "vue", "svelte", "html", "nextjs", "python", "node", "typescript", "kotlin", "swift"}
        if v.lower() not in allowed:
            raise ValueError(f"target_stack must be one of {sorted(allowed)}")
        return v.lower()


class CodeInput(BaseModel):
    intent: str = Field(min_length=1, max_length=5000)
    plan: Dict[str, Any]
    constraints: Optional[List[str]] = None
    design_system: Optional[str] = None
    target_language: str = Field(default="typescript", max_length=50)


class ReviewInput(BaseModel):
    files: List[Dict[str, Any]] = Field(min_length=1, max_length=100)
    requirements: List[str] = Field(min_length=1, max_length=50)


class VerifyInput(BaseModel):
    specification: Optional[Dict[str, Any]] = None
    files: Optional[List[Dict[str, Any]]] = None


class IterateInput(BaseModel):
    specification: Dict[str, Any]
    requirements: List[str] = Field(min_length=1, max_length=50)
    max_iterations: int = Field(default=3, ge=1, le=20)
    quality_threshold: float = Field(default=0.80, ge=0.0, le=1.0)


class TestInput(BaseModel):
    files: List[Dict[str, Any]] = Field(min_length=1, max_length=100)
    requirements: Optional[List[str]] = None
    test_framework: str = Field(default="vitest", max_length=50)


class DeployInput(BaseModel):
    project_name: str = Field(min_length=1, max_length=200)
    files: List[Dict[str, Any]] = Field(min_length=1, max_length=200)
    targets: Optional[List[str]] = None


class DesignInput(BaseModel):
    intent: str = Field(min_length=1, max_length=5000)
    template: Optional[str] = None
    constraints: Optional[List[str]] = None


class BuildProInput(BaseModel):
    intent: str = Field(min_length=1, max_length=5000)
    template: Optional[str] = None
    constraints: Optional[List[str]] = None


class DocsInput(BaseModel):
    query: str = Field(min_length=1, max_length=500)
    library: Optional[str] = None


class FileReadInput(BaseModel):
    path: str = Field(min_length=1, max_length=1000)


class FileWriteInput(BaseModel):
    path: str = Field(min_length=1, max_length=1000)
    content: str = Field(min_length=0, max_length=1_000_000)


class SubprocessInput(BaseModel):
    manager: str = Field(default="npm", max_length=20)
    path: str = Field(default=".", max_length=1000)

    @field_validator("manager")
    @classmethod
    def validate_manager(cls, v):
        allowed = {"npm", "yarn", "pnpm"}
        if v.lower() not in allowed:
            raise ValueError(f"manager must be one of {sorted(allowed)}")
        return v.lower()


class BenchmarkInput(BaseModel):
    iterations: int = Field(default=5, ge=1, le=1000)
