import fs from "node:fs";
import path from "node:path";

// Добавляет предметы из merged/items/custom в merged/listing.json,
// чтобы они были видны в листинге сайта после каждого мержа.

interface CustomItemEntry {
	data: string;
	name?: Record<string, string>;
	color?: string;
	[key: string]: unknown;
}

export async function addCustomToListing(outDir: string) {
	const listingPath = path.join(outDir, "listing.json");
	const customDir = path.join(outDir, "items", "custom");

	if (!fs.existsSync(listingPath)) return;
	if (!fs.existsSync(customDir)) return;

	const listing: CustomItemEntry[] = JSON.parse(
		fs.readFileSync(listingPath, "utf-8"),
	);

	const existing = new Set(listing.map((e) => e.data));

	let added = 0;
	let skipped = 0;

	for (const f of fs.readdirSync(customDir)) {
		if (!f.endsWith(".json")) continue;
		const id = path.basename(f, ".json");
		const data = `/items/custom/${id}.json`;
		if (existing.has(data)) {
			skipped++;
			continue;
		}

		let item: Record<string, unknown>;
		try {
			item = JSON.parse(fs.readFileSync(path.join(customDir, f), "utf-8"));
		} catch {
			continue;
		}

		const entry: CustomItemEntry = { data };

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
		existing.add(data);
		added++;
	}

	if (added > 0) {
		await fs.promises.writeFile(
			listingPath,
			JSON.stringify(listing, null, 2),
			"utf-8",
		);
	}

	console.log(
		`[Listing] custom: +${added} в listing.json (пропущено дублей: ${skipped})`,
	);
}