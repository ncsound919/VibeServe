/**
 * LivePreviewPane — bottom panel wrapper
 * Renders the active tab's HTML/React/UISchema content in a sandboxed iframe
 * with viewport toggles, WCAG scoring, and accessibility overlay.
 */

import { Wand2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { LivePreview, type WCAGReport } from "../features/preview/LivePreview";
import { useIDEStore } from "../stores/useIDEStore";

function detectLanguage(path: string): "html" | "uischema" | "react" {
	if (/\.html?$/i.test(path)) return "html";
	if (/\.tsx?$/i.test(path)) return "react";
	if (/\.jsx?$/i.test(path)) return "react";
	if (/schema.*\.json$/i.test(path)) return "uischema";
	return "html";
}

function shouldPreview(path: string): boolean {
	return /\.(html?|tsx?|jsx?)$/i.test(path) || /schema.*\.json$/i.test(path);
}

export function LivePreviewPane() {
	const { tabs, activeTabId } = useIDEStore();
	const [source, setSource] = useState<string>("");
	const [loading, setLoading] = useState(false);
	const [wcag, setWcag] = useState<WCAGReport | null>(null);
	const [error, setError] = useState<string | null>(null);
	const lastFetchedRef = useRef<{ tabId: string; path: string } | null>(null);

	const activeTab = tabs.find((t) => t.id === activeTabId);

	useEffect(() => {
		if (!activeTab || !shouldPreview(activeTab.path || activeTab.name)) {
			setSource("");
			return;
		}
		if (
			lastFetchedRef.current?.tabId === activeTab.id &&
			lastFetchedRef.current.path === activeTab.path
		) {
			return;
		}
		let cancelled = false;
		setLoading(true);
		setError(null);
		const path = activeTab.path || activeTab.name;
		(async () => {
			try {
				const res = await fetch(
					`/api/files/read?path=${encodeURIComponent(path)}`,
				);
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				const data = await res.json();
				if (cancelled) return;
				setSource(data?.content ?? "");
				lastFetchedRef.current = { tabId: activeTab.id, path };
				// Trigger WCAG check on first load
				if (detectLanguage(path) === "html") {
					runWcagCheck(data?.content ?? "");
				}
			} catch (e: any) {
				if (cancelled) return;
				setError(e?.message || "Failed to load file");
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [activeTab?.id, activeTab?.path, activeTab?.name]);

	const runWcagCheck = async (html: string) => {
		if (!html.trim()) {
			setWcag(null);
			return;
		}
		try {
			const res = await fetch("/api/design/wcag-check", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ html, level: "AA" }),
			});
			if (!res.ok) return;
			const data = await res.json();
			setWcag({
				score: data.score,
				level: data.level,
				issues: data.issues || [],
				computedAt: data.computedAt,
			});
		} catch {
			/* ignore */
		}
	};

	const language = activeTab
		? detectLanguage(activeTab.path || activeTab.name)
		: "html";

	if (!activeTab || !shouldPreview(activeTab.path || activeTab.name)) {
		return (
			<div className="flex flex-col h-full items-center justify-center text-center p-8 bg-[#0a0a0c] text-[#4a4b50]">
				<Wand2 className="w-10 h-10 mb-3 opacity-30" />
				<p className="text-xs">No HTML / React / UISchema file open</p>
				<p className="text-[10px] mt-1 opacity-70">
					Open a .html, .tsx, or UISchema JSON to see a live preview
				</p>
			</div>
		);
	}

	return (
		<div className="h-full flex flex-col">
			{loading && (
				<div className="text-[10px] px-3 py-1 text-[#8E9299] bg-[#0a0a0c] border-b border-[#2d2e32]">
					Loading {activeTab.name}…
				</div>
			)}
			{error && (
				<div className="text-[10px] px-3 py-1 text-rose-300 bg-rose-500/10 border-b border-rose-500/30">
					{error}
				</div>
			)}
			<div className="flex-1 min-h-0">
				<LivePreview
					source={source}
					language={language}
					wcagReport={wcag}
					onRequestWCAG={() => runWcagCheck(source)}
				/>
			</div>
		</div>
	);
}
