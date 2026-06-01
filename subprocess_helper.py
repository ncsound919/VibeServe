"""
Patch for vibeserve/tools/pipeline_tools.py

Two changes:
1. SUBPROCESS_TIMEOUT reduced from 300s to 30s (the 300s value was a DoS vector)
2. _run_subprocess() helper that kills the entire process group on timeout,
   ensuring child processes don't outlive the timeout.

Replace the inline subprocess.run() calls in pipeline_tools.py with
_run_subprocess() for consistent timeout and cleanup behavior.
"""

import logging
import os
import signal
import subprocess
from typing import List, Optional

log = logging.getLogger("VibeServe")

# FIX: was 300s — a 5-minute window is a denial-of-service vector on a shared
# server. 30s is sufficient for npm install, tsc, biome, and playwright on
# typical hardware. Long-running operations (full E2E suites) should be run
# out-of-band, not via MCP tools.
SUBPROCESS_TIMEOUT = 30


def _run_subprocess(
    cmd: List[str],
    cwd: str = ".",
    timeout: int = SUBPROCESS_TIMEOUT,
    env: Optional[dict] = None,
) -> subprocess.CompletedProcess:
    """Run a subprocess with timeout and guaranteed process group cleanup.

    On timeout, kills the entire process group (not just the direct child),
    so grandchildren (e.g. webpack spawned by npm) don't become zombies.

    Returns a CompletedProcess on success.
    Raises subprocess.TimeoutExpired with a descriptive message on timeout.
    """
    # Use os.setsid() to create a new process group so we can kill the whole tree.
    kwargs = {
        "cwd": cwd,
        "capture_output": True,
        "text": True,
        "env": env,
    }

    # setsid is Unix-only; on Windows fall back to standard subprocess behavior.
    use_process_group = hasattr(os, "setsid")
    if use_process_group:
        kwargs["start_new_session"] = True

    proc = subprocess.Popen(cmd, **kwargs)
    try:
        stdout, stderr = proc.communicate(timeout=timeout)
        return subprocess.CompletedProcess(
            args=cmd,
            returncode=proc.returncode,
            stdout=stdout,
            stderr=stderr,
        )
    except subprocess.TimeoutExpired:
        # Kill the entire process group to clean up child processes.
        if use_process_group:
            try:
                os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
            except (ProcessLookupError, PermissionError):
                proc.kill()
        else:
            proc.kill()

        proc.wait()  # Reap the zombie
        log.warning(
            f"[subprocess] Command timed out after {timeout}s and was killed: {' '.join(cmd[:3])}"
        )
        raise subprocess.TimeoutExpired(cmd=cmd, timeout=timeout)
