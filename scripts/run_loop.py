import asyncio
import json
from vibeserve.tools.v5_tools import vibe_benchmark_tool, vibe_iterate_tool

class MockCtx:
    async def info(self, msg): 
        print(f"[i] {msg}")
    async def report_progress(self, current, total, msg): 
        print(f"[{int(current/max(1,total)*100):3d}%] {msg}")

async def run_learning_loop():
    import vibeserve.providers
    class DummyProvider(vibeserve.providers.LLMProvider):
        @property
        def name(self): return "Dummy"
        @property
        def model(self): return "dummy-v1"
        async def call(self, *args, **kwargs): return "{}"
    
    vibeserve.providers.router.providers = {"dummy": DummyProvider()}
    vibeserve.providers.router._initialized = True
    
    async def mock_router_call(prompt, *args, **kwargs):
        # If it's a repair call, return the fixed JSON
        if "Repair this output" in prompt:
            return '{"components": [{"type": "button", "props": {"color": "#000000", "label": "Click me!", "aria-label": "Submit action"}}]}'
        
        # If it's a critique call (Designer, Engineer, or Advocate)
        if "critique" in prompt.lower() or "reviewing a UI" in prompt:
            # Check if the improved version is being reviewed
            is_improved = "#000000" in prompt
            score = 0.95 if is_improved else 0.4
            rec = "keep" if is_improved else "revise"
            
            # Identify which agent is calling (via the prompt)
            role = "Agent"
            if "UX Designer" in prompt: role = "Designer"
            elif "Frontend Engineer" in prompt: role = "Engineer"
            elif "Accessibility Advocate" in prompt: role = "Advocate"
            
            return f"""{{
                "role": "{role}",
                "score": {score},
                "recommendation": "{rec}",
                "concern_level": "low",
                "strengths": ["Clear labels"],
                "weaknesses": ["Contrast issue" if not is_improved else "None"],
                "specific_feedback": "Looks good"
            }}"""
        
        return "{}"
    
    vibeserve.providers.router.call = mock_router_call
    vibeserve.providers.router._initialized = True
    
    ctx = MockCtx()
    print("\n--- Running Vibe Benchmark Tool ---")
    benchmark_res = await vibe_benchmark_tool(ctx, iterations=5)
    print("\nBenchmark Results:")
    print(benchmark_res["dashboard"])
    print(f"Trend: {benchmark_res['trend']}")
    print(f"Average Score: {benchmark_res['avg_score']}")

    print("\n--- Running Vibe Iterate Tool (Recursive Learning) ---")
    mock_spec = {
        "page_type": "dashboard",
        "components": [
            {
                "type": "button",
                "props": {"color": "#ff0000", "label": "Click me!"}  # Bad contrast, no aria
            }
        ]
    }
    
    iterate_res = await vibe_iterate_tool(
        ctx, 
        specification=mock_spec, 
        requirements=["Accessible dashboard button", "Production ready"],
        max_iterations=4,
        quality_threshold=0.9
    )
    
    print("\nIteration History:")
    for iteration in iterate_res["iterations"]:
        print(f"Loop {iteration['iteration']}: Score {iteration['score_before']:.2f} -> {iteration['score_after']:.2f} | Passed: {iteration['passed']}")
        
    print("\nFinal Output:")
    print(json.dumps(iterate_res["final_output"], indent=2))
    
    # Save the loop analysis
    with open("loop_analysis.json", "w") as f:
        json.dump(iterate_res, f, indent=2)

if __name__ == "__main__":
    asyncio.run(run_learning_loop())
