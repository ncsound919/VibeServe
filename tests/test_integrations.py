"""Tests for vibeserve.integrations — External API connectors."""

import json
import os
from pathlib import Path
from unittest.mock import patch, AsyncMock, MagicMock

import pytest
from vibeserve.integrations import (
    Context7Provider,
    SupabaseConnector,
    VercelConnector,
    GitHubConnector,
    CloudflareConnector,
    GoogleConnector,
    EditorBridge,
)

ENV_SUPABASE = {"SUPABASE_KEY": "sb-key-12345", "SUPABASE_URL": "https://db.supabase.co"}
ENV_GITHUB = {"GITHUB_TOKEN": "gh-token-abc"}
ENV_VERCEL = {"VERCEL_TOKEN": "vctok-xyz"}
ENV_CLOUDFLARE = {"CLOUDFLARE_TOKEN": "cftok-789", "CLOUDFLARE_ZONE": "example.com"}
ENV_GOOGLE = {"GOOGLE_API_KEY": "AIzaSyTest123456789"}


class TestContext7Provider:
    @pytest.mark.asyncio
    async def test_fetch_docs_success(self):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "result": {"content": [{"text": "Context7 documentation for pydantic"}]}
        }
        mock_ctx = AsyncMock()
        mock_ctx.post.return_value = mock_response
        mock_client = AsyncMock()
        mock_client.__aenter__.return_value = mock_ctx

        with patch("httpx.AsyncClient", return_value=mock_client):
            result = await Context7Provider.fetch_docs("pydantic", library="pydantic")

        assert result == "Context7 documentation for pydantic"

    @pytest.mark.asyncio
    async def test_fetch_docs_with_api_key(self):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "result": {"content": [{"text": "docs with key"}]}
        }
        mock_ctx = AsyncMock()
        mock_ctx.post.return_value = mock_response
        mock_client = AsyncMock()
        mock_client.__aenter__.return_value = mock_ctx

        with patch.dict(os.environ, {"CONTEXT7_API_KEY": "c7key-12345"}):
            with patch("httpx.AsyncClient", return_value=mock_client):
                result = await Context7Provider.fetch_docs("test")

        assert result == "docs with key"
        call_headers = mock_ctx.post.call_args[1]["headers"]
        assert call_headers.get("CONTEXT7_API_KEY") == "c7key-12345"

    @pytest.mark.asyncio
    async def test_fetch_docs_failure_returns_empty(self):
        mock_ctx = AsyncMock()
        mock_ctx.post.side_effect = Exception("Network error")
        mock_client = AsyncMock()
        mock_client.__aenter__.return_value = mock_ctx

        with patch("httpx.AsyncClient", return_value=mock_client):
            result = await Context7Provider.fetch_docs("test")

        assert result == ""


class TestSupabaseConnector:
    @pytest.mark.asyncio
    async def test_query_success_with_filters(self):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = [{"id": 1, "name": "Alice"}]
        mock_ctx = AsyncMock()
        mock_ctx.get.return_value = mock_response
        mock_client = AsyncMock()
        mock_client.__aenter__.return_value = mock_ctx

        with patch.dict(os.environ, ENV_SUPABASE):
            with patch("httpx.AsyncClient", return_value=mock_client):
                result = await SupabaseConnector.query("users", filters={"status": "active"})

        assert result["status"] == 200
        assert result["data"] == [{"id": 1, "name": "Alice"}]
        assert "users" in mock_ctx.get.call_args[0][0]

    @pytest.mark.asyncio
    async def test_insert_success(self):
        mock_response = MagicMock()
        mock_response.status_code = 201
        mock_response.json.return_value = {"id": 1}
        mock_ctx = AsyncMock()
        mock_ctx.post.return_value = mock_response
        mock_client = AsyncMock()
        mock_client.__aenter__.return_value = mock_ctx

        with patch.dict(os.environ, ENV_SUPABASE):
            with patch("httpx.AsyncClient", return_value=mock_client):
                result = await SupabaseConnector.insert("users", {"name": "Alice"})

        assert result["status"] == 201
        assert result["data"] == {"id": 1}

    @pytest.mark.asyncio
    async def test_rpc_success(self):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"result": "ok"}
        mock_ctx = AsyncMock()
        mock_ctx.post.return_value = mock_response
        mock_client = AsyncMock()
        mock_client.__aenter__.return_value = mock_ctx

        with patch.dict(os.environ, ENV_SUPABASE):
            with patch("httpx.AsyncClient", return_value=mock_client):
                result = await SupabaseConnector.rpc("get_stats", {"year": 2024})

        assert result["status"] == 200
        assert result["data"] == {"result": "ok"}
        assert "rpc/get_stats" in mock_ctx.post.call_args[0][0]


class TestVercelConnector:
    @pytest.mark.asyncio
    async def test_list_deployments_success(self):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"deployments": [{"id": "dpl_1", "name": "my-app"}]}
        mock_ctx = AsyncMock()
        mock_ctx.get.return_value = mock_response
        mock_client = AsyncMock()
        mock_client.__aenter__.return_value = mock_ctx

        with patch.dict(os.environ, ENV_VERCEL):
            with patch("httpx.AsyncClient", return_value=mock_client):
                result = await VercelConnector.list_deployments()

        assert result["status"] == 200
        assert result["deployments"] == [{"id": "dpl_1", "name": "my-app"}]

    @pytest.mark.asyncio
    async def test_list_projects_success(self):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"projects": [{"id": "prj_1", "name": "web"}]}
        mock_ctx = AsyncMock()
        mock_ctx.get.return_value = mock_response
        mock_client = AsyncMock()
        mock_client.__aenter__.return_value = mock_ctx

        with patch.dict(os.environ, ENV_VERCEL):
            with patch("httpx.AsyncClient", return_value=mock_client):
                result = await VercelConnector.list_projects()

        assert result["status"] == 200
        assert result["projects"] == [{"id": "prj_1", "name": "web"}]


class TestGitHubConnector:
    @pytest.mark.asyncio
    async def test_get_repo_success(self):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"id": 1, "full_name": "owner/repo"}
        mock_ctx = AsyncMock()
        mock_ctx.get.return_value = mock_response
        mock_client = AsyncMock()
        mock_client.__aenter__.return_value = mock_ctx

        with patch.dict(os.environ, ENV_GITHUB):
            with patch("httpx.AsyncClient", return_value=mock_client):
                result = await GitHubConnector.get_repo("owner", "repo")

        assert result["status"] == 200
        assert result["repo"]["full_name"] == "owner/repo"

    @pytest.mark.asyncio
    async def test_list_issues_success(self):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = [{"number": 42, "title": "Bug report"}]
        mock_ctx = AsyncMock()
        mock_ctx.get.return_value = mock_response
        mock_client = AsyncMock()
        mock_client.__aenter__.return_value = mock_ctx

        with patch.dict(os.environ, ENV_GITHUB):
            with patch("httpx.AsyncClient", return_value=mock_client):
                result = await GitHubConnector.list_issues("owner", "repo")

        assert result["status"] == 200
        assert result["issues"] == [{"number": 42, "title": "Bug report"}]
        assert "issues" in mock_ctx.get.call_args[0][0]

    @pytest.mark.asyncio
    async def test_trigger_action_success(self):
        mock_response = MagicMock()
        mock_response.status_code = 204
        mock_ctx = AsyncMock()
        mock_ctx.post.return_value = mock_response
        mock_client = AsyncMock()
        mock_client.__aenter__.return_value = mock_ctx

        with patch.dict(os.environ, ENV_GITHUB):
            with patch("httpx.AsyncClient", return_value=mock_client):
                result = await GitHubConnector.trigger_action("owner", "repo", "ci.yml")

        assert result["status"] == 204
        assert result["triggered"] is True


class TestCloudflareConnector:
    @pytest.mark.asyncio
    async def test_list_dns_success(self):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "result": [{"id": "dns1", "name": "example.com"}],
            "success": True,
        }
        mock_ctx = AsyncMock()
        mock_ctx.get.return_value = mock_response
        mock_client = AsyncMock()
        mock_client.__aenter__.return_value = mock_ctx

        with patch.dict(os.environ, ENV_CLOUDFLARE):
            with patch("httpx.AsyncClient", return_value=mock_client):
                result = await CloudflareConnector.list_dns()

        assert result["status"] == 200
        assert result["records"] == [{"id": "dns1", "name": "example.com"}]

    @pytest.mark.asyncio
    async def test_purge_cache_success(self):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_ctx = AsyncMock()
        mock_ctx.post.return_value = mock_response
        mock_client = AsyncMock()
        mock_client.__aenter__.return_value = mock_ctx

        with patch.dict(os.environ, ENV_CLOUDFLARE):
            with patch("httpx.AsyncClient", return_value=mock_client):
                result = await CloudflareConnector.purge_cache()

        assert result["status"] == 200
        assert result["purged"] is True
        assert mock_ctx.post.call_args[1]["json"] == {"purge_everything": True}


class TestGoogleConnector:
    @pytest.mark.asyncio
    async def test_sheets_read_success(self):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"values": [["Name", "Age"], ["Alice", "30"]]}
        mock_ctx = AsyncMock()
        mock_ctx.get.return_value = mock_response
        mock_client = AsyncMock()
        mock_client.__aenter__.return_value = mock_ctx

        with patch.dict(os.environ, ENV_GOOGLE):
            with patch("httpx.AsyncClient", return_value=mock_client):
                result = await GoogleConnector.sheets_read("spreadsheet123")

        assert result["status"] == 200
        assert result["values"] == [["Name", "Age"], ["Alice", "30"]]

    @pytest.mark.asyncio
    async def test_sheets_write_success(self):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_ctx = AsyncMock()
        mock_ctx.post.return_value = mock_response
        mock_client = AsyncMock()
        mock_client.__aenter__.return_value = mock_ctx

        with patch.dict(os.environ, ENV_GOOGLE):
            with patch("httpx.AsyncClient", return_value=mock_client):
                result = await GoogleConnector.sheets_write(
                    "spreadsheet123", "Sheet1!A1:B2", [["Alice", "30"]]
                )

        assert result["status"] == 200
        assert result["updated"] is True


class TestEditorBridge:
    def test_vscode_task_json(self):
        result = EditorBridge.vscode_task_json("Serve", "python main.py")
        assert result["version"] == "2.0.0"
        assert len(result["tasks"]) == 1
        assert result["tasks"][0]["label"] == "Serve"
        assert result["tasks"][0]["command"] == "python main.py"

    def test_vscode_settings_json(self):
        result = EditorBridge.vscode_settings_json()
        assert result["python.testing.pytestEnabled"] is True
        assert result["python.testing.pytestArgs"] == ["tests/"]
        assert result["[python]"]["editor.defaultFormatter"] == "charliermarsh.ruff"

    def test_vscode_extensions_json(self):
        result = EditorBridge.vscode_extensions_json()
        assert "charliermarsh.ruff" in result["recommendations"]
        assert "ms-python.python" in result["recommendations"]

    def test_zed_workspace_config(self):
        result = EditorBridge.zed_workspace_config("vibeserve")
        parsed = json.loads(result)
        assert parsed["name"] == "vibeserve"
        assert "pyright" in parsed["settings"]["lsp"]
        assert parsed["settings"]["languages"]["Python"]["format_on_save"] == "on"

    def test_cursor_rules(self):
        result = EditorBridge.cursor_rules("fastmcp-server")
        assert "fastmcp-server" in result
        assert "type hints" in result

    def test_write_all_configs(self, tmp_path, monkeypatch):
        monkeypatch.setattr(Path, "cwd", lambda: tmp_path)
        result = EditorBridge.write_all_configs("testproj")
        assert result["files"] == [
            "tasks.json",
            "settings.json",
            "extensions.json",
            ".zed/settings.json",
        ]
        assert (tmp_path / ".vscode" / "tasks.json").exists()
        assert (tmp_path / ".vscode" / "settings.json").exists()
        assert (tmp_path / ".vscode" / "extensions.json").exists()
        assert (tmp_path / ".zed" / "settings.json").exists()
        with open(tmp_path / ".vscode" / "tasks.json") as f:
            tasks = json.load(f)
        assert tasks["tasks"][0]["label"] == "testproj: Serve"
        with open(tmp_path / ".zed" / "settings.json") as f:
            zed = json.load(f)
        assert zed["name"] == "testproj"
