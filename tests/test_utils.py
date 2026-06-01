"""Tests for vibeserve.utils — sanitization, WCAG, profiler, TOON, Graphify."""

import json
import time
import pytest
from unittest.mock import patch
from vibeserve.utils import (
    sanitize_for_display,
    hex_to_rgb,
    relative_luminance,
    contrast_ratio,
    AsyncProfiler,
    ProfilerProvider,
    TOON,
    Graphify,
)


class TestSanitizeForDisplay:
    def test_strips_html_tags(self):
        result = sanitize_for_display("<script>alert('xss')</script>")
        assert "<script>" not in result
        assert "</script>" not in result

    def test_removes_null_bytes(self):
        result = sanitize_for_display("hello\x00world")
        assert "\x00" not in result
        assert result == "helloworld"

    def test_removes_event_handlers(self):
        result = sanitize_for_display('<div onclick="alert(1)">click</div>')
        assert "onclick" not in result

    def test_removes_ansi_escapes(self):
        result = sanitize_for_display("\x1b[31mred\x1b[0m")
        assert "\x1b" not in result
        assert "red" in result

    def test_removes_control_characters(self):
        result = sanitize_for_display("a\x01b\x02c\x7f")
        assert result == "abc"

    def test_handles_non_string_input(self):
        assert sanitize_for_display(42) == "42"
        assert sanitize_for_display(None) == "None"


class TestHexToRgb:
    def test_six_digit_hex(self):
        assert hex_to_rgb("#ff0000") == (255, 0, 0)

    def test_three_digit_shorthand(self):
        assert hex_to_rgb("#f00") == (255, 0, 0)

    def test_alpha_stripped(self):
        assert hex_to_rgb("#ff0000aa") == (255, 0, 0)

    def test_invalid_raises(self):
        with pytest.raises(ValueError):
            hex_to_rgb("#xyz")


class TestRelativeLuminance:
    def test_black(self):
        assert relative_luminance((0, 0, 0)) == 0.0

    def test_white(self):
        assert relative_luminance((255, 255, 255)) == 1.0


class TestContrastRatio:
    def test_white_on_white(self):
        assert contrast_ratio("#ffffff", "#ffffff") == 1.0

    def test_black_on_white(self):
        assert contrast_ratio("#000000", "#ffffff") >= 21.0

    def test_bad_hex_returns_zero(self, caplog):
        import logging
        caplog.set_level(logging.WARNING)
        result = contrast_ratio("#zzz", "#ffffff")
        assert result == 0.0
        assert "contrast_ratio failed" in caplog.text


class TestAsyncProfiler:
    def setup_method(self):
        AsyncProfiler.clear()

    def test_start_stop_records_elapsed(self):
        t0 = AsyncProfiler.start("test_op")
        time.sleep(0.01)
        AsyncProfiler.stop("test_op", t0)
        assert "test_op" in AsyncProfiler._traces
        assert len(AsyncProfiler._traces["test_op"]) == 1
        assert AsyncProfiler._traces["test_op"][0] >= 0.01

    def test_stats_returns_dict(self):
        AsyncProfiler._traces["stats_test"] = [0.1, 0.2, 0.3]
        stats = AsyncProfiler.stats()
        assert "stats_test" in stats
        s = stats["stats_test"]
        assert s["count"] == 3
        assert s["avg"] == 0.2
        assert s["min"] == 0.1
        assert s["max"] == 0.3

    def test_clear_resets_traces(self):
        AsyncProfiler._traces["x"] = [1.0]
        AsyncProfiler.clear()
        assert AsyncProfiler._traces == {}

    def test_slow_op_triggers_warning(self, caplog):
        import logging
        caplog.set_level(logging.WARNING)
        t0 = AsyncProfiler.start("slow_op")
        time.sleep(1.01)
        AsyncProfiler.stop("slow_op", t0)
        assert "[Profiler] Slow operation" in caplog.text


class TestProfilerProvider:
    def test_profile_async_returns_original_when_not_available(self):
        with patch("vibeserve.utils.PYINSTRUMENT_AVAILABLE", False):
            async def fake():
                return 42
            wrapped = ProfilerProvider.profile_async(fake)
            assert wrapped is fake

    def test_profile_sync_returns_original_when_not_available(self):
        with patch("vibeserve.utils.PYINSTRUMENT_AVAILABLE", False):
            def fake():
                return 42
            wrapped = ProfilerProvider.profile_sync(fake)
            assert wrapped is fake


class TestTOON:
    def test_encode_dict_with_nested(self):
        data = {"a": {"b": 1}, "c": [2, 3]}
        result = TOON.encode(data)
        assert "a:" in result
        assert "b:" in result
        assert "c:" in result

    def test_encode_dict_long_string_truncated(self):
        long_str = "x" * 100
        data = {"key": long_str}
        result = TOON.encode(data)
        assert result.endswith("...")
        assert len(result) < 100

    def test_encode_empty_list(self):
        assert TOON.encode([]) == "[]"

    def test_encode_list_of_dicts(self):
        data = [{"x": 1}, {"x": 2}]
        result = TOON.encode(data)
        assert result.startswith("-")

    def test_encode_list_of_primitives_truncated(self):
        data = list(range(15))
        result = TOON.encode(data)
        assert "..." in result
        assert "(+5)" in result

    def test_compress_json_valid(self):
        data = {"name": "test", "value": 42}
        result = TOON.compress_json(json.dumps(data))
        assert "name:" in result
        assert "test" in result

    def test_compress_json_invalid_truncates(self):
        long_invalid = "not json! " * 100
        result = TOON.compress_json(long_invalid)
        assert len(result) <= 500

    def test_savings_calculates_correctly(self):
        original = json.dumps({"a": 1, "b": 2, "c": 3})
        compressed = TOON.compress_json(original)
        s = TOON.savings(original, compressed)
        assert "original_tokens" in s
        assert "compressed_tokens" in s
        assert "percent" in s
        assert s["percent"] >= 0


class TestGraphify:
    def test_bar_chart_with_data(self):
        result = Graphify.bar_chart({"A": 10, "B": 20})
        assert "A" in result
        assert "B" in result
        assert "#" in result

    def test_bar_chart_empty_data(self):
        result = Graphify.bar_chart({})
        assert isinstance(result, str)

    def test_trend_line_with_points(self):
        result = Graphify.trend_line([1.0, 2.0, 3.0])
        assert "|" in result

    def test_trend_line_no_data(self):
        assert Graphify.trend_line([]) == "No data"

    def test_benchmark_summary_with_iterations(self):
        iters = [{"score": 0.5, "time_ms": 100}, {"score": 0.8, "time_ms": 200}]
        result = Graphify.benchmark_summary(iters)
        assert "Avg score" in result
        assert "Total time" in result

    def test_benchmark_summary_empty(self):
        result = Graphify.benchmark_summary([])
        assert "No data yet." in result
