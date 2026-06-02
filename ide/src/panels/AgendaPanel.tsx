import { useCallback, useEffect, useState } from "react";
import { useIDEStore } from "../stores/useIDEStore";

interface Goal {
	id: string;
	title: string;
	description: string;
	status: string;
	priority: number;
	timeline?: string;
	tags: string[];
	goal_type?: string;
	target_metric?: string;
	due_date?: string;
	effort?: string;
	areas?: string[];
	allow_bg_work?: boolean;
	schedule_mode?: string;
	created_at: string;
	updated_at: string;
}

interface Progress {
	total_entries: number;
	completed: number;
	in_progress: number;
	pending: number;
	active_goals: number;
	completed_goals: number;
	by_goal: Record<
		string,
		{
			title: string;
			status: string;
			priority: number;
			total: number;
			completed: number;
			in_progress: number;
			pending: number;
		}
	>;
}

interface AgendaData {
	goals: Goal[];
	constraints: string[];
	progress: Progress;
	recent_entries: any[];
}

const STATUS_COLORS: Record<string, string> = {
	planned: "#6b7280",
	active: "#3b82f6",
	completed: "#22c55e",
	blocked: "#ef4444",
};

const PRIORITY_LABELS: Record<number, string> = {
	1: "P1 — Critical",
	2: "P2 — High",
	3: "P3 — Medium",
	4: "P4 — Low",
	5: "P5 — Backlog",
};

export function AgendaPanel() {
	const [agenda, setAgenda] = useState<AgendaData | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [showAddGoal, setShowAddGoal] = useState(false);
	const [newGoal, setNewGoal] = useState({
		title: "",
		description: "",
		priority: 3,
		timeline: "",
		goal_type: "",
		due_date: "",
		effort: "",
		areas: "",
		schedule_mode: "hourly",
	});
	const [showAddConstraint, setShowAddConstraint] = useState(false);
	const [newConstraint, setNewConstraint] = useState("");
	const { autonomyMode, setAutonomyMode } = useIDEStore();
	const apiBase =
		import.meta.env?.VITE_API_URL ||
		(window.location.port === "3000" ? "http://localhost:3002" : "");

	const getAuthHeaders = (): Record<string, string> => {
		const token = localStorage.getItem("nexus_token");
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
		};
		if (token) headers["Authorization"] = `Bearer ${token}`;
		return headers;
	};

	const fetchAgenda = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const res = await fetch(`${apiBase}/api/pipeline/agenda_status`, {
				headers: getAuthHeaders(),
			});
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			setAgenda(await res.json());
		} catch (err: any) {
			setError(err.message);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchAgenda();
	}, [fetchAgenda]);

	const addGoal = useCallback(async () => {
		if (!newGoal.title.trim()) return;
		try {
			const res = await fetch(`${apiBase}/api/pipeline/mcp_call`, {
				method: "POST",
				headers: getAuthHeaders(),
				body: JSON.stringify({
					tool: "agenda_add_goal",
					args: {
						title: newGoal.title,
						description: newGoal.description,
						priority: newGoal.priority,
						timeline: newGoal.timeline || "",
						goal_type: newGoal.goal_type || "",
						due_date: newGoal.due_date || "",
						effort: newGoal.effort || "",
						areas: newGoal.areas || "",
						schedule_mode: newGoal.schedule_mode,
					},
				}),
			});
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			setShowAddGoal(false);
			setNewGoal({
				title: "",
				description: "",
				priority: 3,
				timeline: "",
				goal_type: "",
				due_date: "",
				effort: "",
				areas: "",
				schedule_mode: "hourly",
			});
			await fetchAgenda();
		} catch (err: any) {
			setError(err.message);
		}
	}, [newGoal, fetchAgenda]);

	const activateGoal = useCallback(
		async (goalId: string) => {
			try {
				await fetch(`${apiBase}/api/pipeline/mcp_call`, {
					method: "POST",
					headers: getAuthHeaders(),
					body: JSON.stringify({
						tool: "agenda_activate_goal",
						args: { goal_id: goalId },
					}),
				});
				await fetchAgenda();
			} catch (err: any) {
				setError(err.message);
			}
		},
		[fetchAgenda],
	);

	const completeGoal = useCallback(
		async (goalId: string) => {
			try {
				await fetch(`${apiBase}/api/pipeline/mcp_call`, {
					method: "POST",
					headers: getAuthHeaders(),
					body: JSON.stringify({
						tool: "agenda_complete_goal",
						args: { goal_id: goalId },
					}),
				});
				await fetchAgenda();
			} catch (err: any) {
				setError(err.message);
			}
		},
		[fetchAgenda],
	);

	const completed = agenda?.progress.completed ?? 0;
	const total = agenda?.progress.total_entries ?? 0;
	const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

	return (
		<div
			className="flex flex-col h-full overflow-hidden"
			style={{ backgroundColor: "var(--bg-secondary, #1e1e2e)" }}
		>
			{/* Header */}
			<div
				className="flex items-center justify-between px-3 py-2 border-b"
				style={{ borderColor: "var(--border, #313244)" }}
			>
				<span
					className="text-xs font-semibold uppercase tracking-wider"
					style={{ color: "var(--text-muted, #6c7086)" }}
				>
					Agenda
				</span>
				<div className="flex gap-1">
					<button
						onClick={() => {
							const next = autonomyMode === "pipeline" ? "copilot" : "pipeline";
							setAutonomyMode(next);
							const route =
								next === "pipeline"
									? "/api/pipeline/scheduler/start"
									: "/api/pipeline/scheduler/stop";
							fetch(`${apiBase}${route}`, {
								method: "POST",
								headers: getAuthHeaders(),
								body: JSON.stringify({ repos: ["."] }),
							}).catch(() => {});
						}}
						className="px-2 py-0.5 rounded text-xs"
						style={{
							backgroundColor:
								autonomyMode === "pipeline"
									? "#a6e3a1"
									: "var(--bg-tertiary, #313244)",
							color:
								autonomyMode === "pipeline"
									? "var(--bg-primary, #1e1e2e)"
									: "var(--text-muted, #6c7086)",
						}}
					>
						{autonomyMode === "pipeline"
							? "\u25CF Agents: ON"
							: "\u25CB Agents: OFF"}
					</button>
				</div>
			</div>

			{/* Progress bar */}
			<div className="mx-3 mt-3 mb-1">
				<div
					className="flex justify-between text-xs mb-1"
					style={{ color: "var(--text-muted, #6c7086)" }}
				>
					<span>Progress</span>
					<span>
						{completed}/{total} ({pct}%)
					</span>
				</div>
				<div
					className="h-1.5 rounded-full overflow-hidden"
					style={{ backgroundColor: "var(--bg-tertiary, #313244)" }}
				>
					<div
						className="h-full rounded-full transition-all duration-500"
						style={{
							width: `${Math.max(pct, 2)}%`,
							backgroundColor: "var(--accent, #89b4fa)",
						}}
					/>
				</div>
			</div>

			{/* Content */}
			<div className="flex-1 overflow-y-auto px-3 py-2">
				{loading && (
					<div
						className="text-xs"
						style={{ color: "var(--text-muted, #6c7086)" }}
					>
						Loading agenda...
					</div>
				)}
				{error && (
					<div
						className="text-xs mb-2 p-2 rounded"
						style={{
							color: "var(--error, #f38ba8)",
							backgroundColor: "var(--bg-tertiary, #313244)",
						}}
					>
						{error}
						<button onClick={fetchAgenda} className="ml-2 underline">
							Retry
						</button>
					</div>
				)}

				{/* Goals */}
				{agenda?.goals.length === 0 ? (
					<div
						className="text-xs py-4 text-center"
						style={{ color: "var(--text-muted, #6c7086)" }}
					>
						No goals defined yet.
						<br />
						<span className="mt-1 block">
							Set your first goal below to get agents working.
						</span>
					</div>
				) : (
					agenda?.goals.map((goal) => (
						<div
							key={goal.id}
							className="mb-2 p-2 rounded cursor-pointer hover:brightness-110 transition-colors"
							style={{
								backgroundColor: "var(--bg-tertiary, #313244)",
								borderLeft: `3px solid ${STATUS_COLORS[goal.status] || "#6b7280"}`,
							}}
						>
							<div className="flex items-center justify-between">
								<span
									className="text-xs font-medium"
									style={{ color: "var(--text-primary, #cdd6f4)" }}
								>
									{goal.title}
								</span>
								<span
									className="text-xxs px-1.5 py-0.5 rounded"
									style={{
										backgroundColor: STATUS_COLORS[goal.status] + "22",
										color: STATUS_COLORS[goal.status],
									}}
								>
									{goal.status}
								</span>
							</div>
							{goal.description && (
								<div
									className="text-xxs mt-1"
									style={{ color: "var(--text-muted, #6c7086)" }}
								>
									{goal.description}
								</div>
							)}
							<div className="flex items-center gap-1 mt-1.5">
								<span
									className="text-xxs"
									style={{ color: "var(--text-muted, #6c7086)" }}
								>
									{PRIORITY_LABELS[goal.priority] || `P${goal.priority}`}
								</span>
								{goal.timeline && (
									<span
										className="text-xxs px-1 rounded"
										style={{
											color: "var(--text-muted, #6c7086)",
											backgroundColor: "var(--bg-primary, #1e1e2e)",
										}}
									>
										{goal.timeline}
									</span>
								)}
								{goal.goal_type && (
									<span
										className="text-xxs px-1 rounded"
										style={{
											backgroundColor: "var(--bg-primary, #1e1e2e)",
											color: "var(--text-muted, #6c7086)",
										}}
									>
										{goal.goal_type}
									</span>
								)}
								{goal.due_date && (
									<span
										className="text-xxs px-1 rounded"
										style={{
											backgroundColor: "var(--bg-primary, #1e1e2e)",
											color: "var(--text-muted, #6c7086)",
										}}
									>
										Due: {goal.due_date}
									</span>
								)}
							</div>
							{/* Progress per goal */}
							{agenda.progress.by_goal[goal.id] && (
								<div className="mt-1.5">
									<div className="flex gap-1">
										<span
											className="text-xxs"
											style={{ color: "var(--accent, #89b4fa)" }}
										>
											{agenda.progress.by_goal[goal.id].completed} done
										</span>
										{agenda.progress.by_goal[goal.id].in_progress > 0 && (
											<span className="text-xxs" style={{ color: "#f9e2af" }}>
												{agenda.progress.by_goal[goal.id].in_progress} in
												progress
											</span>
										)}
										<span
											className="text-xxs"
											style={{ color: "var(--text-muted, #6c7086)" }}
										>
											{agenda.progress.by_goal[goal.id].pending} pending
										</span>
									</div>
								</div>
							)}
							{/* Actions */}
							<div className="flex gap-1 mt-1.5">
								{goal.status === "planned" && (
									<button
										onClick={(e) => {
											e.stopPropagation();
											activateGoal(goal.id);
										}}
										className="text-xxs px-1.5 py-0.5 rounded hover:brightness-125"
										style={{
											backgroundColor: "var(--accent, #89b4fa)",
											color: "var(--bg-primary, #1e1e2e)",
										}}
									>
										Start
									</button>
								)}
								{goal.status === "active" && (
									<button
										onClick={(e) => {
											e.stopPropagation();
											completeGoal(goal.id);
										}}
										className="text-xxs px-1.5 py-0.5 rounded hover:brightness-125"
										style={{
											backgroundColor: "var(--success, #a6e3a1)",
											color: "var(--bg-primary, #1e1e2e)",
										}}
									>
										Complete
									</button>
								)}
							</div>
						</div>
					))
				)}

				{/* Constraints */}
				{agenda?.constraints && agenda.constraints.length > 0 && (
					<div className="mt-3">
						<div
							className="text-xxs font-semibold mb-1"
							style={{ color: "var(--text-muted, #6c7086)" }}
						>
							Constraints
						</div>
						{agenda.constraints.map((c, i) => (
							<div
								key={i}
								className="text-xxs pl-2 border-l"
								style={{
									color: "var(--text-muted, #6c7086)",
									borderColor: "var(--warning, #f9e2af)",
								}}
							>
								{c}
							</div>
						))}
					</div>
				)}
			</div>

			{/* Add Goal Button */}
			<div
				className="border-t px-3 py-2"
				style={{ borderColor: "var(--border, #313244)" }}
			>
				{showAddGoal ? (
					<div className="space-y-1.5">
						<input
							value={newGoal.title}
							onChange={(e) =>
								setNewGoal({ ...newGoal, title: e.target.value })
							}
							placeholder="Goal title (e.g., 'Ship user auth')"
							className="w-full text-xs px-2 py-1 rounded border focus:outline-none"
							style={{
								backgroundColor: "var(--bg-primary, #1e1e2e)",
								color: "var(--text-primary, #cdd6f4)",
								borderColor: "var(--border, #313244)",
							}}
							onKeyDown={(e) => e.key === "Enter" && addGoal()}
						/>
						<input
							value={newGoal.description}
							onChange={(e) =>
								setNewGoal({ ...newGoal, description: e.target.value })
							}
							placeholder="Description (optional)"
							className="w-full text-xs px-2 py-1 rounded border focus:outline-none"
							style={{
								backgroundColor: "var(--bg-primary, #1e1e2e)",
								color: "var(--text-primary, #cdd6f4)",
								borderColor: "var(--border, #313244)",
							}}
						/>
						<div className="flex gap-1">
							<select
								value={newGoal.priority}
								onChange={(e) =>
									setNewGoal({ ...newGoal, priority: Number(e.target.value) })
								}
								className="text-xs px-2 py-1 rounded border"
								style={{
									backgroundColor: "var(--bg-primary, #1e1e2e)",
									color: "var(--text-primary, #cdd6f4)",
									borderColor: "var(--border, #313244)",
								}}
							>
								{[1, 2, 3, 4, 5].map((p) => (
									<option key={p} value={p}>
										{PRIORITY_LABELS[p]}
									</option>
								))}
							</select>
							<input
								value={newGoal.timeline}
								onChange={(e) =>
									setNewGoal({ ...newGoal, timeline: e.target.value })
								}
								placeholder="Timeline (e.g., Q2)"
								className="flex-1 text-xs px-2 py-1 rounded border focus:outline-none"
								style={{
									backgroundColor: "var(--bg-primary, #1e1e2e)",
									color: "var(--text-primary, #cdd6f4)",
									borderColor: "var(--border, #313244)",
								}}
							/>
						</div>
						{/* Goal Type */}
						<select
							value={newGoal.goal_type}
							onChange={(e) =>
								setNewGoal({ ...newGoal, goal_type: e.target.value })
							}
							className="text-xs px-2 py-1 rounded border"
							style={{
								backgroundColor: "var(--bg-primary, #1e1e2e)",
								color: "var(--text-primary, #cdd6f4)",
								borderColor: "var(--border, #313244)",
							}}
						>
							<option value="">Type (optional)</option>
							<option value="feature">Feature</option>
							<option value="reliability">Reliability</option>
							<option value="performance">Performance</option>
							<option value="docs">Docs</option>
							<option value="security">Security</option>
						</select>

						{/* Due Date + Effort */}
						<div className="flex gap-1">
							<input
								value={newGoal.due_date}
								onChange={(e) =>
									setNewGoal({ ...newGoal, due_date: e.target.value })
								}
								placeholder="Due date (YYYY-MM-DD)"
								className="flex-1 text-xs px-2 py-1 rounded border focus:outline-none"
								style={{
									backgroundColor: "var(--bg-primary, #1e1e2e)",
									color: "var(--text-primary, #cdd6f4)",
									borderColor: "var(--border, #313244)",
								}}
							/>
							<select
								value={newGoal.effort}
								onChange={(e) =>
									setNewGoal({ ...newGoal, effort: e.target.value })
								}
								className="text-xs px-2 py-1 rounded border"
								style={{
									backgroundColor: "var(--bg-primary, #1e1e2e)",
									color: "var(--text-primary, #cdd6f4)",
									borderColor: "var(--border, #313244)",
								}}
							>
								<option value="">Effort</option>
								<option value="small">Small</option>
								<option value="medium">Medium</option>
								<option value="large">Large</option>
							</select>
						</div>

						{/* Areas */}
						<input
							value={newGoal.areas}
							onChange={(e) =>
								setNewGoal({ ...newGoal, areas: e.target.value })
							}
							placeholder="Areas (comma-sep, e.g. ide/src, vibeserve)"
							className="w-full text-xs px-2 py-1 rounded border focus:outline-none"
							style={{
								backgroundColor: "var(--bg-primary, #1e1e2e)",
								color: "var(--text-primary, #cdd6f4)",
								borderColor: "var(--border, #313244)",
							}}
						/>
						<div className="flex gap-1">
							<button
								onClick={addGoal}
								className="flex-1 text-xs px-2 py-1 rounded"
								style={{
									backgroundColor: "var(--accent, #89b4fa)",
									color: "var(--bg-primary, #1e1e2e)",
								}}
							>
								Add Goal
							</button>
							<button
								onClick={() => {
									setShowAddGoal(false);
									setNewGoal({
										title: "",
										description: "",
										priority: 3,
										timeline: "",
										goal_type: "",
										due_date: "",
										effort: "",
										areas: "",
										schedule_mode: "hourly",
									});
								}}
								className="text-xs px-2 py-1 rounded"
								style={{
									backgroundColor: "var(--bg-tertiary, #313244)",
									color: "var(--text-muted, #6c7086)",
								}}
							>
								Cancel
							</button>
						</div>
					</div>
				) : (
					<button
						onClick={() => setShowAddGoal(true)}
						className="w-full text-xs py-1.5 rounded hover:brightness-110"
						style={{
							backgroundColor: "var(--bg-tertiary, #313244)",
							color: "var(--text-muted, #6c7086)",
						}}
					>
						+ Add Goal
					</button>
				)}
			</div>
		</div>
	);
}
