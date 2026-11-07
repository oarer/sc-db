import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MERGED_ITEMS = path.join(__dirname, "../../merged/items");
const ARMOR_MAP = path.join(__dirname, "../models-map.json");
const WEAPON_MAP = path.join(__dirname, "../weapon-models-map.json");

type JsonRecord = Record<string, unknown>;

type RenderModel = {
	model: string;
	diff?: string;
	nrm?: string;
	emi?: string;
	spek?: string;
};

function asRecord(value: unknown): JsonRecord | null {
	return value !== null && typeof value === "object" && !Array.isArray(value)
		? (value as JsonRecord)
		: null;
}

function isHeavyArmor(model: string): boolean {
	return /\/[^/]*(?:_h|heavy)[^/]*\//i.test(model);
}

function collectWeaponTypes(value: unknown): string[] {
	const record = asRecord(value);
	if (!record) {
		if (Array.isArray(value)) return value.flatMap(collectWeaponTypes);
		return [];
	}

	const types: string[] = [];
	const key = record.key;
	if (
		typeof key === "string" &&
		key.startsWith("weapon.tooltip.weapon.info.weapon_type.")
	) {
		types.push(key.slice(key.lastIndexOf(".") + 1));
	}
	for (const child of Object.values(record))
		types.push(...collectWeaponTypes(child));
	return types;
}

function weaponClass(item: JsonRecord): "primary" | "pistol" | "melee" | null {
	if (typeof item.category === "string" && item.category === "weapon/melee")
		return "melee";

	const types = collectWeaponTypes(item);
	if (types.includes("melee")) return "melee";
	if (types.includes("secondary")) return "pistol";
	if (types.includes("primary")) return "primary";
	return null;
}

async function getJsonFiles(dir: string): Promise<string[]> {
	const entries = await (await import("node:fs/promises")).readdir(dir, {
		withFileTypes: true,
	});
	const files: string[] = [];
	for (const entry of entries) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) files.push(...(await getJsonFiles(full)));
		else if (entry.name.endsWith(".json")) files.push(full);
	}
	return files;
}

async function loadMap(file: string): Promise<Record<string, RenderModel>> {
	return JSON.parse(await readFile(file, "utf8")) as Record<
		string,
		RenderModel
	>;
}

export async function applyRenderMetadata() {
	const armorMap = await loadMap(ARMOR_MAP);
	const weaponMap = await loadMap(WEAPON_MAP);
	const files = await getJsonFiles(MERGED_ITEMS);
	let modelsAdded = 0;
	let armorStancesAdded = 0;
	let weaponClassesAdded = 0;

	for (const file of files) {
		const item = JSON.parse(await readFile(file, "utf8")) as JsonRecord;
		const id = typeof item.id === "string" ? item.id : null;
		if (!id) continue;

		const relative = path.relative(MERGED_ITEMS, file).replace(/\\/g, "/");
		const isArmor = relative.startsWith("armor/");
		const isWeapon = relative.startsWith("weapon/");
		const modelMap = isWeapon ? weaponMap : armorMap;
		const model = modelMap[id];
		let changed = false;

		if (model && !asRecord(item.model)?.model) {
			item.model = model;
			modelsAdded++;
			changed = true;
		}

		if (
			isArmor &&
			asRecord(item.model)?.model &&
			item.menu_anim_heavy === undefined
		) {
			item.menu_anim_heavy = isHeavyArmor(String(asRecord(item.model)?.model));
			armorStancesAdded++;
			changed = true;
		}

		if (isWeapon && item.menu_anim_class === undefined) {
			const className = weaponClass(item);
			if (className) {
				item.menu_anim_class = className;
				weaponClassesAdded++;
				changed = true;
			}
		}

		if (changed) await writeFile(file, JSON.stringify(item, null, 2), "utf8");
	}

	console.log(
		`[Render] models added: ${modelsAdded}; armor stances: ${armorStancesAdded}; weapon classes: ${weaponClassesAdded}`,
	);
}
