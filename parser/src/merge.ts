import fs from "node:fs";
import path from "node:path";
import type { InfoElement, Item } from "./type";
import { readJSONSync, scanFolder, writeJSONSync } from "./utils/fsUtils";

export function ensureNumberArray(v: unknown): number[] {
	if (Array.isArray(v))
		return v.filter((x): x is number => typeof x === "number");
	if (typeof v === "number") return [v];
	return [];
}

export function uniqSorted(nums: number[]) {
	const s = Array.from(new Set(nums));
	s.sort((a, b) => a - b);
	return s;
}

export function uniqPairs(pairs: [number, number][]) {
	const seen = new Set<string>();
	const out: [number, number][] = [];
	for (const [lo, hi] of pairs) {
		const key = `${lo}|${hi}`;
		if (seen.has(key)) continue;
		seen.add(key);
		out.push([lo, hi]);
	}
	out.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
	return out;
}

export function findNumericElementsByKey(item: Item, key: string) {
	const results: { el: InfoElement; blockIdx: number; elIdx: number }[] = [];
	if (!item.infoBlocks) return results;
	item.infoBlocks.forEach((block, bi) => {
		if (!("elements" in block) || !block.elements) return;
		block.elements.forEach((el, ei) => {
			if (
				el?.type === "numeric" ||
				el?.type === "numericVariants" ||
				el?.type === "range"
			) {
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
	const rangePairs: [number, number][] = [];
	if (!variant.infoBlocks)
		return { numToLocStr, nameColor, valueColor, rangePairs };

	for (const block of variant.infoBlocks) {
		if (!("title" in block) || !("elements" in block)) continue;
		const isUpgradeStatsBlock =
			block.title?.type === "translation" &&
			block.title.key === "stalker.tooltip.armor_artefact.info.upgrade_stats";

		if (!block.elements) continue;
		for (const el of block.elements) {
			if (
				(el.type === "numeric" ||
					el.type === "numericVariants" ||
					el.type === "range") &&
				el.name?.type === "translation" &&
				el.name.key === matchKey
			) {
				if (
					matchKey === "stalker.artefact_properties.factor.bullet_dmg_factor" &&
					isUpgradeStatsBlock
				)
					continue;

				if (el.type === "range") {
					const re = el as { min?: unknown; max?: unknown };
					if (
						typeof re.min === "number" &&
						typeof re.max === "number"
					) {
						rangePairs.push([re.min, re.max]);
					}
				} else {
					const vals = ensureNumberArray(
						(el as { value?: unknown }).value,
					);
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
				}

				if (!nameColor && el.formatted?.nameColor)
					nameColor = el.formatted.nameColor;
				if (!valueColor && el.formatted?.valueColor)
					valueColor = el.formatted.valueColor;

				if (!nameColor && el.nameColor) nameColor = el.nameColor;
				if (!valueColor && el.valueColor) valueColor = el.valueColor;
			}
		}
	}
	return { numToLocStr, nameColor, valueColor, rangePairs };
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
	const rangePairs: [number, number][] = [];
	let chosenNameColor: string | undefined;
	let chosenValueColor: string | undefined;

	for (const t of targets) {
		const el = t.el as {
			type?: string;
			value?: unknown;
			min?: unknown;
			max?: unknown;
		};

		if (el.type === "range") {
			if (typeof el.min === "number" && typeof el.max === "number") {
				rangePairs.push([el.min, el.max]);
			}
		} else {
			const origVals = ensureNumberArray(el.value);
			origVals.forEach((n) => {
				allNums.push(n);
			});
		}

		if (
			t.el.formatted?.value &&
			typeof t.el.formatted.value === "object"
		) {
			for (const [loc, s] of Object.entries(t.el.formatted.value)) {
				if (typeof s !== "string") continue;
				for (const n of ensureNumberArray(el.value)) {
					if (!numToLocaleStrings[n]) numToLocaleStrings[n] = {};
					numToLocaleStrings[n][loc] = s;
				}
			}
		}

		if (!chosenNameColor && t.el.formatted?.nameColor)
			chosenNameColor = t.el.formatted.nameColor;
		if (!chosenValueColor && t.el.formatted?.valueColor)
			chosenValueColor = t.el.formatted.valueColor;
		if (!chosenNameColor && t.el.nameColor) chosenNameColor = t.el.nameColor;
		if (!chosenValueColor && t.el.valueColor)
			chosenValueColor = t.el.valueColor;
	}

	for (const v of variants) {
		const { numToLocStr, nameColor, valueColor, rangePairs: vPairs } =
			collectFromVariant(v, matchKey);
		if (nameColor && !chosenNameColor) chosenNameColor = nameColor;
		if (valueColor && !chosenValueColor) chosenValueColor = valueColor;

		rangePairs.push(...vPairs);

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
		const el = t.el as {
			type: string;
			value?: number | number[] | [number, number][];
			nameColor?: string;
			valueColor?: string;
			formatted?: Record<string, unknown>;
		};

		if (rangePairs.length > 0) {
			const discreteRanges: [number, number][] = allNums.map(
				(n): [number, number] => [n, n],
			);
			const allPairs = uniqPairs([...rangePairs, ...discreteRanges]);
			el.type = "numericVariants";
			delete (el as { min?: unknown }).min;
			delete (el as { max?: unknown }).max;
			el.value = allPairs;
		} else {
			el.type = "numericVariants";
			el.value = merged;
		}

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
		} catch (e: unknown) {
			console.error(
				"[Merge] Error processing file",
				f,
				e instanceof Error ? e.message : e,
			);
		}
	}

	console.log("[Merge] Done.");
}
