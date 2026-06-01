"""Tests for vibeserve.models — data models, validation, and edge cases."""

import pytest
from pydantic import ValidationError
from vibeserve.models import (
    WCAGLevel,
    ContrastResult,
    UIComponent,
    ComponentType,
    ArchitectureDecision,
    CodeFile,
    IterationResult,
    ArchitectInput,
    SubprocessInput,
)


class TestWCAGLevel:
    def test_enum_values(self):
        assert WCAGLevel.AAA.value == "AAA"
        assert WCAGLevel.AA.value == "AA"
        assert WCAGLevel.FAIL.value == "FAIL"


class TestContrastResult:
    def test_aaa_level(self):
        r = ContrastResult(fg="#000", bg="#fff", ratio=7.5, wcag_level="", passes_aa=False, passes_aaa=False)
        assert r.wcag_level == WCAGLevel.AAA
        assert r.passes_aa is True
        assert r.passes_aaa is True

    def test_aa_level(self):
        r = ContrastResult(fg="#000", bg="#fff", ratio=5.0, wcag_level="", passes_aa=False, passes_aaa=False)
        assert r.wcag_level == WCAGLevel.AA
        assert r.passes_aa is True
        assert r.passes_aaa is False

    def test_fail_level(self):
        r = ContrastResult(fg="#aaa", bg="#fff", ratio=2.5, wcag_level="", passes_aa=False, passes_aaa=False)
        assert r.wcag_level == WCAGLevel.FAIL
        assert r.passes_aa is False
        assert r.passes_aaa is False


class TestUIComponentValidation:
    def test_missing_aria_role_raises(self):
        with pytest.raises(ValidationError) as exc:
            UIComponent(
                id="test",
                type=ComponentType.BUTTON,
                label="Test",
                purpose="testing",
                visual={"color": "red"},
                accessibility={},
            )
        assert "aria_role" in str(exc.value)

    def test_default_focus_visible(self):
        comp = UIComponent(
            id="test",
            type=ComponentType.BUTTON,
            label="Test",
            purpose="testing",
            visual={"color": "red"},
            accessibility={"aria_role": "button"},
        )
        assert comp.accessibility["focus_visible"] is True


class TestModelDump:
    def test_architecture_decision_model_dump(self):
        ad = ArchitectureDecision(
            id="ADR-001",
            title="Use React",
            context="Need a UI framework",
            decision="React",
            alternatives=["Vue", "Svelte"],
            rationale="Ecosystem",
            consequences=["Bundle size"],
            confidence=0.9,
        )
        d = ad.model_dump()
        assert d["id"] == "ADR-001"
        assert d["title"] == "Use React"
        assert d["alternatives"] == ["Vue", "Svelte"]
        assert d["confidence"] == 0.9

    def test_code_file_model_dump(self):
        cf = CodeFile(
            path="src/main.ts",
            content="console.log('hi')",
            language="typescript",
            purpose="entry point",
            accessibility_notes=["focus"],
        )
        d = cf.model_dump()
        assert d["path"] == "src/main.ts"
        assert d["language"] == "typescript"
        assert d["accessibility_notes"] == ["focus"]

    def test_iteration_result_model_dump(self):
        ir = IterationResult(
            iteration=2,
            score_before=0.4,
            score_after=0.9,
            changes=["fixed bug"],
            critique={"issues": []},
            passed=True,
            files_changed=["main.ts"],
        )
        d = ir.model_dump()
        assert d["iteration"] == 2
        assert d["passed"] is True
        assert d["files_changed"] == ["main.ts"]


class TestArchitectInputValidation:
    def test_invalid_stack_raises(self):
        with pytest.raises(ValidationError) as exc:
            ArchitectInput(intent="build app", target_stack="invalid_framework")
        assert "target_stack" in str(exc.value)

    def test_valid_stack_accepted(self):
        ai = ArchitectInput(intent="build app", target_stack="nextjs")
        assert ai.target_stack == "nextjs"


class TestSubprocessInputValidation:
    def test_invalid_manager_raises(self):
        with pytest.raises(ValidationError) as exc:
            SubprocessInput(manager="pip")
        assert "manager" in str(exc.value)

    def test_valid_manager_accepted(self):
        si = SubprocessInput(manager="yarn")
        assert si.manager == "yarn"
