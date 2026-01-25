import { execSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";

const PORT = 3001;
const TOKEN = process.env.SYNC_TOKEN;
const REPO = "/repo";

if (!TOKEN) {
	console.error("[SYNC] SYNC_TOKEN is not set");
	process.exit(1);
}

function run(cmd: string) {
	return execSync(cmd, { cwd: REPO, stdio: "pipe" }).toString();
}

http
	.createServer((req, res) => {
		if (req.method !== "POST" || req.url !== "/sync") {
			res.writeHead(404);
			return res.end();
		}

		if (req.headers["x-sync-token"] !== TOKEN) {
			res.writeHead(403);
			return res.end("forbidden");
		}

		const lock = "/tmp/sync.lock";

		if (fs.existsSync(lock)) {
			res.writeHead(409);
			return res.end("busy");
		}

		fs.writeFileSync(lock, "1");

		try {
			const status = run(
				"git status --porcelain --untracked-files=all -- merged",
			).trim();

			if (!status) {
				console.log("[SYNC] no changes in merged");
				res.end("no changes");
				return;
			}

			console.log(`[SYNC] git status for merged:\n${status}`);

			try {
				run("git add merged/");
			} catch (err) {
				console.error("[SYNC] git add failed:", err);
				res.writeHead(500);
				return res.end("git add failed");
			}

			const staged = run("git diff --cached --name-only").trim();
			if (!staged) {
				console.log("[SYNC] nothing staged after git add; aborting");
				res.end("nothing staged");
				return;
			}

			console.log(`[SYNC] staged files:\n${staged}`);

			const msg = `Auto: update merged @${new Date().toLocaleString()}`;
			run(`git commit -m "${msg.replace(/"/g, '\\"')}"`);
			run("git push origin main");
			console.log("[SYNC] pushed");
			res.end("pushed");
		} catch (e) {
			console.error("[SYNC] error:", e);
			res.writeHead(500);
			res.end("error");
		} finally {
			try {
				fs.unlinkSync(lock);
			} catch {}
		}
	})
	.listen(PORT, () => {
		console.log("[SYNC] started");
	});
