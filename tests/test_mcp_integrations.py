"""Unit tests for vibeserve.mcp_integrations MCP modules — big_homie_mcp, mem0_mcp, nanobot_mcp."""

from unittest.mock import patch, MagicMock, AsyncMock
from vibeserve.server import _LazyMCP

# Force import integration modules ONCE so tools register before any test
import vibeserve.mcp_integrations.big_homie_mcp  # noqa: F401
import vibeserve.mcp_integrations.mem0_mcp  # noqa: F401
import vibeserve.mcp_integrations.nanobot_mcp  # noqa: F401


class TestBigHomieMCPTools:
    """Tests that big_homie_mcp registers tools."""

    def _find_tool(self, name):
        for n, d, f in _LazyMCP._tools:
            if n == name:
                return (n, d, f)
        return None

    def test_llm_complete_is_registered(self):
        tool = self._find_tool("llm_complete")
        assert tool is not None
        assert "LLM gateway" in tool[1]

    def test_memory_search_is_registered(self):
        assert self._find_tool("memory_search") is not None

    def test_memory_store_is_registered(self):
        assert self._find_tool("memory_store") is not None

    def test_governance_check_budget_registered(self):
        assert self._find_tool("governance_check_budget") is not None

    def test_governance_kill_switch_registered(self):
        assert self._find_tool("governance_kill_switch") is not None

    def test_stripe_is_registered(self):
        assert self._find_tool("stripe_create_payment") is not None

    def test_shopify_is_registered(self):
        assert self._find_tool("shopify_get_orders") is not None

    def test_binance_is_registered(self):
        assert self._find_tool("binance_get_price") is not None

    def test_twilio_is_registered(self):
        assert self._find_tool("twilio_send_sms") is not None

    def test_cloudflare_is_registered(self):
        assert self._find_tool("cloudflare_purge_cache") is not None

    def test_plaid_is_registered(self):
        assert self._find_tool("plaid_get_accounts") is not None

    def test_coinbase_is_registered(self):
        assert self._find_tool("coinbase_create_charge") is not None

    def test_google_cloud_is_registered(self):
        assert self._find_tool("google_cloud_run_query") is not None

    def test_vercel_is_registered(self):
        assert self._find_tool("vercel_list_deployments") is not None

    def test_perplexity_is_registered(self):
        assert self._find_tool("perplexity_search") is not None

    def test_draftkings_is_registered(self):
        assert self._find_tool("draftkings_get_contests") is not None

    def test_prizepicks_is_registered(self):
        assert self._find_tool("prizepicks_get_lines") is not None

    def test_has_17_tools(self):
        big_homie_tools = [t for t in _LazyMCP._tools if t[0] in (
            "llm_complete", "memory_search", "memory_store",
            "governance_check_budget", "governance_kill_switch",
            "stripe_create_payment", "shopify_get_orders",
            "binance_get_price", "twilio_send_sms",
            "cloudflare_purge_cache", "plaid_get_accounts",
            "coinbase_create_charge", "google_cloud_run_query",
            "vercel_list_deployments", "perplexity_search",
            "draftkings_get_contests", "prizepicks_get_lines",
        )]
        assert len(big_homie_tools) == 17


class TestBigHomieFallback:
    """Tests big_homie_mcp fallback behavior when backend is not installed."""

    @patch("vibeserve.mcp_integrations.big_homie_mcp.HAS_BIG_HOMIE", False)
    async def test_llm_complete_fallback(self):
        from vibeserve.mcp_integrations.big_homie_mcp import llm_complete
        result = await llm_complete("hello")
        assert "not installed" in result

    @patch("vibeserve.mcp_integrations.big_homie_mcp.HAS_BIG_HOMIE", False)
    async def test_memory_search_fallback(self):
        from vibeserve.mcp_integrations.big_homie_mcp import memory_search
        result = await memory_search("test")
        assert "not installed" in result

    @patch("vibeserve.mcp_integrations.big_homie_mcp.HAS_BIG_HOMIE", False)
    async def test_governance_fallback(self):
        from vibeserve.mcp_integrations.big_homie_mcp import governance_check_budget
        result = await governance_check_budget()
        assert "not installed" in result

    @patch("vibeserve.mcp_integrations.big_homie_mcp.HAS_STRIPE", False)
    async def test_stripe_fallback(self):
        from vibeserve.mcp_integrations.big_homie_mcp import stripe_create_payment
        result = await stripe_create_payment(1000)
        assert "not available" in result

    @patch("vibeserve.mcp_integrations.big_homie_mcp.HAS_SHOPIFY", False)
    async def test_shopify_fallback(self):
        from vibeserve.mcp_integrations.big_homie_mcp import shopify_get_orders
        result = await shopify_get_orders()
        assert "not available" in result


class TestMem0MCPTools:
    """Tests that mem0_mcp registers tools and handles fallbacks."""

    def _find_tool(self, name):
        for n, d, f in _LazyMCP._tools:
            if n == name:
                return (n, d, f)
        return None

    def test_mem0_add_is_registered(self):
        assert self._find_tool("mem0_add") is not None

    def test_mem0_search_is_registered(self):
        assert self._find_tool("mem0_search") is not None

    def test_mem0_get_all_is_registered(self):
        assert self._find_tool("mem0_get_all") is not None

    def test_mem0_delete_is_registered(self):
        assert self._find_tool("mem0_delete") is not None

    def test_mem0_graph_query_is_registered(self):
        assert self._find_tool("mem0_graph_query") is not None

    def test_has_5_mem0_tools(self):
        mem0_tools = [t for t in _LazyMCP._tools if t[0].startswith("mem0_")]
        assert len(mem0_tools) == 5

    @patch("vibeserve.mcp_integrations.mem0_mcp.HAS_MEM0", False)
    async def test_mem0_add_fallback(self):
        from vibeserve.mcp_integrations.mem0_mcp import mem0_add
        result = await mem0_add("test content")
        assert "not installed" in result

    @patch("vibeserve.mcp_integrations.mem0_mcp.HAS_MEM0", True)
    @patch("vibeserve.mcp_integrations.mem0_mcp.MemoryClient")
    async def test_mem0_add_calls_client(self, MockClient):
        mock_instance = MagicMock()
        mock_instance.add.return_value = {"id": "mem_123"}
        MockClient.return_value = mock_instance
        from vibeserve.mcp_integrations.mem0_mcp import mem0_add
        result = await mem0_add("test content")
        assert "mem_123" in result
        mock_instance.add.assert_called_once()


class TestNanobotMCPTools:
    """Tests that nanobot_mcp registers tools and handles fallbacks."""

    def _find_tool(self, name):
        for n, d, f in _LazyMCP._tools:
            if n == name:
                return (n, d, f)
        return None

    def test_nanobot_send_is_registered(self):
        assert self._find_tool("nanobot_send") is not None

    def test_nanobot_schedule_cron_is_registered(self):
        assert self._find_tool("nanobot_schedule_cron") is not None

    def test_nanobot_run_skill_is_registered(self):
        assert self._find_tool("nanobot_run_skill") is not None

    def test_nanobot_list_skills_is_registered(self):
        assert self._find_tool("nanobot_list_skills") is not None

    def test_has_4_nanobot_tools(self):
        nb_tools = [t for t in _LazyMCP._tools if t[0].startswith("nanobot_")]
        assert len(nb_tools) == 4

    @patch("vibeserve.mcp_integrations.nanobot_mcp.HAS_NANOBOT", False)
    async def test_nanobot_send_fallback(self):
        from vibeserve.mcp_integrations.nanobot_mcp import nanobot_send
        result = await nanobot_send()
        assert "not installed" in result


class TestMCPServerBuild:
    """Verifies the MCP server builds with all integration tools registered."""

    def test_build_includes_integration_tools(self):
        tool_names = [n for n, d, f in _LazyMCP._tools]
        assert "llm_complete" in tool_names
        assert "mem0_search" in tool_names
        assert "nanobot_send" in tool_names
        assert len(tool_names) >= 26  # 17 big-homie + 5 mem0 + 4 nanobot
