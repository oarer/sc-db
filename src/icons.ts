import path from "path";
import fs from "fs";
import { ORIG_DIR, OUT_DIR } from "./constants";
import { copyDirRecursive } from "./fsUtils";

export async function copyIconsToOutput() {
    const src = path.join(ORIG_DIR, "icons");
    const dest = path.join(OUT_DIR, "icons");

    if (!fs.existsSync(src)) {
        console.log("No icons to copy (", src, ")");
        return;
    }

    try {
        await fs.promises.rm(dest, { recursive: true, force: true });
    } catch {}

    if ((fs.promises as any).cp) {
        await (fs.promises as any).cp(src, dest, { recursive: true });
    } else {
        await copyDirRecursive(src, dest);
    }

    console.log("[Icons ]Icons copied to", dest);
}
