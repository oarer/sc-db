import fs from "node:fs";
import path from "node:path";
import type { InfoElement, Item } from "./types";
import { readJSONSync, scanFolder, writeJSONSync } from "./utils/fsUtils";

export function ensureNumberArray(v: any): number[] {
	if (Array.isArray(v)) return v.filter((x) => typeof x === "number");
	if (typeof v === "number") return [v];
	return [];
}

export function uniqSorted(nums: number[]) {
	const s = Array.from(new Set(nums));
	s.sort((a, b) => a - b);
	return s;
}

export function findNumericElementsByKey(item: Item, key: string) {
	const results: { el: InfoElement; blockIdx: number; elIdx: number }[] = [];
	if (!item.infoBlocks) return results;
	item.infoBlocks.forEach((block, bi) => {
		if (!block.elements) return;
		block.elements.forEach((el, ei) => {
			if (el?.type === "numeric" || el?.type === "numericVariants") {
				if (el.name?.type === "translation" && el.name.key === key) {
					results.push({ el, blockIdx: bi, elIdx: ei });
				}
			}
		});
	});
	return results;
}

export function collectFromVariant(variant: Item, matchKey: string) {
	const numToLocStr: Map<number, Record<string, string>> = new Map();
	let nameColor: string | undefined;
	let valueColor: string | undefined;
	if (!variant.infoBlocks) return { numToLocStr, nameColor, valueColor };

	for (const block of variant.infoBlocks) {
		const isUpgradeStatsBlock =
			block.title?.type === "translation" &&
			block.title.key === "stalker.tooltip.armor_artefact.info.upgrade_stats";

		if (!block.elements) continue;
		for (const el of block.elements) {
			if (
				(el.type === "numeric" || el.type === "numericVariants") &&
				el.name?.type === "translation" &&
				el.name.key === matchKey
			) {
				if (
					matchKey === "stalker.artefact_properties.factor.bullet_dmg_factor" &&
					isUpgradeStatsBlock
				)
					continue;

				const vals = ensureNumberArray(el.value);
				const fv = el.formatted?.value;

				vals.forEach((num) => {
					let rec = numToLocStr.get(num);
					if (!rec) {
						rec = {};
						numToLocStr.set(num, rec);
					}
					if (fv && typeof fv === "object") {
						for (const [loc, s] of Object.entries(fv)) {
							if (typeof s === "string" && !rec?.[loc]) rec![loc] = s;
						}
					}
				});

				if (!nameColor && el.formatted?.nameColor)
					nameColor = el.formatted.nameColor;
				if (!valueColor && el.formatted?.valueColor)
					valueColor = el.formatted.valueColor;

				if (!nameColor && (el as any).nameColor)
					nameColor = (el as any).nameColor;
				if (!valueColor && (el as any).valueColor)
					valueColor = (el as any).valueColor;
			}
		}
	}
	return { numToLocStr, nameColor, valueColor };
}

export function mergeOneItem(orig: Item, variants: Item[]) {
	const category = orig.category || "";
	let matchKey: string | null = null;
	if (category.startsWith("weapon"))
		matchKey = "core.tooltip.stat_name.damage_type.direct";
	else if (category.startsWith("armor"))
		matchKey = "stalker.artefact_properties.factor.bullet_dmg_factor";
	if (!matchKey) return orig;

	const targets = findNumericElementsByKey(orig, matchKey);
	if (!targets.length) return orig;

	const allNums: number[] = [];
	const numToLocaleStrings: Record<number, Record<string, string>> = {};
	let chosenNameColor: string | undefined;
	let chosenValueColor: string | undefined;

	for (const t of targets) {
		const origVals = ensureNumberArray(t.el.value);
		origVals.forEach((n) => {
			allNums.push(n);
		});

		if (t.el.formatted?.value && typeof t.el.formatted.value === "object") {
			for (const n of origVals) {
				if (!numToLocaleStrings[n]) numToLocaleStrings[n] = {};
				for (const [loc, s] of Object.entries(t.el.formatted.value)) {
					if (typeof s === "string") numToLocaleStrings[n][loc] = s;
				}
			}
		}

		if (!chosenNameColor && t.el.formatted?.nameColor)
			chosenNameColor = t.el.formatted.nameColor;
		if (!chosenValueColor && t.el.formatted?.valueColor)
			chosenValueColor = t.el.formatted.valueColor;
		if (!chosenNameColor && (t.el as any).nameColor)
			chosenNameColor = (t.el as any).nameColor;
		if (!chosenValueColor && (t.el as any).valueColor)
			chosenValueColor = (t.el as any).valueColor;
	}

	for (const v of variants) {
		const { numToLocStr, nameColor, valueColor } = collectFromVariant(
			v,
			matchKey,
		);
		if (nameColor && !chosenNameColor) chosenNameColor = nameColor;
		if (valueColor && !chosenValueColor) chosenValueColor = valueColor;

		numToLocStr.forEach((locMap, num) => {
			allNums.push(num);
			if (!numToLocaleStrings[num]) numToLocaleStrings[num] = {};
			for (const [loc, s] of Object.entries(locMap)) {
				if (!numToLocaleStrings[num][loc]) numToLocaleStrings[num][loc] = s;
			}
		});
	}

	const merged = uniqSorted(allNums);

	for (const t of targets) {
		const el = t.el;
		el.type = "numericVariants";
		el.value = merged;
		if (!el.nameColor && chosenNameColor) el.nameColor = chosenNameColor;
		if (!el.valueColor && chosenValueColor) el.valueColor = chosenValueColor;
		if (el.formatted) {
			delete el.formatted.value;
			delete el.formatted.nameColor;
			delete el.formatted.valueColor;
			if (!Object.keys(el.formatted).length) delete el.formatted;
		}
	}

	return orig;
}

export function runMerge(ORIG_DIR: string, OUT_DIR: string) {
	const allFiles = scanFolder(ORIG_DIR);
	console.log("[Merge] Found JSON files:", allFiles.length);

	const resolvedOutBase = path.resolve(OUT_DIR);

	for (const f of allFiles) {
		if (f.includes(`${path.sep}_variants${path.sep}`)) continue;

		try {
			const rel = path.relative(ORIG_DIR, f);
			const safeRel = rel.replace(/^([\\/])+/, "");
			const outPath = path.join(OUT_DIR, safeRel);
			const resolvedOut = path.resolve(outPath);

			if (
				!(
					resolvedOut === resolvedOutBase ||
					resolvedOut.startsWith(resolvedOutBase + path.sep)
				)
			) {
				throw new Error(
					`[merge] Unsafe outPath resolved (outside OUT_DIR). src=${f} rel=${rel} outPath=${outPath} resolvedOut=${resolvedOut} OUT_DIR=${resolvedOutBase}`,
				);
			}

			const orig = readJSONSync(f) as Item;

			const dir = path.dirname(f);
			const base = path.basename(f, ".json");
			const variantsFolder = path.join(dir, "_variants", base);

			const variants: Item[] = [];
			if (fs.existsSync(variantsFolder)) {
				const varFiles = scanFolder(variantsFolder);
				for (const vf of varFiles) {
					try {
						variants.push(readJSONSync(vf) as Item);
					} catch (err) {
						console.warn(
							`[merge] Failed to read variant ${vf}:`,
							(err as Error).message,
						);
					}
				}
			}

			const merged = mergeOneItem(orig, variants);

			const outBaseName = path.basename(resolvedOut);
			if (!outBaseName) {
				throw new Error(
					`[merge] Computed out path has no basename: ${resolvedOut}`,
				);
			}

			writeJSONSync(resolvedOut, merged);
		} catch (e: any) {
			console.error("[Merge] Error processing file", f, e?.message || e);
		}
	}

	console.log("[Merge] Done.");
}
