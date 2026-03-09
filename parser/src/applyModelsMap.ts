import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MERGED_DIR = path.join(__dirname, "../../merged/items");
const MAP_FILE = path.join(__dirname, "../models-map.json");

const getFiles = async (dir: string): Promise<string[]> => {
	try {
		const entries = await readdir(dir, { withFileTypes: true });
		const files = await Promise.all(
			entries.map((entry) => {
				const full = path.join(dir, entry.name);
				if (entry.isDirectory()) return getFiles(full);
				if (entry.name.endsWith(".json")) return [full];
				return [];
			}),
		);
		return files.flat();
	} catch {
		return [];
	}
};

export async function applyModelsMap() {
	try {
		const mapContent = await readFile(MAP_FILE, "utf8");
		const modelsMap = JSON.parse(mapContent);
		console.log("[Models] Loaded models map:", Object.keys(modelsMap).length, "entries");

		const categories = ["armor", "containers", "backpacks"];
		let processed = 0;
		let added = 0;

		for (const category of categories) {
			const categoryPath = path.join(MERGED_DIR, category);
			const files = await getFiles(categoryPath);

			for (const file of files) {
				const raw = await readFile(file, "utf8");
				const json = JSON.parse(raw);
				const id = json.id;

				if (!id) continue;

				processed++;

				if (json.model?.model) continue;

				const modelData = modelsMap[id];
				if (modelData) {
					const newJson = { model: modelData, ...json };
					await writeFile(file, JSON.stringify(newJson, null, 2));
					added++;
				}
			}
		}

		console.log("[Models] Processed:", processed, "files, added models to:", added, "files");
	} catch (err) {
		console.warn("[Models] Error:", err);
	}
}
