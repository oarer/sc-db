import fs from "node:fs";
import path from "node:path";

type Options = {
  groups: Record<string, string[]>;
  asArrayFor?: string[];
  pretty?: boolean;
};

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJsonSafe(filePath: string) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (_e) {
    console.warn(`[merge] Failed to parse ${filePath}`);
    return null;
  }
}

function collectJsonFiles(dir: string): string[] {
  let results: string[] = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const fullPath = path.join(dir, e.name);
      if (e.isFile() && e.name.endsWith(".json")) {
        results.push(fullPath);
      } else if (e.isDirectory()) {
        results = results.concat(collectJsonFiles(fullPath));
      }
    }
  } catch {}
  return results;
}

export function mergeFolderGroupsToListing(
  outDir: string,
  opts: Options,
) {
  const { groups, asArrayFor = [], pretty = true } = opts;

  const listingDir = path.join(outDir, "listing");
  ensureDir(listingDir);

  for (const [outputName, folders] of Object.entries(groups)) {
    const outFile = path.join(listingDir, `${outputName}.json`);
    const isArray = asArrayFor.includes(outputName);

    const result: any = isArray ? [] : {};

    for (const folder of folders) {
      const srcDir = path.join(outDir, folder);
      const files = collectJsonFiles(srcDir);

      for (const filePath of files) {
        const data = readJsonSafe(filePath);
        if (data == null) continue;

        if (isArray) {
          result.push(data);
        } else {
          const key = path.basename(filePath, ".json");

          if (key in result) {
            console.warn(
              `[merge] Key collision "${key}" in ${outputName}.json (from ${folder})`,
            );
          }

          result[key] = data;
        }
      }
    }

    fs.writeFileSync(
      outFile,
      pretty ? JSON.stringify(result, null, 2) : JSON.stringify(result),
      "utf8",
    );

    console.log(`[merge] ${outputName}.json ← ${folders.join(", ")}`);
  }
}
