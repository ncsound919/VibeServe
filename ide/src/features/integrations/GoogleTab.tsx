import { useEffect, useState } from "react";
import { useToastStore } from "../../stores/useToastStore";

export function GoogleTab() {
	const [isConnected, setIsConnected] = useState(
		() => localStorage.getItem("vibeserve-google-connected") === "true",
	);
	const [activeSection, setActiveSection] = useState<
		"drive" | "calendar" | "gmail"
	>("drive");
	const [driveFiles, setDriveFiles] = useState<
		{ name: string; id: string; mimeType: string }[]
	>([]);
	const [checkingConnection, setCheckingConnection] = useState(false);
	const { addToast } = useToastStore();

	useEffect(() => {
		localStorage.setItem("vibeserve-google-connected", String(isConnected));
	}, [isConnected]);

	const checkConnection = async () => {
		setCheckingConnection(true);
		try {
			const res = await fetch("/api/google/status");
			if (res.ok) {
				const data = await res.json();
				setIsConnected(data.connected);
				addToast({
					type: data.connected ? "success" : "info",
					message: data.connected
						? "Google account connected"
						: "Not connected to Google",
				});
			}
		} catch {
			addToast({
				type: "error",
				message:
					"Backend not running. OAuth callback requires a running backend.",
			});
		} finally {
			setCheckingConnection(false);
		}
	};

	const connectGoogle = async () => {
		try {
			const res = await fetch("/api/google/auth-url");
			if (res.ok) {
				const { url } = await res.json();
				window.open(url, "_blank");
				addToast({
					type: "info",
					message:
						"Opening Google OAuth flow... Make sure the backend is running to handle the callback.",
				});
			}
		} catch {
			addToast({
				type: "error",
				message:
					"Failed to get Google auth URL. Ensure the backend server is running.",
			});
		}
	};

	return (
		<div className="p-3 space-y-3 text-xs">
			<div className="flex gap-1">
				{(["drive", "calendar", "gmail"] as const).map((s) => (
					<button
						key={s}
						onClick={() => setActiveSection(s)}
						className="flex-1 py-1 rounded text-[10px] capitalize"
						style={{
							background:
								activeSection === s ? "var(--accent)" : "var(--bg-tertiary)",
							color:
								activeSection === s
									? "var(--text-on-accent)"
									: "var(--text-muted)",
						}}
					>
						{s}
					</button>
				))}
			</div>

			<div className="space-y-2">
				<div className="text-[10px]" style={{ color: "var(--text-warning)" }}>
					Note: OAuth callback requires a running backend server.
				</div>
				<button
					onClick={checkConnection}
					disabled={checkingConnection}
					className="w-full py-1.5 rounded font-medium text-xs disabled:opacity-50"
					style={{
						background: "var(--bg-tertiary)",
						color: "var(--text-primary)",
					}}
				>
					{checkingConnection ? "Checking..." : "Check Connection"}
				</button>
			</div>

			{!isConnected && (
				<div className="space-y-2">
					<div style={{ color: "var(--text-secondary)" }}>
						Connect your Google account to access Drive, Calendar, and Gmail.
					</div>
					<button
						onClick={connectGoogle}
						className="w-full py-1.5 rounded font-medium"
						style={{
							background: "var(--accent)",
							color: "var(--text-on-accent)",
						}}
					>
						Connect Google Account
					</button>
					<div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
						Requires Google Cloud Console project with Drive, Calendar, and
						Gmail APIs enabled.
					</div>
				</div>
			)}

			{isConnected && (
				<>
					{activeSection === "drive" && (
						<div className="space-y-1">
							{driveFiles.length === 0 ? (
								<div style={{ color: "var(--text-muted)" }}>
									No files loaded. Connect and refresh.
								</div>
							) : (
								driveFiles.map((f) => (
									<div key={f.id} className="flex items-center gap-2 py-1">
										<span>
											{f.mimeType.includes("folder")
												? "\uD83D\uDCC1"
												: "\uD83D\uDCC4"}
										</span>
										<span>{f.name}</span>
									</div>
								))
							)}
						</div>
					)}
					{activeSection === "calendar" && (
						<div style={{ color: "var(--text-muted)" }}>
							Calendar events will appear here after OAuth connection.
						</div>
					)}
					{activeSection === "gmail" && (
						<div style={{ color: "var(--text-muted)" }}>
							Gmail integration available after OAuth connection.
						</div>
					)}
				</>
			)}
		</div>
	);
}
