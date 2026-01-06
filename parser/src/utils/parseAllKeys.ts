import fsPromises from "fs/promises";
import path from "path";
import type { Item, InfoBlock, InfoElement } from "../types";

const OUT_DIR = "./merged";
const OUTPUT_FILE = "./translations.json";

async function parseAllKeys(dir: string) {
    const files: string[] = [];

    async function walk(d: string) {
        const entries = await fsPromises.readdir(d, { withFileTypes: true });
        for (const entry of entries) {
            const full = path.join(d, entry.name);
            if (entry.isDirectory()) await walk(full);
            else if (entry.isFile() && full.endsWith(".json")) files.push(full);
        }
    }

    await walk(dir);
    console.log(`Found JSON files: ${files.length}`);

    const translations: Record<string, Record<string, string>> = {};

    for (const file of files) {
        try {
            const raw = await fsPromises.readFile(file, "utf8");
            const items: Item[] = JSON.parse(raw);

            for (const item of items) {
                const infoBlocks: InfoBlock[] = item.infoBlocks || [];

                for (const block of infoBlocks) {
                    if (!Array.isArray(block.elements)) continue;

                    for (const el of block.elements as InfoElement[]) {
                        if (
                            el?.type === "range" &&
                            el?.name?.type === "translation" &&
                            el.name.key &&
                            el.name.lines
                        ) {
                            const key = el.name.key as string;
                            const lines = el.name.lines as Record<
                                string,
                                unknown
                            >;
                            if (!translations[key]) translations[key] = {};

                            for (const [lang, text] of Object.entries(lines)) {
                                translations[key][lang] = String(text ?? "");
                            }
                        }
                    }
                }
            }
        } catch (e: any) {
            console.warn(`Failed to process ${file}: ${e.message || e}`);
        }
    }

    await fsPromises.writeFile(
        OUTPUT_FILE,
        JSON.stringify(translations, null, 2),
        "utf8"
    );

    console.log(
        `Keys collected: ${Object.keys(translations).length} keys`
    );
    console.log(`Saved to ${OUTPUT_FILE}`);
}

await parseAllKeys(OUT_DIR);
