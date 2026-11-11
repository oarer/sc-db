import fs from "node:fs";
import path from "node:path";
import { ORIG_DIR, OUT_DIR, PRESERVED_FILES } from "./constants";
import { copyDirRecursive, removeDirExcept } from "./utils/fsUtils";

export async function copyIconsToOutput() {
	const src = path.join(ORIG_DIR, "icons");
	const dest = path.join(OUT_DIR, "icons");

	if (!fs.existsSync(src)) {
		console.log("No icons to copy (", src, ")");
		return;
	}

	// Не удаляем вручную добавленные иконки (uno/custom), которые
	// не приходят из официальной базы.
	const preservedIcons = PRESERVED_FILES.filter((p) =>
		p.startsWith("icons/"),
	).map((p) => p.slice("icons/".length));

	await removeDirExcept(dest, preservedIcons);

	await copyDirRecursive(src, dest);

	console.log("[Icons] Icons copied to", dest);
}
