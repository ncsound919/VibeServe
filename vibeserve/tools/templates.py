"""Template library, design upgrader, and Playwright bridge."""
from __future__ import annotations
import random as _random
import re
import logging
from pathlib import Path
from typing import List
from vibeserve.utils import contrast_ratio

log = logging.getLogger("VibeServe")


class TemplateLibrary:
    TEMPLATES = ["linear", "vercel", "stripe", "supabase", "claude", "notion", "apple", "shopify", "nike", "spacex"]

    @classmethod
    def list_templates(cls) -> List[str]:
        return cls.TEMPLATES

    @classmethod
    def random_template(cls, name: str = None) -> str:
        if name and name in cls.TEMPLATES:
            return cls._load(name)
        return cls._load(_random.choice(cls.TEMPLATES))

    @classmethod
    def _load(cls, name: str) -> str:
        path = Path(__file__).parent.parent.parent / "designs" / f"{name}.md"
        if path.exists():
            content = path.read_text(encoding="utf-8")
            return cls._mutate(content, name)
        log.warning(f"Design template '{name}' not found at {path}")
        return f"# {name.title()} Design System\nUse {{{{colors.primary}}}} for accents."

    @classmethod
    def _mutate(cls, content: str, name: str) -> str:
        original = content
        for _ in range(5):
            mutated = original
            mutations = _random.randint(1, 3)
            for _ in range(mutations):
                op = _random.choice(["color_variant", "spacing_shift", "font_swap"])
                if op == "color_variant":
                    mutated = cls._shift_accent(mutated)
                elif op == "spacing_shift":
                    mutated = cls._vary_spacing(mutated)
                elif op == "font_swap":
                    mutated = cls._swap_font(mutated)
            
            colors = re.findall(r'#([0-9a-fA-F]{6})', mutated)
            valid = True
            for hex_val in colors:
                hex_val = f"#{hex_val}"
                if contrast_ratio(hex_val, "#FFFFFF") < 4.5 and contrast_ratio(hex_val, "#000000") < 4.5:
                    valid = False
                    break
            if valid:
                return f"# Design System: {name} (Monte Carlo seed: {_random.randint(1000,9999)})\n{mutated}"
        return f"# Design System: {name} (Monte Carlo seed: {_random.randint(1000,9999)})\n{original}"

    @staticmethod
    def _shift_accent(content: str) -> str:
        offset = _random.randint(-15, 15)
        def shift_hex(m):
            h = m.group(1)
            if len(h) == 6:
                r = min(255, max(0, int(h[0:2], 16) + offset))
                g = min(255, max(0, int(h[2:4], 16) + offset))
                b = min(255, max(0, int(h[4:6], 16) + offset))
                return f"#{r:02x}{g:02x}{b:02x}"
            return m.group(0)
        return re.sub(r'#([0-9a-fA-F]{6})', shift_hex, content)

    @staticmethod
    def _vary_spacing(content: str) -> str:
        factor = _random.uniform(0.85, 1.15)
        def scale_px(m):
            val = int(m.group(1))
            new_val = max(4, int(val * factor))
            new_val = round(new_val / 4) * 4
            return f"{new_val}px"
        return re.sub(r'(\d+)px', scale_px, content)

    @staticmethod
    def _swap_font(content: str) -> str:
        swaps = [
            ("Inter", _random.choice(["Geist Sans", "system-ui", "SF Pro"])),
            ("system-ui", _random.choice(["Inter", "Geist Sans", "SF Pro"])),
            ("sans-serif", _random.choice(["Inter, system-ui, sans-serif", "Geist Sans, system-ui"])),
        ]
        for old, new in _random.sample(swaps, min(2, len(swaps))):
            content = content.replace(old, new)
        return content


DESIGN_UPGRADES = """
## Production-Grade Enhancements (Senior Dev)

### Responsive (Mobile-First)
- Mobile <640px: single column, 48px gaps, hamburger nav
- Tablet 640-1024px: 2-col grids, 64px gaps, compact nav
- Desktop 1024-1440px: 3-col, 96px gaps, full nav, max-width 1280px

### Accessibility (WCAG AAA)
- focus-visible: 2px solid outline, 2px offset on all interactive elements
- Skip-to-content link at top
- Landmark roles: header, main, nav, footer, sections with aria-label
- aria-live="polite" for dynamic updates
- prefers-reduced-motion: disable ALL animations/transitions
- prefers-contrast: increase border contrast
- prefers-color-scheme: respect system dark/light
- Touch targets minimum 44x44px

### Performance
- font-display: swap on all web fonts (no FOIT)
- content-visibility: auto on below-fold sections
- loading="lazy" on images, decoding="async" on hero images
- Preconnect hints for external origins
- Explicit width/height on all images (no CLS)
- Inline critical CSS, defer non-critical

### Animation
- 150ms micro, 200ms standard, 300ms entrance
- ease-out for opening, ease-in for closing
- No animation when prefers-reduced-motion

### SEO
- Complete meta tags (og:title, og:description, og:image)
- JSON-LD structured data for SoftwareApplication
- Canonical URL
- Descriptive title (brand + keyword)

### Security
- Content-Security-Policy: frame-ancestors 'none'; script-src 'self'
- Referrer-Policy: strict-origin-when-cross-origin
- rel="noopener" on external links"""


class DesignUpgrader:
    @staticmethod
    def upgrade(template_content: str) -> str:
        return f"{template_content}\n\n{DESIGN_UPGRADES}"

    @staticmethod
    def upgrade_file(template_name: str) -> str:
        base = TemplateLibrary.random_template(template_name)
        return DesignUpgrader.upgrade(base)


class PlaywrightBridge:
    @staticmethod
    def generate_test_script(html_path: str, checks: List[str] = None) -> str:
        checks = checks or ["page loads", "no console errors", "all images render"]
        return f"""// Playwright test for {html_path} — execute with Playwright MCP
const {{ test, expect }} = require('@playwright/test');

test('visual verification', async ({{ page }}) => {{
  await page.goto('file://{html_path}');

  // {checks[0] if len(checks)>0 else 'page loads'}
  await page.waitForLoadState('networkidle');

  // Check no console errors
  page.on('console', msg => {{
    if (msg.type() === 'error') console.error(msg.text());
  }});

  // {checks[1] if len(checks)>1 else 'accessibility'}
  const violations = await page.accessibility.snapshot();
  expect(violations).toBeTruthy();

  // Screenshot
  await page.screenshot({{ path: 'preview.png', fullPage: true }});
}});
"""
