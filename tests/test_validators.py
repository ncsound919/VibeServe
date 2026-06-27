"""
Unit tests for vibeserve.tools.validators — SchemaValidator and validate_wcag_contrast.
Pure functions, no I/O, cheap to test.
"""
import pytest
from vibeserve.tools.validators import SchemaValidator, validate_wcag_contrast
from vibeserve.models import WCAGLevel


# ====================== WCAG contrast helper ======================

class TestValidateWcagContrast:
    def test_black_on_white_passes_aaa(self):
        result = validate_wcag_contrast("#000000", "#FFFFFF")
        assert result.passes_aaa is True
        assert result.passes_aa is True
        assert result.wcag_level == WCAGLevel.AAA

    def test_white_on_white_fails(self):
        result = validate_wcag_contrast("#FFFFFF", "#FFFFFF")
        assert result.passes_aa is False
        assert result.wcag_level == WCAGLevel.FAIL

    def test_medium_contrast_passes_aa_not_aaa(self):
        # #767676 on white is ~4.54:1, passes AA but not AAA
        result = validate_wcag_contrast("#767676", "#FFFFFF")
        assert result.passes_aa is True
        assert result.passes_aaa is False
        assert result.wcag_level == WCAGLevel.AA

    def test_passes_min_aaa_level(self):
        result = validate_wcag_contrast("#000000", "#FFFFFF", WCAGLevel.AAA)
        assert result.passes_min is True

    def test_fails_min_aaa_level(self):
        result = validate_wcag_contrast("#767676", "#FFFFFF", WCAGLevel.AAA)
        assert result.passes_min is False

    def test_ratio_is_rounded(self):
        result = validate_wcag_contrast("#000000", "#FFFFFF")
        assert result.ratio == round(result.ratio, 2)

    def test_fg_bg_stored(self):
        result = validate_wcag_contrast("#000000", "#FFFFFF")
        assert result.fg == "#000000"
        assert result.bg == "#FFFFFF"


# ====================== SchemaValidator.validate_component ======================

SAMPLE_DESIGN_SYSTEM = {
    "tokens": {
        "colors": {
            "primary": {"hex": "#00FF9F", "wcag_level": "AAA"},
            "background": {"hex": "#0A0A0A"},
        }
    },
    "constraints": {
        "allowed_components": ["button", "card", "input"],
        "min_wcag_level": "AA",
    }
}


class TestSchemaValidatorComponent:
    def _minimal_component(self):
        return {
            "id": "btn-1",
            "type": "button",
            "accessibility": {"aria_role": "button"},
        }

    def test_valid_component_passes(self):
        valid, errors = SchemaValidator.validate_component(
            self._minimal_component(), SAMPLE_DESIGN_SYSTEM
        )
        assert valid is True
        assert errors == []

    def test_missing_id_fails(self):
        comp = self._minimal_component()
        del comp["id"]
        valid, errors = SchemaValidator.validate_component(comp, SAMPLE_DESIGN_SYSTEM)
        assert valid is False
        assert any("id" in e for e in errors)

    def test_missing_type_fails(self):
        comp = self._minimal_component()
        del comp["type"]
        valid, errors = SchemaValidator.validate_component(comp, SAMPLE_DESIGN_SYSTEM)
        assert valid is False
        assert any("type" in e for e in errors)

    def test_missing_aria_role_fails(self):
        comp = self._minimal_component()
        del comp["accessibility"]
        valid, errors = SchemaValidator.validate_component(comp, SAMPLE_DESIGN_SYSTEM)
        assert valid is False
        assert any("aria_role" in e for e in errors)

    def test_invalid_color_role_fails(self):
        comp = self._minimal_component()
        comp["visual"] = {"color_role": "nonexistent_color"}
        valid, errors = SchemaValidator.validate_component(comp, SAMPLE_DESIGN_SYSTEM)
        assert valid is False
        assert any("nonexistent_color" in e for e in errors)

    def test_valid_color_role_passes(self):
        comp = self._minimal_component()
        comp["visual"] = {"color_role": "primary"}
        valid, errors = SchemaValidator.validate_component(comp, SAMPLE_DESIGN_SYSTEM)
        assert valid is True

    def test_disallowed_component_type_fails(self):
        comp = self._minimal_component()
        comp["type"] = "modal"  # not in allowed_components
        valid, errors = SchemaValidator.validate_component(comp, SAMPLE_DESIGN_SYSTEM)
        assert valid is False
        assert any("modal" in e for e in errors)


# ====================== SchemaValidator.validate_schema ======================

class TestSchemaValidatorSchema:
    def _minimal_schema(self):
        return {
            "version": "1.0",
            "metadata": {"id": "schema-001", "name": "Test Schema"},
            "components": [],
            "design_system": SAMPLE_DESIGN_SYSTEM,
        }

    def test_valid_schema_passes(self):
        valid, errors = SchemaValidator.validate_schema(self._minimal_schema())
        assert valid is True
        assert errors == []

    def test_wrong_version_fails(self):
        schema = self._minimal_schema()
        schema["version"] = "2.0"
        valid, errors = SchemaValidator.validate_schema(schema)
        assert valid is False
        assert any("version" in e.lower() for e in errors)

    def test_missing_metadata_id_fails(self):
        schema = self._minimal_schema()
        schema["metadata"]["id"] = ""
        valid, errors = SchemaValidator.validate_schema(schema)
        assert valid is False
        assert any("metadata.id" in e for e in errors)

    def test_missing_metadata_name_fails(self):
        schema = self._minimal_schema()
        schema["metadata"]["name"] = ""
        valid, errors = SchemaValidator.validate_schema(schema)
        assert valid is False
        assert any("metadata.name" in e for e in errors)

    def test_invalid_component_propagates_error(self):
        schema = self._minimal_schema()
        schema["components"] = [{"type": "button"}]  # missing id and aria_role
        valid, errors = SchemaValidator.validate_schema(schema)
        assert valid is False

    def test_color_failing_wcag_aaa_reported(self):
        schema = self._minimal_schema()
        # grey #888 on white is ~3.5:1 — fails AAA
        schema["design_system"] = {
            "tokens": {"colors": {"grey": {"hex": "#888888"}}},
            "constraints": {"min_wcag_level": "AAA"},
        }
        valid, errors = SchemaValidator.validate_schema(schema)
        assert valid is False
        assert any("grey" in e.lower() for e in errors)

    def test_background_only_role_skipped(self):
        schema = self._minimal_schema()
        schema["design_system"] = {
            "tokens": {"colors": {"bg": {"hex": "#0A0A0A", "role": "background_only"}}},
            "constraints": {"min_wcag_level": "AAA"},
        }
        # background_only colors are skipped, so schema should pass
        valid, errors = SchemaValidator.validate_schema(schema)
        assert valid is True
