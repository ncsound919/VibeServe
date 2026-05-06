"""VibeServe Agenda — business-aware goal tracking and work alignment.

Provides:
- Agenda CRUD (goals, initiatives, constraints)
- Work tagging: agents tag suggestions to agenda items
- Progress analytics: completed work per goal
- Extended goal semantics: type, areas, due dates, target metrics
"""

import asyncio
import calendar
import datetime
import json
import logging
import os
import shutil
import tempfile
import time
import uuid
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, ValidationError

from vibeserve.middleware import audit_tool
from vibeserve.server import mcp_server

logger = logging.getLogger(__name__)

AGENDA_FILE = Path.home() / ".vibeserve" / "agenda.json"

GoalType = Literal["feature", "reliability", "performance", "docs", "security"]
EffortLevel = Literal["small", "medium", "large"]
ScheduleMode = Literal["hourly", "nightly", "manual"]


class Goal(BaseModel):
    id: str = ""
    title: str
    description: str = ""
    priority: int = 3
    timeline: Optional[str] = None
    tags: List[str] = []
    status: Literal["planned", "active", "completed", "blocked"] = "planned"
    goal_type: Optional[GoalType] = None
    target_metric: Optional[str] = None
    due_date: Optional[str] = None
    effort: Optional[EffortLevel] = None
    areas: Optional[List[str]] = None
    allow_bg_work: bool = True
    schedule_mode: ScheduleMode = "hourly"
    created_at: str = ""
    updated_at: str = ""

    def __init__(self, **data):
        if "id" not in data or not data["id"]:
            data["id"] = str(uuid.uuid4())
        now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        data.setdefault("created_at", now)
        data.setdefault("updated_at", now)
        super().__init__(**data)


class Initiative(BaseModel):
    id: str = ""
    goal_id: str
    title: str
    description: str = ""
    features: List[str] = []
    created_at: str = ""

    def __init__(self, **data):
        if "id" not in data or not data["id"]:
            data["id"] = str(uuid.uuid4())
        data.setdefault("created_at", time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()))
        super().__init__(**data)


class AgendaEntry(BaseModel):
    id: str = ""
    goal_id: Optional[str] = None
    initiative_id: Optional[str] = None
    action_type: Literal["pr", "refactor", "test", "docs", "reuse", "fix"]
    repo: str = ""
    description: str = ""
    branch: str = ""
    status: str = "pending"
    pr_url: str = ""
    diff_summary: str = ""
    test_results: Optional[Dict] = None
    completed_at: Optional[str] = None
    created_at: str = ""

    def __init__(self, **data):
        if "id" not in data or not data["id"]:
            data["id"] = str(uuid.uuid4())
        data.setdefault("created_at", time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()))
        super().__init__(**data)


class Agenda:
    def __init__(self):
        self.goals: List[Goal] = []
        self.initiatives: List[Initiative] = []
        self.entries: List[AgendaEntry] = []
        self.constraints: List[str] = []
        self._lock = asyncio.Lock()
        self._load()

    async def _locked_load(self):
        async with self._lock:
            self._load_unlocked()

    async def _locked_save(self):
        async with self._lock:
            self._save_unlocked()

    def _load_unlocked(self):
        if not AGENDA_FILE.exists():
            return
        try:
            data = json.loads(AGENDA_FILE.read_text())
            self.goals = [Goal(**g) for g in data.get("goals", [])]
            self.initiatives = [Initiative(**i) for i in data.get("initiatives", [])]
            self.entries = [AgendaEntry(**e) for e in data.get("entries", [])]
            self.constraints = data.get("constraints", [])
        except (FileNotFoundError, json.JSONDecodeError, ValidationError) as e:
            logger.error(f"Error loading agenda from {AGENDA_FILE}: {e}")
            # Optionally, back up the corrupted file before clearing
            if AGENDA_FILE.exists():
                shutil.copy(AGENDA_FILE, f"{AGENDA_FILE}.bak.{int(time.time())}")
            self.goals = []
            self.initiatives = []
            self.entries = []
            self.constraints = []
        except Exception as e:
            logger.critical(f"Unexpected critical error loading agenda: {e}")
            raise

    def _save_unlocked(self):
        AGENDA_FILE.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(mode="w", delete=False, dir=AGENDA_FILE.parent) as tmp_file:
            tmp_file.write(json.dumps({
                "goals": [g.model_dump() for g in self.goals],
                "initiatives": [i.model_dump() for i in self.initiatives],
                "entries": [e.model_dump() for e in self.entries],
                "constraints": self.constraints,
            }, indent=2, default=str))
        os.replace(tmp_file.name, AGENDA_FILE)

    def _load(self):
        # Initial load, not necessarily locked. Use _locked_load for async ops.
        self._load_unlocked()

    def _save(self):
        # Initial save, not necessarily locked. Use _locked_save for async ops.
        self._save_unlocked()

    async def add_goal(self, title: str, description: str = "", priority: int = 3,
                     timeline: Optional[str] = None, tags: List[str] = None,
                     goal_type: Optional[GoalType] = None, target_metric: Optional[str] = None,
                     due_date: Optional[str] = None, effort: Optional[EffortLevel] = None,
                     areas: Optional[List[str]] = None,
                     allow_bg_work: bool = True, schedule_mode: ScheduleMode = "hourly") -> Goal:
        async with self._lock:
            goal = Goal(
                title=title, description=description, priority=priority,
                timeline=timeline, tags=tags or [],
                goal_type=goal_type, target_metric=target_metric,
                due_date=due_date, effort=effort, areas=areas,
                allow_bg_work=allow_bg_work, schedule_mode=schedule_mode,
            )
            self.goals.append(goal)
            self._save_unlocked()
            return goal

    async def add_initiative(self, goal_id: str, title: str, description: str = "",
                           features: List[str] = None) -> Initiative:
        async with self._lock:
            init = Initiative(goal_id=goal_id, title=title, description=description,
                              features=features or [])
            self.initiatives.append(init)
            self._save_unlocked()
            return init

    async def add_entry(self, goal_id: Optional[str], action_type: Literal["pr", "refactor", "test", "docs", "reuse", "fix"], repo: str,
                      description: str, initiative_id: Optional[str] = None,
                      branch: str = "") -> AgendaEntry:
        async with self._lock:
            entry = AgendaEntry(goal_id=goal_id, initiative_id=initiative_id,
                               action_type=action_type, repo=repo, description=description,
                               branch=branch)
            self.entries.append(entry)
            self._save_unlocked()
            return entry

    async def complete_entry(self, entry_id: str, pr_url: str = "", diff_summary: str = "",
                           test_results: Dict = None):
        async with self._lock:
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
                    self._save_unlocked()
                    return e.model_copy()  # Return a copy
            return None

    async def update_goal_status(self, goal_id: str, status: Literal['planned', 'active', 'completed', 'blocked']):
        async with self._lock:
            for g in self.goals:
                if g.id == goal_id:
                    g.status = status
                    g.updated_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
                    self._save_unlocked()
                    return g.model_copy()
            return None

    _ALLOWED_UPDATE_FIELDS = {"title", "description", "priority", "timeline", "tags",
                              "goal_type", "target_metric", "due_date", "effort", "areas",
                              "allow_bg_work", "schedule_mode", "status"}

    async def update_goal(self, goal_id: str, **kwargs):
        async with self._lock:
            for g in self.goals:
                if g.id == goal_id:
                    for key, value in kwargs.items():
                        if key not in self._ALLOWED_UPDATE_FIELDS:
                            logger.warning(f"Attempted to update non-mutable goal field: {key}")
                            continue
                        # Re-validate with Pydantic for type safety and allowed values
                        try:
                            updated_data = g.model_dump()
                            updated_data[key] = value
                            Goal(**updated_data)  # validate updated fields
                            setattr(g, key, value)
                        except ValidationError as e:
                            logger.error(f"Validation error updating goal {goal_id} field {key}: {e}")
                            return None # Or raise a specific error

                    g.updated_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
                    self._save_unlocked()
                    return g.model_copy()
            return None

    async def progress_report(self) -> Dict[str, Any]:
        async with self._lock:
            total = len(self.entries)
            completed = sum(1 for e in self.entries if e.status == "completed")
            in_progress = sum(1 for e in self.entries if e.status == "in_progress")
            pending = sum(1 for e in self.entries if e.status == "pending") # Corrected calculation

            by_goal = {}
            for g in self.goals:
                entries = [e for e in self.entries if e.goal_id == g.id]
                done = sum(1 for e in entries if e.status == "completed")
                is_overdue = False
                days_until_due = None
                if g.due_date and g.status != "completed":
                    try:
                        due_datetime = datetime.datetime.strptime(g.due_date, "%Y-%m-%d").replace(tzinfo=datetime.timezone.utc)
                        now_utc = datetime.datetime.now(datetime.timezone.utc)
                        if now_utc > due_datetime:
                            is_overdue = True
                        delta = due_datetime - now_utc
                        days_until_due = delta.days
                    except (ValueError, OverflowError):
                        pass
                by_goal[g.id] = {
                    "title": g.title,
                    "status": g.status,
                    "priority": g.priority,
                    "goal_type": g.goal_type,
                    "total": len(entries),
                    "completed": done,
                    "in_progress": sum(1 for e in entries if e.status == "in_progress"),
                    "pending": sum(1 for e in entries if e.status == "pending"),
                    "overdue": is_overdue,
                    "days_until_due": days_until_due, # Now returns int or None
                }
            return {
                "total_entries": total,
                "completed": completed,
                "in_progress": in_progress,
                "pending": pending, # Corrected calculation
                "rejected": total - completed - in_progress - pending, # New field
                "active_goals": sum(1 for g in self.goals if g.status == "active"),
                "completed_goals": sum(1 for g in self.goals if g.status == "completed"),
                "by_goal": by_goal,
            }

    async def impact_summary(self, days: int = 7) -> Dict[str, Any]:
        async with self._lock:
            cutoff = time.time() - (days * 86400)
            recent = [
                e for e in self.entries
                if e.status == "completed" and e.completed_at
                and calendar.timegm(time.strptime(e.completed_at, "%Y-%m-%dT%H:%M:%SZ")) >= cutoff
            ]
            by_goal = {}
            for e in recent:
                gid = e.goal_id if e.goal_id is not None else "unassigned" # Handle None goal_id
                if gid not in by_goal:
                    by_goal[gid] = {"count": 0, "repos": set()}
                by_goal[gid]["count"] += 1
                by_goal[gid]["repos"].add(e.repo)
            return {
                "period_days": days,
                "total_applied": len(recent),
                "by_goal": {
                    gid: {"count": v["count"], "repos": list(v["repos"])}
                    for gid, v in by_goal.items()
                },
            }


_agenda = Agenda()


@mcp_server.tool(name="agenda_set_goals", description="Define your business objectives, priorities, and constraints for VibeServe agents to work against.")
@audit_tool
async def agenda_set_goals(ctx, goals: str, constraints: str = "") -> Dict[str, Any]:
    async with _agenda._lock:
        try:
            goals_list = json.loads(goals)
        except json.JSONDecodeError as e:
            return {"status": "error", "error": str(e)}

        _agenda.goals = []
        for g_data in goals_list:
            try:
                _agenda.goals.append(Goal(**g_data))
            except ValidationError as e:
                logger.error(f"Validation error for goal data: {g_data}. Error: {e}")
                return {"status": "error", "error": f"Invalid goal data: {e}"}

        if constraints:
            _agenda.constraints = [c.strip() for c in constraints.split("\n") if c.strip()]
        await _agenda._locked_save()
        return {
            "status": "ok",
            "goal_count": len(_agenda.goals),
            "constraint_count": len(_agenda.constraints),
        }


@mcp_server.tool(name="agenda_add_goal", description="Add a single goal to the agenda with optional type, areas, due date and target metric.")
@audit_tool
async def agenda_add_goal(ctx, title: str, description: str = "",
                          priority: int = 3, timeline: str = "",
                          goal_type: str = "", target_metric: str = "",
                          due_date: str = "", effort: str = "",
                          areas: str = "",
                          allow_bg_work: bool = True,
                          schedule_mode: str = "hourly") -> Dict[str, Any]:
    areas_list = [a.strip() for a in areas.split(",") if a.strip()] if areas else None
    try:
        goal = await _agenda.add_goal(
            title=title, description=description,
            priority=priority, timeline=timeline or None,
            goal_type=goal_type or None, target_metric=target_metric or None,
            due_date=due_date or None, effort=effort or None,
            areas=areas_list,
            allow_bg_work=allow_bg_work, schedule_mode=schedule_mode,
        )
        return {"status": "ok", "goal": goal.model_dump()}
    except ValidationError as e:
        return {"status": "error", "error": f"Invalid goal data: {e}"}


@mcp_server.tool(name="agenda_add_initiative", description="Add an initiative linked to a goal.")
@audit_tool
async def agenda_add_initiative(ctx, goal_id: str, title: str,
                                 description: str = "", features: str = "") -> Dict[str, Any]:
    features_list = [f.strip() for f in features.split(",") if f.strip()]
    init = await _agenda.add_initiative(goal_id=goal_id, title=title,
                                  description=description, features=features_list)
    return {"status": "ok", "initiative": init.model_dump()}


@mcp_server.tool(name="agenda_get_status", description="Get current agenda: goals, progress per goal, recent entries.")
@audit_tool
async def agenda_get_status(ctx) -> Dict[str, Any]:
    async with _agenda._lock:
        try:
            progress_report = await _agenda.progress_report()
            impact_summary = await _agenda.impact_summary()
            return {
                "status": "ok",
                "goals": [g.model_dump() for g in _agenda.goals],
                "initiatives": [i.model_dump() for i in _agenda.initiatives],
                "constraints": _agenda.constraints,
                "progress": progress_report,
                "impact": impact_summary,
                "recent_entries": [e.model_dump() for e in _agenda.entries[-20:]],
            }
        except Exception as e:
            logger.error(f"Error in agenda_get_status: {e}")
            return {"status": "error", "error": f"Failed to retrieve agenda status: {e}"}


@mcp_server.tool(name="agenda_get_active_goals", description="Return all active agenda goals with full metadata.")
@audit_tool
async def agenda_get_active_goals(ctx) -> List[Dict[str, Any]]:
    async with _agenda._lock:
        active = [g for g in _agenda.goals if g.status == 'active']
        return [
            {
                "id": g.id,
                "title": g.title,
                "priority": g.priority,
                "status": g.status,
                "goalType": g.goal_type,
                "tags": g.tags,
                "targetMetric": g.target_metric,
                "dueDate": g.due_date,
                "effort": g.effort,
                "areas": g.areas,
                "allowBgWork": g.allow_bg_work,
                "scheduleMode": g.schedule_mode,
            }
            for g in active
        ]


@mcp_server.tool(name="agenda_get_impact", description="Get 7-day impact summary: suggestions applied per goal.")
@audit_tool
async def agenda_get_impact(ctx) -> Dict[str, Any]:
    async with _agenda._lock:
        try:
            return {"status": "ok", "impact": await _agenda.impact_summary()}
        except Exception as e:
            logger.error(f"Error in agenda_get_impact: {e}")
            return {"status": "error", "error": f"Failed to retrieve agenda impact: {e}"}


@mcp_server.tool(name="agenda_complete_goal", description="Mark a goal as completed.")
@audit_tool
async def agenda_complete_goal(ctx, goal_id: str) -> Dict[str, Any]:
    goal = await _agenda.update_goal_status(goal_id, "completed")
    if not goal:
        return {"status": "error", "error": f"Goal {goal_id} not found"}
    return {"status": "ok", "goal": goal.model_dump()}


@mcp_server.tool(name="agenda_activate_goal", description="Mark a goal as active — agents will prioritize work against this goal.")
@audit_tool
async def agenda_activate_goal(ctx, goal_id: str) -> Dict[str, Any]:
    goal = await _agenda.update_goal_status(goal_id, "active")
    if not goal:
        return {"status": "error", "error": f"Goal {goal_id} not found"}
    return {"status": "ok", "goal": goal.model_dump()}


@mcp_server.tool(name="agenda_log_entry", description="Log a work entry (PR, refactor, test) against an agenda goal.")
@audit_tool
async def agenda_log_entry(ctx, goal_id: str = "", action_type: Literal["pr", "refactor", "test", "docs", "reuse", "fix"] = "",
                           repo: str = "", description: str = "",
                           initiative_id: str = "", branch: str = "") -> Dict[str, Any]:
    entry = await _agenda.add_entry(
        goal_id=goal_id or None,
        initiative_id=initiative_id or None,
        action_type=action_type,
        repo=repo,
        description=description,
        branch=branch,
    )
    return {"status": "ok", "entry": entry.model_dump()}

