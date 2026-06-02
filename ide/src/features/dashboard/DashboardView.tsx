import {
	Activity,
	AlertCircle,
	AlertTriangle,
	CheckCircle2,
	Circle,
	Cpu,
	Globe,
	HardDrive,
	TrendingUp,
	Zap,
} from "lucide-react";
import { motion } from "motion/react";

interface MetricGaugeProps {
	label: string;
	value: number;
	max: number;
	unit: string;
	icon: typeof Cpu;
}

function MetricGauge({
	label,
	value,
	max,
	unit,
	icon: Icon,
}: MetricGaugeProps) {
	const pct = Math.round((value / max) * 100);
	const color = pct > 90 ? "rose" : pct > 70 ? "amber" : "emerald";

	return (
		<div className="bg-[#0d0d10] border border-[#1a1b1e] rounded-xl p-4">
			<div className="flex items-center justify-between mb-2">
				<span className="text-[10px] font-mono uppercase tracking-wider text-[#8E9299]">
					{label}
				</span>
				<Icon size={14} className="text-[#4a4b50]" />
			</div>
			<div className="text-2xl font-bold text-white">
				{value}
				<span className="text-sm text-[#4a4b50] ml-1">{unit}</span>
			</div>
			<div className="mt-2 h-1.5 rounded-full bg-[#1a1b1e] overflow-hidden">
				<motion.div
					className={`h-full rounded-full bg-gradient-to-r ${
						color === "emerald"
							? "from-emerald-600 to-emerald-400"
							: color === "amber"
								? "from-amber-600 to-amber-400"
								: "from-rose-600 to-rose-400"
					}`}
					initial={{ width: 0 }}
					animate={{ width: `${pct}%` }}
					transition={{ duration: 0.8, ease: "easeOut" }}
				/>
			</div>
		</div>
	);
}

interface ActivityEvent {
	id: string;
	time: string;
	message: string;
	type: "success" | "warning" | "error" | "progress";
}

const EVENTS: ActivityEvent[] = [
	{ id: "1", time: "14:32", message: "Build completed", type: "success" },
	{ id: "2", time: "14:28", message: "Review passed", type: "success" },
	{ id: "3", time: "14:25", message: "E2E tests 3/3 passed", type: "success" },
	{ id: "4", time: "14:22", message: "Audit: 2 findings", type: "warning" },
	{ id: "5", time: "14:18", message: "Fix applied", type: "success" },
	{ id: "6", time: "14:15", message: "Build started", type: "progress" },
];

const EVENT_ICON = {
	success: CheckCircle2,
	warning: AlertTriangle,
	error: AlertCircle,
	progress: Circle,
};

const EVENT_COLOR = {
	success: "text-emerald-500",
	warning: "text-amber-500",
	error: "text-rose-500",
	progress: "text-[#4a4b50]",
};

interface AgentStatus {
	id: string;
	name: string;
	status: "active" | "paused" | "idle";
	progress: number;
	currentStep: string;
}

const AGENTS: AgentStatus[] = [
	{
		id: "1",
		name: "Agent-1",
		status: "active",
		progress: 80,
		currentStep: "Build",
	},
	{
		id: "2",
		name: "Agent-2",
		status: "paused",
		progress: 40,
		currentStep: "Review",
	},
	{
		id: "3",
		name: "Agent-3",
		status: "active",
		progress: 60,
		currentStep: "Audit",
	},
];

export function DashboardView() {
	return (
		<div className="p-6 space-y-8">
			{/* Top Row: Live Metrics + Activity Feed */}
			<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
				{/* Live Metrics */}
				<div className="space-y-3">
					<h3 className="text-[10px] font-mono uppercase tracking-widest text-[#4a4b50] mb-3">
						Live Metrics
					</h3>
					<MetricGauge label="CPU" value={42} max={100} unit="%" icon={Cpu} />
					<MetricGauge
						label="Memory"
						value={38}
						max={100}
						unit="%"
						icon={HardDrive}
					/>
					<MetricGauge
						label="Disk I/O"
						value={22}
						max={100}
						unit="%"
						icon={Activity}
					/>
					<div className="bg-[#0d0d10] border border-[#1a1b1e] rounded-xl p-4">
						<div className="flex items-center gap-4 text-[10px] font-mono">
							<div className="flex items-center gap-2">
								<div className="w-2 h-2 rounded-full bg-emerald-500" />
								<span className="text-[#8E9299]">WS</span>
								<span className="text-white">active</span>
							</div>
							<div className="flex items-center gap-2">
								<div className="w-2 h-2 rounded-full bg-emerald-500" />
								<span className="text-[#8E9299]">MCP</span>
								<span className="text-white">active</span>
							</div>
						</div>
					</div>
					<div className="bg-[#0d0d10] border border-[#1a1b1e] rounded-xl p-4">
						<div className="flex items-center gap-2 mb-2">
							<Zap size={14} className="text-emerald-500" />
							<span className="text-[10px] font-mono uppercase text-[#8E9299]">
								Pipeline Health
							</span>
						</div>
						<div className="h-1.5 rounded-full bg-[#1a1b1e] overflow-hidden">
							<motion.div
								className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400"
								initial={{ width: 0 }}
								animate={{ width: "92%" }}
								transition={{ duration: 1, ease: "easeOut" }}
							/>
						</div>
					</div>
				</div>

				{/* Activity Feed */}
				<div className="lg:col-span-2 bg-[#151619] border border-[#2d2e32] rounded-2xl p-6">
					<h3 className="text-[10px] font-mono uppercase tracking-widest text-[#4a4b50] mb-4">
						Activity Feed
					</h3>
					<div className="space-y-1">
						{EVENTS.map((event) => {
							const Icon = EVENT_ICON[event.type];
							return (
								<div
									key={event.id}
									className="flex items-center gap-3 py-2 border-b border-[#1a1b1e] last:border-0"
								>
									<span className="text-[10px] font-mono text-[#4a4b50] w-10 shrink-0">
										{event.time}
									</span>
									<Icon size={14} className={EVENT_COLOR[event.type]} />
									<span className="text-xs font-mono text-[#8E9299]">
										{event.message}
									</span>
								</div>
							);
						})}
					</div>
				</div>
			</div>

			{/* Mission Control */}
			<div className="bg-[#151619] border border-[#2d2e32] rounded-2xl p-6">
				<h3 className="text-[10px] font-mono uppercase tracking-widest text-[#4a4b50] mb-4">
					Mission Control — Agent Status
				</h3>
				<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
					{AGENTS.map((agent) => (
						<div
							key={agent.id}
							className="bg-[#0d0d10] border border-[#1a1b1e] rounded-xl p-4"
						>
							<div className="flex items-center justify-between mb-3">
								<span className="text-xs font-mono text-white">
									{agent.name}
								</span>
								<span
									className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
										agent.status === "active"
											? "bg-emerald-500/20 text-emerald-400"
											: agent.status === "paused"
												? "bg-amber-500/20 text-amber-400"
												: "bg-[#1a1b1e] text-[#4a4b50]"
									}`}
								>
									{agent.status === "active"
										? "▶ active"
										: agent.status === "paused"
											? "⏸ paused"
											: "✓ idle"}
								</span>
							</div>
							<div className="flex items-center gap-2 mb-2">
								<div className="flex-1 h-1.5 rounded-full bg-[#1a1b1e] overflow-hidden">
									<motion.div
										className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400"
										initial={{ width: 0 }}
										animate={{ width: `${agent.progress}%` }}
										transition={{ duration: 0.5 }}
									/>
								</div>
								<span className="text-[10px] font-mono text-[#4a4b50]">
									{agent.progress}%
								</span>
							</div>
							<span className="text-[9px] font-mono text-[#4a4b50]">
								{agent.currentStep} step
							</span>
						</div>
					))}
				</div>
			</div>

			{/* Stat Cards */}
			<div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
				<div className="bg-[#0d0d10] border border-[#1a1b1e] rounded-xl p-4">
					<div className="flex items-center gap-2 mb-2">
						<Zap size={14} className="text-emerald-500" />
						<span className="text-[10px] font-mono uppercase text-[#8E9299]">
							Pipeline
						</span>
					</div>
					<div className="text-2xl font-bold text-white">12/15</div>
					<div className="flex items-center gap-1 mt-1">
						<TrendingUp size={12} className="text-emerald-500" />
						<span className="text-[10px] font-mono text-emerald-500">
							streak 5
						</span>
					</div>
				</div>
				<div className="bg-[#0d0d10] border border-[#1a1b1e] rounded-xl p-4">
					<div className="flex items-center gap-2 mb-2">
						<Globe size={14} className="text-indigo-400" />
						<span className="text-[10px] font-mono uppercase text-[#8E9299]">
							Projects
						</span>
					</div>
					<div className="text-2xl font-bold text-white">3 live</div>
					<span className="text-[10px] font-mono text-[#4a4b50]">
						2 complete
					</span>
				</div>
				<div className="bg-[#0d0d10] border border-[#1a1b1e] rounded-xl p-4">
					<div className="flex items-center gap-2 mb-2">
						<HardDrive size={14} className="text-blue-400" />
						<span className="text-[10px] font-mono uppercase text-[#8E9299]">
							Repos
						</span>
					</div>
					<div className="text-2xl font-bold text-white">8</div>
					<span className="text-[10px] font-mono text-[#4a4b50]">scanned</span>
				</div>
				<div className="bg-[#0d0d10] border border-[#1a1b1e] rounded-xl p-4">
					<div className="flex items-center gap-2 mb-2">
						<CheckCircle2 size={14} className="text-emerald-500" />
						<span className="text-[10px] font-mono uppercase text-[#8E9299]">
							Quality
						</span>
					</div>
					<div className="text-2xl font-bold text-white">B+</div>
					<div className="flex items-center gap-1 mt-1">
						<TrendingUp size={12} className="text-emerald-500" />
						<span className="text-[10px] font-mono text-emerald-500">
							73% ↑ +8%
						</span>
					</div>
				</div>
			</div>
		</div>
	);
}
