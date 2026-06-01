"""Tests for vibeserve.tools.agenda."""

import json
import time

import pytest
from pydantic import ValidationError

from vibeserve.tools.agenda import (
    Goal,
    Initiative,
    AgendaEntry,
    Agenda,
)


@pytest.fixture
def tmp_agenda_file(tmp_path, monkeypatch):
    """Patch AGENDA_FILE to an isolated temp path."""
    agenda_file = tmp_path / "agenda.json"
    monkeypatch.setattr("vibeserve.tools.agenda.AGENDA_FILE", agenda_file)
    return agenda_file


@pytest.fixture
def agenda(tmp_agenda_file):
    """Return a fresh Agenda instance with isolated file path."""
    return Agenda()


class TestGoalModel:
    def test_auto_id_and_timestamps(self):
        goal = Goal(title="My Goal")
        assert goal.id
        assert len(goal.id) > 0
        assert goal.created_at
        assert goal.updated_at
        assert goal.title == "My Goal"
        assert goal.priority == 3
        assert goal.status == "planned"

    def test_custom_id(self):
        goal = Goal(id="my-custom-id", title="My Goal")
        assert goal.id == "my-custom-id"

    def test_required_fields(self):
        with pytest.raises(ValidationError):
            Goal()


class TestInitiativeModel:
    def test_auto_id(self):
        init = Initiative(goal_id="g1", title="My Initiative")
        assert init.id
        assert len(init.id) > 0
        assert init.goal_id == "g1"
        assert init.title == "My Initiative"

    def test_custom_id(self):
        init = Initiative(id="init-1", goal_id="g1", title="My Initiative")
        assert init.id == "init-1"


class TestAgendaEntryModel:
    def test_auto_id(self):
        entry = AgendaEntry(
            goal_id="g1",
            action_type="pr",
            repo="user/repo",
            description="Test PR",
        )
        assert entry.id
        assert entry.goal_id == "g1"
        assert entry.action_type == "pr"
        assert entry.status == "pending"

    def test_all_fields(self):
        entry = AgendaEntry(
            id="entry-1",
            goal_id="g1",
            initiative_id="i1",
            action_type="refactor",
            repo="user/repo",
            description="Refactor",
            branch="feature/refactor",
            status="in_progress",
            pr_url="https://github.com/user/repo/pull/1",
            diff_summary="Changed a bunch of stuff",
            test_results={"pass": 10, "fail": 0},
            completed_at="2025-01-01T00:00:00Z",
        )
        assert entry.id == "entry-1"
        assert entry.initiative_id == "i1"
        assert entry.branch == "feature/refactor"
        assert entry.pr_url == "https://github.com/user/repo/pull/1"
        assert entry.test_results["pass"] == 10


class TestAgendaCRUD:
    async def test_init_loads_from_file(self, tmp_agenda_file):
        data = {
            "goals": [{"title": "Goal 1"}, {"title": "Goal 2"}],
            "initiatives": [{"goal_id": "g1", "title": "Init 1"}],
            "entries": [{"goal_id": "g1", "action_type": "pr", "repo": "r", "description": "e1"}],
            "constraints": ["c1"],
        }
        tmp_agenda_file.write_text(json.dumps(data))
        a = Agenda()
        assert len(a.goals) == 2
        assert len(a.initiatives) == 1
        assert len(a.entries) == 1
        assert a.constraints == ["c1"]

    async def test_add_goal(self, agenda):
        g = await agenda.add_goal(title="Test Goal", priority=1, goal_type="feature")
        assert g.title == "Test Goal"
        assert g.priority == 1
        assert g.goal_type == "feature"
        assert len(agenda.goals) == 1
        assert agenda.goals[0].id == g.id

    async def test_add_initiative(self, agenda):
        init = await agenda.add_initiative(
            goal_id="g1", title="Test Init", description="desc",
            features=["feat1", "feat2"],
        )
        assert init.title == "Test Init"
        assert init.description == "desc"
        assert init.features == ["feat1", "feat2"]
        assert len(agenda.initiatives) == 1

    async def test_add_entry(self, agenda):
        entry = await agenda.add_entry(
            goal_id="g1", action_type="pr", repo="user/repo",
            description="Test entry", branch="main",
        )
        assert entry.action_type == "pr"
        assert entry.repo == "user/repo"
        assert entry.branch == "main"
        assert len(agenda.entries) == 1

    async def test_complete_entry(self, agenda):
        entry = await agenda.add_entry(
            goal_id="g1", action_type="fix", repo="user/repo",
            description="Fix bug",
        )
        completed = await agenda.complete_entry(
            entry.id,
            pr_url="https://github.com/user/repo/pull/1",
            diff_summary="Fixed the bug",
        )
        assert completed is not None
        assert completed.status == "completed"
        assert completed.completed_at is not None
        assert completed.pr_url == "https://github.com/user/repo/pull/1"
        assert agenda.entries[0].status == "completed"

    async def test_complete_entry_unknown(self, agenda):
        result = await agenda.complete_entry("nonexistent-id")
        assert result is None

    async def test_update_goal_status(self, agenda):
        g = await agenda.add_goal(title="My Goal")
        updated = await agenda.update_goal_status(g.id, "active")
        assert updated is not None
        assert updated.status == "active"
        assert agenda.goals[0].status == "active"

    async def test_update_goal_status_unknown(self, agenda):
        result = await agenda.update_goal_status("nonexistent-id", "active")
        assert result is None


class TestAgendaProgress:
    async def test_progress_report_counts(self, agenda):
        await agenda.add_goal(title="Goal 1")
        e1 = await agenda.add_entry(goal_id=None, action_type="pr", repo="r", description="e1")
        await agenda.add_entry(goal_id=None, action_type="fix", repo="r", description="e2")
        await agenda.complete_entry(e1.id)
        report = await agenda.progress_report()
        assert report["total_entries"] == 2
        assert report["completed"] == 1
        assert report["pending"] == 1

    async def test_progress_report_overdue(self, agenda):
        g = await agenda.add_goal(title="Overdue Goal", due_date="2020-01-01")
        agenda.goals[0].status = "active"
        report = await agenda.progress_report()
        goal_data = report["by_goal"][g.id]
        assert goal_data["title"] == "Overdue Goal"
        assert goal_data["overdue"] is True
        assert goal_data["days_until_due"] is not None

    async def test_impact_summary_window(self, agenda):
        recent_time = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        old_time = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() - 30 * 86400))
        e1 = await agenda.add_entry(goal_id="g1", action_type="pr", repo="user/repo", description="Recent")
        await agenda.complete_entry(e1.id)
        agenda.entries[-1].completed_at = recent_time
        e2 = await agenda.add_entry(goal_id="g1", action_type="fix", repo="user/repo", description="Old")
        await agenda.complete_entry(e2.id)
        agenda.entries[-1].completed_at = old_time
        summary = await agenda.impact_summary(days=7)
        assert summary["total_applied"] == 1
        assert "g1" in summary["by_goal"]
        assert summary["by_goal"]["g1"]["count"] == 1


class TestAgendaPersistence:
    async def test_goals_persist_to_file(self, tmp_agenda_file, agenda):
        await agenda.add_goal(title="Persisted Goal", priority=2)
        raw = json.loads(tmp_agenda_file.read_text())
        assert len(raw["goals"]) == 1
        assert raw["goals"][0]["title"] == "Persisted Goal"
        assert raw["goals"][0]["priority"] == 2

    async def test_corrupted_file_handling(self, tmp_agenda_file):
        tmp_agenda_file.write_text("this is not valid json")
        a = Agenda()
        assert len(a.goals) == 0
        assert len(a.initiatives) == 0
        assert len(a.entries) == 0
        backups = list(tmp_agenda_file.parent.glob("agenda.json.bak.*"))
        assert len(backups) == 1

    async def test_nonexistent_file(self, tmp_agenda_file):
        assert not tmp_agenda_file.exists()
        a = Agenda()
        assert len(a.goals) == 0
        assert len(a.initiatives) == 0
        assert len(a.entries) == 0


class TestGoalUpdate:
    async def test_modifies_allowed_fields(self, agenda):
        g = await agenda.add_goal(title="Original Title", priority=3)
        updated = await agenda.update_goal(
            g.id,
            title="Updated Title",
            priority=1,
            status="active",
            description="Updated description",
        )
        assert updated is not None
        assert updated.title == "Updated Title"
        assert updated.priority == 1
        assert updated.status == "active"
        assert updated.description == "Updated description"

    async def test_rejects_disallowed_fields(self, agenda):
        g = await agenda.add_goal(title="Original Title")
        original_id = g.id
        original_created = g.created_at
        updated = await agenda.update_goal(
            g.id,
            id="new-id",
            created_at="2025-01-01T00:00:00Z",
            title="Updated Title",
        )
        assert updated is not None
        assert updated.id == original_id
        assert updated.created_at == original_created
        assert updated.title == "Updated Title"
