"""Backward-compat shim — all symbols now live in dedicated modules.

DEPRECATED: Import directly from the new modules instead.
"""
from vibeserve.tools.config import CONFIG, Config
from vibeserve.tools.validators import SchemaValidator, validate_wcag_contrast
from vibeserve.tools.memory import memory_store, MemoryStore, store_successful_spec, get_similar_specs
from vibeserve.tools.cache import cache_manager, CacheManager
from vibeserve.tools.design_agent import DesignAgent
from vibeserve.tools.critique import MultiAgentCritique, CritiqueLoop
from vibeserve.tools.generators import SpecGenerator
from vibeserve.tools.vibe_architect import VibeArchitect, CONTENT_GUIDELINES
from vibeserve.tools.vibe_implementer import VibeImplementer, DEFAULT_DESIGN_SYSTEM
from vibeserve.tools.verify import VibeVerifier
from vibeserve.tools.code_reviewer import VibeCodeReviewer
from vibeserve.tools.system_auditor import SystemAuditor
from vibeserve.tools.vibe_tester import VibeTester
from vibeserve.tools.vibe_deployer import VibeDeployer
from vibeserve.tools.templates import TemplateLibrary, DesignUpgrader, PlaywrightBridge, DESIGN_UPGRADES

__all__ = [
    "CONFIG", "Config", "SchemaValidator", "validate_wcag_contrast",
    "memory_store", "MemoryStore", "store_successful_spec", "get_similar_specs",
    "cache_manager", "CacheManager", "DesignAgent",
    "MultiAgentCritique", "CritiqueLoop", "SpecGenerator",
    "VibeArchitect", "CONTENT_GUIDELINES",
    "VibeImplementer", "DEFAULT_DESIGN_SYSTEM",
    "VibeVerifier", "VibeCodeReviewer", "SystemAuditor",
    "VibeTester", "VibeDeployer",
    "TemplateLibrary", "DesignUpgrader", "PlaywrightBridge", "DESIGN_UPGRADES",
]
