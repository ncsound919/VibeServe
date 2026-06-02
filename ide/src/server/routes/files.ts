import { promises as fs } from "fs";
import path from "path";

export function registerFileRoutes(app: any) {
	const WORKSPACE_ROOT = path.resolve(
		process.env.WORKSPACE_ROOT || process.cwd(),
	);

	app.get("/api/files/list", async (c: any) => {
		const dirPath = c.req.query("path") || ".";
		const fullPath = path.resolve(WORKSPACE_ROOT, dirPath as string);
		if (!fullPath.startsWith(WORKSPACE_ROOT))
			return c.json({ error: "Access denied" }, 403);
		const entries = await fs.readdir(fullPath, { withFileTypes: true });
		const files = entries.map((e) => ({
			name: e.name,
			path: path.join(dirPath as string, e.name).replace(/\\/g, "/"),
			type: e.isDirectory() ? ("directory" as const) : ("file" as const),
		}));
		return c.json(files);
	});

	app.get("/api/files/read", async (c: any) => {
		const filePath = c.req.query("path");
		if (!filePath) return c.json({ error: "path required" }, 400);
		const fullPath = path.resolve(WORKSPACE_ROOT, filePath as string);
		if (!fullPath.startsWith(WORKSPACE_ROOT))
			return c.json({ error: "Access denied" }, 403);
		const content = await fs.readFile(fullPath, "utf-8");
		return c.text(content);
	});

	app.post("/api/files/create", async (c: any) => {
		const { path: filePath, content } = await c.req.json();
		const fullPath = path.resolve(WORKSPACE_ROOT, filePath as string);
		if (!fullPath.startsWith(WORKSPACE_ROOT))
			return c.json({ error: "Access denied" }, 403);
		await fs.mkdir(path.dirname(fullPath), { recursive: true });
		await fs.writeFile(fullPath, content || "", "utf-8");
		return c.json({ ok: true });
	});

	app.delete("/api/files/delete", async (c: any) => {
		const { path: filePath } = await c.req.json();
		const fullPath = path.resolve(WORKSPACE_ROOT, filePath as string);
		if (!fullPath.startsWith(WORKSPACE_ROOT))
			return c.json({ error: "Access denied" }, 403);
		await fs.rm(fullPath, { recursive: true });
		return c.json({ ok: true });
	});

	app.post("/api/files/rename", async (c: any) => {
		const { oldPath, newPath: newP } = await c.req.json();
		const oldFull = path.resolve(WORKSPACE_ROOT, oldPath as string);
		const newFull = path.resolve(WORKSPACE_ROOT, newP as string);
		if (
			!oldFull.startsWith(WORKSPACE_ROOT) ||
			!newFull.startsWith(WORKSPACE_ROOT)
		)
			return c.json({ error: "Access denied" }, 403);
		await fs.rename(oldFull, newFull);
		return c.json({ ok: true });
	});
}
