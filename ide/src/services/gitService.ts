import fs from "fs";
import * as git from "isomorphic-git";
import http from "isomorphic-git/http/node";
import path from "path";

const WORKSPACE_ROOT = process.cwd();

export interface GitStatus {
	path: string;
	status:
		| "modified"
		| "deleted"
		| "added"
		| "untracked"
		| "renamed"
		| "unmodified";
	oldPath?: string;
}

export interface GitCommit {
	oid: string;
	message: string;
	author: string;
	timestamp: number;
}

export const gitService = {
	dir: WORKSPACE_ROOT,

	async isRepo(): Promise<boolean> {
		try {
			const root = await git.findRoot({ fs, filepath: WORKSPACE_ROOT });
			return !!root;
		} catch {
			return false;
		}
	},

	async status(): Promise<GitStatus[]> {
		const statusMatrix = await git.statusMatrix({ fs, dir: WORKSPACE_ROOT });
		const statuses: GitStatus[] = [];
		for (const [filepath, HEAD, WORKDIR, STAGE] of statusMatrix) {
			const s = await mapStatus(HEAD, WORKDIR, STAGE);
			if (s !== "unmodified") {
				statuses.push({ path: filepath, status: s });
			}
		}
		return statuses;
	},

	async addFiles(files: string[]): Promise<void> {
		for (const file of files) {
			await git.add({ fs, dir: WORKSPACE_ROOT, filepath: file });
		}
	},

	async commit(message: string): Promise<string> {
		const sha = await git.commit({
			fs,
			dir: WORKSPACE_ROOT,
			message,
			author: { name: "VibeServe", email: "vibeserve@local" },
		});
		return sha;
	},

	async push(): Promise<void> {
		await git.push({
			fs,
			http,
			dir: WORKSPACE_ROOT,
			onAuth: () => ({ username: "token" }),
		});
	},

	async pull(): Promise<void> {
		await git.pull({
			fs,
			http,
			dir: WORKSPACE_ROOT,
			author: { name: "VibeServe", email: "vibeserve@local" },
			onAuth: () => ({ username: "token" }),
		});
	},

	async log(depth = 20): Promise<GitCommit[]> {
		const commits = await git.log({ fs, dir: WORKSPACE_ROOT, depth });
		return commits.map((c) => ({
			oid: c.oid.slice(0, 7),
			message: c.commit.message,
			author: c.commit.author.name,
			timestamp: c.commit.author.timestamp * 1000,
		}));
	},

	async getBranches(): Promise<string[]> {
		return await git.listBranches({ fs, dir: WORKSPACE_ROOT });
	},

	async currentBranch(): Promise<string> {
		const branch = await git.currentBranch({
			fs,
			dir: WORKSPACE_ROOT,
			fullname: false,
		});
		return branch ?? "HEAD";
	},

	async createBranch(name: string): Promise<void> {
		await git.branch({ fs, dir: WORKSPACE_ROOT, ref: name });
	},

	async checkout(ref: string): Promise<void> {
		await git.checkout({ fs, dir: WORKSPACE_ROOT, ref });
	},

	async diff(oldRef?: string, newRef?: string): Promise<string> {
		if (oldRef) {
			return await diffRefs(oldRef, newRef);
		}
		const matrix = await git.statusMatrix({ fs, dir: WORKSPACE_ROOT });
		const lines: string[] = [];
		for (const [filepath, HEAD, WORKDIR, STAGE] of matrix) {
			const s = await mapStatus(HEAD, WORKDIR, STAGE);
			if (s === "unmodified") continue;
			const fullPath = path.resolve(WORKSPACE_ROOT, filepath);
			if (s === "modified") {
				let oldContent = "";
				try {
					const b = await git.readBlob({
						fs,
						dir: WORKSPACE_ROOT,
						oid: await resolveHeadOid(filepath),
					});
					oldContent = Buffer.from(b.blob).toString("utf8");
				} catch {}
				let newContent = "";
				try {
					newContent = fs.readFileSync(fullPath, "utf8");
				} catch {}
				lines.push(...generateUnifiedDiff(filepath, oldContent, newContent));
			} else {
				lines.push(`${s.toUpperCase()} ${filepath}`);
			}
		}
		return lines.join("\n");
	},

	async clone(url: string, targetDir: string): Promise<void> {
		await git.clone({
			fs,
			http,
			dir: targetDir,
			url,
			singleBranch: true,
			depth: 1,
		});
	},

	async init(): Promise<void> {
		await git.init({ fs, dir: WORKSPACE_ROOT });
	},
};

async function resolveHeadOid(filepath: string): Promise<string> {
	const headOid = await git.resolveRef({
		fs,
		dir: WORKSPACE_ROOT,
		ref: "HEAD",
	});
	const { tree } = await git.readTree({
		fs,
		dir: WORKSPACE_ROOT,
		oid: headOid,
	});
	for (const entry of tree) {
		if (entry.path === filepath) return entry.oid;
	}
	throw new Error(`File not in HEAD: ${filepath}`);
}

async function diffRefs(oldRef?: string, newRef?: string): Promise<string> {
	const ref1 = oldRef || "HEAD";
	const ref2 = newRef || "HEAD";
	const oid1 = await git.resolveRef({ fs, dir: WORKSPACE_ROOT, ref: ref1 });
	const oid2 = await git.resolveRef({ fs, dir: WORKSPACE_ROOT, ref: ref2 });
	const tree1 = (await git.readTree({ fs, dir: WORKSPACE_ROOT, oid: oid1 }))
		.tree;
	const tree2 = (await git.readTree({ fs, dir: WORKSPACE_ROOT, oid: oid2 }))
		.tree;
	const files1 = new Map(tree1.map((e) => [e.path, e.oid]));
	const files2 = new Map(tree2.map((e) => [e.path, e.oid]));
	const allFiles = new Set([...files1.keys(), ...files2.keys()]);
	const lines: string[] = [];
	for (const filepath of allFiles) {
		const o1 = files1.get(filepath);
		const o2 = files2.get(filepath);
		if (!o1 && o2) {
			lines.push(`ADDED ${filepath}`);
			continue;
		}
		if (o1 && !o2) {
			lines.push(`DELETED ${filepath}`);
			continue;
		}
		if (o1 !== o2) {
			const b1 = Buffer.from(
				(await git.readBlob({ fs, dir: WORKSPACE_ROOT, oid: o1! })).blob,
			).toString("utf8");
			const b2 = Buffer.from(
				(await git.readBlob({ fs, dir: WORKSPACE_ROOT, oid: o2! })).blob,
			).toString("utf8");
			lines.push(...generateUnifiedDiff(filepath, b1, b2));
		}
	}
	return lines.join("\n");
}

function generateUnifiedDiff(
	filepath: string,
	oldText: string,
	newText: string,
): string[] {
	const lines: string[] = [`--- a/${filepath}`, `+++ b/${filepath}`];
	const oldLines = oldText.split("\n");
	const newLines = newText.split("\n");
	const maxLen = Math.max(oldLines.length, newLines.length);
	for (let i = 0; i < maxLen; i++) {
		const o = oldLines[i] ?? "";
		const n = newLines[i] ?? "";
		if (o === n) continue;
		if (!o && n) lines.push(`+${n}`);
		else if (o && !n) lines.push(`-${o}`);
		else {
			lines.push(`-${o}`);
			lines.push(`+${n}`);
		}
	}
	return lines;
}

async function mapStatus(
	HEAD: number,
	WORKDIR: number,
	STAGE: number,
): Promise<GitStatus["status"]> {
	if (HEAD === 0 && WORKDIR === 2 && STAGE === 0) return "untracked";
	if (HEAD === 0 && STAGE === 2) return "added";
	if (HEAD === 1 && WORKDIR === 0) return "deleted";
	if (WORKDIR === 2) return "modified";
	return "unmodified";
}
