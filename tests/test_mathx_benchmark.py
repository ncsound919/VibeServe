import pytest
import os
import json
from vibeserve.tools.mathx_benchmark import MathXBenchmark

def test_benchmark_initialization():
    benchmark = MathXBenchmark()
    assert benchmark.system_stats is not None
    assert "cpu_count" in benchmark.system_stats
    assert "python_version" in benchmark.system_stats

def test_benchmark_save_snapshot(tmp_path):
    benchmark = MathXBenchmark()
    test_file = os.path.join(tmp_path, "test-snapshots.json")
    benchmark.save_snapshot(filepath=test_file, metrics={"test_metric": 100})
    
    assert os.path.exists(test_file)
    with open(test_file, 'r') as f:
        data = json.load(f)
    assert data["metrics"]["test_metric"] == 100
