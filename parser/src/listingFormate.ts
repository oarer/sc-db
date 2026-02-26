import fs from "node:fs";
import path from "node:path";

interface ListingItem {
	name?: { lines?: Record<string, string> } | Record<string, string>;
	status?: unknown;
	[key: string]: unknown;
}

export async function processListing(outDir: string) {
	const listingPath = path.join(outDir, "listing.json");

	if (!fs.existsSync(listingPath)) {
		console.warn("listing.json not found — skipping.");
		return;
	}

	const raw = await fs.promises.readFile(listingPath, "utf-8");
	const items = JSON.parse(raw);

	const processed = items.map((item: ListingItem) => {
		if (item.name && typeof item.name === "object" && "lines" in item.name) {
			item.name = item.name.lines as Record<string, string>;
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
