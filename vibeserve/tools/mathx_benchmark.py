import os
import sys
import json
import psutil
from datetime import datetime

class MathXBenchmark:
    def __init__(self):
        self.system_stats = {
            "python_version": sys.version,
            "cpu_count": psutil.cpu_count(),
            "memory_total_gb": round(psutil.virtual_memory().total / (1024**3), 2)
        }

    def save_snapshot(self, filepath: str, metrics: dict):
        snapshot = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "system_stats": self.system_stats,
            "metrics": metrics,
            "improvements_applied": []
        }
        
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        with open(filepath, 'w') as f:
            json.dump(snapshot, f, indent=2)
