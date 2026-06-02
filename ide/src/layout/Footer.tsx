import { Terminal } from "lucide-react";
import { useEffect, useState } from "react";
import { DebtRadar } from "../components/DebtRadar";
import { useIDEStore } from "../stores/useIDEStore";

export const Footer = () => {
	const [uptime, setUptime] = useState(99.999);
	const {
		toggleBottomPanel,
		setBottomPanelActive,
		bottomPanelOpen,
		bottomPanelActive,
	} = useIDEStore();

	useEffect(() => {
		const i = setInterval(() => {
			setUptime((prev) => {
				const delta = Math.random() * 0.002 - 0.001;
				return Math.min(100, Math.max(99.98, prev + delta));
			});
		}, 10000);
		return () => clearInterval(i);
	}, []);

	const handleTerminal = () => {
		if (bottomPanelOpen && bottomPanelActive === "terminal") {
			toggleBottomPanel();
		} else {
			setBottomPanelActive("terminal");
		}
	};

	return (
		<footer
			className="h-10 px-4 border-t border-[#21262d] bg-[#161b22] flex items-center justify-between text-[#7d8590] font-mono text-[10px] relative z-20"
			role="contentinfo"
			aria-label="System status"
		>
			<div className="flex items-center gap-4">
				<div className="flex items-center gap-1.5">
					<div className="w-1.5 h-1.5 rounded-full bg-[#3fb950] animate-pulse" />
					<span>UPTIME: {uptime.toFixed(3)}%</span>
				</div>
				<span className="text-[#484f58]">VibeServe</span>
			</div>

			<div className="flex items-center gap-4">
				<DebtRadar />
				<button
					onClick={handleTerminal}
					className={`flex items-center gap-1.5 px-2 py-1 rounded transition-colors text-[10px] ${
						bottomPanelOpen && bottomPanelActive === "terminal"
							? "bg-[#1f6feb]/10 text-[#58a6ff]"
							: "text-[#484f58] hover:text-[#c9d1d9] hover:bg-[#21262d]"
					}`}
					title="Toggle terminal (Ctrl+`)"
				>
					<Terminal size={12} />
					<span className="hidden sm:inline">Terminal</span>
					<kbd className="hidden md:inline text-[8px] px-1 py-0.5 bg-[#0d1117] border border-[#30363d] rounded">
						Ctrl+`
					</kbd>
				</button>
			</div>
		</footer>
	);
};
