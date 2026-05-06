"""VibeServe Agenda — business-aware goal tracking and work alignment.

Provides:
- Agenda CRUD (goals, initiatives, constraints)
- Work tagging: agents tag suggestions to agenda items
- Progress analytics: completed work per goal
"""

import json
import os
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field
from vibeserve.tools._tool_deps import memory_store
from vibeserve.server import mcp_server
from vibeserve.middleware import audit_tool

AGENDA_FILE = Path(os.getenv("VIBESERVE_AGENDA_PATH", ".vibeserve/agenda.json"))


class Goal(BaseModel):
    id: str = Field(default_factory=lambda: f"goal-{int(time.time() * 1000)}")
    title: str
    description: str = ""
    status: str = "planned"  # planned, active, completed, blocked
    priority: int = 3  # 1-5, 1 = highest
    timeline: Optional[str] = None  # e.g. "Q2 2026"
    tags: List[str] = Field(default_factory=list)
    created_at: str = Field(default_factory=lambda: time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()))
    updated_at: str = Field(default_factory=lambda: time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()))


class Initiative(BaseModel):
    id: str = Field(default_factory=lambda: f"init-{int(time.time() * 1000)}")
    goal_id: str
    title: str
    description: str = ""
    status: str = "planned"
    features: List[str] = Field(default_factory=list)


class AgendaEntry(BaseModel):
    id: str = Field(default_factory=lambda: f"entry-{int(time.time() * 1000)}")
    goal_id: Optional[str] = None
    initiative_id: Optional[str] = None
    action_type: str  # "pr", "refactor", "test", "docs", "reuse", "fix"
    repo: str
    branch: str = ""
    description: str
    status: str = "pending"  # pending, in_progress, completed, rejected
    pr_url: Optional[str] = None
    diff_summary: Optional[str] = None
    test_results: Optional[Dict[str, Any]] = None
    created_at: str = Field(default_factory=lambda: time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()))
    completed_at: Optional[str] = None


class Agenda:
    def __init__(self):
        self.goals: List[Goal] = []
        self.initiatives: List[Initiative] = []
        self.entries: List[AgendaEntry] = []
        self.constraints: List[str] = []
        self._load()

    def _load(self):
        if AGENDA_FILE.exists():
            try:
                data = json.loads(AGENDA_FILE.read_text())
                self.goals = [Goal(**g) for g in data.get("goals", [])]
                self.initiatives = [Initiative(**i) for i in data.get("initiatives", [])]
                self.entries = [AgendaEntry(**e) for e in data.get("entries", [])]
                self.constraints = data.get("constraints", [])
            except Exception:
                pass

    def _save(self):
        AGENDA_FILE.parent.mkdir(parents=True, exist_ok=True)
        AGENDA_FILE.write_text(json.dumps({
            "goals": [g.model_dump() for g in self.goals],
            "initiatives": [i.model_dump() for i in self.initiatives],
            "entries": [e.model_dump() for e in self.entries],
            "constraints": self.constraints,
        }, indent=2, default=str))

    def add_goal(self, title: str, description: str = "", priority: int = 3,
                 timeline: Optional[str] = None, tags: List[str] = None) -> Goal:
        goal = Goal(title=title, description=description, priority=priority,
                     timeline=timeline, tags=tags or [])
        self.goals.append(goal)
        self._save()
        return goal

    def add_initiative(self, goal_id: str, title: str, description: str = "",
                       features: List[str] = None) -> Initiative:
        init = Initiative(goal_id=goal_id, title=title, description=description,
                          features=features or [])
        self.initiatives.append(init)
        self._save()
        return init

    def add_entry(self, goal_id: Optional[str], action_type: str, repo: str,
                  description: str, initiative_id: Optional[str] = None,
                  branch: str = "") -> AgendaEntry:
        entry = AgendaEntry(goal_id=goal_id, initiative_id=initiative_id,
                           action_type=action_type, repo=repo, description=description,
                           branch=branch)
        self.entries.append(entry)
        self._save()
        return entry

    def complete_entry(self, entry_id: str, pr_url: str = "", diff_summary: str = "",
                       test_results: Dict = None):
        for e in self.entries:
            if e.id == entry_id:
                e.status = "completed"
                e.completed_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
                if pr_url:
                    e.pr_url = pr_url
                if diff_summary:
                    e.diff_summary = diff_summary
                if test_results:
                    e.test_results = test_results
                self._save()
                return e
        return None

    def update_goal_status(self, goal_id: str, status: str):
        for g in self.goals:
            if g.id == goal_id:
                g.status = status
                g.updated_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
                self._save()
                return g
        return None

    def progress_report(self) -> Dict[str, Any]:
        total = len(self.entries)
        completed = sum(1 for e in self.entries if e.status == "completed")
        in_progress = sum(1 for e in self.entries if e.status == "in_progress")
        by_goal = {}
        for g in self.goals:
            entries = [e for e in self.entries if e.goal_id == g.id]
            done = sum(1 for e in entries if e.status == "completed")
            by_goal[g.id] = {
                "title": g.title,
                "status": g.status,
                "priority": g.priority,
                "total": len(entries),
                "completed": done,
                "in_progress": sum(1 for e in entries if e.status == "in_progress"),
                "pending": sum(1 for e in entries if e.status == "pending"),
            }
        return {
            "total_entries": total,
            "completed": completed,
            "in_progress": in_progress,
            "pending": total - completed - in_progress,
            "active_goals": sum(1 for g in self.goals if g.status == "active"),
            "completed_goals": sum(1 for g in self.goals if g.status == "completed"),
            "by_goal": by_goal,
        }


_agenda = Agenda()


@mcp_server.tool(name="agenda_set_goals", description="Define your business objectives, priorities, and constraints for VibeServe agents to work against.")
@audit_tool
async def agenda_set_goals(ctx, goals: str, constraints: str = "") -> Dict[str, Any]:
    try:
        goals_list = json.loads(goals)
    except json.JSONDecodeError as e:
        return {"status": "error", "error": str(e)}

    _agenda.goals = [Goal(**g) for g in goals_list]
    if constraints:
        _agenda.constraints = [c.strip() for c in constraints.split("\n") if c.strip()]
    _agenda._save()
    return {
        "status": "ok",
        "goal_count": len(_agenda.goals),
        "constraint_count": len(_agenda.constraints),
    }


@mcp_server.tool(name="agenda_add_goal", description="Add a single goal to the agenda.")
@audit_tool
async def agenda_add_goal(ctx, title: str, description: str = "",
                          priority: int = 3, timeline: str = "") -> Dict[str, Any]:
    goal = _agenda.add_goal(title=title, description=description,
                           priority=priority, timeline=timeline or None)
    return {"status": "ok", "goal": goal.model_dump()}


@mcp_server.tool(name="agenda_add_initiative", description="Add an initiative linked to a goal.")
@audit_tool
async def agenda_add_initiative(ctx, goal_id: str, title: str,
                                 description: str = "", features: str = "") -> Dict[str, Any]:
    features_list = [f.strip() for f in features.split(",") if f.strip()]
    init = _agenda.add_initiative(goal_id=goal_id, title=title,
                                  description=description, features=features_list)
    return {"status": "ok", "initiative": init.model_dump()}


@mcp_server.tool(name="agenda_get_status", description="Get current agenda: goals, progress per goal, recent entries.")
@audit_tool
async def agenda_get_status(ctx) -> Dict[str, Any]:
    return {
        "status": "ok",
        "goals": [g.model_dump() for g in _agenda.goals],
        "initiatives": [i.model_dump() for i in _agenda.initiatives],
        "constraints": _agenda.constraints,
        "progress": _agenda.progress_report(),
        "recent_entries": [e.model_dump() for e in _agenda.entries[-20:]],
    }


@mcp_server.tool(name="agenda_complete_goal", description="Mark a goal as completed.")
@audit_tool
async def agenda_complete_goal(ctx, goal_id: str) -> Dict[str, Any]:
    goal = _agenda.update_goal_status(goal_id, "completed")
    if not goal:
        return {"status": "error", "error": f"Goal {goal_id} not found"}
    return {"status": "ok", "goal": goal.model_dump()}


@mcp_server.tool(name="agenda_activate_goal", description="Mark a goal as active — agents will prioritize work against this goal.")
@audit_tool
async def agenda_activate_goal(ctx, goal_id: str) -> Dict[str, Any]:
    goal = _agenda.update_goal_status(goal_id, "active")
    if not goal:
        return {"status": "error", "error": f"Goal {goal_id} not found"}
    return {"status": "ok", "goal": goal.model_dump()}


@mcp_server.tool(name="agenda_log_entry", description="Log a work entry (PR, refactor, test) against an agenda goal.")
@audit_tool
async def agenda_log_entry(ctx, goal_id: str = "", action_type: str = "",
                           repo: str = "", description: str = "",
                           initiative_id: str = "", branch: str = "") -> Dict[str, Any]:
    entry = _agenda.add_entry(
        goal_id=goal_id or None,
        initiative_id=initiative_id or None,
        action_type=action_type,
        repo=repo,
        description=description,
        branch=branch,
    )
    return {"status": "ok", "entry": entry.model_dump()}
