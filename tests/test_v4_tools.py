import pytest
from unittest.mock import AsyncMock, MagicMock
from vibeserve.tools.v4_tools import list_design_systems_tool, memory_stats_tool

@pytest.mark.asyncio
async def test_list_design_systems_tool():
    ctx = AsyncMock()
    result = await list_design_systems_tool(ctx)
    assert "available_systems" in result
    assert len(result["available_systems"]) > 0
    assert result["available_systems"][0]["id"] == "default_grok"

@pytest.mark.asyncio
async def test_memory_stats_tool():
    ctx = AsyncMock()
    # Mocking memory_store
    with pytest.MonkeyPatch.context() as m:
        mock_store = MagicMock()
        mock_store.stats.return_value = {"total_stored_specs": 10}
        m.setattr("vibeserve.tools.v4_tools.memory_store", mock_store)
        
        result = await memory_stats_tool(ctx)
        assert result["total_stored_specs"] == 10
        ctx.info.assert_called()

@pytest.mark.asyncio
async def test_generate_ui_spec_tool():
    from unittest.mock import patch, AsyncMock
    from vibeserve.tools.v4_tools import generate_ui_spec_tool
    ctx = AsyncMock()
    with patch("vibeserve.tools.v4_tools.SpecGenerator") as mock_gen_class:
        mock_gen = mock_gen_class.return_value
        mock_gen.generate_with_critique = AsyncMock(return_value={
            "selected": {
                "version": "1.0",
                "metadata": {"id": "123"},
                "_score": 0.9,
                "_critique": {"score": 0.9}
            },
            "alternatives": [],
            "generation_metadata": {"time": 12.3}
        })
        
        result = await generate_ui_spec_tool(
            ctx, page_type="dashboard", requirements=["accessible"], use_cache=False
        )
        assert result["page_type"] == "dashboard"
        assert result["selected_specification"]["version"] == "1.0"

@pytest.mark.asyncio
async def test_generate_ui_spec_tool_cache_hit():
    from unittest.mock import patch
    from vibeserve.tools.v4_tools import generate_ui_spec_tool
    ctx = AsyncMock()
    with patch("vibeserve.tools.v4_tools.cache_manager") as mock_cache:
        mock_cache.get.return_value = {
            "page_type": "dashboard",
            "selected_specification": {"version": "1.0"},
            "alternatives": [],
            "metadata": {},
            "critique": {}
        }
        result = await generate_ui_spec_tool(
            ctx, page_type="dashboard", requirements=["accessible"], use_cache=True
        )
        assert result["cache_hit"] is True

@pytest.mark.asyncio
async def test_validate_ui_spec_tool():
    from vibeserve.tools.v4_tools import validate_ui_spec_tool
    ctx = AsyncMock()
    spec = {
        "version": "1.0",
        "metadata": {"id": "schema-001", "name": "Test Schema"},
        "components": [
            {
                "id": "btn-1", "type": "button", "label": "Click me",
                "accessibility": {"aria_role": "button"},
                "visual": {"color_role": "primary"}
            }
        ],
        "design_system": {
            "tokens": {
                "colors": {
                    "primary": {"hex": "#888888"},
                    "background": {"hex": "#FFFFFF"}
                }
            },
            "constraints": {
                "allowed_components": ["button"],
                "min_wcag_level": "AA"
            }
        }
    }
    result = await validate_ui_spec_tool(ctx, specification=spec)
    assert result["valid"] is True
    assert len(result["warnings"]) > 0

