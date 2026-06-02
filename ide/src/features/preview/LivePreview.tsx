/**
 * LivePreview — Zone 5
 * Live UI preview with viewport toggles, WCAG score badge, accessibility overlay,
 * screenshot/PNG export, refresh, and pop-out to a new tab.
 *
 * Different from MultimodalPreview (which renders file docs), this renders the
 * actual UI artifact from a stream of code (HTML / UISchema JSON) inside a
 * sandboxed iframe with viewable viewport constraints.
 */

import {
	AlertTriangle,
	Camera,
	CheckCircle2,
	Code2,
	ExternalLink,
	Eye,
	EyeOff,
	Loader,
	Monitor,
	RefreshCw,
	Smartphone,
	Star,
	Tablet,
	X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type ViewportPreset = "mobile" | "tablet" | "desktop" | "full";

const VIEWPORTS: Record<
	ViewportPreset,
	{ width: number; height: number; label: string; icon: typeof Monitor }
> = {
	mobile: { width: 375, height: 667, label: "Mobile · 375", icon: Smartphone },
	tablet: { width: 768, height: 1024, label: "Tablet · 768", icon: Tablet },
	desktop: { width: 1440, height: 900, label: "Desktop · 1440", icon: Monitor },
	full: { width: 0, height: 0, label: "Full", icon: Monitor },
};

export interface WCAGIssue {
	rule: string;
	severity: "pass" | "warn" | "fail";
	detail: string;
	selector?: string;
}

export interface WCAGReport {
	score: number; // 0-100
	level: "A" | "AA" | "AAA";
	issues: WCAGIssue[];
	computedAt: number;
}

interface LivePreviewProps {
	source: string; // HTML or UISchema JSON
	language: "html" | "uischema" | "react";
	wcagReport?: WCAGReport | null;
	onRequestWCAG?: () => void;
	onClose?: () => void;
}

export function LivePreview({
	source,
	language,
	wcagReport,
	onRequestWCAG,
	onClose,
}: LivePreviewProps) {
	const [viewport, setViewport] = useState<ViewportPreset>("full");
	const [scale, setScale] = useState(1);
	const [showA11y, setShowA11y] = useState(false);
	const [iframeKey, setIframeKey] = useState(0);
	const [busy, setBusy] = useState(false);
	const iframeRef = useRef<HTMLIFrameElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);

	const html = useCallback(() => {
		if (language === "html") return source;
		if (language === "uischema") {
			// Best-effort: render a <div> the user can view as text or feed to the React renderer
			// (full renderer is in /uischema_react_renderer.jsx but that requires Vite plugin)
			return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>UISchema</title>
        <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
        <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
        <style>body{font-family:ui-sans-serif,system-ui,sans-serif;margin:24px;color:#0f172a;background:#f8fafc}h1{font-size:18px;margin-bottom:8px}pre{background:#0f172a;color:#e2e8f0;padding:12px;border-radius:8px;overflow:auto;font-size:12px}</style>
        </head><body><h1>UISchema v1.0 Source</h1><pre>${escapeHtml(source)}</pre></body></html>`;
		}
		if (language === "react") {
			return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>React</title>
        <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
        <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
        <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
        <style>body{font-family:ui-sans-serif,system-ui,sans-serif;margin:0;padding:0}</style>
        </head><body><div id="root"></div>
        <script type="text/babel">${source}</script>
        </body></html>`;
		}
		return source;
	}, [source, language]);

	// Fit-to-width scaling for non-full viewports
	useEffect(() => {
		const vp = VIEWPORTS[viewport];
		if (vp.width === 0 || !containerRef.current) return;
		const containerW = containerRef.current.clientWidth - 32;
		setScale(Math.min(1, containerW / vp.width));
	}, [viewport, source]);

	const reload = useCallback(() => setIframeKey((k) => k + 1), []);

	const popOut = useCallback(() => {
		const blob = new Blob([html()], { type: "text/html" });
		const url = URL.createObjectURL(blob);
		window.open(url, "_blank", "noopener,noreferrer");
	}, [html]);

	const screenshot = useCallback(async () => {
		const iframe = iframeRef.current;
		if (!iframe) return;
		setBusy(true);
		try {
			const doc = iframe.contentDocument;
			if (!doc) throw new Error("No iframe document");
			// Walk all elements to compute bounding boxes via foreignObject SVG
			const { width, height } = (() => {
				const body = doc.body;
				return {
					width: Math.max(body.scrollWidth, 1024),
					height: Math.max(body.scrollHeight, 768),
				};
			})();

			// Build a minimal HTML→SVG via foreignObject and rasterize via canvas
			const html2canvas = (await import("html2canvas").catch(
				() => null,
			)) as any;
			if (html2canvas) {
				const canvas = await html2canvas.default(doc.body, {
					backgroundColor: "#ffffff",
					logging: false,
				});
				canvas.toBlob((blob: Blob | null) => {
					if (!blob) return;
					const url = URL.createObjectURL(blob);
					const a = document.createElement("a");
					a.href = url;
					a.download = `preview-${Date.now()}.png`;
					document.body.appendChild(a);
					a.click();
					a.remove();
					URL.revokeObjectURL(url);
				}, "image/png");
				return;
			}
			// Fallback: use the iframe's contentWindow's print
			iframe.contentWindow?.print();
		} catch (e) {
			console.error("Screenshot failed:", e);
			alert(
				"Screenshot failed. The html2canvas library is not installed — falling back to print dialog.",
			);
		} finally {
			setBusy(false);
		}
	}, []);

	const scoreColor = wcagReport
		? wcagReport.score >= 90
			? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30"
			: wcagReport.score >= 70
				? "text-amber-400 bg-amber-500/10 border-amber-500/30"
				: "text-rose-400 bg-rose-500/10 border-rose-500/30"
		: "text-slate-400 bg-slate-500/10 border-slate-500/30";

	const a11yOverlayCSS = showA11y
		? `
    [data-a11y-fail] { outline: 2px solid #f43f5e !important; outline-offset: 2px; }
    [data-a11y-warn] { outline: 2px solid #f59e0b !important; outline-offset: 2px; }
  `
		: "";

	return (
		<div className="flex flex-col h-full bg-[#0a0a0c] text-[#c9d1d9]">
			{/* Toolbar */}
			<div className="flex items-center gap-2 px-3 py-2 border-b border-[#2d2e32] flex-wrap">
				<span className="text-[10px] font-mono uppercase tracking-widest text-[#8E9299]">
					Live Preview
				</span>
				<span
					className="text-[10px] px-1.5 py-0.5 rounded font-mono"
					style={{ background: "#1f6feb22", color: "#58a6ff" }}
				>
					{language}
				</span>
				<div className="flex-1" />
				{/* Viewport toggles */}
				<div className="flex rounded" style={{ background: "#1a1b1e" }}>
					{(Object.keys(VIEWPORTS) as ViewportPreset[]).map((vp) => {
						const Icon = VIEWPORTS[vp].icon;
						const active = viewport === vp;
						return (
							<button
								key={vp}
								onClick={() => setViewport(vp)}
								className="flex items-center gap-1 px-2 py-1 text-[10px] font-mono"
								style={{
									background: active ? "#1f6feb" : "transparent",
									color: active ? "white" : "#7d8590",
								}}
								title={VIEWPORTS[vp].label}
							>
								<Icon className="w-3 h-3" />
							</button>
						);
					})}
				</div>
				<button
					onClick={reload}
					className="p-1.5 rounded hover:opacity-80 text-[#7d8590] hover:text-white"
					title="Hard reload"
				>
					<RefreshCw className="w-3.5 h-3.5" />
				</button>
				<button
					onClick={() => setShowA11y((v) => !v)}
					className={`p-1.5 rounded ${showA11y ? "bg-amber-500/20 text-amber-300" : "text-[#7d8590] hover:text-white"}`}
					title="Toggle accessibility overlay"
				>
					{showA11y ? (
						<Eye className="w-3.5 h-3.5" />
					) : (
						<EyeOff className="w-3.5 h-3.5" />
					)}
				</button>
				<button
					onClick={screenshot}
					disabled={busy}
					className="p-1.5 rounded text-[#7d8590] hover:text-white disabled:opacity-50"
					title="Export PNG"
				>
					{busy ? (
						<Loader className="w-3.5 h-3.5 animate-spin" />
					) : (
						<Camera className="w-3.5 h-3.5" />
					)}
				</button>
				<button
					onClick={popOut}
					className="p-1.5 rounded text-[#7d8590] hover:text-white"
					title="Open in new tab"
				>
					<ExternalLink className="w-3.5 h-3.5" />
				</button>
				{onClose && (
					<button
						onClick={onClose}
						className="p-1.5 rounded text-[#7d8590] hover:text-white"
						title="Close"
					>
						<X className="w-3.5 h-3.5" />
					</button>
				)}
			</div>

			{/* WCAG score bar — the killer differentiator */}
			{wcagReport && (
				<div
					className={`flex items-center gap-3 px-3 py-1.5 border-b border-[#2d2e32] border ${scoreColor}`}
				>
					<button
						onClick={onRequestWCAG}
						className="flex items-center gap-1.5 text-[11px] font-mono"
						title="Re-run WCAG analysis"
					>
						<Star className="w-3 h-3" />
						<span className="font-bold">{wcagReport.score}</span>
						<span className="opacity-70">/100 · {wcagReport.level}</span>
					</button>
					<div className="flex-1" />
					{wcagReport.issues.filter((i) => i.severity === "fail").length >
						0 && (
						<span className="text-[10px] flex items-center gap-1">
							<AlertTriangle className="w-3 h-3" />
							{wcagReport.issues.filter((i) => i.severity === "fail").length}{" "}
							fail
						</span>
					)}
					{wcagReport.issues.filter((i) => i.severity === "warn").length >
						0 && (
						<span className="text-[10px] flex items-center gap-1">
							<AlertTriangle className="w-3 h-3" />
							{wcagReport.issues.filter((i) => i.severity === "warn").length}{" "}
							warn
						</span>
					)}
					{wcagReport.issues.length === 0 && (
						<span className="text-[10px] flex items-center gap-1">
							<CheckCircle2 className="w-3 h-3" />
							All checks pass
						</span>
					)}
				</div>
			)}

			{/* Iframe area */}
			<div
				ref={containerRef}
				className="flex-1 min-h-0 overflow-auto p-4 flex items-start justify-center bg-[#1a1b1e]"
			>
				{source ? (
					<iframe
						key={iframeKey}
						ref={iframeRef}
						srcDoc={
							a11yOverlayCSS
								? `<style>${a11yOverlayCSS}</style>${html()}`
								: html()
						}
						title="Live preview"
						sandbox="allow-scripts allow-same-origin"
						className="bg-white rounded shadow-2xl"
						style={{
							width:
								viewport === "full"
									? "100%"
									: VIEWPORTS[viewport].width * scale,
							height:
								viewport === "full"
									? "100%"
									: VIEWPORTS[viewport].height * scale,
							minHeight: viewport === "full" ? 600 : undefined,
							border: "none",
							transform: viewport !== "full" ? `scale(${scale})` : undefined,
							transformOrigin: "top left",
						}}
					/>
				) : (
					<div className="flex flex-col items-center justify-center h-full text-center text-[#4a4b50] p-8">
						<Code2 className="w-12 h-12 mb-3 opacity-30" />
						<p className="text-xs">No preview source</p>
						<p className="text-[10px] mt-1 opacity-70">
							Generate HTML/React/UISchema to see it rendered here
						</p>
					</div>
				)}
			</div>
		</div>
	);
}

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}
