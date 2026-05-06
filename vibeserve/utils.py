"""Utility functions: WCAG, TOON, Graphify, profiling, sanitization.

Telemetry (StructuredLogger, SentryTracker) → vibeserve.telemetry
Connectors (Context7Provider, Supabase, Vercel, GitHub, etc.) → vibeserve.integrations
Re-exports below preserve backward compatibility until all importers are migrated.
"""

from __future__ import annotations
import json
import logging
import re
import time
from typing import Any, Dict, List, Tuple

log = logging.getLogger("VibeServe")


# ====================== INPUT SANITIZATION ======================
def sanitize_for_display(text: str) -> str:
    """Strip HTML tags, control characters, and null bytes from user-facing output.

    Prevents XSS in any context where tool output is rendered.
    """
    if not isinstance(text, str):
        text = str(text)
    text = text.replace("\x00", "")
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"\b(on\w+)\s*=", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\x1b\[[0-9;]*[a-zA-Z]", "", text)
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", text)
    return text


# ====================== WCAG VALIDATION ======================
def hex_to_rgb(hex_color: str) -> Tuple[int, int, int]:
    hex_color = hex_color.lstrip('#')
    if len(hex_color) == 3:
        hex_color = ''.join(c * 2 for c in hex_color)
    elif len(hex_color) >= 6:
        hex_color = hex_color[:6]
    else:
        raise ValueError(f"Invalid hex color: {hex_color!r}")
    return (int(hex_color[0:2], 16), int(hex_color[2:4], 16), int(hex_color[4:6], 16))


def relative_luminance(rgb: Tuple[int, int, int]) -> float:
    r, g, b = [x / 255.0 for x in rgb]
    r = r / 12.92 if r <= 0.03928 else pow((r + 0.055) / 1.055, 2.4)
    g = g / 12.92 if g <= 0.03928 else pow((g + 0.055) / 1.055, 2.4)
    b = b / 12.92 if b <= 0.03928 else pow((b + 0.055) / 1.055, 2.4)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast_ratio(fg: str, bg: str) -> float:
    try:
        l1 = relative_luminance(hex_to_rgb(fg))
        l2 = relative_luminance(hex_to_rgb(bg))
        lighter = max(l1, l2)
        darker = min(l1, l2)
        return (lighter + 0.05) / (darker + 0.05)
    except (ValueError, IndexError) as e:
        log.warning(f"contrast_ratio failed for fg={fg!r} bg={bg!r}: {e}")
        return 0.0


# ====================== ASYNC PROFILER ======================
class AsyncProfiler:
    _traces: Dict[str, List[float]] = {}

    @classmethod
    def start(cls, name: str): return time.time()

    @classmethod
    def stop(cls, name: str, t0: float):
        elapsed = time.time() - t0
        cls._traces.setdefault(name, []).append(elapsed)
        if elapsed > 1.0:
            log.warning(f"[Profiler] Slow operation: {name} took {elapsed:.1f}s")

    @classmethod
    def stats(cls) -> Dict[str, Any]:
        return {name: {"count": len(times), "avg": round(sum(times)/len(times), 3) if times else 0,
                       "min": round(min(times), 3) if times else 0, "max": round(max(times), 3) if times else 0}
                for name, times in cls._traces.items()}

    @classmethod
    def clear(cls): cls._traces.clear()


try:
    from pyinstrument import Profiler as PyInstrument
    PYINSTRUMENT_AVAILABLE = True
except ImportError:
    PYINSTRUMENT_AVAILABLE = False


class ProfilerProvider:
    @staticmethod
    def profile_async(func):
        if not PYINSTRUMENT_AVAILABLE:
            return func
        import functools
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            profiler = PyInstrument()
            profiler.start()
            try:
                return await func(*args, **kwargs)
            finally:
                profiler.stop()
        return wrapper

    @staticmethod
    def profile_sync(func):
        if not PYINSTRUMENT_AVAILABLE:
            return func
        import functools
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            profiler = PyInstrument()
            profiler.start()
            try:
                return func(*args, **kwargs)
            finally:
                profiler.stop()
        return wrapper


# ====================== TOON (Token-Optimized Object Notation) ======================
class TOON:
    @staticmethod
    def encode(data: Any, depth: int = 0) -> str:
        indent = "  " * depth
        if isinstance(data, dict):
            items = []
            for k, v in data.items():
                if isinstance(v, (dict, list)):
                    inner = TOON.encode(v, depth + 1)
                    items.append(f"{indent}{k}:\n{inner}")
                elif isinstance(v, str) and len(v) > 80:
                    items.append(f"{indent}{k}: {v[:80]}...")
                else:
                    items.append(f"{indent}{k}: {v}")
            return "\n".join(items)
        elif isinstance(data, list):
            if not data:
                return f"{indent}[]"
            if all(isinstance(x, dict) for x in data[:3]):
                items = [f"{indent}-"] + [TOON.encode(d, depth + 1) for d in data]
                return "\n".join(items)
            return f"{indent}{', '.join(str(x)[:60] for x in data[:10])}" + (f"... (+{len(data)-10})" if len(data) > 10 else "")
        return str(data)[:200]

    @staticmethod
    def compress_json(json_str: str) -> str:
        try:
            data = json.loads(json_str) if isinstance(json_str, str) else json_str
            return TOON.encode(data)
        except Exception:
            return json_str[:500] if isinstance(json_str, str) else str(json_str)[:500]

    @staticmethod
    def savings(original: str, compressed: str = None) -> dict:
        if compressed is None:
            compressed = TOON.compress_json(original)
        orig_tokens = len(original) // 4
        comp_tokens = len(compressed) // 4
        saved = orig_tokens - comp_tokens
        pct = round((saved / max(1, orig_tokens)) * 100, 1)
        return {"original_tokens": orig_tokens, "compressed_tokens": comp_tokens, "saved": saved, "percent": pct}


# ====================== GRAPHIFY ======================
class Graphify:
    @staticmethod
    def bar_chart(data: dict, width: int = 50, title: str = "") -> str:
        lines = [title, "=" * width] if title else ["=" * width]
        max_val = max(data.values()) if data else 1
        max_label = max(len(str(k)) for k in data) if data else 5
        for label, value in data.items():
            bar_len = int((value / max_val) * (width - max_label - 10))
            bar = "#" * bar_len
            lines.append(f"  {str(label):<{max_label}} |{bar:<{width-max_label-10}} {value}")
        lines.append("=" * width)
        return "\n".join(lines)

    @staticmethod
    def trend_line(points: List[float], width: int = 50, height: int = 10, title: str = "") -> str:
        lines = [title] if title else []
        if not points:
            return "No data"
        mn, mx = min(points), max(points)
        rng = max(mx - mn, 0.01)
        for row in range(height - 1, -1, -1):
            line = ""
            for i, val in enumerate(points):
                y = int(((val - mn) / rng) * (height - 1))
                if row == 0:
                    line += "_"
                elif y >= row:
                    line += "#"
                else:
                    line += " "
            lines.append(f"  {mx - (mx-mn)*row/(height-1):.1f} |{line}")
        lines.append(f"  {' ' * 4}{'-' * len(points)}")
        return "\n".join(lines)

    @staticmethod
    def benchmark_summary(iterations: List[dict]) -> str:
        lines = ["", "=" * 60, "  VibeServe Self-Improvement Dashboard", "=" * 60]
        if not iterations:
            return "\n".join(lines + ["  No data yet."])
        scores = [i.get("score", 0) for i in iterations]
        lines.append("")
        lines.append(Graphify.bar_chart(
            {f"Loop {j+1}": s for j, s in enumerate(scores)},
            width=50, title="  Scores per iteration"
        ))
        lines.append("")
        lines.append(Graphify.trend_line(scores, title="  Score trend"))
        avg_s = sum(scores) / len(scores) if scores else 0
        lines.append(f"\n  Avg score: {avg_s:.2f}  |  "
                     f"Best: {max(scores):.2f}  |  "
                     f"Worst: {min(scores):.2f}  |  "
                     f"Delta: {max(scores)-min(scores):.2f}")
        times = [i.get("time_ms", 0) / 1000 for i in iterations if i.get("time_ms")]
        if times:
            lines.append(f"  Total time: {sum(times):.1f}s  |  Avg/loop: {sum(times)/len(times):.1f}s")
        lines.append("=" * 60)
        return "\n".join(lines)


# ====================== BACKWARD-COMPAT RE-EXPORTS ======================
# Migrated to vibeserve.telemetry and vibeserve.integrations.
# These re-exports keep all existing `from vibeserve.utils import ...` working.
from vibeserve.telemetry import StructuredLogger, SentryTracker  # noqa: E402, F401
from vibeserve.integrations import (  # noqa: E402, F401
    Context7Provider,
    SupabaseConnector,
    VercelConnector,
    GitHubConnector,
    CloudflareConnector,
    GoogleConnector,
    EditorBridge,
)
