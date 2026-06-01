"""Shared imports for tool/handler modules — eliminates 20-line copy-paste blocks."""
from __future__ import annotations
import asyncio
import json
import logging
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

from vibeserve.models import CodeFile, ArchitectureDecision, VibePlan
from vibeserve.tools.config import CONFIG
from vibeserve.tools.memory import memory_store, store_successful_spec, get_similar_specs
from vibeserve.tools.cache import cache_manager
from vibeserve.tools.validators import SchemaValidator
from vibeserve.tools.generators import SpecGenerator
from vibeserve.tools.critique import MultiAgentCritique, CritiqueLoop
from vibeserve.tools.vibe_architect import VibeArchitect, CONTENT_GUIDELINES
from vibeserve.tools.vibe_implementer import VibeImplementer, DEFAULT_DESIGN_SYSTEM
from vibeserve.tools.verify import VibeVerifier
from vibeserve.tools.code_reviewer import VibeCodeReviewer
from vibeserve.tools.system_auditor import SystemAuditor
from vibeserve.tools.vibe_tester import VibeTester
from vibeserve.tools.vibe_deployer import VibeDeployer
from vibeserve.tools.templates import TemplateLibrary, DesignUpgrader, PlaywrightBridge
from vibeserve.utils import (
    TOON, Graphify, SentryTracker, Context7Provider,
    SupabaseConnector, VercelConnector, GitHubConnector,
    CloudflareConnector, GoogleConnector, EditorBridge,
    contrast_ratio,
)

log = logging.getLogger("VibeServe")

__all__ = [
    "asyncio", "json", "logging", "os", "Path", "Any", "Dict", "List", "Optional",
    "CodeFile", "ArchitectureDecision", "VibePlan",
    "CONFIG", "memory_store", "store_successful_spec", "get_similar_specs",
    "cache_manager", "SchemaValidator", "SpecGenerator",
    "MultiAgentCritique", "CritiqueLoop",
    "VibeArchitect", "CONTENT_GUIDELINES",
    "VibeImplementer", "DEFAULT_DESIGN_SYSTEM",
    "VibeVerifier", "VibeCodeReviewer", "SystemAuditor",
    "VibeTester", "VibeDeployer",
    "TemplateLibrary", "DesignUpgrader", "PlaywrightBridge",
    "TOON", "Graphify", "SentryTracker", "Context7Provider",
    "SupabaseConnector", "VercelConnector", "GitHubConnector",
    "CloudflareConnector", "GoogleConnector", "EditorBridge",
    "contrast_ratio",
    "log",
]
