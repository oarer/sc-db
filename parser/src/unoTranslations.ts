import fs from "node:fs";
import path from "node:path";
import type { Item } from "./type";
import { readJSONSync, scanFolder, writeJSONSync } from "./utils/fsUtils";

const TRANSLATIONS_PATH = path.join(import.meta.dir, "translations.json");

type TranslationLines = Record<string, string>;

interface MessageLike {
	type?: string;
	key?: string;
	lines?: TranslationLines;
}

function fillMessage(
	msg: unknown,
	translations: Record<string, TranslationLines>,
): boolean {
	if (typeof msg !== "object" || msg === null) return false;
	const m = msg as MessageLike;
	if (m.type !== "translation" || typeof m.key !== "string") return false;
	if (m.lines && Object.keys(m.lines).length > 0) return false;
	const lines = translations[m.key];
	if (!lines) return false;
	m.lines = { ...lines };
	return true;
}

function fillItem(
	item: Item,
	translations: Record<string, TranslationLines>,
): boolean {
	let changed = false;
	for (const block of item.infoBlocks ?? []) {
		const candidates: unknown[] = [block];
		if (block.type === "grouped") {
			candidates.push(...block.compact, ...block.detailed);
		}
		for (const candidate of candidates) {
			if (!candidate || typeof candidate !== "object") continue;
			const obj = candidate as { title?: unknown; elements?: unknown[] };
			if (fillMessage(obj.title, translations)) changed = true;
			for (const el of obj.elements ?? []) {
				if (!el || typeof el !== "object") continue;
				const elObj = el as Record<string, unknown>;
				for (const field of ["name", "key", "value", "title", "text"]) {
					if (fillMessage(elObj[field], translations)) changed = true;
				}
			}
		}
	}
	return changed;
}

/** Fills missing `lines` on key-only translation messages of uno items. */
export async function applyUnoTranslations(outDir: string) {
	if (!fs.existsSync(TRANSLATIONS_PATH)) {
		console.log("[UnoTranslations] translations.json missing, skipping");
		return;
	}
	const translations = readJSONSync(TRANSLATIONS_PATH) as Record<
		string,
		TranslationLines
	>;

	const unoDir = path.join(outDir, "items", "uno");
	if (!fs.existsSync(unoDir)) return;

	let filled = 0;
	for (const file of scanFolder(unoDir)) {
		let item: Item;
		try {
			item = JSON.parse(fs.readFileSync(file, "utf8")) as Item;
		} catch {
			continue;
		}
		if (!fillItem(item, translations)) continue;
		writeJSONSync(file, item);
		filled++;
	}

	console.log(
		`[UnoTranslations] translations filled for ${filled} items (${Object.keys(translations).length} keys)`,
	);
}
