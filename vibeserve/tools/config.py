"""Configuration constants for VibeServe."""
from __future__ import annotations
from pathlib import Path


class Config:
    cache_dir: Path = Path(".aether_prime_cache")
    memory_dir: Path = Path(".aether_prime_memory")
    memory_db: Path = Path(".aether_prime_memory/specs.db")
    cache_ttl: int = 7200
    max_concurrency: int = 3
    max_retries: int = 4
    max_repairs: int = 2
    temp_generator: float = 0.82
    temp_critic: float = 0.15
    temp_synthesizer: float = 0.65
    max_variants: int = 4
    evolution_threshold: float = 0.85
    min_score_to_store: float = 0.82
    max_llm_calls: int = 50
    max_cost: float = 1.0


CONFIG = Config()
CONFIG.cache_dir.mkdir(parents=True, exist_ok=True)
CONFIG.memory_dir.mkdir(parents=True, exist_ok=True)
