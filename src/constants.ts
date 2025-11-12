import path from "path";

export const ORIG_DIR = "./items";
export const OUT_DIR = "./merged";
export const SHA_FILE = path.join(ORIG_DIR, ".last_sha");

export const GITHUB_OWNER = "EXBO-Studio";
export const GITHUB_REPO = "stalcraft-database";
export const GITHUB_BRANCH = process.env.GITHUB_BRANCH || "main";
export const FORCE_PULL = process.env.FORCE_PULL === "1";
export const CLEAN_ORIG = process.env.CLEAN_ORIG === "1";
export const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
