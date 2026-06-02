import { create } from "zustand";

export type ToastType = "info" | "success" | "warning" | "error";

export interface Toast {
	id: string;
	type: ToastType;
	title?: string;
	message?: string;
	description?: string;
	actions?: { label: string; onClick: () => void }[];
	duration?: number;
}

interface ToastState {
	toasts: Toast[];
	addToast: (toast: Omit<Toast, "id">) => string;
	dismissToast: (id: string) => void;
	clearAll: () => void;
}

let toastId = 0;

export const useToastStore = create<ToastState>((set) => ({
	toasts: [],
	addToast: (toast) => {
		const id = `toast-${++toastId}`;
		set((s) => ({ toasts: [...s.toasts, { ...toast, id }] }));

		const duration =
			toast.duration ??
			(toast.type === "info"
				? 4000
				: toast.type === "success"
					? 6000
					: undefined);
		if (duration) {
			setTimeout(() => {
				set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
			}, duration);
		}
		return id;
	},
	dismissToast: (id) =>
		set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
	clearAll: () => set({ toasts: [] }),
}));
