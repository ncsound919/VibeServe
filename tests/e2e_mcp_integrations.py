"""E2E tests — verifies VibeServe MCP server builds with all integration tools."""

import sys
import asyncio
import json

sys.path.insert(0, ".")

from vibeserve.server import mcp_server


def test_mcp_server_build_has_all_integrations():
    """Verifies the built FastMCP server includes all integration tools."""
    from vibeserve.__main__ import main as _  # noqa: F401 — triggers registration

    server = mcp_server.build()
    # FastMCP's tool() method registers tools; we verify it was called with the right names
    # by checking the mcp_server._tools list
    tool_names = [n for n, d, f in mcp_server._tools]

    # Big-Homie tools
    assert "llm_complete" in tool_names, "llm_complete not registered"
    assert "memory_search" in tool_names, "memory_search not registered"
    assert "memory_store" in tool_names, "memory_store not registered"
    assert "governance_check_budget" in tool_names
    assert "governance_kill_switch" in tool_names
    assert "stripe_create_payment" in tool_names
    assert "shopify_get_orders" in tool_names
    assert "binance_get_price" in tool_names
    assert "twilio_send_sms" in tool_names
    assert "cloudflare_purge_cache" in tool_names
    assert "plaid_get_accounts" in tool_names
    assert "coinbase_create_charge" in tool_names
    assert "google_cloud_run_query" in tool_names
    assert "vercel_list_deployments" in tool_names
    assert "perplexity_search" in tool_names
    assert "draftkings_get_contests" in tool_names
    assert "prizepicks_get_lines" in tool_names
    assert len([n for n in tool_names if n in (
        "llm_complete", "memory_search", "memory_store",
        "governance_check_budget", "governance_kill_switch",
        "stripe_create_payment", "shopify_get_orders",
        "binance_get_price", "twilio_send_sms",
        "cloudflare_purge_cache", "plaid_get_accounts",
        "coinbase_create_charge", "google_cloud_run_query",
        "vercel_list_deployments", "perplexity_search",
        "draftkings_get_contests", "prizepicks_get_lines",
    )]) == 17, "Missing big-homie tools"

    # mem0 tools
    assert "mem0_add" in tool_names
    assert "mem0_search" in tool_names
    assert "mem0_get_all" in tool_names
    assert "mem0_delete" in tool_names
    assert "mem0_graph_query" in tool_names
    assert len([n for n in tool_names if n.startswith("mem0_")]) == 5, "Missing mem0 tools"

    # nanobot tools
    assert "nanobot_send" in tool_names
    assert "nanobot_schedule_cron" in tool_names
    assert "nanobot_run_skill" in tool_names
    assert "nanobot_list_skills" in tool_names
    assert len([n for n in tool_names if n.startswith("nanobot_")]) == 4, "Missing nanobot tools"

    total_integration = 17 + 5 + 4
    integration_names = [n for n in tool_names if n in (
        "llm_complete", "memory_search", "memory_store",
        "governance_check_budget", "governance_kill_switch",
        "stripe_create_payment", "shopify_get_orders",
        "binance_get_price", "twilio_send_sms",
        "cloudflare_purge_cache", "plaid_get_accounts",
        "coinbase_create_charge", "google_cloud_run_query",
        "vercel_list_deployments", "perplexity_search",
        "draftkings_get_contests", "prizepicks_get_lines",
        "mem0_add", "mem0_search", "mem0_get_all",
        "mem0_delete", "mem0_graph_query",
        "nanobot_send", "nanobot_schedule_cron",
        "nanobot_run_skill", "nanobot_list_skills",
    )]
    assert len(integration_names) == total_integration, (
        f"Expected {total_integration} integration tools, got {len(integration_names)}"
    )

    print(f"ALL {total_integration} integration tools confirmed on MCP server:")
    for name in sorted(integration_names):
        print(f"  ✓ {name}")
    print(f"\nTotal tools on server: {len(tool_names)}")
