import { exec } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import { promisify } from "util";

const execAsync = promisify(exec);
const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT || process.cwd();

interface Task {
	name: string;
	command: string;
	type: string;
}

export function registerTaskRoutes(app: any) {
	app.get("/api/tasks/list", async (c: any) => {
		const tasks: Task[] = [];
		try {
			const pkgPath = path.join(WORKSPACE_ROOT, "package.json");
			const pkg = JSON.parse(await fs.readFile(pkgPath, "utf-8"));
			if (pkg.scripts) {
				for (const [name, command] of Object.entries(pkg.scripts)) {
					tasks.push({ name, command: `npm run ${name}`, type: "npm" });
				}
			}
		} catch {}
		try {
			const makePath = path.join(WORKSPACE_ROOT, "Makefile");
			const content = await fs.readFile(makePath, "utf-8");
			const matches = content.matchAll(/^(\w+):/gm);
			for (const m of matches) {
				tasks.push({ name: m[1], command: `make ${m[1]}`, type: "make" });
			}
		} catch {}
		return c.json(tasks);
	});

	app.post("/api/tasks/run", async (c: any) => {
		const { command } = await c.req.json();

		const allowedPattern = /^(npm run [a-zA-Z0-9_:.-]+|make [a-zA-Z0-9_.-]+)$/;
		if (!command || !allowedPattern.test(command)) {
			return c.json(
				{
					error:
						"Command not allowed. Use only npm run <script> or make <target>.",
				},
				403,
			);
		}

		try {
			const { stdout, stderr } = await execAsync(command, {
				cwd: WORKSPACE_ROOT,
				timeout: 60000,
			});
			return c.text(stdout + (stderr ? `\n${stderr}` : ""));
		} catch (err: any) {
			return c.text(
				err.stdout + "\n" + err.stderr + `\nExit code: ${err.code}`,
				500,
			);
		}
	});
}
