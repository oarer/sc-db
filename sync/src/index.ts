import { execSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const PORT = 3001;
const TOKEN = process.env.SYNC_TOKEN;
const REPO = "/repo";
const LOCK = "/tmp/sync.lock";

if (!TOKEN) {
	console.error("[SYNC] SYNC_TOKEN is not set");
	process.exit(1);
}

function acquireLock() {
	try {
		const fd = fs.openSync(LOCK, "wx");
		fs.writeSync(fd, String(process.pid));
		fs.closeSync(fd);
		return true;
	} catch {
		return false;
	}
}

function releaseLock() {
	try {
		fs.unlinkSync(LOCK);
	} catch {}
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

		if (!acquireLock()) {
			res.writeHead(409);
			return res.end("busy");
		}

		try {
			if (!fs.existsSync(REPO) || !fs.existsSync(path.join(REPO, ".git"))) {
				res.writeHead(500);
				return res.end("repo not found or not a git repo");
			}

			try {
				execSync("git diff --quiet", { cwd: REPO, stdio: "ignore" });
				res.end("no changes");
				return;
			} catch {
				execSync("git add -A", { cwd: REPO });
				execSync(`git commit -m "Auto: update @ ${new Date().toISOString()}"`, {
					cwd: REPO,
				});
				execSync("git push origin main", { cwd: REPO });
				res.end("pushed");
			}
		} catch (e) {
			console.error("[SYNC] error:", e);
			res.writeHead(500);
			res.end("error");
		} finally {
			releaseLock();
		}
	})
	.listen(PORT, () => {
		console.log("[SYNC] started");
	});
