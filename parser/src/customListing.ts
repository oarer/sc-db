import fs from "node:fs";
import path from "node:path";

interface CustomItemEntry {
	data: string;
	uno?: boolean;
	name?: Record<string, string>;
	color?: string;
	[key: string]: unknown;
}

const SOURCES = [
	{ dir: ["items", "custom"], prefix: "/items/custom", uno: false },
	{ dir: ["items", "uno"], prefix: "/items/uno", uno: true },
];

function collectJsonFiles(dir: string): string[] {
	const results: string[] = [];

	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isFile() && entry.name.endsWith(".json")) {
			results.push(fullPath);
		} else if (entry.isDirectory()) {
			results.push(...collectJsonFiles(fullPath));
		}
	}

	return results;
}

export async function addCustomToListing(outDir: string) {
	const listingPath = path.join(outDir, "listing.json");

	if (!fs.existsSync(listingPath)) return;

	const listing: CustomItemEntry[] = JSON.parse(
		fs.readFileSync(listingPath, "utf-8"),
	);

	const existing = new Map(listing.map((e) => [e.data, e]));

	let added = 0;
	let updated = 0;
	let skipped = 0;

	for (const source of SOURCES) {
		const sourceDir = path.join(outDir, ...source.dir);
		if (!fs.existsSync(sourceDir)) continue;

		for (const filePath of collectJsonFiles(sourceDir)) {
			const relativePath = path
				.relative(sourceDir, filePath)
				.replace(/\\/g, "/");
			const data = `${source.prefix}/${relativePath}`;

			const existingEntry = existing.get(data);
			if (existingEntry) {
				if (source.uno && existingEntry.uno !== true) {
					existingEntry.uno = true;
					updated++;
				}
				skipped++;
				continue;
			}

			let item: Record<string, unknown>;
			try {
				item = JSON.parse(fs.readFileSync(filePath, "utf-8"));
			} catch {
				continue;
			}

			const entry: CustomItemEntry = {
				data,
			};
			if (source.uno) entry.uno = true;

			const name = item.name as
				| { type?: string; text?: string; lines?: Record<string, string> }
				| undefined;
			if (name) {
				if (name.lines) {
					entry.name = name.lines;
				} else if (name.type === "text" && typeof name.text === "string") {
					entry.name = { ru: name.text };
				}
			}

			if (typeof item.color === "string" && item.color) entry.color = item.color;

			listing.push(entry);
			existing.set(data, entry);
			added++;
		}
	}

	if (added > 0 || updated > 0) {
		await fs.promises.writeFile(
			listingPath,
			JSON.stringify(listing, null, 2),
			"utf-8",
		);
	}

	console.log(
		`[Listing] custom/uno: +${added} в listing.json, обновлено UNO-флагов: ${updated} (пропущено дублей: ${skipped})`,
	);
}