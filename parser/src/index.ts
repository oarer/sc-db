import path from "path";
import fs from "fs";

import {
    ORIG_DIR,
    OUT_DIR,
    GITHUB_OWNER,
    GITHUB_REPO,
    GITHUB_BRANCH,
    FORCE_PULL,
    CLEAN_ORIG,
    UPDATE_COOLDOWN,
} from "./constants";

import { downloadZip, extractItemsFromZip, notifySync } from "./github";
import { hashFile, loadSavedSha, saveSha, removeDir } from "./utils/fsUtils";
import { runMerge } from "./merge";
import { copyIconsToOutput } from "./icons";
import { processListing } from "./listingFormate";
import { additionalStatsParse } from "./additionalStatsParse";

async function main(): Promise<boolean> {
    const useProxy = process.argv.includes("--proxy");
    const forceMerge = process.argv.includes("--force-merge");

    let updated = false;

    if (CLEAN_ORIG) {
        await removeDir(ORIG_DIR);
        console.log("Cleaned", ORIG_DIR);
    }

    try {
        if (forceMerge) {
            console.log("[Merge] Force merge requested.");

            await removeDir(OUT_DIR);
            await runMerge(ORIG_DIR, OUT_DIR);
            await processListing(OUT_DIR);
            await copyIconsToOutput();
            await additionalStatsParse(OUT_DIR, useProxy);

            return true; // ⬅️ изменения точно есть
        }

        const zipUrl = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/archive/refs/heads/${GITHUB_BRANCH}.zip`;
        const zipPath = path.join("./", `${GITHUB_REPO}-${GITHUB_BRANCH}.zip`);

        const savedSha = loadSavedSha();
        let needUpdate = FORCE_PULL || !savedSha;

        if (!needUpdate && fs.existsSync(zipPath)) {
            const localSha = hashFile(zipPath);
            if (localSha !== savedSha) needUpdate = true;
        }

        if (needUpdate) {
            await downloadZip(zipUrl, zipPath, useProxy);

            const sha = hashFile(zipPath);

            if (!savedSha || savedSha !== sha || FORCE_PULL) {
                await removeDir(ORIG_DIR);
                await extractItemsFromZip(zipPath, ORIG_DIR);
                saveSha(sha);

                updated = true;
            }

            await fs.promises.rm(zipPath, { force: true });

            if (updated) {
                await removeDir(OUT_DIR);
                await runMerge(ORIG_DIR, OUT_DIR);
                await processListing(OUT_DIR);
                await copyIconsToOutput();
                await additionalStatsParse(OUT_DIR, useProxy);
            }
        }
    } catch (e: any) {
        console.warn("Sync failed:", e?.message || e);
    }

    return updated;
}

async function sleep(milliseconds: number) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function loop() {
    while (true) {
        console.log("[Loop] Starting loop");

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

        console.log("[Loop] Sleeping for", UPDATE_COOLDOWN / 1000, "seconds\n");

        await sleep(UPDATE_COOLDOWN);
    }
}

process.on("SIGINT", () => {
    console.log("\nReceived SIGINT, exiting...");
    process.exit();
});

process.on("SIGTERM", () => {
    console.log("Received SIGTERM, exiting...");
    process.exit();
});

await loop();
