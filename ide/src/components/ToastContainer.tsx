import { useToastStore } from "../stores/useToastStore";

export function ToastContainer() {
	const { toasts, removeToast } = useToastStore();
	if (toasts.length === 0) return null;

	const colors = {
		info: "var(--info)",
		success: "var(--success)",
		warning: "var(--warning)",
		error: "var(--error)",
	} as const;

	return (
		<div className="fixed bottom-10 right-4 z-[100] flex flex-col gap-2">
			{toasts.map((t) => (
				<div
					key={t.id}
					className="flex items-center gap-2 px-4 py-2 rounded-md shadow-lg text-xs cursor-pointer"
					style={{
						background: "var(--bg-surface)",
						color: "var(--text-primary)",
						border: "1px solid var(--border)",
						borderLeft: `3px solid ${colors[t.type]}`,
					}}
					onClick={() => removeToast(t.id)}
				>
					<div
						className="w-2 h-2 rounded-full shrink-0"
						style={{ background: colors[t.type] }}
					/>
					<span>{t.message}</span>
				</div>
			))}
		</div>
	);
}
