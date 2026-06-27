import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";
import { useAppStore } from "../stores/useAppStore";
import { usePipelineStore } from "../stores/usePipelineStore";
import type { DashboardData } from "../types";
import { useDashboardData } from "./useDashboardData";
import { useNexusAuth } from "./useNexusAuth";
import { useNexusStatus } from "./useNexusStatus";

// Guard: only run in browser environment
const IS_BROWSER = typeof window !== "undefined";

export function useNexusApp() {
	const { data, isLoading: loading, refetch } = useDashboardData();
	const { appLicensed } = useNexusAuth();
	const { latency, nexusSystemStatus, setNexusSystemStatus } = useNexusStatus(
		loading,
		!!data,
	);
	const {
		activeTab,
		setActiveTab,
		isProcessing,
		setIsProcessing,
		selectedRepos,
	} = useAppStore();
	const dataRef = useRef<DashboardData | null>(null);
	const activeRun = usePipelineStore((s) => s.activeExecution);
	const connectWebSocket = usePipelineStore((s) => s.connectWebSocket);
	const queryClient = useQueryClient();

	useEffect(() => {
		dataRef.current = data ?? null;
	}, [data]);

	const setData = useCallback(
		(updater: (prev: DashboardData | null) => DashboardData | null) => {
			queryClient.setQueryData(
				["dashboard"],
				(old: DashboardData | undefined) => {
					const prev = old ?? null;
					return updater(prev);
				},
			);
		},
		[queryClient],
	);

	// WebSocket connection for real-time pipeline updates
	useEffect(() => {
		if (!IS_BROWSER) return;
		const cleanup = connectWebSocket();
		return () => {
			if (cleanup) cleanup();
		};
	}, [connectWebSocket]);

	// Codeix initialization — dynamic import keeps Node.js fs/path out of the browser bundle
	useEffect(() => {
		if (!IS_BROWSER) return;
		const initCodeix = async () => {
			try {
				const { useCodeixStore } = await import("../services/codeixService");
				const codeix = useCodeixStore.getState();
				if (codeix.isIndexing || codeix.index) return;
				const loaded = await codeix.loadFromDisk(".");
				if (!loaded) {
					process.stdout.write(
						"[Nexus] No existing Codeix index - will create one when in Node/Electron context",
					);
				}
			} catch {
				console.debug("[Codeix] Skipped: browser environment (no fs access)");
			}
		};
		initCodeix();
	}, []);

	// Autonomous runtime loop - only active on Overview tab, throttled
	useEffect(() => {
		if (!IS_BROWSER || activeTab !== "Overview") return;

		const interval = setInterval(async () => {
			try {
				if (Math.random() < 0.5) {
					const d = dataRef.current;
					const agent = d?.customAgents?.find((a) => a.status === "active");
					if (agent) {
						setNexusSystemStatus("AGENT_SYNC");
					}
				} else {
					setNexusSystemStatus("DATA_FETCH");
				}
			} catch {
				// Workflow server not running is expected in dev - silently ignore
			} finally {
				setTimeout(() => setNexusSystemStatus("IDLE"), 4000);
			}
		}, 18000);

		return () => clearInterval(interval);
	}, [activeTab, setNexusSystemStatus]);

	return {
		data,
		loading,
		latency,
		appLicensed,
		activeTab,
		setActiveTab,
		nexusSystemStatus,
		activeRun,
		setData,
		selectedRepos,
		isProcessing,
		setIsProcessing,
		refetch,
	};
}
