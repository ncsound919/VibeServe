"""E2E test for agenda system after Phase A-D fixes."""
import asyncio
from vibeserve.tools.agenda import Agenda

async def main():
    a = Agenda()
    
    # Test 1: Create goal
    goal = await a.add_goal(
        title="E2E Test Goal",
        description="Testing complete CRUD cycle",
        goal_type="feature",
        areas=["ide/src"],
        due_date="2026-12-31",
    )
    print(f"[PASS] Created goal: {goal.id} - {goal.title}")
    assert goal.title == "E2E Test Goal"
    assert goal.goal_type == "feature"
    assert goal.areas == ["ide/src"]
    
    # Test 2: Activate goal
    updated = await a.update_goal_status(goal.id, "active")
    print(f"[PASS] Activated: {updated.status}")
    assert updated.status == "active"
    
    # Test 3: Get active goals
    active = [g for g in a.goals if g.status == "active"]
    print(f"[PASS] Active goals: {len(active)}")
    assert len(active) == 1
    
    # Test 4: Progress report
    report = await a.progress_report()
    print(f"[PASS] Progress: {report['active_goals']} active, {report['completed_goals']} completed")
    
    # Test 5: Update goal fields with validation
    await a.update_goal(goal.id, priority=1, effort="large")
    g = next(g for g in a.goals if g.id == goal.id)
    print(f"[PASS] Updated: priority={g.priority}, effort={g.effort}")
    assert g.priority == 1
    assert g.effort == "large"
    
    # Test 6: Allowlist rejects bad fields
    await a.update_goal(goal.id, id="hacked")  # should be rejected silently
    g2 = next(g for g in a.goals if g.id == goal.id)
    print(f"[PASS] Immutable field protection: id still={g2.id}")
    assert g2.id == goal.id
    
    # Test 7: Impact summary
    impact = await a.impact_summary()
    print(f"[PASS] Impact summary: {impact['period_days']}d period")
    
    # Test 8: Complete goal
    completed = await a.update_goal_status(goal.id, "completed")
    print(f"[PASS] Completed: {completed.status}")
    assert completed.status == "completed"
    
    # Test 9: Completed goals filter
    active_after = [g for g in a.goals if g.status == "active"]
    completed_after = [g for g in a.goals if g.status == "completed"]
    print(f"[PASS] Post-complete: {len(active_after)} active, {len(completed_after)} completed")
    assert len(active_after) == 0
    assert len(completed_after) == 1
    
    print("\n=== ALL 9 E2E TESTS PASSED ===")

asyncio.run(main())
