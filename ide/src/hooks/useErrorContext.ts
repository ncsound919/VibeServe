/**
 * useErrorContext
 *
 * React hook that subscribes to ErrorContextService and keeps local state
 * in sync. Designed to work alongside any Zustand chat store.
 *
 * Usage:
 *   const { errors, latestError, dismiss, clearAll, enabled, setEnabled } = useErrorContext();
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { type DetectedError, ErrorContextService } from "./errorContextService";

export interface UseErrorContextReturn {
	/** All non-dismissed errors in the session queue */
	errors: DetectedError[];
	/** The most recently detected error (nil if none) */
	latestError: DetectedError | null;
	/** Count of active (non-dismissed) errors */
	activeCount: number;
	dismiss: (id: string) => void;
	clearAll: () => void;
	enabled: boolean;
	setEnabled: (v: boolean) => void;
}

export function useErrorContext(): UseErrorContextReturn {
	const svc = ErrorContextService.getInstance();
	const [errors, setErrors] = useState<DetectedError[]>(() => svc.getQueue());
	const [enabled, setEnabledState] = useState(() => svc.isEnabled());
	const latestRef = useRef<DetectedError | null>(null);

	useEffect(() => {
		// Subscribe to new errors
		const unsub = svc.onError((err) => {
			latestRef.current = err;
			setErrors(svc.getQueue());
		});
		return unsub;
	}, [svc]);

	const dismiss = useCallback(
		(id: string) => {
			svc.dismissError(id);
			setErrors([...svc.getQueue()]);
		},
		[svc],
	);

	const clearAll = useCallback(() => {
		svc.clearAll();
		setErrors([]);
		latestRef.current = null;
	}, [svc]);

	const setEnabled = useCallback(
		(v: boolean) => {
			svc.setEnabled(v);
			setEnabledState(v);
		},
		[svc],
	);

	const activeErrors = errors.filter((e) => !e.dismissed);

	return {
		errors: activeErrors,
		latestError: latestRef.current,
		activeCount: activeErrors.length,
		dismiss,
		clearAll,
		enabled,
		setEnabled,
	};
}

// ─── Utility: build a compact chat prompt from a DetectedError ────────────────

export function buildErrorPrompt(err: DetectedError): string {
	const parts: string[] = [`**Detected ${err.kind} error** — ${err.title}`, ""];

	if (err.file) {
		const loc = [err.file, err.line, err.column].filter(Boolean).join(":");
		parts.push(`📍 \`${loc}\``);
		parts.push("");
	}

	parts.push("```");
	parts.push(err.trace);
	parts.push("```");
	parts.push("");
	parts.push("What is causing this error and how do I fix it?");

	return parts.join("\n");
}
