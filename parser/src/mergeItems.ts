import fs from "node:fs/promises";
import path from "node:path";

type Options = {
	groups: Record<string, string[]>;
	asArrayFor?: string[];
	pretty?: boolean;
};

async function ensureDir(dir: string) {
	await fs.mkdir(dir, { recursive: true });
}

async function readJsonSafe(filePath: string) {
	try {
		return JSON.parse(await fs.readFile(filePath, "utf8"));
	} catch (_e) {
		console.warn(`[merge] Failed to parse ${filePath}`);
		return null;
	}
}

async function collectJsonFiles(dir: string): Promise<string[]> {
	let results: string[] = [];
	try {
		const entries = await fs.readdir(dir, { withFileTypes: true });
		for (const e of entries) {
			const fullPath = path.join(dir, e.name);
			if (e.isFile() && e.name.endsWith(".json")) {
				results.push(fullPath);
			} else if (e.isDirectory()) {
				const subFiles = await collectJsonFiles(fullPath);
				results = results.concat(subFiles);
			}
		}
	} catch {}
	return results;
}

export async function mergeFolderGroupsToListing(
	outDir: string,
	opts: Options,
) {
	const { groups, asArrayFor = [], pretty = true } = opts;

	const listingDir = path.join(outDir, "listing");
	await ensureDir(listingDir);

	const ignoreFolders = ["items/armor/device"];

	for (const [outputName, folders] of Object.entries(groups)) {
		const outFile = path.join(listingDir, `${outputName}.json`);
		const isArray = asArrayFor.includes(outputName);

		const result: any = isArray ? [] : {};

		for (const folder of folders) {
			if (ignoreFolders.includes(folder)) {
				continue;
			}

			const srcDir = path.join(outDir, folder);
			const files = await collectJsonFiles(srcDir);

			for (const filePath of files) {
				const relative = path.relative(outDir, filePath).replace(/\\/g, "/");

				if (
					ignoreFolders.some((ignored) => relative.startsWith(`${ignored}/`))
				) {
					continue;
				}
				const data = await readJsonSafe(filePath);
				if (data == null) continue;

				if (isArray) {
					result.push(data);
				} else {
					const key = path.basename(filePath, ".json");

					if (key in result) {
						console.warn(
							`[merge] Key collision "${key}" in ${outputName}.json (from ${folder})`,
						);
					}

					result[key] = data;
				}
			}
		}

		await fs.writeFile(
			outFile,
			pretty ? JSON.stringify(result, null, 2) : JSON.stringify(result),
			"utf8",
		);

		console.log(
			`[merge] ${outputName}.json ← ${folders.filter((f) => !ignoreFolders.includes(f)).join(", ")}`,
		);
	}
}
