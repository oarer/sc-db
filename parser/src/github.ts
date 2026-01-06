import AdmZip from "adm-zip";
import path from "path";
import fs from "fs";
import axios from "axios";
import { GITHUB_REPO, GITHUB_BRANCH, PROXY_CONFIG } from "./constants";

export async function downloadZip(
    url: string,
    dest: string,
    proxy: boolean = false
) {
    let totalSize = 0;

    try {
        const headRes = await axios.head(url, {
            proxy: proxy ? PROXY_CONFIG : false,
        });
        totalSize = Number(headRes.headers["content-length"] || 0);
    } catch {
        console.log("Could not determine file size");
    }

    const response = await axios.get(url, {
        responseType: "stream",
        proxy: proxy ? PROXY_CONFIG : false,
    });

    const fileStream = fs.createWriteStream(dest);
    let downloaded = 0;

    response.data.on("data", (chunk: Buffer) => {
        fileStream.write(chunk);
        downloaded += chunk.length;

        if (totalSize) {
            const perc = ((downloaded / totalSize) * 100).toFixed(1);
            Bun.stdout.write(
                `\rDownloading: ${perc}% [${(downloaded / 1024 / 1024).toFixed(
                    2
                )} / ${(totalSize / 1024 / 1024).toFixed(2)} MB]`
            );
        } else {
            Bun.stdout.write(
                `\rDownloading: ${(downloaded / 1024 / 1024).toFixed(2)} MB...`
            );
        }
    });

    await new Promise<void>((resolve, reject) => {
        response.data.on("end", () => {
            fileStream.end();
            console.log("\n✓ Download completed");
            resolve();
        });
        response.data.on("error", reject);
    });
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

        let relPath = entry.entryName.slice(matchedPrefix.length);

        if (!relPath) {
            if (matchedPrefix.endsWith("listing.json")) {
                relPath = "listing.json";
            } else {
                if (entry.isDirectory) continue;
            }
        }

        const subdir = matchedPrefix.includes("/items/")
            ? "items"
            : matchedPrefix.includes("/icons/")
            ? "icons"
            : "";

        const outPath = subdir
            ? path.join(targetDir, subdir, relPath)
            : path.join(targetDir, relPath);

        if (entry.isDirectory) {
            fs.mkdirSync(outPath, { recursive: true });
        } else {
            fs.mkdirSync(path.dirname(outPath), { recursive: true });
            fs.writeFileSync(outPath, entry.getData());
        }
    }
}

export async function notifySync() {
    if (!process.env.SYNC_TOKEN) return;

    try {
        await fetch("http://sync-server:3001/sync", {
            method: "POST",
            headers: {
                "x-sync-token": process.env.SYNC_TOKEN,
            },
        });

        console.log("[Sync] sync-server notified");
    } catch (e) {
        console.warn("[Sync] failed to notify sync-server:", e);
    }
}
