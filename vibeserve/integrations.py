"""External API connectors for VibeServe."""

from __future__ import annotations
import json
import logging
import os
from pathlib import Path
from urllib.parse import quote

import httpx

log = logging.getLogger("VibeServe")


class Context7Provider:
    BASE = "https://mcp.context7.com/mcp"

    @staticmethod
    async def fetch_docs(query: str, library: str = None) -> str:
        try:
            api_key = os.getenv("CONTEXT7_API_KEY", "")
            headers = {"Content-Type": "application/json"}
            if api_key:
                headers["CONTEXT7_API_KEY"] = api_key
            async with httpx.AsyncClient(timeout=15) as c:
                resp = await c.post(
                    Context7Provider.BASE,
                    json={"method": "tools/call", "params": {
                        "name": "get-library-docs",
                        "arguments": {"topic": query, "library": library or query}
                    }},
                    headers=headers
                )
                if resp.status_code == 200:
                    data = resp.json()
                    return data.get("result", {}).get("content", [{}])[0].get("text", "")[:3000]
        except Exception as e:
            log.warning("Context7Provider.fetch_docs failed: %s", e)
        return ""


class SupabaseConnector:
    @staticmethod
    def _headers() -> dict:
        return {
            "apikey": os.getenv("SUPABASE_KEY", ""),
            "Authorization": f"Bearer {os.getenv('SUPABASE_KEY', '')}",
            "Content-Type": "application/json"
        }

    @staticmethod
    async def query(table: str, select: str = "*", filters: dict = None, limit: int = 10) -> dict:
        url = f"{os.getenv('SUPABASE_URL', '')}/rest/v1/{table}?select={select}&limit={limit}"
        if filters:
            for k, v in filters.items():
                url += f"&{k}=eq.{quote(str(v), safe='')}"
        async with httpx.AsyncClient(timeout=15) as c:
            resp = await c.get(url, headers=SupabaseConnector._headers())
            return {"status": resp.status_code, "data": resp.json() if resp.status_code == 200 else None}

    @staticmethod
    async def insert(table: str, data: dict) -> dict:
        url = f"{os.getenv('SUPABASE_URL', '')}/rest/v1/{table}"
        async with httpx.AsyncClient(timeout=15) as c:
            resp = await c.post(url, headers=SupabaseConnector._headers(), json=data)
            return {"status": resp.status_code, "data": resp.json() if resp.status_code in (200, 201) else None}

    @staticmethod
    async def rpc(function: str, params: dict = None) -> dict:
        url = f"{os.getenv('SUPABASE_URL', '')}/rest/v1/rpc/{function}"
        async with httpx.AsyncClient(timeout=15) as c:
            resp = await c.post(url, headers=SupabaseConnector._headers(), json=params or {})
            return {"status": resp.status_code, "data": resp.json() if resp.status_code == 200 else None}


class VercelConnector:
    @staticmethod
    def _headers() -> dict:
        return {"Authorization": f"Bearer {os.getenv('VERCEL_TOKEN', '')}", "Content-Type": "application/json"}

    @staticmethod
    async def list_deployments(limit: int = 5) -> dict:
        async with httpx.AsyncClient(timeout=15) as c:
            resp = await c.get(
                f"https://api.vercel.com/v6/deployments?limit={limit}",
                headers=VercelConnector._headers()
            )
        return {"status": resp.status_code, "deployments": resp.json().get("deployments", []) if resp.status_code == 200 else []}

    @staticmethod
    async def list_projects() -> dict:
        async with httpx.AsyncClient(timeout=15) as c:
            resp = await c.get(
                "https://api.vercel.com/v9/projects",
                headers=VercelConnector._headers()
            )
        return {"status": resp.status_code, "projects": resp.json().get("projects", []) if resp.status_code == 200 else []}

    @staticmethod
    async def get_env(project_id: str) -> dict:
        async with httpx.AsyncClient(timeout=15) as c:
            resp = await c.get(
                f"https://api.vercel.com/v9/projects/{project_id}/env",
                headers=VercelConnector._headers()
            )
        return {"status": resp.status_code, "envs": resp.json().get("envs", []) if resp.status_code == 200 else []}


class GitHubConnector:
    @staticmethod
    def _headers() -> dict:
        return {"Authorization": f"Bearer {os.getenv('GITHUB_TOKEN', '')}", "Accept": "application/vnd.github+json"}

    @staticmethod
    async def get_repo(owner: str, repo: str) -> dict:
        async with httpx.AsyncClient(timeout=15) as c:
            resp = await c.get(
                f"https://api.github.com/repos/{owner}/{repo}",
                headers=GitHubConnector._headers()
            )
        return {"status": resp.status_code, "repo": resp.json() if resp.status_code == 200 else None}

    @staticmethod
    async def list_issues(owner: str, repo: str, state: str = "open") -> dict:
        async with httpx.AsyncClient(timeout=15) as c:
            resp = await c.get(
                f"https://api.github.com/repos/{owner}/{repo}/issues?state={state}&per_page=10",
                headers=GitHubConnector._headers()
            )
        return {"status": resp.status_code, "issues": resp.json() if resp.status_code == 200 else []}

    @staticmethod
    async def trigger_action(owner: str, repo: str, workflow: str, ref: str = "main") -> dict:
        async with httpx.AsyncClient(timeout=15) as c:
            resp = await c.post(
                f"https://api.github.com/repos/{owner}/{repo}/actions/workflows/{workflow}/dispatches",
                headers=GitHubConnector._headers(),
                json={"ref": ref}
            )
        return {"status": resp.status_code, "triggered": resp.status_code == 204}


class CloudflareConnector:
    @staticmethod
    def _headers() -> dict:
        return {"Authorization": f"Bearer {os.getenv('CLOUDFLARE_TOKEN', '')}", "Content-Type": "application/json"}

    @staticmethod
    async def list_dns() -> dict:
        zone = os.getenv("CLOUDFLARE_ZONE", "")
        async with httpx.AsyncClient(timeout=15) as c:
            resp = await c.get(
                f"https://api.cloudflare.com/client/v4/zones/{zone}/dns_records?per_page=20",
                headers=CloudflareConnector._headers()
            )
        return {"status": resp.status_code, "records": resp.json().get("result", []) if resp.status_code == 200 else []}

    @staticmethod
    async def purge_cache() -> dict:
        zone = os.getenv("CLOUDFLARE_ZONE", "")
        async with httpx.AsyncClient(timeout=15) as c:
            resp = await c.post(
                f"https://api.cloudflare.com/client/v4/zones/{zone}/purge_cache",
                headers=CloudflareConnector._headers(),
                json={"purge_everything": True}
            )
        return {"status": resp.status_code, "purged": resp.status_code == 200}


class GoogleConnector:
    @staticmethod
    async def sheets_read(spreadsheet_id: str, range_: str = "A1:Z100") -> dict:
        key = os.getenv("GOOGLE_API_KEY", "")
        headers = {"Content-Type": "application/json"}
        if key:
            headers["x-goog-api-key"] = key
        async with httpx.AsyncClient(timeout=15) as c:
            resp = await c.get(
                f"https://sheets.googleapis.com/v4/spreadsheets/{spreadsheet_id}/values/{range_}",
                headers=headers
            )
        return {"status": resp.status_code, "values": resp.json().get("values", []) if resp.status_code == 200 else []}

    @staticmethod
    async def sheets_write(spreadsheet_id: str, range_: str, values: list) -> dict:
        key = os.getenv("GOOGLE_API_KEY", "")
        headers = {"Content-Type": "application/json"}
        if key:
            headers["x-goog-api-key"] = key
        async with httpx.AsyncClient(timeout=15) as c:
            resp = await c.post(
                f"https://sheets.googleapis.com/v4/spreadsheets/{spreadsheet_id}/values/{range_}:append?valueInputOption=RAW",
                headers=headers,
                json={"values": values}
            )
        return {"status": resp.status_code, "updated": resp.status_code == 200}


class EditorBridge:
    @staticmethod
    def vscode_task_json(label: str, command: str) -> dict:
        return {"version": "2.0.0", "tasks": [{"label": label, "type": "shell", "command": command, "group": "build", "problemMatcher": []}]}

    @staticmethod
    def vscode_settings_json() -> dict:
        return {
            "python.defaultInterpreterPath": "python",
            "python.linting.ruffEnabled": True,
            "python.testing.pytestEnabled": True,
            "python.testing.pytestArgs": ["tests/"],
            "[python]": {"editor.formatOnSave": True, "editor.defaultFormatter": "charliermarsh.ruff"}
        }

    @staticmethod
    def vscode_extensions_json() -> dict:
        return {"recommendations": ["charliermarsh.ruff", "ms-python.python", "ms-python.mypy-type-checker"]}

    @staticmethod
    def zed_workspace_config(name: str, python_path: str = ".") -> str:
        return json.dumps({
            "name": name,
            "settings": {
                "lsp": {"pyright": {"settings": {"python": {"pythonPath": python_path}}}},
                "languages": {"Python": {"format_on_save": "on", "formatter": {"external": {"command": "ruff", "arguments": ["format", "-"]}}}}
            }
        }, indent=2)

    @staticmethod
    def cursor_rules(project_type: str = "mcp-server") -> str:
        return f"""You are building a {project_type}.
- Use type hints everywhere
- Async/await for I/O operations
- Environment variables for secrets, never hardcode keys
- WCAG AAA compliance for any UI output
- Test coverage: unit + integration + edge cases
- Follow PEP 8 and ruff linting rules
- Use Pydantic v2 for data validation"""

    @staticmethod
    def write_all_configs(project_name: str = "vibeserve"):
        base = Path.cwd()
        vscode_dir = base / ".vscode"
        vscode_dir.mkdir(exist_ok=True)
        with open(vscode_dir / "tasks.json", "w") as f:
            json.dump(EditorBridge.vscode_task_json(f"{project_name}: Serve", f"python {project_name}.py"), f, indent=2)
        with open(vscode_dir / "settings.json", "w") as f:
            json.dump(EditorBridge.vscode_settings_json(), f, indent=2)
        with open(vscode_dir / "extensions.json", "w") as f:
            json.dump(EditorBridge.vscode_extensions_json(), f, indent=2)
        zed_dir = base / ".zed"
        zed_dir.mkdir(exist_ok=True)
        with open(zed_dir / "settings.json", "w") as f:
            f.write(EditorBridge.zed_workspace_config(project_name))
        return {"vscode": str(vscode_dir), "zed": str(zed_dir), "files": ["tasks.json", "settings.json", "extensions.json", ".zed/settings.json"]}
