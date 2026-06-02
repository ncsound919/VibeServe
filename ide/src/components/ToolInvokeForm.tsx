/**
 * ToolInvokeForm — auto-generates a form from a VibeServe ToolEntry.
 *
 * Supports:
 *   string, number, boolean, enum    -> <input> / <select> / <textarea>
 *   array (of strings)               -> one-per-line textarea
 *   object                           -> JSON textarea (advanced)
 *
 * The form is *purely controlled*; the parent owns the args state so the
 * parent can also render the raw JSON preview and re-use the values for
 * re-invocation.
 */

import { useState } from "react";
import type { ToolArg, ToolEntry } from "../server/toolCatalog";

interface ToolInvokeFormProps {
	tool: ToolEntry;
	value: Record<string, unknown>;
	onChange: (next: Record<string, unknown>) => void;
	disabled?: boolean;
}

export function ToolInvokeForm({
	tool,
	value,
	onChange,
	disabled,
}: ToolInvokeFormProps) {
	const set = (k: string, v: unknown) => onChange({ ...value, [k]: v });

	return (
		<div className="flex flex-col gap-3 p-3">
			{tool.args.length === 0 && (
				<div className="text-xxs" style={{ color: "var(--text-muted)" }}>
					This tool takes no arguments. Click <em>Run</em> to invoke it.
				</div>
			)}
			{tool.args.map((arg) => (
				<ArgInput
					key={arg.name}
					arg={arg}
					value={value[arg.name]}
					onChange={(v) => set(arg.name, v)}
					disabled={disabled}
				/>
			))}
		</div>
	);
}

function ArgInput({
	arg,
	value,
	onChange,
	disabled,
}: {
	arg: ToolArg;
	value: unknown;
	onChange: (v: unknown) => void;
	disabled?: boolean;
}) {
	const [rawJson, setRawJson] = useState<string | null>(null);

	if (arg.kind === "boolean") {
		return (
			<label className="flex items-center gap-2 text-xs">
				<input
					type="checkbox"
					checked={Boolean(value)}
					onChange={(e) => onChange(e.target.checked)}
					disabled={disabled}
				/>
				<span style={{ color: "var(--text-primary)" }}>{arg.name}</span>
				{arg.description && (
					<span
						className="text-xxs opacity-60"
						style={{ color: "var(--text-muted)" }}
					>
						— {arg.description}
					</span>
				)}
			</label>
		);
	}

	if (arg.kind === "enum" && arg.enumValues) {
		return (
			<div className="flex flex-col gap-1">
				<label
					className="text-xs flex items-center gap-1"
					style={{ color: "var(--text-primary)" }}
				>
					{arg.name}
					{arg.required && (
						<span style={{ color: "var(--error, #f38ba8)" }}>*</span>
					)}
					{arg.description && (
						<span
							className="text-xxs opacity-60"
							style={{ color: "var(--text-muted)" }}
						>
							— {arg.description}
						</span>
					)}
				</label>
				<select
					value={(value as string) ?? ""}
					onChange={(e) => onChange(e.target.value)}
					disabled={disabled}
					className="text-xs px-2 py-1 rounded border"
					style={{
						background: "var(--bg-primary)",
						color: "var(--text-primary)",
						borderColor: "var(--border)",
					}}
				>
					<option value="">(none)</option>
					{arg.enumValues.map((v) => (
						<option key={v} value={v}>
							{v}
						</option>
					))}
				</select>
			</div>
		);
	}

	if (arg.kind === "number") {
		return (
			<div className="flex flex-col gap-1">
				<label
					className="text-xs flex items-center gap-1"
					style={{ color: "var(--text-primary)" }}
				>
					{arg.name}
					{arg.required && (
						<span style={{ color: "var(--error, #f38ba8)" }}>*</span>
					)}
					{arg.description && (
						<span
							className="text-xxs opacity-60"
							style={{ color: "var(--text-muted)" }}
						>
							— {arg.description}
						</span>
					)}
				</label>
				<input
					type="number"
					value={(value as number | undefined) ?? ""}
					onChange={(e) =>
						onChange(e.target.value === "" ? undefined : Number(e.target.value))
					}
					disabled={disabled}
					className="text-xs px-2 py-1 rounded border"
					style={{
						background: "var(--bg-primary)",
						color: "var(--text-primary)",
						borderColor: "var(--border)",
					}}
				/>
			</div>
		);
	}

	if (arg.kind === "array" && arg.itemKind === "string") {
		return (
			<div className="flex flex-col gap-1">
				<label
					className="text-xs flex items-center gap-1"
					style={{ color: "var(--text-primary)" }}
				>
					{arg.name}
					{arg.required && (
						<span style={{ color: "var(--error, #f38ba8)" }}>*</span>
					)}
					{arg.description && (
						<span
							className="text-xxs opacity-60"
							style={{ color: "var(--text-muted)" }}
						>
							— {arg.description}
						</span>
					)}
				</label>
				<textarea
					rows={3}
					value={
						Array.isArray(value)
							? (value as string[]).join("\n")
							: ((value as string) ?? "")
					}
					onChange={(e) =>
						onChange(
							e.target.value
								.split("\n")
								.map((s) => s.trim())
								.filter(Boolean),
						)
					}
					disabled={disabled}
					placeholder="one per line"
					className="text-xs px-2 py-1 rounded border font-mono"
					style={{
						background: "var(--bg-primary)",
						color: "var(--text-primary)",
						borderColor: "var(--border)",
					}}
				/>
			</div>
		);
	}

	if (arg.kind === "object" || arg.kind === "array") {
		return (
			<div className="flex flex-col gap-1">
				<label
					className="text-xs flex items-center gap-1"
					style={{ color: "var(--text-primary)" }}
				>
					{arg.name}
					{arg.required && (
						<span style={{ color: "var(--error, #f38ba8)" }}>*</span>
					)}
					{arg.description && (
						<span
							className="text-xxs opacity-60"
							style={{ color: "var(--text-muted)" }}
						>
							— {arg.description}
						</span>
					)}
				</label>
				<textarea
					rows={5}
					value={
						rawJson ??
						(value !== undefined ? JSON.stringify(value, null, 2) : "")
					}
					onChange={(e) => {
						setRawJson(e.target.value);
						try {
							onChange(
								e.target.value.trim() === ""
									? undefined
									: JSON.parse(e.target.value),
							);
						} catch {
							/* leave as raw text until valid */
						}
					}}
					disabled={disabled}
					placeholder="{ }"
					className="text-xs px-2 py-1 rounded border font-mono"
					style={{
						background: "var(--bg-primary)",
						color: "var(--text-primary)",
						borderColor: "var(--border)",
					}}
				/>
			</div>
		);
	}

	// string (default)
	const isLong =
		(arg.description?.length || 0) > 80 ||
		(typeof value === "string" && value.length > 60);
	return (
		<div className="flex flex-col gap-1">
			<label
				className="text-xs flex items-center gap-1"
				style={{ color: "var(--text-primary)" }}
			>
				{arg.name}
				{arg.required && (
					<span style={{ color: "var(--error, #f38ba8)" }}>*</span>
				)}
				{arg.description && (
					<span
						className="text-xxs opacity-60"
						style={{ color: "var(--text-muted)" }}
					>
						— {arg.description}
					</span>
				)}
			</label>
			{isLong ? (
				<textarea
					rows={3}
					value={(value as string) ?? ""}
					onChange={(e) => onChange(e.target.value)}
					disabled={disabled}
					className="text-xs px-2 py-1 rounded border font-mono"
					style={{
						background: "var(--bg-primary)",
						color: "var(--text-primary)",
						borderColor: "var(--border)",
					}}
				/>
			) : (
				<input
					type="text"
					value={(value as string) ?? ""}
					onChange={(e) => onChange(e.target.value)}
					disabled={disabled}
					className="text-xs px-2 py-1 rounded border"
					style={{
						background: "var(--bg-primary)",
						color: "var(--text-primary)",
						borderColor: "var(--border)",
					}}
				/>
			)}
		</div>
	);
}
