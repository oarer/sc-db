import fs from "node:fs";
import path from "node:path";

type Options = {
  groups: Record<string, string[]>;
  asArrayFor?: string[];
  pretty?: boolean;
};

function ensureDirSync(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJsonSafeSync(filePath: string) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (_e) {
    console.warn(`[merge] Failed to parse ${filePath}`);
    return null;
  }
}

function collectJsonFilesSync(dir: string): string[] {
  let results: string[] = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const fullPath = path.join(dir, e.name);
      if (e.isFile() && e.name.endsWith(".json")) {
        results.push(fullPath);
      } else if (e.isDirectory()) {
        results = results.concat(collectJsonFilesSync(fullPath));
      }
    }
  } catch {}
  return results;
}

export function mergeFolderGroupsToListingSync(
  outDir: string,
  opts: Options,
) {
  const { groups, asArrayFor = [], pretty = true } = opts;

  const listingDir = path.join(outDir, "listing");
  ensureDirSync(listingDir);

  for (const [outputName, folders] of Object.entries(groups)) {
    const outFile = path.join(listingDir, `${outputName}.json`);
    const isArray = asArrayFor.includes(outputName);

    const result: any = isArray ? [] : {};

    for (const folder of folders) {
      const srcDir = path.join(outDir, folder);
      const files = collectJsonFilesSync(srcDir);

      for (const filePath of files) {
        const data = readJsonSafeSync(filePath);
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
