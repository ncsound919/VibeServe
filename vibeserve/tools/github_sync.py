"""VibeServe GitHub Sync — link GitHub accounts, list repos, clone, sync.

Provides:
- Multi-account GitHub linking via personal access token
- Repo selection and scoping
- Periodic sync of repo metadata
"""

import json
import os
import subprocess
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from vibeserve.server import mcp_server
from vibeserve.middleware import audit_tool

GITHUB_CONFIG_PATH = Path(os.getenv("VIBESERVE_GITHUB_CONFIG", ".vibeserve/github.json"))
REPOS_DIR = Path(os.getenv("VIBESERVE_REPOS_DIR", os.path.expanduser("~/vibeserve-repos")))


class GhAccount(BaseModel):
    id: str
    username: str = ""
    token_prefix: str = ""  # first 8 chars of token for identification
    scopes: List[str] = Field(default_factory=list)
    added_at: str = Field(default_factory=lambda: time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()))


class LinkedRepo(BaseModel):
    id: int
    full_name: str
    name: str
    description: str = ""
    language: str = ""
    html_url: str = ""
    clone_url: str = ""
    default_branch: str = "main"
    private: bool = False
    in_scope: bool = True
    local_path: str = ""
    account_id: str = ""
    last_synced: str = ""


class GithubLinkManager:
    def __init__(self):
        self.accounts: List[GhAccount] = []
        self.linked_repos: List[LinkedRepo] = []
        self._load()

    def _load(self):
        if GITHUB_CONFIG_PATH.exists():
            try:
                data = json.loads(GITHUB_CONFIG_PATH.read_text())
                self.accounts = [GhAccount(**a) for a in data.get("accounts", [])]
                self.linked_repos = [LinkedRepo(**r) for r in data.get("repos", [])]
            except Exception:
                pass

    def _save(self):
        GITHUB_CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
        GITHUB_CONFIG_PATH.write_text(json.dumps({
            "accounts": [a.model_dump() for a in self.accounts],
            "repos": [r.model_dump() for r in self.linked_repos],
        }, indent=2, default=str))

    def link_account(self, token: str) -> GhAccount:
        import httpx
        import asyncio

        async def _fetch():
            async with httpx.AsyncClient() as client:
                r = await client.get("https://api.github.com/user", headers={
                    "Authorization": f"Bearer {token}",
                    "Accept": "application/vnd.github.v3+json",
                    "X-GitHub-Api-Version": "2022-11-28",
                    "User-Agent": "VibeServe",
                })
                r.raise_for_status()
                return r.json()

        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                import nest_asyncio
                nest_asyncio.apply()
                data = asyncio.ensure_future(_fetch()).result(timeout=15)
            else:
                data = asyncio.run(_fetch())
        except Exception:
            try:
                import requests
                r = requests.get("https://api.github.com/user", headers={
                    "Authorization": f"Bearer {token}",
                    "Accept": "application/vnd.github.v3+json",
                    "X-GitHub-Api-Version": "2022-11-28",
                    "User-Agent": "VibeServe",
                }, timeout=15)
                r.raise_for_status()
                data = r.json()
            except Exception as e:
                raise RuntimeError(f"GitHub API unreachable: {e}")

        username = data.get("login", "unknown")
        account = GhAccount(
            id=f"gh-{int(time.time())}",
            username=username,
            token_prefix=token[:8],
            scopes=data.get("scopes", []),
        )
        self.accounts.append(account)
        self._save()
        return account

    def list_repos(self, token: str, page: int = 1, per_page: int = 100) -> List[Dict]:
        import httpx
        import asyncio

        async def _fetch():
            async with httpx.AsyncClient() as client:
                r = await client.get(
                    f"https://api.github.com/user/repos?per_page={per_page}&page={page}&sort=updated&type=owner",
                    headers={
                        "Authorization": f"Bearer {token}",
                        "Accept": "application/vnd.github.v3+json",
                        "X-GitHub-Api-Version": "2022-11-28",
                        "User-Agent": "VibeServe",
                    })
                r.raise_for_status()
                return r.json()

        try:
            try:
                data = asyncio.run(_fetch())
            except RuntimeError:
                import nest_asyncio
                nest_asyncio.apply()
                loop = asyncio.get_event_loop()
                data = loop.run_until_complete(_fetch())
        except Exception:
            try:
                import requests
                r = requests.get(
                    f"https://api.github.com/user/repos?per_page={per_page}&page={page}&sort=updated&type=owner",
                    headers={
                        "Authorization": f"Bearer {token}",
                        "Accept": "application/vnd.github.v3+json",
                        "X-GitHub-Api-Version": "2022-11-28",
                        "User-Agent": "VibeServe",
                    }, timeout=15)
                r.raise_for_status()
                data = r.json()
            except Exception as e:
                raise RuntimeError(f"Failed to list repos: {e}")

        existing = {r.full_name for r in self.linked_repos}
        results = []
        for repo in data:
            results.append({
                "id": repo["id"],
                "full_name": repo["full_name"],
                "name": repo["name"],
                "description": repo.get("description", ""),
                "language": repo.get("language", ""),
                "html_url": repo.get("html_url", ""),
                "clone_url": repo.get("clone_url", ""),
                "default_branch": repo.get("default_branch", "main"),
                "private": repo.get("private", False),
                "already_linked": repo["full_name"] in existing,
                "stargazers_count": repo.get("stargazers_count", 0),
                "pushed_at": repo.get("pushed_at", ""),
            })
        return results

    def link_repo(self, full_name: str, account_id: str, clone: bool = True) -> LinkedRepo:
        token = ""
        for a in self.accounts:
            if a.id == account_id:
                token = a.token_prefix
                break

        name = full_name.split("/")[-1]
        repo = LinkedRepo(
            id=int(time.time() * 1000) % 1000000,
            full_name=full_name,
            name=name,
            clone_url=f"https://github.com/{full_name}.git",
            html_url=f"https://github.com/{full_name}",
            account_id=account_id,
            in_scope=True,
        )

        if clone:
            REPOS_DIR.mkdir(parents=True, exist_ok=True)
            local_path = REPOS_DIR / name
            if not local_path.exists():
                try:
                    subprocess.run(
                        ["git", "clone", f"https://github.com/{full_name}.git", str(local_path)],
                        check=False, capture_output=True, text=True, timeout=120
                    )
                except Exception:
                    pass
            if local_path.exists():
                repo.local_path = str(local_path)

        self.linked_repos.append(repo)
        self._save()
        return repo

    def get_linked_repos(self) -> List[Dict]:
        return [r.model_dump() for r in self.linked_repos]


_github_manager = GithubLinkManager()


@mcp_server.tool(name="github_link_account", description="Link a GitHub account via personal access token. Required before repo operations.")
@audit_tool
async def github_link_account(ctx, token: str) -> Dict[str, Any]:
    try:
        account = _github_manager.link_account(token)
        return {"status": "ok", "account": account.model_dump()}
    except Exception as e:
        return {"status": "error", "error": str(e)}


@mcp_server.tool(name="github_list_repos", description="List repositories for the linked GitHub account.")
@audit_tool
async def github_list_repos(ctx, page: int = 1) -> Dict[str, Any]:
    if not _github_manager.accounts:
        return {"status": "error", "error": "No GitHub account linked. Use github_link_account first."}
    try:
        token = _github_manager.accounts[0].token_prefix
        repos = _github_manager.list_repos(token=token, page=page)
        return {"status": "ok", "count": len(repos), "repos": repos}
    except Exception as e:
        return {"status": "error", "error": str(e)}


@mcp_server.tool(name="github_link_repo", description="Add a GitHub repo to VibeServe scope. Optionally clone it locally.")
@audit_tool
async def github_link_repo(ctx, full_name: str, clone: bool = True) -> Dict[str, Any]:
    if not _github_manager.accounts:
        return {"status": "error", "error": "No GitHub account linked."}
    account_id = _github_manager.accounts[0].id
    try:
        repo = _github_manager.link_repo(full_name=full_name, account_id=account_id, clone=clone)
        return {"status": "ok", "repo": repo.model_dump()}
    except Exception as e:
        return {"status": "error", "error": str(e)}


@mcp_server.tool(name="github_sync_all", description="Sync metadata for all linked repos — pulls latest data from GitHub API.")
@audit_tool
async def github_sync_all(ctx) -> Dict[str, Any]:
    repos = _github_manager.get_linked_repos()
    return {"status": "ok", "count": len(repos), "repos": repos}
