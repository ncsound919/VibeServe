import { useState } from "react";
import { GiteaTab } from "../features/integrations/GiteaTab";
import { GitHubTab } from "../features/integrations/GitHubTab";
import { GoogleTab } from "../features/integrations/GoogleTab";
import { VaultTab } from "../features/integrations/VaultTab";

const TABS = [
	{ id: "github" as const, label: "GitHub" },
	{ id: "vault" as const, label: "Vault" },
	{ id: "google" as const, label: "Google" },
	{ id: "gitea" as const, label: "Gitea" },
];

export function IntegrationsPanel() {
	const [activeTab, setActiveTab] =
		useState<(typeof TABS)[number]["id"]>("github");

	return (
		<div className="flex flex-col h-full">
			<div
				className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider"
				style={{ color: "var(--text-muted)" }}
			>
				Integrations
			</div>
			<div
				className="flex gap-1 px-3 py-1"
				style={{ borderBottom: "1px solid var(--border)" }}
			>
				{TABS.map((tab) => (
					<button
						key={tab.id}
						onClick={() => setActiveTab(tab.id)}
						className="text-[10px] px-2 py-0.5 rounded"
						style={{
							background:
								activeTab === tab.id ? "var(--accent)" : "var(--bg-tertiary)",
							color:
								activeTab === tab.id
									? "var(--text-on-accent)"
									: "var(--text-muted)",
						}}
					>
						{tab.label}
					</button>
				))}
			</div>
			<div className="flex-1 overflow-y-auto">
				{activeTab === "github" && <GitHubTab />}
				{activeTab === "vault" && <VaultTab />}
				{activeTab === "google" && <GoogleTab />}
				{activeTab === "gitea" && <GiteaTab />}
			</div>
		</div>
	);
}
