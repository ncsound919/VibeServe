/**
 * ToolResult — renders the response of a VibeServe MCP tool call.
 *
 * The Python side returns a JSON envelope of the form
 *   { tool, result, ts }                  on success
 *   { tool, error }                       on failure
 *
 * `result` is the raw MCP content array. For most tools it contains a
 * single `text` item whose `text` is itself JSON. We decode that, sniff
 * the shape, and render with the most appropriate component.
 */

import { useMemo, useState } from "react";
import { Icons } from "./icons";

type ResultKind =
	| "text"
	| "markdown"
	| "json"
	| "table"
	| "log"
	| "image"
	| "video"
	| "code";

interface ToolResultProps {
	result: unknown;
	kind?: ResultKind;
	loading?: boolean;
	error?: string | null;
	onReconnect?: () => void;
}

function decodeResultEnvelope(envelope: unknown): {
	payload: unknown;
	raw: string;
	errorText: string | null;
} {
	if (envelope === null || envelope === undefined) {
		return { payload: null, raw: "", errorText: "No result returned" };
	}
	if (typeof envelope === "string") {
		try {
			return decodeResultEnvelope(JSON.parse(envelope));
		} catch {
			return { payload: envelope, raw: envelope, errorText: null };
		}
	}
	if (typeof envelope !== "object") {
		return {
			payload: envelope,
			raw: JSON.stringify(envelope, null, 2),
			errorText: null,
		};
	}
	const e = envelope as Record<string, unknown>;
	if (e.error) {
		return {
			payload: null,
			raw: JSON.stringify(e, null, 2),
			errorText: String(e.error),
		};
	}
	// MCP callTool result: { content: [{ type, text }] }
	if (Array.isArray(e.content) && (e.content as unknown[]).length > 0) {
		const first = (e.content as Array<Record<string, unknown>>)[0];
		if (first && typeof first.text === "string") {
			const text = first.text;
			try {
				const parsed = JSON.parse(text);
				if (parsed && typeof parsed === "object" && "error" in parsed) {
					return {
						payload: null,
						raw: text,
						errorText: String((parsed as any).error),
					};
				}
				return { payload: parsed, raw: text, errorText: null };
			} catch {
				return { payload: text, raw: text, errorText: null };
			}
		}
		if (first && first.type === "image" && typeof first.data === "string") {
			return {
				payload: {
					__image: first.data,
					mime: (first.mimeType as string) || "image/png",
				},
				raw: "[image]",
				errorText: null,
			};
		}
	}
	// Already decoded (backend /api/pipeline/mcp/tools/call returns { tool, result, ts })
	if ("result" in e) {
		return decodeResultEnvelope(e.result);
	}
	return { payload: e, raw: JSON.stringify(e, null, 2), errorText: null };
}

function isArrayOfObjects(v: unknown): v is Record<string, unknown>[] {
	return (
		Array.isArray(v) &&
		v.length > 0 &&
		typeof v[0] === "object" &&
		v[0] !== null
	);
}

function inferKind(payload: unknown, hint?: ResultKind): ResultKind {
	if (hint) return hint;
	if (Array.isArray(payload) && isArrayOfObjects(payload)) return "table";
	if (typeof payload === "string") return "text";
	if (payload && typeof payload === "object") return "json";
	return "text";
}

export function ToolResult({
	result,
	kind,
	loading,
	error,
	onReconnect,
}: ToolResultProps) {
	const [copied, setCopied] = useState(false);

	if (loading) {
		return (
			<div
				className="flex items-center gap-2 px-3 py-2 text-xs"
				style={{ color: "var(--text-muted)" }}
			>
				<span
					className="inline-block w-3 h-3 rounded-full animate-pulse"
					style={{ background: "var(--accent)" }}
				/>
				Invoking tool…
			</div>
		);
	}

	if (error) {
		return (
			<div
				className="m-3 p-3 rounded border text-xs"
				style={{
					borderColor: "var(--error, #f38ba8)",
					backgroundColor: "rgba(243, 139, 168, 0.08)",
					color: "var(--error, #f38ba8)",
				}}
			>
				<div className="font-semibold mb-1">Tool invocation failed</div>
				<div className="opacity-90">{error}</div>
				{onReconnect && (
					<button
						onClick={onReconnect}
						className="mt-2 text-xxs underline opacity-80 hover:opacity-100"
					>
						Retry connection
					</button>
				)}
			</div>
		);
	}

	if (result === undefined || result === null) {
		return (
			<div
				className="px-3 py-2 text-xxs"
				style={{ color: "var(--text-muted)" }}
			>
				(no result)
			</div>
		);
	}

	const { payload, raw, errorText } = decodeResultEnvelope(result);

	if (errorText) {
		return (
			<div
				className="m-3 p-3 rounded border text-xs"
				style={{
					borderColor: "var(--error, #f38ba8)",
					backgroundColor: "rgba(243, 139, 168, 0.08)",
					color: "var(--error, #f38ba8)",
				}}
			>
				<div className="font-semibold mb-1">Tool returned an error</div>
				<div className="opacity-90">{errorText}</div>
			</div>
		);
	}

	const inferred = inferKind(payload, kind);
	const prettyRaw = useMemo(() => {
		if (typeof payload === "string") return payload;
		return JSON.stringify(payload, null, 2);
	}, [payload]);

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(prettyRaw);
			setCopied(true);
			setTimeout(() => setCopied(false), 1500);
		} catch {
			/* noop */
		}
	};

	return (
		<div className="flex flex-col h-full overflow-hidden">
			<div
				className="flex items-center justify-between px-3 py-1.5 border-b"
				style={{ borderColor: "var(--border)" }}
			>
				<span
					className="text-xxs uppercase tracking-wider"
					style={{ color: "var(--text-muted)" }}
				>
					Result · {inferred}
				</span>
				<button
					onClick={handleCopy}
					className="flex items-center gap-1 text-xxs opacity-70 hover:opacity-100"
					style={{ color: "var(--text-muted)" }}
				>
					<Icons.Copy />
					{copied ? "Copied" : "Copy"}
				</button>
			</div>
			<div className="flex-1 overflow-auto p-3 text-xs">
				{inferred === "table" && isArrayOfObjects(payload) ? (
					<ResultTable rows={payload} />
				) : inferred === "image" &&
					payload &&
					typeof payload === "object" &&
					(payload as any).__image ? (
					<img
						src={`data:${(payload as any).mime};base64,${(payload as any).__image}`}
						alt="tool result"
						className="max-w-full rounded border"
						style={{ borderColor: "var(--border)" }}
					/>
				) : inferred === "code" ? (
					<pre
						className="font-mono text-xs whitespace-pre-wrap"
						style={{ color: "var(--text-primary)" }}
					>
						{prettyRaw}
					</pre>
				) : (
					<pre
						className="font-mono text-xs whitespace-pre-wrap"
						style={{ color: "var(--text-primary)" }}
					>
						{prettyRaw}
					</pre>
				)}
			</div>
		</div>
	);
}

function ResultTable({ rows }: { rows: Record<string, unknown>[] }) {
	const keys = useMemo(() => {
		const set = new Set<string>();
		rows.slice(0, 20).forEach((r) => Object.keys(r).forEach((k) => set.add(k)));
		return Array.from(set).slice(0, 8);
	}, [rows]);

	return (
		<div className="overflow-x-auto">
			<table className="text-xxs" style={{ borderCollapse: "collapse" }}>
				<thead>
					<tr>
						{keys.map((k) => (
							<th
								key={k}
								className="text-left px-2 py-1 border-b font-semibold"
								style={{
									color: "var(--text-muted)",
									borderColor: "var(--border)",
								}}
							>
								{k}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{rows.slice(0, 100).map((row, i) => (
						<tr key={i} className="hover:bg-white/5">
							{keys.map((k) => (
								<td
									key={k}
									className="px-2 py-1 border-b align-top"
									style={{
										borderColor: "var(--border)",
										color: "var(--text-primary)",
									}}
								>
									{formatCell(row[k])}
								</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
			{rows.length > 100 && (
				<div
					className="text-xxs mt-2 opacity-60"
					style={{ color: "var(--text-muted)" }}
				>
					Showing first 100 of {rows.length} rows
				</div>
			)}
		</div>
	);
}

function formatCell(value: unknown): string {
	if (value === null || value === undefined) return "—";
	if (typeof value === "string")
		return value.length > 80 ? value.slice(0, 77) + "…" : value;
	if (typeof value === "number" || typeof value === "boolean")
		return String(value);
	if (Array.isArray(value)) return `[${value.length}]`;
	if (typeof value === "object") return "{…}";
	return String(value);
}
