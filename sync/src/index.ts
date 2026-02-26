import { execSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";

const PORT = 7829;
const TOKEN = process.env.SYNC_TOKEN;
const REPO = "/merged";

if (!TOKEN) {
	console.error("[SYNC] SYNC_TOKEN is not set");
	process.exit(1);
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
			const status = execSync("git status --porcelain", { cwd: REPO })
				.toString()
				.trim();

			if (!status) {
				res.end("no changes");
				return;
			}

			execSync("git add -A merged/**", { cwd: REPO });

			try {
				execSync(
					`git commit -m "Auto: update @${new Date().toLocaleString()}"`,
					{ cwd: REPO },
				);
			} catch (_err) {}

			execSync("git push origin main", { cwd: REPO });
			res.end("pushed");
		} catch (e) {
			console.error("[SYNC] error:", e);
			res.writeHead(500);
			res.end("error");
		} finally {
			fs.unlinkSync(lock);
		}
	})
	.listen(PORT, () => {
		console.log("[SYNC] started");
	});
