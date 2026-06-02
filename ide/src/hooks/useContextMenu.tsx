import { type MouseEvent, useCallback, useState } from "react";

interface MenuItem {
	label: string;
	action: () => void;
}

export function useContextMenu(items: MenuItem[]) {
	const [position, setPosition] = useState<{ x: number; y: number } | null>(
		null,
	);

	const onContextMenu = useCallback((e: MouseEvent) => {
		e.preventDefault();
		setPosition({ x: e.clientX, y: e.clientY });
	}, []);

	const close = useCallback(() => setPosition(null), []);

	const menu = position && (
		<div
			className="fixed z-50 min-w-[160px] rounded-md shadow-lg py-1"
			style={{
				left: position.x,
				top: position.y,
				background: "var(--bg-surface)",
				border: "1px solid var(--border)",
				color: "var(--text-primary)",
			}}
			onClick={close}
		>
			{items.map((item, i) => (
				<div key={i}>
					{item.label === "---" ? (
						<div
							className="my-1 mx-2"
							style={{ borderTop: "1px solid var(--border)" }}
						/>
					) : (
						<button
							className="w-full text-left px-3 py-1.5 text-xs hover:opacity-80 transition-colors"
							style={{ background: "transparent" }}
							onClick={() => {
								item.action();
								close();
							}}
						>
							{item.label}
						</button>
					)}
				</div>
			))}
		</div>
	);

	return { menu, onContextMenu, close };
}
