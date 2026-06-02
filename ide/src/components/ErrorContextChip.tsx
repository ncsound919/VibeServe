/**
 * ErrorContextChip
 *
 * Floating chip that appears in the IDE's chat panel (or terminal panel header)
 * whenever ErrorContextService detects a new error. Provides:
 *   - Error kind badge + title
 *   - File/line location pill
 *   - "Send to AI" button  →  calls onSend(prompt)
 *   - "Expand trace" toggle
 *   - Dismiss × button
 *   - Settings toggle for auto-inject behaviour
 */

import type React from "react";
import { useCallback, useState } from "react";
import type { DetectedError, ErrorKind } from "./errorContextService";
import { buildErrorPrompt } from "./useErrorContext";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const KIND_LABEL: Record<ErrorKind, string> = {
	runtime: "Runtime",
	typecheck: "TypeScript",
	test: "Test",
	build: "Build",
	syntax: "Syntax",
	lint: "Lint",
	unknown: "Error",
};

const KIND_COLORS: Record<ErrorKind, { bg: string; text: string }> = {
	runtime: {
		bg: "var(--color-background-danger)",
		text: "var(--color-text-danger)",
	},
	syntax: {
		bg: "var(--color-background-danger)",
		text: "var(--color-text-danger)",
	},
	typecheck: {
		bg: "var(--color-background-warning)",
		text: "var(--color-text-warning)",
	},
	build: {
		bg: "var(--color-background-warning)",
		text: "var(--color-text-warning)",
	},
	test: { bg: "var(--color-background-info)", text: "var(--color-text-info)" },
	lint: {
		bg: "var(--color-background-secondary)",
		text: "var(--color-text-secondary)",
	},
	unknown: {
		bg: "var(--color-background-danger)",
		text: "var(--color-text-danger)",
	},
};

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ErrorContextChipProps {
	error: DetectedError;
	onSend: (prompt: string) => void;
	onDismiss: (id: string) => void;
	/** Whether the chip starts expanded (showing the trace) */
	defaultExpanded?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const ErrorContextChip: React.FC<ErrorContextChipProps> = ({
	error,
	onSend,
	onDismiss,
	defaultExpanded = false,
}) => {
	const [expanded, setExpanded] = useState(defaultExpanded);
	const colors = KIND_COLORS[error.kind];

	const handleSend = useCallback(() => {
		onSend(buildErrorPrompt(error));
	}, [error, onSend]);

	return (
		<div
			role="alert"
			aria-label={`Detected ${error.kind} error: ${error.title}`}
			style={{
				background: "var(--color-background-primary)",
				border: "0.5px solid var(--color-border-secondary)",
				borderLeft: `2px solid ${colors.text}`,
				borderRadius: "var(--border-radius-md)",
				marginBottom: "8px",
				overflow: "hidden",
				fontFamily: "var(--font-sans)",
			}}
		>
			{/* ── Header row ──────────────────────────────────────────────────── */}
			<div
				style={{
					display: "flex",
					alignItems: "center",
					gap: "8px",
					padding: "8px 10px",
				}}
			>
				{/* Kind badge */}
				<span
					style={{
						fontSize: "11px",
						fontWeight: 500,
						padding: "2px 7px",
						borderRadius: "4px",
						background: colors.bg,
						color: colors.text,
						whiteSpace: "nowrap",
						flexShrink: 0,
					}}
				>
					{KIND_LABEL[error.kind]}
				</span>

				{/* Title */}
				<span
					style={{
						fontSize: "13px",
						color: "var(--color-text-primary)",
						flex: 1,
						overflow: "hidden",
						textOverflow: "ellipsis",
						whiteSpace: "nowrap",
					}}
					title={error.title}
				>
					{error.title}
				</span>

				{/* Expand toggle */}
				<button
					onClick={() => setExpanded((v) => !v)}
					aria-label={expanded ? "Collapse trace" : "Expand trace"}
					style={{
						background: "none",
						border: "none",
						cursor: "pointer",
						padding: "2px",
						color: "var(--color-text-tertiary)",
						display: "flex",
						alignItems: "center",
						flexShrink: 0,
					}}
				>
					<svg
						width="14"
						height="14"
						viewBox="0 0 14 14"
						fill="none"
						style={{
							transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
							transition: "transform 150ms ease",
						}}
					>
						<path
							d="M3 5l4 4 4-4"
							stroke="currentColor"
							strokeWidth="1.5"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
					</svg>
				</button>

				{/* Dismiss */}
				<button
					onClick={() => onDismiss(error.id)}
					aria-label="Dismiss error"
					style={{
						background: "none",
						border: "none",
						cursor: "pointer",
						padding: "2px",
						color: "var(--color-text-tertiary)",
						display: "flex",
						alignItems: "center",
						flexShrink: 0,
					}}
				>
					<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
						<path
							d="M3.5 3.5l7 7M10.5 3.5l-7 7"
							stroke="currentColor"
							strokeWidth="1.5"
							strokeLinecap="round"
						/>
					</svg>
				</button>
			</div>

			{/* ── Location pill ────────────────────────────────────────────────── */}
			{error.file && (
				<div style={{ padding: "0 10px 6px" }}>
					<span
						style={{
							fontSize: "11px",
							fontFamily: "var(--font-mono)",
							color: "var(--color-text-secondary)",
							background: "var(--color-background-secondary)",
							padding: "1px 6px",
							borderRadius: "3px",
						}}
					>
						{error.file}
						{error.line ? `:${error.line}` : ""}
						{error.column ? `:${error.column}` : ""}
					</span>
				</div>
			)}

			{/* ── Trace (expanded) ─────────────────────────────────────────────── */}
			{expanded && (
				<div
					style={{
						borderTop: "0.5px solid var(--color-border-tertiary)",
						padding: "8px 10px",
					}}
				>
					<pre
						style={{
							margin: 0,
							fontSize: "11px",
							fontFamily: "var(--font-mono)",
							color: "var(--color-text-secondary)",
							whiteSpace: "pre-wrap",
							wordBreak: "break-all",
							maxHeight: "200px",
							overflowY: "auto",
							lineHeight: 1.5,
						}}
					>
						{error.trace}
					</pre>
				</div>
			)}

			{/* ── Action row ───────────────────────────────────────────────────── */}
			<div
				style={{
					borderTop: "0.5px solid var(--color-border-tertiary)",
					padding: "6px 10px",
					display: "flex",
					alignItems: "center",
					gap: "6px",
				}}
			>
				<button
					onClick={handleSend}
					style={{
						background: "var(--color-background-info)",
						color: "var(--color-text-info)",
						border: "none",
						borderRadius: "var(--border-radius-md)",
						padding: "4px 10px",
						fontSize: "12px",
						fontWeight: 500,
						cursor: "pointer",
						display: "flex",
						alignItems: "center",
						gap: "4px",
					}}
				>
					{/* Sparkle icon */}
					<svg
						width="12"
						height="12"
						viewBox="0 0 12 12"
						fill="none"
						aria-hidden="true"
					>
						<path
							d="M6 1v2M6 9v2M1 6h2M9 6h2M2.93 2.93l1.41 1.41M7.66 7.66l1.41 1.41M2.93 9.07l1.41-1.41M7.66 4.34l1.41-1.41"
							stroke="currentColor"
							strokeWidth="1.2"
							strokeLinecap="round"
						/>
					</svg>
					Send to AI
				</button>

				<span
					style={{
						fontSize: "11px",
						color: "var(--color-text-tertiary)",
						marginLeft: "2px",
					}}
				>
					{new Date(error.createdAt).toLocaleTimeString([], {
						hour: "2-digit",
						minute: "2-digit",
						second: "2-digit",
					})}
				</span>
			</div>
		</div>
	);
};

// ─── Error tray (list of chips) ───────────────────────────────────────────────

export interface ErrorContextTrayProps {
	errors: DetectedError[];
	onSend: (prompt: string) => void;
	onDismiss: (id: string) => void;
	onClearAll: () => void;
	enabled: boolean;
	onToggleEnabled: (v: boolean) => void;
}

export const ErrorContextTray: React.FC<ErrorContextTrayProps> = ({
	errors,
	onSend,
	onDismiss,
	onClearAll,
	enabled,
	onToggleEnabled,
}) => {
	if (!enabled && errors.length === 0) return null;

	return (
		<div
			aria-live="polite"
			aria-label="Detected errors"
			style={{
				padding: "8px",
			}}
		>
			{/* Tray header */}
			<div
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					marginBottom: errors.length > 0 ? "8px" : "0",
				}}
			>
				<div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
					<span
						style={{
							fontSize: "12px",
							fontWeight: 500,
							color: "var(--color-text-secondary)",
						}}
					>
						Terminal errors
					</span>
					{errors.length > 0 && (
						<span
							style={{
								fontSize: "11px",
								background: "var(--color-background-danger)",
								color: "var(--color-text-danger)",
								borderRadius: "8px",
								padding: "1px 6px",
								fontWeight: 500,
							}}
						>
							{errors.length}
						</span>
					)}
				</div>

				<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
					{errors.length > 1 && (
						<button
							onClick={onClearAll}
							style={{
								background: "none",
								border: "none",
								fontSize: "11px",
								color: "var(--color-text-tertiary)",
								cursor: "pointer",
								padding: "2px 4px",
							}}
						>
							Clear all
						</button>
					)}

					{/* Auto-inject toggle */}
					<label
						style={{
							display: "flex",
							alignItems: "center",
							gap: "4px",
							cursor: "pointer",
							fontSize: "11px",
							color: "var(--color-text-secondary)",
							userSelect: "none",
						}}
					>
						<span>Auto</span>
						<input
							type="checkbox"
							checked={enabled}
							onChange={(e) => onToggleEnabled(e.target.checked)}
							style={{ cursor: "pointer", width: "14px", height: "14px" }}
							aria-label="Auto-send terminal errors to AI"
						/>
					</label>
				</div>
			</div>

			{/* Chips */}
			{errors.map((err, i) => (
				<ErrorContextChip
					key={err.id}
					error={err}
					onSend={onSend}
					onDismiss={onDismiss}
					defaultExpanded={i === 0}
				/>
			))}
		</div>
	);
};
