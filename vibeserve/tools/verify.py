"""VibeVerifier — spec and code quality verification."""
from __future__ import annotations
import re
from typing import Any, Dict, List
from vibeserve.models import CodeFile
from vibeserve.tools.validators import SchemaValidator


class VibeVerifier:
    @staticmethod
    def verify_spec(spec: Dict[str, Any]) -> Dict[str, Any]:
        valid, errors = SchemaValidator.validate_schema(spec)
        return {"valid": valid, "errors": errors, "error_count": len(errors)}

    @staticmethod
    def verify_code_quality(files: List[CodeFile]) -> Dict[str, Any]:
        issues = []
        fabricated_patterns = [
            (r"\d+K\+.*[Dd]ownloads", "fabricated download count"),
            (r"\d+\.\d+%.*[Uu]ptime", "fabricated uptime stat"),
            (r"24/7.*[Ss]upport", "fabricated support claim"),
            (r"[Ee]nterprise.grade.{0,30}security", "fabricated security claim"),
            (r"[Rr]eal.time.{0,20}[Cc]ollaboration", "fabricated feature"),
            (r"\d+%.*faster", "fabricated performance claim"),
            (r"[Jj]oin.{0,15}thousands.{0,15}developers", "fabricated user count"),
            (r"Sarah K\.|Marcus J\.|Elena R\.", "fabricated testimonial name"),
            (r"[Ss]ign.{0,10}[Uu]p|[Ff]ree.{0,10}[Tt]rial|[Pp]ricing.{0,10}[Pp]lan|[Ss]chedule.{0,10}[Dd]emo", "SaaS CTA pattern"),
            (r"[Ww]hat.{0,15}[Dd]evelopers.{0,15}[Ss]ay", "testimonial header with no content"),
        ]
        for f in files:
            if not f.accessibility_notes:
                issues.append(f"{f.path}: missing accessibility notes")
            if "aria-" not in f.content.lower() and f.language in ("tsx", "jsx", "html"):
                issues.append(f"{f.path}: no ARIA attributes found")
            if "TODO" in f.content or "FIXME" in f.content:
                issues.append(f"{f.path}: contains TODO/FIXME")
            if f.language == "html":
                for pattern, label in fabricated_patterns:
                    if re.search(pattern, f.content):
                        issues.append(f"{f.path}: {label} — fabricated/hallucinated content")
                opens = len(re.findall(r"<section\b", f.content))
                closes = len(re.findall(r"</section>", f.content))
                if opens != closes:
                    issues.append(f"{f.path}: HTML nesting error — {opens} <section> opens vs {closes} closes")
        return {"passed": len(issues) == 0, "issues": issues, "issue_count": len(issues), "files_checked": len(files)}
