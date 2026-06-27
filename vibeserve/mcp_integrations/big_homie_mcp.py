"""Big-Homie MCP tools — LLM, vector memory, governance, and 12 integrations."""

from __future__ import annotations

import logging
import os

from vibeserve.server import mcp_server

log = logging.getLogger("VibeServe")

HAS_BIG_HOMIE = False
try:
    from big_homie.llm_gateway import llm, TaskType
    from big_homie.vector_memory import vector_memory
    from big_homie.governance import check_budget, kill_switch

    HAS_BIG_HOMIE = True
except ImportError:
    log.info("big-homie not installed — Big-Homie tools will return fallback messages")

HAS_STRIPE = False
try:
    from big_homie.integrations.stripe_integration import StripeIntegration
    HAS_STRIPE = True
except ImportError:
    pass

HAS_SHOPIFY = False
try:
    from big_homie.integrations.shopify_integration import ShopifyIntegration
    HAS_SHOPIFY = True
except ImportError:
    pass

HAS_BINANCE = False
try:
    from big_homie.integrations.binance_integration import BinanceIntegration
    HAS_BINANCE = True
except ImportError:
    pass

HAS_TWILIO = False
try:
    from big_homie.integrations.twilio_integration import TwilioIntegration
    HAS_TWILIO = True
except ImportError:
    pass

HAS_CLOUDFLARE = False
try:
    from big_homie.integrations.cloudflare_integration import CloudflareIntegration
    HAS_CLOUDFLARE = True
except ImportError:
    pass

HAS_PLAID = False
try:
    from big_homie.integrations.plaid_integration import PlaidIntegration
    HAS_PLAID = True
except ImportError:
    pass

HAS_COINBASE = False
try:
    from big_homie.integrations.coinbase_commerce_integration import CoinbaseCommerceIntegration
    HAS_COINBASE = True
except ImportError:
    pass

HAS_GOOGLE_CLOUD = False
try:
    from big_homie.integrations.google_cloud_integration import GoogleCloudIntegration
    HAS_GOOGLE_CLOUD = True
except ImportError:
    pass

HAS_VERCEL = False
try:
    from big_homie.integrations.vercel_integration import VercelIntegration
    HAS_VERCEL = True
except ImportError:
    pass

HAS_PERPLEXITY = False
try:
    from big_homie.integrations.perplexity_integration import PerplexityIntegration
    HAS_PERPLEXITY = True
except ImportError:
    pass

HAS_DRAFTKINGS = False
try:
    from big_homie.integrations.draftkings_integration import DraftKingsIntegration
    HAS_DRAFTKINGS = True
except ImportError:
    pass

HAS_PRIZEPICKS = False
try:
    from big_homie.integrations.prizepicks_integration import PrizePicksIntegration
    HAS_PRIZEPICKS = True
except ImportError:
    pass


# ── LLM Gateway ──────────────────────────────────────────────────────────

@mcp_server.tool(name="llm_complete", description="Complete a prompt through Big-Homie's multi-provider LLM gateway")
async def llm_complete(prompt: str, task_type: str = "general") -> str:
    if not HAS_BIG_HOMIE:
        return "big-homie not installed - install with: pip install -e path/to/Big-Homie-main"
    try:
        ttype = getattr(TaskType, task_type.upper(), TaskType.GENERAL)
        response = await llm.complete_with_tools(
            messages=[{"role": "user", "content": prompt}],
            task_type=ttype,
        )
        return response["content"]
    except Exception as e:
        log.error("llm_complete failed: %s", e)
        return f"Error: {e}"


@mcp_server.tool(name="memory_search", description="Search vector memory for past conversations")
async def memory_search(query: str, limit: int = 5) -> str:
    if not HAS_BIG_HOMIE:
        return "big-homie not installed"
    try:
        results = await vector_memory.search_conversations(query=query, limit=limit)
        return str(results)
    except Exception as e:
        log.error("memory_search failed: %s", e)
        return f"Error: {e}"


@mcp_server.tool(name="memory_store", description="Store a conversation into vector memory")
async def memory_store(content: str, metadata: str = "{}") -> str:
    if not HAS_BIG_HOMIE:
        return "big-homie not installed"
    try:
        import json
        meta = json.loads(metadata)
        await vector_memory.add_conversation(content=content, metadata=meta)
        return "stored"
    except Exception as e:
        log.error("memory_store failed: %s", e)
        return f"Error: {e}"


# ── Governance ────────────────────────────────────────────────────────────

@mcp_server.tool(name="governance_check_budget", description="Check current budget usage against configured limits")
async def governance_check_budget() -> str:
    if not HAS_BIG_HOMIE:
        return "big-homie not installed"
    try:
        result = check_budget()
        return str(result)
    except Exception as e:
        log.error("governance_check_budget failed: %s", e)
        return f"Error: {e}"


@mcp_server.tool(name="governance_kill_switch", description="Kill switch — disable all Big-Homie agent operations")
async def governance_kill_switch(reason: str = "manual override") -> str:
    if not HAS_BIG_HOMIE:
        return "big-homie not installed"
    try:
        kill_switch(reason=reason)
        return "kill switch activated"
    except Exception as e:
        log.error("governance_kill_switch failed: %s", e)
        return f"Error: {e}"


# ── Stripe ────────────────────────────────────────────────────────────────

@mcp_server.tool(name="stripe_create_payment", description="Create a Stripe payment intent")
async def stripe_create_payment(amount: int, currency: str = "usd") -> str:
    if not HAS_STRIPE:
        return "Stripe integration not available"
    try:
        si = StripeIntegration()
        result = si.create_payment_intent(amount=amount, currency=currency)
        return str(result)
    except Exception as e:
        log.error("stripe_create_payment failed: %s", e)
        return f"Error: {e}"


# ── Shopify ───────────────────────────────────────────────────────────────

@mcp_server.tool(name="shopify_get_orders", description="List recent Shopify orders")
async def shopify_get_orders(limit: int = 10) -> str:
    if not HAS_SHOPIFY:
        return "Shopify integration not available"
    try:
        si = ShopifyIntegration()
        result = si.get_orders(limit=limit)
        return str(result)
    except Exception as e:
        log.error("shopify_get_orders failed: %s", e)
        return f"Error: {e}"


# ── Binance ───────────────────────────────────────────────────────────────

@mcp_server.tool(name="binance_get_price", description="Get current price from Binance")
async def binance_get_price(symbol: str = "BTCUSDT") -> str:
    if not HAS_BINANCE:
        return "Binance integration not available"
    try:
        bi = BinanceIntegration()
        result = bi.get_ticker_price(symbol=symbol)
        return str(result)
    except Exception as e:
        log.error("binance_get_price failed: %s", e)
        return f"Error: {e}"


# ── Twilio ────────────────────────────────────────────────────────────────

@mcp_server.tool(name="twilio_send_sms", description="Send an SMS via Twilio")
async def twilio_send_sms(to: str, body: str) -> str:
    if not HAS_TWILIO:
        return "Twilio integration not available"
    try:
        ti = TwilioIntegration()
        result = ti.send_sms(to=to, body=body)
        return str(result)
    except Exception as e:
        log.error("twilio_send_sms failed: %s", e)
        return f"Error: {e}"


# ── Cloudflare ────────────────────────────────────────────────────────────

@mcp_server.tool(name="cloudflare_purge_cache", description="Purge Cloudflare cache for the configured zone")
async def cloudflare_purge_cache() -> str:
    if not HAS_CLOUDFLARE:
        return "Cloudflare integration not available"
    try:
        ci = CloudflareIntegration()
        result = ci.purge_cache()
        return str(result)
    except Exception as e:
        log.error("cloudflare_purge_cache failed: %s", e)
        return f"Error: {e}"


# ── Plaid ─────────────────────────────────────────────────────────────────

@mcp_server.tool(name="plaid_get_accounts", description="Get linked Plaid accounts")
async def plaid_get_accounts() -> str:
    if not HAS_PLAID:
        return "Plaid integration not available"
    try:
        pi = PlaidIntegration()
        result = pi.get_accounts()
        return str(result)
    except Exception as e:
        log.error("plaid_get_accounts failed: %s", e)
        return f"Error: {e}"


# ── Coinbase Commerce ─────────────────────────────────────────────────────

@mcp_server.tool(name="coinbase_create_charge", description="Create a Coinbase Commerce charge")
async def coinbase_create_charge(name: str, description: str, amount: float, currency: str = "USD") -> str:
    if not HAS_COINBASE:
        return "Coinbase Commerce integration not available"
    try:
        ci = CoinbaseCommerceIntegration()
        result = ci.create_charge(name=name, description=description, amount=amount, currency=currency)
        return str(result)
    except Exception as e:
        log.error("coinbase_create_charge failed: %s", e)
        return f"Error: {e}"


# ── Google Cloud ──────────────────────────────────────────────────────────

@mcp_server.tool(name="google_cloud_run_query", description="Run a Google Cloud SQL query")
async def google_cloud_run_query(sql: str) -> str:
    if not HAS_GOOGLE_CLOUD:
        return "Google Cloud integration not available"
    try:
        gci = GoogleCloudIntegration()
        result = gci.run_query(sql=sql)
        return str(result)
    except Exception as e:
        log.error("google_cloud_run_query failed: %s", e)
        return f"Error: {e}"


# ── Vercel ────────────────────────────────────────────────────────────────

@mcp_server.tool(name="vercel_list_deployments", description="List Vercel deployments")
async def vercel_list_deployments(limit: int = 10) -> str:
    if not HAS_VERCEL:
        return "Vercel integration not available"
    try:
        vi = VercelIntegration()
        result = vi.list_deployments(limit=limit)
        return str(result)
    except Exception as e:
        log.error("vercel_list_deployments failed: %s", e)
        return f"Error: {e}"


# ── Perplexity ────────────────────────────────────────────────────────────

@mcp_server.tool(name="perplexity_search", description="Search the web via Perplexity AI")
async def perplexity_search(query: str) -> str:
    if not HAS_PERPLEXITY:
        return "Perplexity integration not available"
    try:
        pi = PerplexityIntegration()
        result = pi.search(query=query)
        return str(result)
    except Exception as e:
        log.error("perplexity_search failed: %s", e)
        return f"Error: {e}"


# ── DraftKings ────────────────────────────────────────────────────────────

@mcp_server.tool(name="draftkings_get_contests", description="Get DraftKings contests")
async def draftkings_get_contests(sport: str = "NBA") -> str:
    if not HAS_DRAFTKINGS:
        return "DraftKings integration not available"
    try:
        dki = DraftKingsIntegration()
        result = dki.get_contests(sport=sport)
        return str(result)
    except Exception as e:
        log.error("draftkings_get_contests failed: %s", e)
        return f"Error: {e}"


# ── PrizePicks ────────────────────────────────────────────────────────────

@mcp_server.tool(name="prizepicks_get_lines", description="Get PrizePicks lines")
async def prizepicks_get_lines() -> str:
    if not HAS_PRIZEPICKS:
        return "PrizePicks integration not available"
    try:
        ppi = PrizePicksIntegration()
        result = ppi.get_lines()
        return str(result)
    except Exception as e:
        log.error("prizepicks_get_lines failed: %s", e)
        return f"Error: {e}"
