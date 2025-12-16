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
} from "./constants";

import { downloadZip, extractItemsFromZip } from "./github";
import { hashFile, loadSavedSha, saveSha, removeDir } from "./utils/fsUtils";
import { runMerge } from "./merge";
import { copyIconsToOutput } from "./icons";
import { processListing } from "./listingFormate";
import { additionalStatsParse } from "./additionalStatsParse";

async function main() {
    const useProxy = process.argv.includes("--proxy");
    const forceMerge = process.argv.includes("--force-merge");

    if (CLEAN_ORIG) {
        await removeDir(ORIG_DIR);
        console.log("Cleaned", ORIG_DIR);
    }

    try {
        if (forceMerge) {
            console.log(
                "[Merge] Force merge requested. Running merge on local files..."
            );

            await removeDir(OUT_DIR);
            await runMerge(ORIG_DIR, OUT_DIR);
            await processListing(OUT_DIR);
            await copyIconsToOutput();

            await additionalStatsParse(OUT_DIR, useProxy);

            console.log("Force merge finished.");
            return;
        }

        console.log(
            `Checking GitHub repo ${GITHUB_OWNER}/${GITHUB_REPO}@${GITHUB_BRANCH}...`
        );

        const zipUrl = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/archive/refs/heads/${GITHUB_BRANCH}.zip`;
        const zipPath = path.join("./", `${GITHUB_REPO}-${GITHUB_BRANCH}.zip`);

        const savedSha = loadSavedSha();
        let needUpdate = FORCE_PULL || !savedSha;

        if (!needUpdate && fs.existsSync(zipPath)) {
            const localSha = hashFile(zipPath);
            if (localSha !== savedSha) needUpdate = true;
        }

        if (needUpdate) {
            console.log("Downloading ZIP from GitHub...");
            await downloadZip(zipUrl, zipPath, useProxy);

            const sha = hashFile(zipPath);

            if (!savedSha || savedSha !== sha || FORCE_PULL) {
                console.log("Extracting items from ZIP...");
                await removeDir(ORIG_DIR);
                await extractItemsFromZip(zipPath, ORIG_DIR);
                saveSha(sha);
                console.log("ZIP sync finished. Saved sha:", sha);
            }

            await fs.promises.rm(zipPath, { force: true });

            console.log("[Merge] Running merge after ZIP update...");
            await removeDir(OUT_DIR);
            await runMerge(ORIG_DIR, OUT_DIR);
            await processListing(OUT_DIR);
            await copyIconsToOutput();

            await additionalStatsParse(OUT_DIR, useProxy);

            console.log("[Merge] Update merge finished.");
        } else {
            console.log(
                "[Merge] No update needed — local files are up-to-date."
            );
        }
    } catch (e: any) {
        console.warn(
            "GitHub ZIP sync failed / skipped. Reason:",
            e?.message || e
        );
    }
}

await main();
