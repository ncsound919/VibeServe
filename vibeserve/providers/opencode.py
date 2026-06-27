"""OpenCode CLI provider."""
from __future__ import annotations

import asyncio
import json as _json
import logging
import os
import shutil
from typing import Optional

from vibeserve.providers.base import LLMProvider

log = logging.getLogger("VibeServe")


def _resolve_opencode_command() -> list[str]:
    """Return the Windows-safe command prefix for launching opencode."""
    if os.name == "nt":
        exe = shutil.which("opencode.exe")
        if exe:
            return [exe]

        cmd = shutil.which("opencode.cmd")
        if cmd:
            return ["cmd.exe", "/d", "/s", "/c", cmd]

        log.warning("Could not resolve a Windows-launchable opencode binary (.exe or .cmd)")
        return []

    found = shutil.which("opencode")
    if found:
        return [found]

    log.warning("Could not resolve opencode on PATH")
    return []


class OpenCodeProvider(LLMProvider):
    def __init__(self, model: Optional[str] = None):
        self.model = model or os.getenv("OPENCODE_MODEL", "opencode/hy3-preview-free")
        self._available = False
        self._binary_cmd: list[str] = []
        self._binary_cmd = _resolve_opencode_command()
        self._available = len(self._binary_cmd) > 0
        if not self._available:
            log.warning("OpenCode CLI not found. Install: npm install -g opencode-ai")

        self._project_root = os.getenv("OPENCODE_PROJECT_ROOT") or os.getcwd()

    @property
    def name(self) -> str:
        return "OpenCode"

    async def call(self, prompt: str, temperature: float = 0.7,
                   response_format: str = "json") -> Optional[str]:
        if not self._available:
            log.error("OpenCode CLI not installed -- provider disabled")
            return None

        try:
            cmd = [
                *self._binary_cmd, "run",
                "--model", self.model,
                prompt,
            ]
            log.info("OpenCode argv: %r", cmd)
            log.info("OpenCode cwd: %s", self._project_root)
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                cwd=self._project_root,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            try:
                stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=300.0)
            except asyncio.TimeoutError:
                proc.kill()
                await proc.wait()
                log.warning(f"[{self.name}] CLI timeout after 300s")
                return None

            if proc.returncode != 0:
                stderr_msg = stderr.decode() if stderr else "unknown error"
                log.warning(f"[{self.name}] CLI failed (exit {proc.returncode}): {stderr_msg[:200]}")
                return None

            output = stdout.decode()
            if response_format == "json":
                start = output.find("{")
                if start >= 0:
                    end = output.rfind("}")
                    if end > start:
                        candidate = output[start:end + 1]
                        try:
                            data = _json.loads(candidate)
                            content = self._extract_content(data)
                            if content is not None:
                                return content
                        except _json.JSONDecodeError:
                            pass
            return self._parse_output(output)
        except Exception as e:
            log.warning(f"[{self.name}] Provider error: {e}")
            return None

    @staticmethod
    def _extract_content(data: dict) -> Optional[str]:
        if 'content' in data:
            return data['content']
        if 'message' in data and isinstance(data['message'], dict):
            return data['message'].get('content')
        if 'response' in data:
            return data['response']
        return None

    def _parse_output(self, output: str) -> Optional[str]:
        try:
            lines = [line.strip() for line in output.strip().split('\n') if line.strip()]
            last_content: Optional[str] = None
            for line in lines:
                try:
                    data = _json.loads(line)
                    if isinstance(data, dict):
                        content = self._extract_content(data)
                        if content is not None:
                            last_content = content
                except _json.JSONDecodeError:
                    if line and not line.startswith('{'):
                        last_content = line
            return last_content
        except Exception as e:
            log.warning(f"[{self.name}] Failed to parse output: {e}")
            return None
