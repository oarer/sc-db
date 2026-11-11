import fs from "node:fs";
import path from "node:path";
import { readJSONSync } from "./utils/fsUtils";

const KEY_DIRECT = "core.tooltip.stat_name.damage_type.direct";
const KEY_DAMAGE_DISTANT = "weapon.tooltip.weapon.info.damage_distant";
const KEY_DAMAGE_DECREASE_START =
	"weapon.tooltip.weapon.info.damage_decrease_start";
const KEY_DAMAGE_DECREASE_END =
	"weapon.tooltip.weapon.info.damage_decrease_end";
const KEY_DISTANCE = "weapon.tooltip.weapon.info.distance";
const KEY_AMMO_TYPE = "weapon.tooltip.weapon.info.ammo_type";

interface WeaponUpgradeConfig {
	damage?: number;
	upgraded_damage?: number;
	damage_distant?: number;
	upgraded_damage_distant?: number;
	max_distance?: number;
	damage_decrease_start?: number;
	damage_decrease_end?: number;
}

interface UpgradeStatsConfig {
	weapons: Record<string, WeaponUpgradeConfig>;
}

const UPGRADE_STATS_PATH = path.join(
	import.meta.dir,
	"..",
	"configs",
	"upgrade-stats.json",
);

function loadWeaponConfigs(): Record<string, WeaponUpgradeConfig> {
	try {
		const cfg = readJSONSync(UPGRADE_STATS_PATH) as UpgradeStatsConfig;
		return cfg.weapons ?? {};
	} catch {
		return {};
	}
}

interface WeaponItem {
	id: string;
	name?: { key?: string };
	infoBlocks?: Record<string, unknown>[];
	[key: string]: unknown;
}

function walkJsonFiles(dir: string): string[] {
	const results: string[] = [];
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			if (entry.name === "_variants") continue;
			results.push(...walkJsonFiles(full));
		} else if (entry.name.endsWith(".json")) {
			results.push(full);
		}
	}
	return results;
}

function listElements(item: WeaponItem): Record<string, unknown>[] {
	const out: Record<string, unknown>[] = [];
	for (const block of item.infoBlocks ?? []) {
		const lists =
			block.type === "grouped"
				? [
						...((block.compact as unknown[]) ?? []),
						...((block.detailed as unknown[]) ?? []),
					]
				: [block];
		for (const sub of lists) {
			out.push(
				...((sub as { elements?: Record<string, unknown>[] })?.elements ?? []),
			);
		}
	}
	return out;
}

function getNumeric(item: WeaponItem, key: string): number | undefined {
	for (const el of listElements(item)) {
		if ((el.name as { key?: string } | undefined)?.key !== key) continue;
		if (el.type === "numeric" && typeof el.value === "number") {
			return el.value;
		}
		if (
			el.type === "numericVariants" &&
			Array.isArray(el.value) &&
			typeof el.value[0] === "number"
		) {
			return el.value[0];
		}
	}
	return undefined;
}

function findAmmoTypeElement(
	item: WeaponItem,
): Record<string, unknown> | undefined {
	for (const el of listElements(item)) {
		if (
			el.type === "key-value" &&
			(el.key as { key?: string } | undefined)?.key === KEY_AMMO_TYPE
		) {
			return el;
		}
	}
	return undefined;
}

function candidateBaseKeys(nameKey: string): string[] {
	const out: string[] = [nameKey];
	const cur = nameKey.replace(/-\d+\.name$/, ".name");
	if (cur !== nameKey) out.push(cur);
	const parts = cur.replace(/\.name$/, "").split("_");
	while (parts.length > 1) {
		parts.pop();
		out.push(`${parts.join("_")}.name`);
	}
	return out;
}

function loadBaseWeapons(outDir: string): Map<string, WeaponItem> {
	const map = new Map<string, WeaponItem>();
	const weaponDir = path.join(outDir, "items", "weapon");
	if (!fs.existsSync(weaponDir)) return map;
	for (const file of walkJsonFiles(weaponDir)) {
		try {
			const item = JSON.parse(fs.readFileSync(file, "utf8")) as WeaponItem;
			const key = item.name?.key;
			if (key && !map.has(key)) map.set(key, item);
		} catch {
			// skip 
		}
	}
	return map;
}

function hasDamageBlock(item: WeaponItem): boolean {
	const find = (blocks: Record<string, unknown>[] | undefined): boolean => {
		for (const block of blocks ?? []) {
			if (block.type === "damage") return true;
			if (block.type === "grouped") {
				if (
					find(block.compact as Record<string, unknown>[]) ||
					find(block.detailed as Record<string, unknown>[])
				) {
					return true;
				}
			}
		}
		return false;
	};
	return find(item.infoBlocks);
}

function unFromItem(item: WeaponItem): string | undefined {
	const name = item.name as { type?: string; key?: string } | undefined;
	if (name?.type !== "translation") return undefined;
	const key = name.key;
	if (typeof key !== "string") return undefined;
	if (!key.startsWith("item.") || !key.endsWith(".name")) return undefined;
	return key.slice("item.".length, -".name".length);
}

function buildDamageBlock(
	item: WeaponItem,
	weaponConfigs: Record<string, WeaponUpgradeConfig>,
): Record<string, unknown> | undefined {
	const un = unFromItem(item);
	let wcfg: WeaponUpgradeConfig | undefined = un
		? weaponConfigs[un]
		: undefined;
	if (un) {
		// Longest-prefix match over config keys ("wpn.ptrd_encaged" ->
		// "wpn.ptrd") fills fields missing from the item's own config.
		let best: WeaponUpgradeConfig | undefined;
		let bestLen = 0;
		for (const key of Object.keys(weaponConfigs)) {
			if (key === un || key.length <= bestLen) continue;
			if (un.startsWith(`${key}_`)) {
				best = weaponConfigs[key];
				bestLen = key.length;
			}
		}
		if (best) {
			wcfg = wcfg ? { ...best, ...wcfg } : best;
		}
	}
	const startDamage = getNumeric(item, KEY_DIRECT);
	const endDamage = getNumeric(item, KEY_DAMAGE_DISTANT);
	const damageDecreaseStart =
		getNumeric(item, KEY_DAMAGE_DECREASE_START) ?? wcfg?.damage_decrease_start;
	const damageDecreaseEnd =
		getNumeric(item, KEY_DAMAGE_DECREASE_END) ?? wcfg?.damage_decrease_end;
	const maxDistance = getNumeric(item, KEY_DISTANCE) ?? wcfg?.max_distance;
	if (
		startDamage === undefined ||
		endDamage === undefined ||
		damageDecreaseStart === undefined ||
		damageDecreaseEnd === undefined ||
		maxDistance === undefined
	) {
		return undefined;
	}
	return {
		type: "damage",
		startDamage,
		damageDecreaseStart,
		endDamage,
		damageDecreaseEnd,
		maxDistance,
	};
}

function buildAmmoBlock(
	element: Record<string, unknown>,
): Record<string, unknown> {
	return {
		type: "list",
		title: { type: "text", text: "" },
		elements: [element],
	};
}

export async function applyUnoWeaponStats(outDir: string) {
	const unoWeaponDir = path.join(outDir, "items", "uno", "weapon");
	if (!fs.existsSync(unoWeaponDir)) {
		console.log("[UnoWeaponStats] no items/uno/weapon dir, skipping");
		return;
	}

	const weaponConfigs = loadWeaponConfigs();

	const baseWeapons = loadBaseWeapons(outDir);

	let damageAdded = 0;
	let ammoAdded = 0;
	let skipped = 0;
	let noDamageNumbers = 0;

	for (const file of walkJsonFiles(unoWeaponDir)) {
		let item: WeaponItem;
		try {
			item = JSON.parse(fs.readFileSync(file, "utf8")) as WeaponItem;
		} catch {
			continue;
		}

		if (hasDamageBlock(item)) {
			skipped++;
			continue;
		}

		let changed = false;
		const damageBlock = buildDamageBlock(item, weaponConfigs);
		if (damageBlock && item.infoBlocks) {
			item.infoBlocks.push(damageBlock);
			damageAdded++;
			changed = true;
		} else {
			noDamageNumbers++;
		}

		const nameKey = item.name?.key;
		if (nameKey && !findAmmoTypeElement(item)) {
			for (const candidate of candidateBaseKeys(nameKey)) {
				const base = baseWeapons.get(candidate);
				const element = base ? findAmmoTypeElement(base) : undefined;
				if (element && item.infoBlocks) {
					item.infoBlocks.unshift(buildAmmoBlock(element));
					ammoAdded++;
					changed = true;
					break;
				}
			}
		}

		if (changed) {
			await fs.promises.writeFile(file, JSON.stringify(item, null, 2), "utf-8");
		}
	}

	console.log(
		`[UnoWeaponStats] damage blocks: +${damageAdded}, ammo types: +${ammoAdded}, already has damage: ${skipped}, no damage numbers: ${noDamageNumbers}`,
	);
}
