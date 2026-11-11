import fs from "node:fs";
import path from "node:path";
import { additionalStatsParse } from "./additionalStatsParse";
import { applyModelsMap } from "./applyModelsMap";
import { applyRenderMetadata } from "./applyRenderMetadata";
import {
	CLEAN_ORIG,
	FORCE_PULL,
	GITHUB_BRANCH,
	GITHUB_OWNER,
	GITHUB_REPO,
	ORIG_DIR,
	OUT_DIR,
	PRESERVED_FILES,
	UPDATE_COOLDOWN,
} from "./constants";
import { addCustomToListing } from "./customListing";
import {
	downloadZip,
	extractItemsFromZip,
	getRemoteSha,
	notifySync,
} from "./github";
import { copyIconsToOutput } from "./icons";
import { processListing } from "./listingFormate";
import { LISTING_GROUPS } from "./listingGroups";
import { runMerge } from "./merge";
import { mergeFolderGroupsToListing } from "./mergeItems";
import { applyUnoWeaponStats } from "./unoWeaponStats";
import { applyUpgradeStats } from "./upgradeStats";
import {
	hashFile,
	loadSavedSha,
	removeDir,
	removeDirExcept,
	saveSha,
} from "./utils/fsUtils";

async function main(): Promise<boolean> {
	const useProxy =
		process.argv.includes("--proxy") || process.env.PROXY === "true";
	const forceMerge = process.argv.includes("--force-merge");

	let updated = false;

	if (CLEAN_ORIG) {
		await removeDir(ORIG_DIR);
		console.log("[Main] Cleaned", ORIG_DIR);
	}

	try {
		if (forceMerge) {
			console.log("[Merge] Force merge requested.");

			await removeDirExcept(OUT_DIR, PRESERVED_FILES);
			await runMerge(ORIG_DIR, OUT_DIR);
			await processListing(OUT_DIR);
			await addCustomToListing(OUT_DIR);
			await copyIconsToOutput();
			await additionalStatsParse(OUT_DIR, useProxy);
			await applyUnoWeaponStats(OUT_DIR);
			await applyUpgradeStats(OUT_DIR);
			await mergeFolderGroupsToListing(OUT_DIR, {
				groups: LISTING_GROUPS,
				asArrayFor: ["consumables", "containers"],
			});

			await applyModelsMap();
			await applyRenderMetadata();

			return true;
		}

		const zipPath = path.join("./", `${GITHUB_REPO}-${GITHUB_BRANCH}.zip`);
		const savedSha = loadSavedSha();
		let needUpdate = FORCE_PULL || !savedSha;

		const remoteSha = await getRemoteSha();
		console.log("[Main] savedSha =", savedSha, "remoteSha =", remoteSha);

		if (remoteSha) {
			if (!savedSha || savedSha !== remoteSha) {
				needUpdate = true;
			}
		} else {
			needUpdate = needUpdate || false;
		}

		if (needUpdate) {
			console.log("[Main] Updating from GitHub...");

			const zipUrl = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/archive/refs/heads/${GITHUB_BRANCH}.zip`;
			await downloadZip(zipUrl, zipPath, useProxy);

			const zipHash = hashFile(zipPath);
			console.log("[Main] Zip hash:", zipHash);

			if (remoteSha) {
				if (!savedSha || savedSha !== remoteSha || FORCE_PULL) {
					await removeDir(ORIG_DIR);
					await extractItemsFromZip(zipPath, ORIG_DIR);

					saveSha(remoteSha);
					updated = true;
					console.log("[Main] Updated using remote commit SHA:", remoteSha);
				} else {
					console.log(
						"[Main] Remote SHA matches saved SHA — no extraction necessary.",
					);
				}
			} else {
				if (!savedSha || savedSha !== zipHash || FORCE_PULL) {
					await removeDir(ORIG_DIR);
					await extractItemsFromZip(zipPath, ORIG_DIR);

					saveSha(zipHash);
					updated = true;
					console.log("[Main] Updated using zip hash (fallback):", zipHash);
				} else {
					console.log(
						"[Main] Zip identical to saved hash — skipping extraction.",
					);
				}
			}

			await fs.promises.rm(zipPath, { force: true });

			if (updated) {
				await removeDirExcept(OUT_DIR, PRESERVED_FILES);
				await runMerge(ORIG_DIR, OUT_DIR);
				await processListing(OUT_DIR);
				await addCustomToListing(OUT_DIR);
				await copyIconsToOutput();
				await additionalStatsParse(OUT_DIR, useProxy);
				await mergeFolderGroupsToListing(OUT_DIR, {
					groups: LISTING_GROUPS,
					asArrayFor: ["consumables", "containers"],
				});

				await applyModelsMap();
				await applyRenderMetadata();
			}
		}
	} catch (e: any) {
		console.warn("[Main] Sync failed:", e?.message || e);
	}

	return updated;
}

async function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function loop() {
	while (true) {
		try {
			const updated = await main();

			if (updated) {
				console.log("[Loop] Changes detected → syncing");
				await notifySync();
			} else {
				console.log("[Loop] No changes");
			}
		} catch (e) {
			console.error("[Loop] Loop error:", e);
		}

		await sleep(UPDATE_COOLDOWN);
	}
}

const noLoop = process.argv.includes("--no-loop");

if (noLoop) {
	console.log("[Main] --no-loop detected — running single sync then exiting");
	try {
		const updated = await main();
		if (updated) {
			console.log("[Main] Changes detected → syncing");
			await notifySync();
		} else {
			console.log("[Main] No changes");
		}
		process.exit(0);
	} catch (e) {
		console.error("[Main] Error during single run:", e);
		process.exit(1);
	}
} else {
	await loop();
}
