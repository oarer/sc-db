import crypto from "node:crypto";
import fs, { promises as fsPromises } from "node:fs";
import path from "node:path";
import { SHA_FILE } from "../constants";

export function readJSONSync(p: string) {
	return JSON.parse(fs.readFileSync(p, "utf8"));
}

export function writeJSONSync(p: string, data: unknown) {
	fs.mkdirSync(path.dirname(p), { recursive: true });
	fs.writeFileSync(p, JSON.stringify(data, null, 2), "utf8");
}

export function scanFolder(folder: string): string[] {
	if (!fs.existsSync(folder)) return [];
	const out: string[] = [];
	for (const name of fs.readdirSync(folder)) {
		const fp = path.join(folder, name);
		const st = fs.statSync(fp);
		if (st.isDirectory()) out.push(...scanFolder(fp));
		else if (name.endsWith(".json")) out.push(fp);
	}
	return out;
}

export async function copyDirRecursive(src: string, dest: string) {
	await fsPromises.mkdir(dest, { recursive: true });
	const entries = await fsPromises.readdir(src, { withFileTypes: true });
	for (const entry of entries) {
		const srcPath = path.join(src, entry.name);
		const destPath = path.join(dest, entry.name);
		if (entry.isDirectory()) {
			await copyDirRecursive(srcPath, destPath);
		} else if (entry.isFile()) {
			await fsPromises.copyFile(srcPath, destPath);
		}
	}
}

export async function removeDir(dirPath: string) {
	if (!fs.existsSync(dirPath)) return;
	await fsPromises.rm(dirPath, { recursive: true, force: true });
}

export async function removeDirExcept(
	dirPath: string,
	preserve: string[] = [],
) {
	if (!fs.existsSync(dirPath)) return;
	const preserveSet = new Set(preserve.map((p) => p.replace(/\\/g, "/")));

	async function walk(dir: string) {
		const entries = await fsPromises.readdir(dir, { withFileTypes: true });
		for (const entry of entries) {
			const full = path.join(dir, entry.name);
			const rel = path.relative(dirPath, full).replace(/\\/g, "/");
			if (preserveSet.has(rel)) continue;

			if (entry.isDirectory()) {
				await walk(full);
				const remaining = await fsPromises.readdir(full);
				if (remaining.length === 0)
					await fsPromises.rm(full, { recursive: true, force: true });
			} else {
				await fsPromises.rm(full, { force: true });
			}
		}
	}

	await walk(dirPath);
}

export function hashFile(filePath: string): string {
	const buf = fs.readFileSync(filePath);
	return crypto.createHash("sha256").update(buf).digest("hex");
}

export function loadSavedSha(): string | null {
	try {
		if (!fs.existsSync(SHA_FILE)) return null;
		return fs.readFileSync(SHA_FILE, "utf8").trim();
	} catch {
		return null;
	}
}

export function saveSha(sha: string) {
	try {
		fs.mkdirSync(path.dirname(SHA_FILE), { recursive: true });
		fs.writeFileSync(SHA_FILE, sha, "utf8");
		console.log("[SHA] Last sha saved");
	} catch (e) {
		console.warn("Failed to save sha:", e);
	}
}
