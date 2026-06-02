/**
 * VibeServe Tool Catalog — Single Source of Truth
 *
 * Central registry of every MCP tool exposed by the VibeServe Python backend.
 * The UI uses this to render the Tool Catalog panel, build the command
 * palette, and generate invocation forms. The backend uses the same shape
 * to expose /api/pipeline/mcp/tools/list and /api/pipeline/mcp/tools/schema.
 *
 * Each tool entry contains:
 *   - name: MCP tool name (matches `@mcp_server.tool(name=...)` in Python)
 *   - category: top-level grouping shown in the catalog
 *   - title: short human label
 *   - description: what the tool does
 *   - scope: 'read' | 'write' | 'execute' (used for authz + UI hints)
 *   - args: ordered list of argument descriptors
 *   - example: working sample payload (for the "Try it" button)
 *   - resultKind: how the UI should render the response
 *   - requires?: optional list of secrets/env the tool needs
 */

export type ArgKind =
	| "string"
	| "number"
	| "boolean"
	| "array"
	| "object"
	| "enum";
export type ResultKind =
	| "text"
	| "markdown"
	| "json"
	| "table"
	| "log"
	| "image"
	| "video"
	| "code";
export type ToolScope = "read" | "write" | "execute" | "ai";

export interface ToolArg {
	name: string;
	kind: ArgKind;
	required?: boolean;
	description?: string;
	default?: unknown;
	enumValues?: string[];
	itemKind?: ArgKind;
	properties?: ToolArg[];
}

export interface ToolEntry {
	name: string;
	category: string;
	title: string;
	description: string;
	scope: ToolScope;
	args: ToolArg[];
	example: Record<string, unknown>;
	resultKind: ResultKind;
	requires?: string[];
	/** Surface this tool as a quick-action in the command palette */
	isQuickAction?: boolean;
}

const GOAL_TYPE = [
	"feature",
	"reliability",
	"performance",
	"docs",
	"security",
	"chore",
] as const;
const SCHEDULE_MODE = ["manual", "hourly", "daily"] as const;
const PRIORITY = ["low", "medium", "high", "critical"] as const;

export const VIBESERVE_TOOL_CATALOG: ToolEntry[] = [
	// ── AGENDA (goal + initiative tracking) ────────────────────────────────────
	{
		name: "agenda_get_status",
		category: "Agenda",
		title: "Agenda: Get Status",
		description:
			"Get an overview of all active goals, initiatives, and recent activity log entries.",
		scope: "read",
		args: [
			{
				name: "include_completed",
				kind: "boolean",
				default: false,
				description: "Include completed goals in the response.",
			},
		],
		example: { include_completed: false },
		resultKind: "json",
		isQuickAction: true,
	},
	{
		name: "agenda_get_active_goals",
		category: "Agenda",
		title: "Agenda: Active Goals",
		description:
			"Return all goals currently marked active (i.e. visible to background agents).",
		scope: "read",
		args: [],
		example: {},
		resultKind: "json",
	},
	{
		name: "agenda_add_goal",
		category: "Agenda",
		title: "Agenda: Add Goal",
		description:
			"Add a single goal to the agenda with optional type, areas, due date and target metric.",
		scope: "write",
		args: [
			{
				name: "title",
				kind: "string",
				required: true,
				description: "Short, action-oriented title.",
			},
			{ name: "description", kind: "string", description: "Longer context." },
			{
				name: "priority",
				kind: "number",
				default: 3,
				description: "1 (highest) — 5 (lowest).",
			},
			{
				name: "goal_type",
				kind: "enum",
				enumValues: [...GOAL_TYPE],
				description:
					"Categorizes the goal so background agents pick the right tools.",
			},
			{
				name: "areas",
				kind: "array",
				itemKind: "string",
				description: "List of file paths / packages the goal touches.",
			},
			{ name: "due_date", kind: "string", description: "ISO date string." },
			{
				name: "target_metric",
				kind: "string",
				description: 'e.g. "p95 latency < 200ms".',
			},
			{
				name: "allow_bg_work",
				kind: "boolean",
				default: true,
				description:
					"If false, the goal is not picked up by scheduled background agents.",
			},
			{
				name: "schedule_mode",
				kind: "enum",
				enumValues: [...SCHEDULE_MODE],
				default: "hourly",
			},
			{ name: "tags", kind: "array", itemKind: "string" },
		],
		example: {
			title: "Add a /metrics endpoint",
			description: "Surface Prometheus metrics for the auth service.",
			priority: 2,
			goal_type: "feature",
			areas: ["src/auth/"],
			target_metric: "endpoint available in <2h",
			allow_bg_work: true,
			schedule_mode: "hourly",
			tags: ["observability"],
		},
		resultKind: "json",
	},
	{
		name: "agenda_set_goals",
		category: "Agenda",
		title: "Agenda: Bulk Set Goals",
		description:
			"Replace the entire goal list with the provided array. Useful for syncing from a planning file.",
		scope: "write",
		args: [
			{ name: "goals", kind: "array", required: true, itemKind: "object" },
		],
		example: {
			goals: [
				{
					id: "g1",
					title: "Reduce bundle size",
					priority: 1,
					status: "active",
				},
				{
					id: "g2",
					title: "Migrate to React 19",
					priority: 3,
					status: "active",
				},
			],
		},
		resultKind: "json",
	},
	{
		name: "agenda_activate_goal",
		category: "Agenda",
		title: "Agenda: Activate Goal",
		description:
			"Mark a goal as active — agents will prioritize work against this goal.",
		scope: "write",
		args: [{ name: "goal_id", kind: "string", required: true }],
		example: { goal_id: "g1" },
		resultKind: "json",
	},
	{
		name: "agenda_complete_goal",
		category: "Agenda",
		title: "Agenda: Complete Goal",
		description: "Mark a goal as completed with an optional summary.",
		scope: "write",
		args: [
			{ name: "goal_id", kind: "string", required: true },
			{ name: "summary", kind: "string" },
		],
		example: { goal_id: "g1", summary: "Shipped in PR #42" },
		resultKind: "json",
	},
	{
		name: "agenda_add_initiative",
		category: "Agenda",
		title: "Agenda: Add Initiative",
		description:
			"Add a higher-level initiative that groups multiple goals together.",
		scope: "write",
		args: [
			{ name: "title", kind: "string", required: true },
			{ name: "description", kind: "string" },
			{ name: "goal_ids", kind: "array", itemKind: "string" },
		],
		example: {
			title: "Q4 Reliability Push",
			description: "Cut p95 latency 30%",
			goal_ids: ["g1", "g2"],
		},
		resultKind: "json",
	},
	{
		name: "agenda_log_entry",
		category: "Agenda",
		title: "Agenda: Log Entry",
		description:
			"Append a free-form entry to the agenda activity log (decisions, blockers, learnings).",
		scope: "write",
		args: [
			{ name: "message", kind: "string", required: true },
			{ name: "category", kind: "string", default: "note" },
			{ name: "goal_id", kind: "string" },
		],
		example: {
			message: "Adopted Vitest for unit tests",
			category: "decision",
			goal_id: "g3",
		},
		resultKind: "log",
	},
	{
		name: "agenda_get_impact",
		category: "Agenda",
		title: "Agenda: Get Impact",
		description:
			"Compute the cumulative impact (areas touched, goals completed, suggestions accepted) for the agenda.",
		scope: "read",
		args: [],
		example: {},
		resultKind: "json",
	},

	// ── VIBE AGENTS (the 7-stage pipeline) ──────────────────────────────────────
	{
		name: "vibe_architect",
		category: "Vibe Agents",
		title: "Vibe Architect",
		description:
			"Generate a full plan (architecture, file tree, dependencies) from a spec.",
		scope: "ai",
		args: [
			{
				name: "spec",
				kind: "string",
				required: true,
				description: "Product spec / requirements doc.",
			},
			{ name: "constraints", kind: "array", itemKind: "string" },
			{
				name: "output_format",
				kind: "enum",
				enumValues: ["plan", "tree", "json"],
				default: "plan",
			},
		],
		example: {
			spec: "Build a Slack clone with realtime presence.",
			constraints: ["no auth, use seeded user"],
			output_format: "plan",
		},
		resultKind: "markdown",
		isQuickAction: true,
	},
	{
		name: "vibe_code",
		category: "Vibe Agents",
		title: "Vibe Code",
		description:
			"Emit code for the plan, file by file, with imports and tests.",
		scope: "ai",
		args: [
			{
				name: "plan",
				kind: "object",
				required: true,
				description: "Output of vibe_architect.",
			},
			{
				name: "language",
				kind: "enum",
				enumValues: ["typescript", "python", "go"],
				default: "typescript",
			},
			{ name: "max_files", kind: "number", default: 30 },
		],
		example: {
			plan: { files: [{ path: "src/index.ts" }] },
			language: "typescript",
			max_files: 10,
		},
		resultKind: "code",
		isQuickAction: true,
	},
	{
		name: "vibe_review",
		category: "Vibe Agents",
		title: "Vibe Review",
		description:
			"Run a code review pass and emit findings (style, perf, security).",
		scope: "ai",
		args: [
			{ name: "files", kind: "array", itemKind: "object", required: true },
			{ name: "strict", kind: "boolean", default: false },
		],
		example: { files: [{ path: "src/auth.ts", content: "..." }], strict: true },
		resultKind: "json",
	},
	{
		name: "vibe_verify",
		category: "Vibe Agents",
		title: "Vibe Verify",
		description:
			"Run linting, typecheck, and unit tests against the produced code.",
		scope: "execute",
		args: [
			{ name: "files", kind: "array", itemKind: "object", required: true },
			{
				name: "runners",
				kind: "array",
				itemKind: "string",
				default: ["tsc", "biome", "playwright"],
			},
		],
		example: { files: [{ path: "src/index.ts" }], runners: ["tsc", "biome"] },
		resultKind: "log",
	},
	{
		name: "vibe_iterate",
		category: "Vibe Agents",
		title: "Vibe Iterate",
		description: "Apply review feedback to the code in a feedback loop.",
		scope: "ai",
		args: [
			{ name: "files", kind: "array", itemKind: "object", required: true },
			{ name: "feedback", kind: "string", required: true },
		],
		example: {
			files: [{ path: "src/x.ts" }],
			feedback: "Replace forEach with map where possible",
		},
		resultKind: "code",
	},
	{
		name: "vibe_test",
		category: "Vibe Agents",
		title: "Vibe Test",
		description: "Generate unit + integration tests for the supplied code.",
		scope: "ai",
		args: [
			{ name: "files", kind: "array", itemKind: "object", required: true },
			{
				name: "framework",
				kind: "enum",
				enumValues: ["vitest", "jest", "playwright", "pytest"],
				default: "vitest",
			},
		],
		example: { files: [{ path: "src/auth.ts" }], framework: "vitest" },
		resultKind: "code",
	},
	{
		name: "vibe_deploy",
		category: "Vibe Agents",
		title: "Vibe Deploy",
		description:
			"Trigger a deploy to the configured target (Vercel, Cloudflare, or self-hosted).",
		scope: "execute",
		args: [
			{
				name: "target",
				kind: "enum",
				enumValues: ["vercel", "cloudflare", "self-hosted"],
				default: "vercel",
			},
			{ name: "project", kind: "string", required: true },
			{
				name: "env",
				kind: "enum",
				enumValues: ["preview", "production"],
				default: "preview",
			},
		],
		example: { target: "vercel", project: "vibeserve-ide", env: "preview" },
		resultKind: "log",
		isQuickAction: true,
	},

	// ── DESIGN / UI ─────────────────────────────────────────────────────────────
	{
		name: "vibe_design",
		category: "Design",
		title: "Vibe Design",
		description:
			"Generate a design system (colors, typography, spacing) from a brand brief.",
		scope: "ai",
		args: [
			{ name: "brief", kind: "string", required: true },
			{ name: "palette", kind: "array", itemKind: "string" },
		],
		example: {
			brief: "A calm, dev-tool brand",
			palette: ["#0b1020", "#7dd3fc"],
		},
		resultKind: "json",
	},
	{
		name: "vibe_upgrade_design",
		category: "Design",
		title: "Vibe Upgrade Design",
		description:
			"Take an existing design system and propose an upgraded variant.",
		scope: "ai",
		args: [
			{ name: "design_system", kind: "object", required: true },
			{ name: "goals", kind: "array", itemKind: "string" },
		],
		example: {
			design_system: { name: "default" },
			goals: ["more contrast", "less purple"],
		},
		resultKind: "json",
	},
	{
		name: "generate_ui_spec",
		category: "Design",
		title: "Generate UI Spec",
		description:
			"Produce a UISchema (components, props, layout tree) for the supplied spec.",
		scope: "ai",
		args: [
			{ name: "description", kind: "string", required: true },
			{ name: "design_system", kind: "string", default: "default" },
		],
		example: {
			description: "A settings page with sidebar nav",
			design_system: "default",
		},
		resultKind: "json",
		isQuickAction: true,
	},
	{
		name: "validate_ui_spec",
		category: "Design",
		title: "Validate UI Spec",
		description:
			"Validate a UISchema against the design system and WCAG rules.",
		scope: "read",
		args: [{ name: "spec", kind: "object", required: true }],
		example: { spec: { components: [] } },
		resultKind: "json",
	},
	{
		name: "list_design_systems",
		category: "Design",
		title: "List Design Systems",
		description: "List every design system registered with VibeServe.",
		scope: "read",
		args: [],
		example: {},
		resultKind: "json",
	},
	{
		name: "vibe_preview",
		category: "Design",
		title: "Vibe Preview",
		description:
			"Render an HTML preview of a UISchema and return the markup + a screenshot URL.",
		scope: "ai",
		args: [
			{ name: "spec", kind: "object", required: true },
			{ name: "screenshot", kind: "boolean", default: false },
		],
		example: { spec: { components: [] }, screenshot: true },
		resultKind: "image",
	},

	// ── CODE TOOLS (file + repo operations) ─────────────────────────────────────
	{
		name: "index_repo",
		category: "Code",
		title: "Index Repo",
		description:
			"Ingest a local repository into the code graph and embeddings index.",
		scope: "write",
		args: [
			{
				name: "path",
				kind: "string",
				required: true,
				description: "Absolute path to the repo root.",
			},
			{
				name: "name",
				kind: "string",
				description: "Friendly identifier; defaults to the folder name.",
			},
		],
		example: { path: "/Users/me/projects/acme", name: "acme" },
		resultKind: "json",
	},
	{
		name: "list_indexed_repos",
		category: "Code",
		title: "List Indexed Repos",
		description: "List all repositories that have been indexed.",
		scope: "read",
		args: [],
		example: {},
		resultKind: "table",
	},
	{
		name: "search_repo",
		category: "Code",
		title: "Search Repo",
		description: "Semantic + lexical search across a single indexed repo.",
		scope: "read",
		args: [
			{ name: "repo", kind: "string", required: true },
			{ name: "query", kind: "string", required: true },
			{ name: "limit", kind: "number", default: 10 },
		],
		example: { repo: "acme", query: "where do we hash passwords", limit: 5 },
		resultKind: "json",
	},
	{
		name: "read_file",
		category: "Code",
		title: "Read File",
		description: "Read a single file from an indexed repo.",
		scope: "read",
		args: [
			{ name: "repo", kind: "string", required: true },
			{ name: "path", kind: "string", required: true },
		],
		example: { repo: "acme", path: "src/auth/login.ts" },
		resultKind: "code",
	},
	{
		name: "write_file",
		category: "Code",
		title: "Write File",
		description: "Write content to a file inside an indexed repo.",
		scope: "write",
		args: [
			{ name: "repo", kind: "string", required: true },
			{ name: "path", kind: "string", required: true },
			{ name: "content", kind: "string", required: true },
		],
		example: {
			repo: "acme",
			path: "src/hello.ts",
			content: 'export const hello = "world"\n',
		},
		resultKind: "log",
	},
	{
		name: "editor_config",
		category: "Code",
		title: "Editor Config",
		description:
			"Read or update editor / formatter configuration for a repo (prettier, biome, eslint).",
		scope: "write",
		args: [
			{ name: "repo", kind: "string", required: true },
			{ name: "config", kind: "object", required: true },
		],
		example: { repo: "acme", config: { formatter: "biome", lineWidth: 100 } },
		resultKind: "json",
	},
	{
		name: "generate_plan",
		category: "Code",
		title: "Generate Plan",
		description:
			"Generate a multi-step plan (parse_spec → architect → emit_graph) for a request.",
		scope: "ai",
		args: [{ name: "request", kind: "string", required: true }],
		example: { request: "Add a /metrics endpoint and a Grafana dashboard" },
		resultKind: "markdown",
	},
	{
		name: "retrieve_context",
		category: "Code",
		title: "Retrieve Context",
		description:
			"Pull relevant files and symbols for a question (RAG retrieval).",
		scope: "read",
		args: [
			{ name: "query", kind: "string", required: true },
			{ name: "repos", kind: "array", itemKind: "string" },
			{ name: "max_chunks", kind: "number", default: 12 },
		],
		example: {
			query: "how does the cache get invalidated",
			repos: ["acme"],
			max_chunks: 5,
		},
		resultKind: "json",
	},
	{
		name: "check_node_env",
		category: "Code",
		title: "Check Node Env",
		description:
			"Return the current Node, npm, pnpm versions and detect package manager in a directory.",
		scope: "read",
		args: [{ name: "dir", kind: "string" }],
		example: { dir: "/Users/me/projects/acme" },
		resultKind: "json",
	},
	{
		name: "detect_package_manager",
		category: "Code",
		title: "Detect Package Manager",
		description:
			"Detect the package manager (npm / pnpm / yarn / bun) used in a directory.",
		scope: "read",
		args: [{ name: "dir", kind: "string", required: true }],
		example: { dir: "/Users/me/projects/acme" },
		resultKind: "json",
	},

	// ── RUN / BUILD ─────────────────────────────────────────────────────────────
	{
		name: "run_install",
		category: "Build",
		title: "Run Install",
		description:
			"Run the install command for the detected package manager in a repo.",
		scope: "execute",
		args: [{ name: "repo", kind: "string", required: true }],
		example: { repo: "acme" },
		resultKind: "log",
	},
	{
		name: "run_build",
		category: "Build",
		title: "Run Build",
		description: "Run `npm run build` (or equivalent) in a repo.",
		scope: "execute",
		args: [{ name: "repo", kind: "string", required: true }],
		example: { repo: "acme" },
		resultKind: "log",
	},
	{
		name: "run_biome",
		category: "Build",
		title: "Run Biome",
		description: "Run biome check + format on a repo and return the diff.",
		scope: "execute",
		args: [{ name: "repo", kind: "string", required: true }],
		example: { repo: "acme" },
		resultKind: "log",
	},
	{
		name: "run_tsc",
		category: "Build",
		title: "Run TypeScript",
		description: "Run `tsc --noEmit` and return the diagnostics.",
		scope: "execute",
		args: [{ name: "repo", kind: "string", required: true }],
		example: { repo: "acme" },
		resultKind: "log",
	},
	{
		name: "run_npm_audit",
		category: "Build",
		title: "Run npm Audit",
		description: "Run `npm audit --json` and return parsed vulnerabilities.",
		scope: "execute",
		args: [{ name: "repo", kind: "string", required: true }],
		example: { repo: "acme" },
		resultKind: "json",
	},
	{
		name: "run_semgrep",
		category: "Build",
		title: "Run Semgrep",
		description: "Run Semgrep with the security ruleset on a repo.",
		scope: "execute",
		args: [
			{ name: "repo", kind: "string", required: true },
			{
				name: "ruleset",
				kind: "enum",
				enumValues: ["security", "owasp-top-ten", "auto"],
				default: "security",
			},
		],
		example: { repo: "acme", ruleset: "security" },
		resultKind: "log",
	},
	{
		name: "run_playwright",
		category: "Build",
		title: "Run Playwright",
		description:
			"Run the Playwright test suite headlessly and return the report.",
		scope: "execute",
		args: [
			{ name: "repo", kind: "string", required: true },
			{ name: "headed", kind: "boolean", default: false },
		],
		example: { repo: "acme", headed: false },
		resultKind: "log",
	},

	// ── GITHUB ─────────────────────────────────────────────────────────────────
	{
		name: "github_list_repos",
		category: "GitHub",
		title: "GitHub: List Repos",
		description: "List repositories the linked GitHub account can see.",
		scope: "read",
		args: [
			{
				name: "visibility",
				kind: "enum",
				enumValues: ["all", "public", "private"],
				default: "all",
			},
			{ name: "per_page", kind: "number", default: 30 },
		],
		example: { visibility: "all", per_page: 50 },
		resultKind: "table",
		isQuickAction: true,
	},
	{
		name: "github_repo",
		category: "GitHub",
		title: "GitHub: Get Repo",
		description: "Fetch metadata, README, and languages for a single repo.",
		scope: "read",
		args: [
			{ name: "owner", kind: "string", required: true },
			{ name: "repo", kind: "string", required: true },
		],
		example: { owner: "vercel", repo: "next.js" },
		resultKind: "json",
	},
	{
		name: "github_issues",
		category: "GitHub",
		title: "GitHub: List Issues",
		description:
			"List issues for a repo (optionally filtered by state and labels).",
		scope: "read",
		args: [
			{ name: "owner", kind: "string", required: true },
			{ name: "repo", kind: "string", required: true },
			{
				name: "state",
				kind: "enum",
				enumValues: ["open", "closed", "all"],
				default: "open",
			},
			{ name: "labels", kind: "array", itemKind: "string" },
		],
		example: {
			owner: "vercel",
			repo: "next.js",
			state: "open",
			labels: ["bug"],
		},
		resultKind: "table",
	},
	{
		name: "github_link_account",
		category: "GitHub",
		title: "GitHub: Link Account",
		description: "Persist a GitHub PAT to VibeServe and validate it.",
		scope: "write",
		args: [
			{
				name: "pat",
				kind: "string",
				required: true,
				description:
					"Personal Access Token. Stored encrypted in the secret store.",
			},
		],
		example: { pat: "ghp_***" },
		resultKind: "log",
		requires: ["GITHUB_TOKEN"],
	},
	{
		name: "github_link_repo",
		category: "GitHub",
		title: "GitHub: Link Repo",
		description: "Link a GitHub repo to a local checkout for diffs and PRs.",
		scope: "write",
		args: [
			{ name: "owner", kind: "string", required: true },
			{ name: "repo", kind: "string", required: true },
			{ name: "local_path", kind: "string", required: true },
		],
		example: {
			owner: "acme",
			repo: "web",
			local_path: "/Users/me/projects/acme-web",
		},
		resultKind: "log",
	},
	{
		name: "github_sync_all",
		category: "GitHub",
		title: "GitHub: Sync All",
		description: "Sync issues, PRs, and metadata for every linked GitHub repo.",
		scope: "write",
		args: [],
		example: {},
		resultKind: "log",
	},

	// ── VERCEL ─────────────────────────────────────────────────────────────────
	{
		name: "vercel_deployments",
		category: "Vercel",
		title: "Vercel: List Deployments",
		description: "List recent deployments for a Vercel project.",
		scope: "read",
		args: [
			{ name: "project", kind: "string", required: true },
			{ name: "limit", kind: "number", default: 20 },
		],
		example: { project: "vibeserve-ide", limit: 10 },
		resultKind: "table",
		isQuickAction: true,
	},

	// ── SUPABASE ───────────────────────────────────────────────────────────────
	{
		name: "supabase_query",
		category: "Supabase",
		title: "Supabase: Query",
		description: "Run a read-only SELECT against a Supabase table.",
		scope: "read",
		args: [
			{ name: "table", kind: "string", required: true },
			{ name: "select", kind: "string", default: "*" },
			{ name: "filters", kind: "array", itemKind: "object" },
			{ name: "limit", kind: "number", default: 50 },
		],
		example: { table: "goals", select: "id,title,status", limit: 25 },
		resultKind: "table",
		isQuickAction: true,
	},
	{
		name: "supabase_insert",
		category: "Supabase",
		title: "Supabase: Insert",
		description: "Insert one or more rows into a Supabase table.",
		scope: "write",
		args: [
			{ name: "table", kind: "string", required: true },
			{ name: "rows", kind: "array", itemKind: "object", required: true },
		],
		example: { table: "activity_log", rows: [{ message: "Hello world" }] },
		resultKind: "log",
	},

	// ── LEARNING / MEMORY ──────────────────────────────────────────────────────
	{
		name: "ingest_learning",
		category: "Memory",
		title: "Ingest Learning",
		description:
			"Persist a learning (success or failure) to the long-term memory store for future reference.",
		scope: "write",
		args: [
			{
				name: "kind",
				kind: "enum",
				enumValues: ["success", "failure", "pattern"],
				required: true,
			},
			{ name: "text", kind: "string", required: true },
			{ name: "tags", kind: "array", itemKind: "string" },
		],
		example: {
			kind: "success",
			text: "Using biome instead of eslint cut lint time 4x",
			tags: ["perf", "lint"],
		},
		resultKind: "log",
	},
	{
		name: "memory_stats",
		category: "Memory",
		title: "Memory Stats",
		description: "Return the size and structure of the long-term memory store.",
		scope: "read",
		args: [],
		example: {},
		resultKind: "json",
	},

	// ── ANALYSIS (background-job inputs) ──────────────────────────────────────
	{
		name: "find_test_gaps",
		category: "Analysis",
		title: "Find Test Gaps",
		description:
			"Identify functions in the indexed repos that have no test coverage.",
		scope: "ai",
		args: [
			{ name: "repos", kind: "array", itemKind: "string", required: true },
			{ name: "threshold", kind: "number", default: 0.5 },
		],
		example: { repos: ["acme"], threshold: 0.5 },
		resultKind: "json",
	},
	{
		name: "find_refactors",
		category: "Analysis",
		title: "Find Refactors",
		description:
			"Suggest refactor candidates based on code smells and complexity.",
		scope: "ai",
		args: [
			{ name: "repos", kind: "array", itemKind: "string", required: true },
		],
		example: { repos: ["acme"] },
		resultKind: "json",
	},
	{
		name: "cross_repo_suggest",
		category: "Analysis",
		title: "Cross-Repo Suggestions",
		description: "Find opportunities to share code between the indexed repos.",
		scope: "ai",
		args: [
			{ name: "repos", kind: "array", itemKind: "string", required: true },
		],
		example: { repos: ["acme", "acme-web"] },
		resultKind: "json",
	},

	// ── META / HEALTH / DOCS / BENCHMARK ───────────────────────────────────────
	{
		name: "vibe_health",
		category: "Meta",
		title: "Vibe Health",
		description:
			"Return a health snapshot of VibeServe (mcp status, queue, memory, secrets).",
		scope: "read",
		args: [],
		example: {},
		resultKind: "json",
	},
	{
		name: "vibe_audit",
		category: "Meta",
		title: "Vibe Audit",
		description:
			"Run a system audit (secrets rotation, config drift, queue depth) and return findings.",
		scope: "read",
		args: [{ name: "sections", kind: "array", itemKind: "string" }],
		example: { sections: ["secrets", "config"] },
		resultKind: "json",
	},
	{
		name: "vibe_compress",
		category: "Meta",
		title: "Vibe Compress",
		description: "Compress a long context using the TOON encoder.",
		scope: "read",
		args: [{ name: "text", kind: "string", required: true }],
		example: { text: "A long piece of text that needs compressing…" },
		resultKind: "text",
	},
	{
		name: "vibe_benchmark",
		category: "Meta",
		title: "Vibe Benchmark",
		description:
			"Run a micro-benchmark suite for prompt caching / embedding generation.",
		scope: "execute",
		args: [
			{
				name: "suite",
				kind: "enum",
				enumValues: ["embed", "compress", "all"],
				default: "all",
			},
		],
		example: { suite: "embed" },
		resultKind: "log",
	},
	{
		name: "vibe_docs",
		category: "Meta",
		title: "Vibe Docs",
		description: "Generate documentation for the supplied files.",
		scope: "ai",
		args: [
			{ name: "files", kind: "array", itemKind: "object", required: true },
			{
				name: "format",
				kind: "enum",
				enumValues: ["markdown", "jsdoc", "docstring"],
				default: "markdown",
			},
		],
		example: { files: [{ path: "src/auth.ts" }], format: "markdown" },
		resultKind: "markdown",
	},
	{
		name: "vibe_build_pro",
		category: "Meta",
		title: "Vibe Build Pro",
		description: "Run the full build+test+deploy pipeline in one shot.",
		scope: "execute",
		args: [
			{ name: "repo", kind: "string", required: true },
			{
				name: "target",
				kind: "enum",
				enumValues: ["vercel", "cloudflare", "self-hosted"],
				default: "vercel",
			},
		],
		example: { repo: "acme", target: "vercel" },
		resultKind: "log",
	},
];

// ── Helpers ──────────────────────────────────────────────────────────────────

const _byName = new Map(VIBESERVE_TOOL_CATALOG.map((t) => [t.name, t]));

export function findTool(name: string): ToolEntry | undefined {
	return _byName.get(name);
}

export function findToolsByCategory(category: string): ToolEntry[] {
	return VIBESERVE_TOOL_CATALOG.filter((t) => t.category === category);
}

export function searchTools(query: string): ToolEntry[] {
	const q = query.toLowerCase().trim();
	if (!q) return VIBESERVE_TOOL_CATALOG;
	return VIBESERVE_TOOL_CATALOG.filter((t) => {
		return (
			t.name.toLowerCase().includes(q) ||
			t.title.toLowerCase().includes(q) ||
			t.description.toLowerCase().includes(q) ||
			t.category.toLowerCase().includes(q)
		);
	});
}

export function listCategories(): string[] {
	return Array.from(new Set(VIBESERVE_TOOL_CATALOG.map((t) => t.category)));
}

export function listQuickActions(): ToolEntry[] {
	return VIBESERVE_TOOL_CATALOG.filter((t) => t.isQuickAction);
}

export const VIBESERVE_CATEGORIES = listCategories();

export const VIBESERVE_TOOL_COUNT = VIBESERVE_TOOL_CATALOG.length;
