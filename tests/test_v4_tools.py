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
