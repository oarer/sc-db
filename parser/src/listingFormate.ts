import fs from "node:fs";
import path from "node:path";

export async function processListing(outDir: string) {
	const listingPath = path.join(outDir, "listing.json");

	if (!fs.existsSync(listingPath)) {
		console.warn("listing.json not found — skipping.");
		return;
	}

	const raw = await fs.promises.readFile(listingPath, "utf-8");
	const items = JSON.parse(raw);

	const processed = items.map((item: any) => {
		if (item.name?.lines) {
			item.name = item.name.lines;
		}

		delete item.status;

		return item;
	});

	await fs.promises.writeFile(
		listingPath,
		JSON.stringify(processed, null, 2),
		"utf-8",
	);

	console.log("[Listing] listing.json processed");
}
