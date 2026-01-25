import fs from "node:fs";
import path from "node:path";
import { ORIG_DIR, OUT_DIR } from "./constants";
import { copyDirRecursive } from "./utils/fsUtils";

export async function copyIconsToOutput() {
	const src = path.join(ORIG_DIR, "icons");
	const dest = path.join(OUT_DIR, "icons");

	if (!fs.existsSync(src)) {
		console.log("No icons to copy (", src, ")");
		return;
	}

	try {
		await fs.promises.rm(dest, { recursive: true, force: true });
	} catch {}

	await copyDirRecursive(src, dest);

	console.log("[Icons] Icons copied to", dest);
}
