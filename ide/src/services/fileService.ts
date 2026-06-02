const API_BASE = "/api/files";

export interface FileEntry {
	name: string;
	path: string;
	type: "file" | "directory";
	size?: number;
	modified?: string;
}

export const fileService = {
	async listDir(dirPath: string): Promise<FileEntry[]> {
		const res = await fetch(
			`${API_BASE}/list?path=${encodeURIComponent(dirPath)}`,
		);
		if (!res.ok) throw new Error(`Failed to list ${dirPath}`);
		return res.json();
	},
	async readFile(filePath: string): Promise<string> {
		const res = await fetch(
			`${API_BASE}/read?path=${encodeURIComponent(filePath)}`,
		);
		if (!res.ok) throw new Error(`Failed to read ${filePath}`);
		return res.text();
	},
	async createFile(path: string, content: string): Promise<void> {
		await fetch(`${API_BASE}/create`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ path, content }),
		});
	},
	async deleteFile(path: string): Promise<void> {
		await fetch(`${API_BASE}/delete`, {
			method: "DELETE",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ path }),
		});
	},
	async rename(oldPath: string, newPath: string): Promise<void> {
		await fetch(`${API_BASE}/rename`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ oldPath, newPath }),
		});
	},
};
