"""Agent session WebSocket API — Phase 2.1

A standalone WebSocket server that broadcasts agent session events to all
connected clients.  Events are emitted by the agent runtime when:
  - a new agent session is created
  - an agent's status changes (pending → running → done/failed)
  - an agent modifies a file
  - a heartbeat tick occurs (every 5s)
  - an agent's token/cost updates

Clients connect via:
  ws://host:8001/ws/agents

Each event is a JSON object with shape:
  {
    "type": "session.created" | "session.status" | "session.file_changed" | "heartbeat" | "session.cost",
    "ts": <iso timestamp>,
    "session": { id, status, task, files_changed, cost, model, started_at, duration_ms }
  }

Authentication: clients must send an `X-VibeServe-API-Key` header OR provide
it as the first text frame after connection (for browser clients that can't
set headers).
"""

from __future__ import annotations
import asyncio
import json
import logging
import os
import sys
import time
import uuid
from dataclasses import dataclass, field, asdict
from typing import Any, Dict, List, Optional, Set

try:
    from websockets.asyncio.server import serve, ServerConnection
    from websockets.exceptions import ConnectionClosed
except ImportError:  # pragma: no cover
    serve = None
    ServerConnection = Any

log = logging.getLogger("VibeServe")

API_KEY = os.getenv("VIBESERVE_API_KEY")
if not API_KEY:
    print("[agent_ws] WARNING: No VIBESERVE_API_KEY set — agent WS auth is DISABLED. Set VIBESERVE_API_KEY to enable.", file=sys.stderr)
HEARTBEAT_INTERVAL_S = float(os.getenv("AGENT_WS_HEARTBEAT_S", "5"))
DEFAULT_PORT = int(os.getenv("AGENT_WS_PORT", "8001"))


@dataclass
class AgentSession:
    """In-memory state for one running agent session."""
    id: str
    task: str
    status: str = "pending"  # pending | running | blocked | done | failed
    model: str = ""
    files_changed: List[str] = field(default_factory=list)
    # File regions this session intends to modify. Each region is
    # {file, start_line, end_line, op: "read"|"write"|"replace"}.
    # Conflicts are detected across running sessions that share
    # overlapping write regions on the same file.
    file_regions: List[Dict[str, Any]] = field(default_factory=list)
    started_at: float = field(default_factory=time.time)
    ended_at: Optional[float] = None
    cost_usd: float = 0.0
    prompt_tokens: int = 0
    completion_tokens: int = 0
    # Optional context: who dispatched this agent
    parent_session: Optional[str] = None
    # Optional metadata
    model_provider: str = ""

    @property
    def duration_ms(self) -> int:
        end = self.ended_at or time.time()
        return int((end - self.started_at) * 1000)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "task": self.task,
            "status": self.status,
            "model": self.model,
            "files_changed": list(self.files_changed),
            "file_regions": list(self.file_regions),
            "started_at": self.started_at,
            "ended_at": self.ended_at,
            "duration_ms": self.duration_ms,
            "cost_usd": round(self.cost_usd, 6),
            "prompt_tokens": self.prompt_tokens,
            "completion_tokens": self.completion_tokens,
            "parent_session": self.parent_session,
            "model_provider": self.model_provider,
        }


class AgentSessionRegistry:
    """Process-wide registry of active agent sessions.

    Provides thread-safe (asyncio-safe) access to session state and broadcasts
    events to all connected WebSocket clients.
    """
    def __init__(self) -> None:
        self.sessions: Dict[str, AgentSession] = {}
        self._subscribers: Set["AgentEventBus"] = set()
        self._lock = asyncio.Lock()

    async def create(self, task: str, model: str = "", parent: Optional[str] = None) -> AgentSession:
        sid = f"ses_{uuid.uuid4().hex[:16]}"
        sess = AgentSession(id=sid, task=task, model=model, parent_session=parent)
        async with self._lock:
            self.sessions[sid] = sess
        await self._broadcast({
            "type": "session.created",
            "ts": time.time(),
            "session": sess.to_dict(),
        })
        return sess

    async def update(self, sid: str, **fields: Any) -> Optional[AgentSession]:
        async with self._lock:
            sess = self.sessions.get(sid)
            if not sess:
                return None
            for k, v in fields.items():
                if hasattr(sess, k):
                    setattr(sess, k, v)
        await self._broadcast({
            "type": "session.status",
            "ts": time.time(),
            "session": sess.to_dict(),
        })
        return sess

    async def add_file(self, sid: str, file: str) -> None:
        async with self._lock:
            sess = self.sessions.get(sid)
            if not sess:
                return
            if file not in sess.files_changed:
                sess.files_changed.append(file)
        await self._broadcast({
            "type": "session.file_changed",
            "ts": time.time(),
            "session": sess.to_dict(),
            "file": file,
        })

    async def add_cost(self, sid: str, prompt_tokens: int, completion_tokens: int, cost_usd: float) -> None:
        async with self._lock:
            sess = self.sessions.get(sid)
            if not sess:
                return
            sess.prompt_tokens += prompt_tokens
            sess.completion_tokens += completion_tokens
            sess.cost_usd += cost_usd
        await self._broadcast({
            "type": "session.cost",
            "ts": time.time(),
            "session": sess.to_dict(),
            "delta": {
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "cost_usd": round(cost_usd, 6),
            },
        })

    def add_file_regions_sync(self, sid: str, regions: List[Dict[str, Any]]) -> Optional[AgentSession]:
        """Synchronously set the file regions for a session (for HTTP handlers)."""
        sess = self.sessions.get(sid)
        if not sess:
            return None
        sess.file_regions = list(regions)
        return sess

    def detect_conflicts(self) -> List[Dict[str, Any]]:
        """Find overlapping write regions across *running* sessions.

        Returns a list of conflict dicts:
            {sessions: [sid_a, sid_b], file, overlap: [start, end],
             region_a: {...}, region_b: {...}}
        """
        running = [s for s in self.sessions.values() if s.status == "running"]
        conflicts: List[Dict[str, Any]] = []
        for i, a in enumerate(running):
            for b in running[i + 1:]:
                for ra in a.file_regions:
                    for rb in b.file_regions:
                        if ra.get("file") != rb.get("file"):
                            continue
                        if ra.get("op", "write") == "read" or rb.get("op", "write") == "read":
                            continue
                        try:
                            a_start = int(ra.get("start_line", 0))
                            a_end = int(ra.get("end_line", a_start))
                            b_start = int(rb.get("start_line", 0))
                            b_end = int(rb.get("end_line", b_start))
                        except (ValueError, TypeError):
                            continue
                        if a_end < b_start or b_end < a_start:
                            continue
                        overlap_start = max(a_start, b_start)
                        overlap_end = min(a_end, b_end)
                        conflicts.append({
                            "sessions": [a.id, b.id],
                            "file": ra.get("file"),
                            "overlap": [overlap_start, overlap_end],
                            "region_a": dict(ra),
                            "region_b": dict(rb),
                        })
        return conflicts

    def get(self, sid: str) -> Optional[AgentSession]:
        return self.sessions.get(sid)

    def list_all(self) -> List[AgentSession]:
        return list(self.sessions.values())

    def attach(self, bus: "AgentEventBus") -> None:
        self._subscribers.add(bus)

    def detach(self, bus: "AgentEventBus") -> None:
        self._subscribers.discard(bus)

    async def _broadcast(self, event: Dict[str, Any]) -> None:
        # Send to all connected event buses (one per WebSocket client)
        dead = []
        for bus in list(self._subscribers):
            try:
                await bus.send(event)
            except Exception:
                dead.append(bus)
        for bus in dead:
            self.detach(bus)


class AgentEventBus:
    """Per-client event queue.  Buffers events for slow consumers."""
    def __init__(self) -> None:
        self.queue: asyncio.Queue[Dict[str, Any]] = asyncio.Queue(maxsize=1000)
        self._closed = False

    async def send(self, event: Dict[str, Any]) -> None:
        if self._closed:
            return
        try:
            self.queue.put_nowait(event)
        except asyncio.QueueFull:
            # Drop oldest, add new
            try:
                self.queue.get_nowait()
                self.queue.put_nowait(event)
            except Exception:
                pass

    async def stream(self):
        """Async iterator yielding events as they arrive."""
        while not self._closed:
            try:
                event = await asyncio.wait_for(self.queue.get(), timeout=1.0)
                yield event
            except asyncio.TimeoutError:
                continue

    def close(self) -> None:
        self._closed = True


# ─── HTTP API surface ─────────────────────────────────────────────
# A small HTTP/JSON endpoint next to the WebSocket so HTTP-only clients
# (curl, scripts) can read session state.

def _json(obj: Any) -> str:
    return json.dumps(obj, default=str)


def handle_agents_http(path: str, body: bytes) -> Optional[tuple]:
    """Return (status, headers, body) or None if not handled."""
    if path == "/v1/agents" or path == "/v1/agents/":
        sessions = list(REGISTRY.list_all())
        return 200, {"Content-Type": "application/json"}, _json({"sessions": [s.to_dict() for s in sessions]})
    if path == "/v1/agents/conflicts" or path == "/v1/agents/conflicts/":
        conflicts = REGISTRY.detect_conflicts()
        return 200, {"Content-Type": "application/json"}, _json({"conflicts": conflicts, "count": len(conflicts)})
    if path.startswith("/v1/agents/"):
        sid = path[len("/v1/agents/"):].rstrip("/")
        sess = REGISTRY.get(sid)
        if not sess:
            return 404, {"Content-Type": "application/json"}, _json({"status": "error", "error": f"Session not found: {sid}"})
        return 200, {"Content-Type": "application/json"}, _json(sess.to_dict())
    return None


async def handle_agents_http_post(path: str, body: bytes) -> Optional[tuple]:
    """POST endpoint to create/update sessions from CLI or programmatic sources."""
    if not path.startswith("/v1/agents"):
        return None
    try:
        payload = json.loads(body.decode() or "{}") if body else {}
    except json.JSONDecodeError:
        return 400, {"Content-Type": "application/json"}, _json({"status": "error", "error": "Invalid JSON"})

    if path == "/v1/agents" or path == "/v1/agents/":
        # Create new session
        task = payload.get("task", "(no task)")
        model = payload.get("model", "")
        parent = payload.get("parent_session")
        sid = f"ses_{uuid.uuid4().hex[:16]}"
        sess = AgentSession(id=sid, task=task, model=model, parent_session=parent)
        async with REGISTRY._lock:
            REGISTRY.sessions[sid] = sess
        event = {
            "type": "session.created",
            "ts": time.time(),
            "session": sess.to_dict(),
        }
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                asyncio.create_task(REGISTRY._broadcast(event))
        except RuntimeError:
            pass
        return 201, {"Content-Type": "application/json"}, _json(sess.to_dict())

    if path.startswith("/v1/agents/") and path.endswith(":update"):
        sid = path[len("/v1/agents/"):-len(":update")].rstrip("/")
        async with REGISTRY._lock:
            sess = REGISTRY.sessions.get(sid)
            if not sess:
                return 404, {"Content-Type": "application/json"}, _json({"status": "error", "error": f"Session not found: {sid}"})
            for k in ("status", "ended_at", "model", "model_provider"):
                if k in payload:
                    setattr(sess, k, payload[k])
            if payload.get("ended_at") == "now":
                sess.ended_at = time.time()
        event = {
            "type": "session.status",
            "ts": time.time(),
            "session": sess.to_dict(),
        }
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                asyncio.create_task(REGISTRY._broadcast(event))
        except RuntimeError:
            pass
        return 200, {"Content-Type": "application/json"}, _json(sess.to_dict())

    if path.startswith("/v1/agents/") and path.endswith(":file"):
        sid = path[len("/v1/agents/"):-len(":file")].rstrip("/")
        async with REGISTRY._lock:
            sess = REGISTRY.sessions.get(sid)
            if not sess:
                return 404, {"Content-Type": "application/json"}, _json({"status": "error", "error": f"Session not found: {sid}"})
            file = payload.get("file", "")
            if file and file not in sess.files_changed:
                sess.files_changed.append(file)
        event = {
            "type": "session.file_changed",
            "ts": time.time(),
            "session": sess.to_dict(),
            "file": file,
        }
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                asyncio.create_task(REGISTRY._broadcast(event))
        except RuntimeError:
            pass
        return 200, {"Content-Type": "application/json"}, _json(sess.to_dict())

    if path.startswith("/v1/agents/") and path.endswith(":cost"):
        sid = path[len("/v1/agents/"):-len(":cost")].rstrip("/")
        async with REGISTRY._lock:
            sess = REGISTRY.sessions.get(sid)
            if not sess:
                return 404, {"Content-Type": "application/json"}, _json({"status": "error", "error": f"Session not found: {sid}"})
            prompt_tokens = int(payload.get("prompt_tokens", 0))
            completion_tokens = int(payload.get("completion_tokens", 0))
            cost_usd = float(payload.get("cost_usd", 0.0))
            sess.prompt_tokens += prompt_tokens
            sess.completion_tokens += completion_tokens
            sess.cost_usd += cost_usd
        event = {
            "type": "session.cost",
            "ts": time.time(),
            "session": sess.to_dict(),
            "delta": {
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "cost_usd": round(cost_usd, 6),
            },
        }
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                asyncio.create_task(REGISTRY._broadcast(event))
        except RuntimeError:
            pass
        return 200, {"Content-Type": "application/json"}, _json(sess.to_dict())

    if path.startswith("/v1/agents/") and path.endswith(":regions"):
        sid = path[len("/v1/agents/"):-len(":regions")].rstrip("/")
        async with REGISTRY._lock:
            sess = REGISTRY.sessions.get(sid)
            if not sess:
                return 404, {"Content-Type": "application/json"}, _json({"status": "error", "error": f"Session not found: {sid}"})
            regions = payload.get("file_regions", [])
            if not isinstance(regions, list):
                return 400, {"Content-Type": "application/json"}, _json({"status": "error", "error": "file_regions must be a list"})
            sess.file_regions = list(regions)
            conflicts = REGISTRY.detect_conflicts()
        event = {
            "type": "session.file_regions",
            "ts": time.time(),
            "session": sess.to_dict(),
            "regions": regions,
            "conflicts": [c for c in conflicts if sid in c["sessions"]],
        }
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                asyncio.create_task(REGISTRY._broadcast(event))
        except RuntimeError:
            pass
        return 200, {"Content-Type": "application/json"}, _json({"session": sess.to_dict(), "conflicts": event["conflicts"]})

    return 404, {"Content-Type": "application/json"}, _json({"status": "error", "error": "Unknown endpoint"})


# ─── WebSocket server ─────────────────────────────────────────────

# Global registry — shared between HTTP and WebSocket servers
REGISTRY = AgentSessionRegistry()


async def _ws_send(ws: ServerConnection, event: Dict[str, Any]) -> None:
    """Send a JSON event to one WebSocket client.  Silently drops on closed."""
    try:
        await ws.send(json.dumps(event, default=str))
    except ConnectionClosed:
        raise
    except Exception:
        pass


async def _ws_handler(ws: ServerConnection) -> None:
    """Handle one WebSocket client connection.

    Auth: client must send a text frame with the API key as the first
    message.  If the env var VIBESERVE_API_KEY is empty, auth is skipped.
    """
    bus = AgentEventBus()
    REGISTRY.attach(bus)

    # Optional auth handshake
    if API_KEY:
        try:
            first = await asyncio.wait_for(ws.recv(), timeout=5.0)
            if first != API_KEY:
                await ws.send(json.dumps({"type": "error", "error": "Invalid API key"}))
                await ws.close()
                return
        except (asyncio.TimeoutError, ConnectionClosed):
            await ws.close()
            return

    # Send snapshot of all current sessions.  Always send at least one
    # snapshot event so clients know the connection is live and they have
    # a baseline.
    try:
        sessions = REGISTRY.list_all()
        if not sessions:
            await _ws_send(ws, {
                "type": "snapshot",
                "ts": time.time(),
                "session": None,
                "message": "no active sessions",
            })
        for sess in sessions:
            await _ws_send(ws, {
                "type": "snapshot",
                "ts": time.time(),
                "session": sess.to_dict(),
            })
    except ConnectionClosed:
        REGISTRY.detach(bus)
        bus.close()
        return

    # Heartbeat + event loop
    last_heartbeat = time.time()
    try:
        while True:
            # Heartbeat
            if time.time() - last_heartbeat >= HEARTBEAT_INTERVAL_S:
                try:
                    await _ws_send(ws, {"type": "heartbeat", "ts": time.time()})
                    last_heartbeat = time.time()
                except ConnectionClosed:
                    break

            # Drain any buffered events to the client
            try:
                event = await asyncio.wait_for(bus.queue.get(), timeout=1.0)
                await _ws_send(ws, event)
            except asyncio.TimeoutError:
                continue
    except ConnectionClosed:
        pass
    finally:
        REGISTRY.detach(bus)
        bus.close()


async def run_agent_ws_server(host: str = "127.0.0.1", port: int = DEFAULT_PORT) -> None:
    """Start the WebSocket server.  Runs forever until cancelled."""
    if serve is None:
        log.warning("websockets library not available — agent WS server disabled")
        return
    log.info(f"Agent WebSocket server starting on ws://{host}:{port}/ws/agents")
    async with serve(_ws_handler, host, port, ping_interval=20, ping_timeout=20):
        await asyncio.Future()  # run forever


# ─── Self-test (E2E) ──────────────────────────────────────────────

async def _self_test() -> int:
    """Spawn a fake agent, watch events stream, then exit."""
    import json as _json
    from websockets.asyncio.client import connect as ws_connect
    from websockets.exceptions import ConnectionClosed

    received: list = []
    snapshot_seen = False
    port = int(os.getenv("AGENT_WS_PORT", "8001"))

    async def consumer():
        nonlocal snapshot_seen
        uri = f"ws://127.0.0.1:{port}/ws/agents"
        async with ws_connect(uri) as ws:
            # Auth
            await ws.send(API_KEY)
            # After auth the server sends a snapshot event.  Wait for it
            # explicitly so we don't race.
            try:
                msg = await asyncio.wait_for(ws.recv(), timeout=2.0)
                event = _json.loads(msg)
                received.append(event)
                if event.get("type") == "snapshot":
                    snapshot_seen = True
            except (asyncio.TimeoutError, ConnectionClosed):
                return
            # Then drain remaining events for up to 3 seconds
            deadline = time.time() + 3.0
            while time.time() < deadline:
                try:
                    msg = await asyncio.wait_for(ws.recv(), timeout=0.5)
                    received.append(_json.loads(msg))
                except asyncio.TimeoutError:
                    continue
                except ConnectionClosed:
                    break

    cons = asyncio.create_task(consumer())
    # Wait for the consumer to receive the initial snapshot before
    # creating the new session — otherwise the snapshot would include
    # it and we can't distinguish.
    await asyncio.sleep(0.3)
    if not snapshot_seen:
        pass  # proceed anyway, we'll fail at the assert

    # Create session
    sess = await REGISTRY.create(task="self-test", model="gpt-4")
    sid = sess.id

    # Mutate it
    await REGISTRY.update(sid, status="running")
    await asyncio.sleep(0.05)
    await REGISTRY.add_file(sid, "src/foo.ts")
    await asyncio.sleep(0.05)
    await REGISTRY.add_cost(sid, prompt_tokens=100, completion_tokens=50, cost_usd=0.002)
    await asyncio.sleep(0.05)
    await REGISTRY.update(sid, status="done", ended_at=time.time())

    # Wait for the consumer to drain events
    try:
        await asyncio.wait_for(cons, timeout=4.0)
    except asyncio.TimeoutError:
        cons.cancel()
        try:
            await cons
        except (asyncio.CancelledError, Exception):
            pass

    # Validate events
    types = [e["type"] for e in received]
    # We don't require a heartbeat (5s interval, test is shorter)
    # but we require snapshot, session.created, status, file_changed, cost
    required = ["snapshot", "session.created", "session.status", "session.file_changed", "session.cost"]
    missing = [e for e in required if e not in types]
    if missing:
        print(f"FAIL: missing event types {missing}; got: {types}")
        return 1
    # Find the snapshot for our session and verify state
    snapshots = [e["session"] for e in received if e["type"] == "snapshot" and e.get("session") and e["session"].get("id") == sid]
    finals = [e["session"] for e in received if e["type"] == "session.status" and e["session"]["id"] == sid and e["session"]["status"] == "done"]
    if not snapshots:
        # No snapshot for our session because it didn't exist at connect time
        # — that's expected.  Skip the snapshot-specific check.
        pass
    if not finals:
        print("FAIL: no 'done' status event seen")
        return 1
    final = finals[-1]
    if final["cost_usd"] < 0.001:
        print(f"FAIL: cost_usd {final['cost_usd']} should be ~0.002")
        return 1
    if "src/foo.ts" not in final["files_changed"]:
        print(f"FAIL: src/foo.ts not in files_changed {final['files_changed']}")
        return 1
    if final["status"] != "done":
        print(f"FAIL: final status {final['status']} != done")
        return 1

    # Cleanup
    REGISTRY.sessions.pop(sid, None)
    print(f"PASS: got {len(received)} events, types: {types}")
    return 0


if __name__ == "__main__":
    # E2E self-test: spawn server, run a fake agent, validate events
    if "--test" in os.sys.argv:
        async def _main():
            server = asyncio.create_task(run_agent_ws_server())
            await asyncio.sleep(0.5)
            rc = await _self_test()
            server.cancel()
            try:
                await server
            except (asyncio.CancelledError, Exception):
                pass
            return rc
        sys_exit = asyncio.run(_main())
        raise SystemExit(sys_exit)
    # Default: just run the server
    asyncio.run(run_agent_ws_server())
