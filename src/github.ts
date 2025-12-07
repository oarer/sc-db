import AdmZip from "adm-zip";
import path from "path";
import fs from "fs";
import { GITHUB_REPO, GITHUB_BRANCH, GITHUB_TOKEN } from "./constants";

export async function downloadZip(url: string, dest: string) {
    console.log("Downloading ZIP from GitHub...");

    let totalSize = 0;
    try {
        const headRes = await fetch(url, {
            method: "HEAD",
            headers: GITHUB_TOKEN
                ? { Authorization: `token ${GITHUB_TOKEN}` }
                : {},
        });
        totalSize = Number(headRes.headers.get("content-length") || 0);
    } catch {
        console.log("Could not determine file size");
    }

    const res = await fetch(url, {
        headers: GITHUB_TOKEN ? { Authorization: `token ${GITHUB_TOKEN}` } : {},
    });
    if (!res.body) throw new Error("No body");

    const fileStream = fs.createWriteStream(dest);
    const reader = res.body.getReader();

    let downloaded = 0;

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
            fileStream.write(value);
            downloaded += value.byteLength;

            if (totalSize) {
                const perc = ((downloaded / totalSize) * 100).toFixed(1);
                Bun.stdout.write(
                    `\rDownloading: ${perc}% [${(
                        downloaded /
                        1024 /
                        1024
                    ).toFixed(2)} / ${(totalSize / 1024 / 1024).toFixed(2)} MB]`
                );
            } else {
                Bun.stdout.write(
                    `\rDownloading: ${(downloaded / 1024 / 1024).toFixed(
                        2
                    )} MB...`
                );
            }
        }
    }

    await new Promise(resolve => fileStream.end(resolve));
    console.log("\n✓ Download completed");
}

export async function extractItemsFromZip(zipPath: string, targetDir: string) {
    const zip = new AdmZip(zipPath);
    const entries = zip.getEntries();

    const prefixes = [
        `${GITHUB_REPO}-${GITHUB_BRANCH}/ru/items/`,
        `${GITHUB_REPO}-${GITHUB_BRANCH}/ru/icons/`,
        `${GITHUB_REPO}-${GITHUB_BRANCH}/ru/listing.json`,
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
