"""WCAG validation and schema validation."""
from __future__ import annotations
from typing import Any, Dict, List, Tuple
from vibeserve.models import WCAGLevel, ContrastResult
from vibeserve.utils import contrast_ratio


def validate_wcag_contrast(fg: str, bg: str, min_level: WCAGLevel = WCAGLevel.AA) -> ContrastResult:
    ratio = contrast_ratio(fg, bg)
    passes_aa = ratio >= 4.5
    passes_aaa = ratio >= 7.0
    if passes_aaa:
        wcag_level = WCAGLevel.AAA
    elif passes_aa:
        wcag_level = WCAGLevel.AA
    else:
        wcag_level = WCAGLevel.FAIL
    result = ContrastResult(fg=fg, bg=bg, ratio=round(ratio, 2), wcag_level=wcag_level, passes_aa=passes_aa, passes_aaa=passes_aaa)
    result.passes_min = (
        passes_aaa if min_level == WCAGLevel.AAA
        else passes_aa if min_level == WCAGLevel.AA
        else False
    )
    return result


class SchemaValidator:
    @staticmethod
    def validate_component(component: Dict[str, Any], design_system: Dict[str, Any]) -> Tuple[bool, List[str]]:
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
                    continue
                hex_val = color_data.get("hex")
                if hex_val:
                    white_ratio = contrast_ratio(hex_val, "#FFFFFF")
                    black_ratio = contrast_ratio(hex_val, "#000000")
                    if min_wcag == "AAA":
                        if white_ratio < 7 and black_ratio < 7:
                            errors.append(f"Color {color_id} fails WCAG AAA contrast requirements")
        return len(errors) == 0, errors
