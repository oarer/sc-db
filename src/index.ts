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
import { hashFile, loadSavedSha, saveSha, removeDir } from "./fsUtils";
import { runMerge } from "./merge";
import { copyIconsToOutput } from "./icons";

async function main() {
    if (CLEAN_ORIG) {
        await removeDir(ORIG_DIR);
        console.log("Cleaned", ORIG_DIR);
    }

    try {
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
            await downloadZip(zipUrl, zipPath);
            const sha = hashFile(zipPath);

            if (!savedSha || savedSha !== sha || FORCE_PULL) {
                console.log("Extracting items from ZIP...");
                await extractItemsFromZip(zipPath, ORIG_DIR);
                saveSha(sha);
                console.log("ZIP sync finished. Saved sha:", sha);
            }

            await fs.promises.rm(zipPath, { force: true });
            runMerge(ORIG_DIR, OUT_DIR);
            await copyIconsToOutput();
        } else if (process.argv.includes("--force-merge")) {
            console.log(
                "Local files up-to-date, but --force-merge specified. Running merge..."
            );
            runMerge(ORIG_DIR, OUT_DIR);
            await copyIconsToOutput();
        } else {
            console.log("No update needed — local files are up-to-date.");
        }
    } catch (e: any) {
        console.warn(
            "GitHub ZIP sync failed / skipped. Reason:",
            e?.message || e
        );
    }
}

await main();
