import AdmZip from "adm-zip";
import axios from "axios";
import path from "path";
import fs from "fs";
import { promises as fsPromises } from "fs";
import {
    GITHUB_REPO,
    GITHUB_BRANCH,
    GITHUB_TOKEN,
} from "./constants";

export async function downloadZip(url: string, dest: string) {
    console.log("Downloading ZIP from GitHub...");
    let totalSize = 0;
    try {
        const headResponse = await axios.head(url, {
            headers: GITHUB_TOKEN
                ? { Authorization: `token ${GITHUB_TOKEN}` }
                : {},
        });
        totalSize = parseInt(headResponse.headers["content-length"] || "0", 10);
    } catch {
        console.log("Could not determine file size");
    }

    const response = await axios.get(url, {
        responseType: "arraybuffer",
        maxRedirects: 5,
        headers: GITHUB_TOKEN ? { Authorization: `token ${GITHUB_TOKEN}` } : {},
        onDownloadProgress: (progressEvent: any) => {
            const total =
                totalSize || progressEvent.total || progressEvent.loaded;
            const current = progressEvent.loaded;
            const percentage =
                total > 0 ? ((current / total) * 100).toFixed(1) : "0";
            const currentMB = (current / 1024 / 1024).toFixed(2);
            const totalMB = (total / 1024 / 1024).toFixed(2);

            if (total > current) {
                process.stdout.write(
                    `\rDownloading: ${percentage}% [${currentMB} / ${totalMB} MB]`
                );
            } else {
                process.stdout.write(`\rDownloading: ${currentMB} MB...`);
            }
        },
    });

    console.log("\nSaving to disk...");
    await fsPromises.writeFile(dest, Buffer.from(response.data));
    console.log("✓ Download completed");
}

export async function extractItemsFromZip(zipPath: string, targetDir: string) {
    const zip = new AdmZip(zipPath);
    const entries = zip.getEntries();

    const prefixes = [
        `${GITHUB_REPO}-${GITHUB_BRANCH}/ru/items/`,
        `${GITHUB_REPO}-${GITHUB_BRANCH}/ru/icons/`,
    ];

    for (const entry of entries) {
        const matchedPrefix = prefixes.find(prefix =>
            entry.entryName.startsWith(prefix)
        );
        if (!matchedPrefix) continue;

        const relPath = entry.entryName.slice(matchedPrefix.length);
        const subdir = matchedPrefix.includes("/items/") ? "items" : "icons";

        const outPath = path.join(targetDir, subdir, relPath);

        if (entry.isDirectory) {
            fs.mkdirSync(outPath, { recursive: true });
        } else {
            fs.mkdirSync(path.dirname(outPath), { recursive: true });
            fs.writeFileSync(outPath, entry.getData());
        }
    }
}
