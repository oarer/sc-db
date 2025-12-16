import fs from "fs";
import fsPromises from "fs/promises";
import path from "path";
import axios from "axios";

const API_URL = "https://sctools.tech/api/exbo/items/?category=artefact";

export async function additionalStatsParse(
    outDir: string,
    translationsPath = path.join(process.cwd(), "translations.json")
) {
    console.log("[AddStats] Fetching artefacts from API…");

    let apiItems: any[];
    const proxyConfig = {
        protocol: "http",
        host: "127.0.0.1",
        port: 10808,
    };

    try {
        const res = await axios.get(API_URL, {
            headers: { accept: "application/json" },
            timeout: 10000,
            proxy: proxyConfig,
        });
        apiItems = res.data;
        console.log(
            `[AddStats] API items received via proxy: ${
                Array.isArray(apiItems) ? apiItems.length : typeof apiItems
            }`
        );
    } catch (err: any) {
        console.warn("[AddStats] Proxy failed, trying direct connection...");
        try {
            const res = await axios.get(API_URL, {
                headers: { accept: "application/json" },
                timeout: 10000,
                proxy: false,
            });
            apiItems = res.data;
            console.log(
                `[AddStats] API items received directly: ${
                    Array.isArray(apiItems) ? apiItems.length : typeof apiItems
                }`
            );
        } catch (err2: any) {
            console.error(
                "[AddStats] API fetch failed completely:",
                err2.message || err2
            );
            return;
        }
    }

    let translations: Record<string, Record<string, string>> = {};
    try {
        if (fs.existsSync(translationsPath)) {
            const trRaw = await fsPromises.readFile(translationsPath, "utf8");
            translations = JSON.parse(trRaw);
            console.log(
                `[AddStats] Translations loaded: ${
                    Object.keys(translations).length
                } keys`
            );
        } else {
            console.log(
                `[AddStats] Translations file not found: ${translationsPath}`
            );
        }
    } catch (e: any) {
        console.warn(
            `[AddStats] Failed to load translations file: ${e.message || e}`
        );
        translations = {};
    }

    const artefactsDir = path.join(outDir, "items", "artefact");
    if (!fs.existsSync(artefactsDir)) {
        console.warn(`[AddStats] Directory not found: ${artefactsDir}`);
        return;
    }

    const jsonFiles: string[] = [];
    async function walk(dir: string) {
        const entries = await fsPromises.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) await walk(full);
            else if (entry.isFile() && full.endsWith(".json"))
                jsonFiles.push(full);
        }
    }
    await walk(artefactsDir);
    console.log(`[AddStats] JSON files found: ${jsonFiles.length}`);
    if (!jsonFiles.length) return;

    const index = new Map<string, string[]>();
    for (const file of jsonFiles) {
        try {
            const json = JSON.parse(await fsPromises.readFile(file, "utf8"));
            const keys = [
                json?.id,
                json?.custom_id,
                json?.key,
                path.basename(file, ".json"),
            ].filter(Boolean);
            for (const key of keys) {
                const k = String(key);
                if (!index.has(k)) index.set(k, []);
                index.get(k)!.push(file);
            }
        } catch (e) {
            console.warn(
                `[AddStats] Broken json: ${file} — ${(e as any)?.message || e}`
            );
        }
    }

    console.log(`[AddStats] Index keys generated: ${index.size}`);

    let matched = 0;
    let modified = 0;

    for (const item of apiItems) {
        const lookupKeys = [item.id, item.custom_id, item.key].filter(Boolean);
        const files = new Set<string>();
        for (const key of lookupKeys) {
            const found = index.get(String(key));
            if (found) found.forEach(f => files.add(f));
        }

        if (!files.size) {
            console.log(`[AddStats] ❌ No match for item: ${item.id}`);
            continue;
        }

        const stats = item?.add_info?.addStats;
        if (!Array.isArray(stats) || !stats.length) {
            console.log(`[AddStats] ⚠ No addStats for item: ${item.id}`);
            continue;
        }

        matched++;

        const elements = stats.map((stat: any) => {
            const {
                isPositive,
                name,
                key,
                minValue,
                maxValue,
                formattedValue,
            } = stat ?? {};
            const tr = key && translations[key] ? translations[key] : undefined;
            const statNameLines = typeof name === "object" ? name : undefined;

            const mergedLines: Record<string, string> = {};
            if (tr) Object.assign(mergedLines, tr);
            if (statNameLines)
                Object.entries(statNameLines).forEach(([lang, text]) => {
                    if (!mergedLines[lang]) mergedLines[lang] = String(text);
                });

            const nameObj: any = {
                type: "translation",
                key: key || "",
                args: {},
                lines: mergedLines,
            };

            const formatted: any = {};
            if (formattedValue && typeof formattedValue === "object")
                formatted.value = formattedValue;
            if (isPositive === true) {
                formatted.nameColor = "53C353";
                formatted.valueColor = "53C353";
            } else if (isPositive === false) {
                formatted.nameColor = "FF4D4D";
                formatted.valueColor = "FF4D4D";
            }

            const element: any = {
                type: "range",
                name: nameObj,
                min: minValue,
                max: maxValue,
            };
            if (Object.keys(formatted).length) element.formatted = formatted;
            return element;
        });

        const listBlock = {
            type: "addStat",
            title: { type: "text", text: "" },
            elements,
        };

        for (const file of files) {
            try {
                const raw = await fsPromises.readFile(file, "utf8");
                const json = JSON.parse(raw);
                const infoBlocksKey = json.info_blocks
                    ? "info_blocks"
                    : json.infoBlocks
                    ? "infoBlocks"
                    : "info_blocks";
                if (!json[infoBlocksKey]) json[infoBlocksKey] = [];
                json[infoBlocksKey].push(listBlock);
                await fsPromises.writeFile(
                    file,
                    JSON.stringify(json, null, 2),
                    "utf8"
                );
                modified++;
            } catch (e: any) {
                console.warn(
                    `[AddStats] Failed to update file ${file}: ${
                        e.message || e
                    }`
                );
            }
        }
    }

    console.log(
        `[AddStats] Done. Matched: ${matched}, Files updated: ${modified}`
    );
}
