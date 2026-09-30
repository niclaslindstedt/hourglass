// Where the skill keeps its things. Everything it writes stays inside its own
// directory (gitignored there) — never the checkout's dist/, which a deploy or
// the shells' bundle scripts would pick up.

import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const SKILL_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
/** The checkout: .agents/skills/screenshot → three up. */
export const REPO_DIR = resolve(SKILL_DIR, "..", "..", "..");
export const BUILD_DIR = join(SKILL_DIR, ".build");
export const OUT_DIR = join(SKILL_DIR, "out");
