import sys, os, json, re
sys.path.insert(0, '.')
os.environ['DEFAULT_LLM_PROVIDER'] = 'local'
os.environ['LOCAL_LLM_MODEL'] = 'llama3.2:1b'
import asyncio
from vibeserve.providers import router
from vibeserve.tools.vibe_architect import VibeArchitect

async def test():
    provider = router.get('local')
    prompt = open('tests/test_self_build_pipeline.py').read()
    intent = [l for l in prompt.split('\n') if 'SELF_BUILD_INTENT' in l][0].split('"')[1]

    arch = VibeArchitect()
    plan = await arch.plan(
        intent=intent,
        constraints=['Must use the real MCP server tools', 'Generated UI must be served on localhost:4999', 'Must include a live benchmarking dashboard'],
        target_stack='react'
    )
    print(f"decisions={len(plan.decisions)}")
    for d in plan.decisions:
        print(f"  {d.id}: {d.title}")
    print(f"risks={plan.risks}")
    print(f"component_tree={plan.component_tree}")
    print(f"data_flow={plan.data_flow}")

asyncio.run(test())
