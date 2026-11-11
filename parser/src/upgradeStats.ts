import fs from "node:fs";
import path from "node:path";
import type { Item, NumericElement, NumericVariantsElement } from "./type";
import { readJSONSync, scanFolder, writeJSONSync } from "./utils/fsUtils";

const KEY_DAMAGE_DIRECT = "core.tooltip.stat_name.damage_type.direct";
const KEY_BULLET_DMG = "stalker.artefact_properties.factor.bullet_dmg_factor";
const UPGRADE_LEVELS = 16;

const CONFIG_PATH = path.join(
	import.meta.dir,
	"..",
	"configs",
	"upgrade-stats.json",
);

interface UpgradeConfig {
	peaks: Record<string, number>;
	weapons: Record<
		string,
		{
			damage?: number;
			upgraded_damage?: number;
			damage_distant?: number;
			upgraded_damage_distant?: number;
			max_distance?: number;
			damage_decrease_start?: number;
			damage_decrease_end?: number;
		}
	>;
	armors: Record<
		string,
		{ bullet_dmg_factor: number; upgraded_bullet_dmg_factor: number }
	>;
}

function elementKey(el: Record<string, unknown>): string | undefined {
	const name = el.name as { type?: string; key?: string } | undefined;
	return name?.type === "translation" ? name.key : undefined;
}

function elementLists(item: Item): Record<string, unknown>[][] {
	const out: Record<string, unknown>[][] = [];
	for (const block of item.infoBlocks ?? []) {
		if (block.type === "list" || block.type === "addStat") {
			out.push(block.elements as Record<string, unknown>[]);
		} else if (block.type === "grouped") {
			for (const sub of [...block.compact, ...block.detailed]) {
				if (sub.type === "list" || sub.type === "addStat") {
					out.push(sub.elements as Record<string, unknown>[]);
				}
			}
		}
	}
	return out.filter((els) => Array.isArray(els));
}

function unFromItem(item: Item): string | undefined {
	const name = item.name;
	if (name?.type !== "translation") return undefined;
	const key = name.key;
	if (!key.startsWith("item.") || !key.endsWith(".name")) return undefined;
	return key.slice("item.".length, -".name".length);
}

function round6(x: number): number {
	return Math.round(x * 1e6) / 1e6;
}

function levelFractions(peaks: number[]): number[] {
	const total = peaks.reduce((a, b) => a + b, 0);
	const out: number[] = [0];
	let sum = 0;
	for (const p of peaks.slice(0, UPGRADE_LEVELS - 1)) {
		sum += p;
		out.push(total > 0 ? sum / total : 0);
	}
	return out;
}

function bonusShare(maxPercent: number, fraction: number): number {
	return Math.min(1, Math.max(0, (maxPercent * fraction) / 100));
}

function convertToVariants(
	el: NumericElement,
	base: number,
	maxPercent: number,
	fractions: number[],
): NumericVariantsElement {
	const variants: number[] = [];
	for (let n = 0; n < UPGRADE_LEVELS; n++) {
		variants.push(
			round6(base * (1 + bonusShare(maxPercent, fractions[n] ?? 0))),
		);
	}
	return {
		type: "numericVariants",
		name: el.name,
		value: variants,
		nameColor: el.nameColor,
		valueColor: el.valueColor,
		formatted: el.formatted,
	};
}

async function processItems(
	itemsDir: string,
	transform: (item: Item) => boolean,
): Promise<number> {
	if (!fs.existsSync(itemsDir)) return 0;
	let changedCount = 0;
	for (const file of scanFolder(itemsDir)) {
		let item: Item;
		try {
			item = JSON.parse(fs.readFileSync(file, "utf8")) as Item;
		} catch {
			continue;
		}
		if (!transform(item)) continue;
		writeJSONSync(file, item);
		changedCount++;
	}
	return changedCount;
}

export async function applyUpgradeStats(outDir: string) {
	if (!fs.existsSync(CONFIG_PATH)) {
		console.log(
			"[UpgradeStats] configs/upgrade-stats.json missing, skipping (run tools/extract-upgrade-stats.mjs)",
		);
		return;
	}

	const cfg = readJSONSync(CONFIG_PATH) as UpgradeConfig;
	const peaks = Object.entries(cfg.peaks)
		.sort(([a], [b]) => Number(a) - Number(b))
		.map(([, v]) => v)
		.filter((v) => typeof v === "number");
	const fractions = levelFractions(peaks);

	const weaponDir = path.join(outDir, "items", "weapon");
	const unoWeaponDir = path.join(outDir, "items", "uno", "weapon");
	const armorDir = path.join(outDir, "items", "armor");
	const unoArmorDir = path.join(outDir, "items", "uno", "armor");

	let weaponVariants = 0;
	let armorVariants = 0;

	const processWeapon = (item: Item): boolean => {
		const un = unFromItem(item);
		const wcfg = un ? cfg.weapons[un] : undefined;
		if (
			wcfg &&
			typeof wcfg.upgraded_damage === "number" &&
			wcfg.upgraded_damage > 0
		) {
			for (const els of elementLists(item)) {
				const idx = els.findIndex(
					(el) => el.type === "numeric" && elementKey(el) === KEY_DAMAGE_DIRECT,
				);
				if (idx === -1) continue;
				const numEl = els[idx] as unknown as NumericElement;
				const base =
					typeof numEl.value === "number" ? numEl.value : (wcfg.damage ?? 0);
				els[idx] = convertToVariants(
					numEl,
					base,
					wcfg.upgraded_damage,
					fractions,
				);
				weaponVariants++;
				return true;
			}
		}
		return false;
	};

	const processArmor = (item: Item): boolean => {
		const un = unFromItem(item);
		const acfg = un ? cfg.armors[un] : undefined;
		if (!acfg || !(acfg.upgraded_bullet_dmg_factor > 0)) return false;
		for (const els of elementLists(item)) {
			const idx = els.findIndex(
				(el) => el.type === "numeric" && elementKey(el) === KEY_BULLET_DMG,
			);
			if (idx === -1) continue;
			const numEl = els[idx] as unknown as NumericElement;
			const base =
				typeof numEl.value === "number" ? numEl.value : acfg.bullet_dmg_factor;
			els[idx] = convertToVariants(
				numEl,
				base,
				acfg.upgraded_bullet_dmg_factor,
				fractions,
			);
			armorVariants++;
			return true;
		}
		return false;
	};

	await processItems(weaponDir, processWeapon);
	await processItems(unoWeaponDir, processWeapon);
	await processItems(armorDir, processArmor);
	await processItems(unoArmorDir, processArmor);

	console.log(
		`[UpgradeStats] weapon variants added: ${weaponVariants}, armor variants added: ${armorVariants}`,
	);
}
