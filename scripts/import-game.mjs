#!/usr/bin/env node
/**
 * Import a finished game into the portal.
 *
 * Usage:  node scripts/import-game.mjs ../games/<slug>/
 *
 * What it does:
 *   1. Reads <gameDir>/game.json and validates the required fields
 *      (Astro Content Collections + Zod will catch the rest at build time).
 *   2. Verifies <gameDir>/out/ exists (the static export).
 *   3. Copies <gameDir>/out/* into portal/public/games/<slug>/.
 *   4. Writes the game.json into portal/src/content/games/<slug>.json.
 *
 * Re-running on the same game replaces the existing entry (idempotent).
 */
import {
  cp,
  mkdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_FIELDS = [
  "slug",
  "title",
  "tagline",
  "description",
  "category",
  "thumbnail",
  "playUrl",
  "playTime",
  "orientation",
  "releaseDate",
  "version",
];

const __dirname = dirname(fileURLToPath(import.meta.url));
const portalRoot = resolve(__dirname, "..");

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error("usage: node scripts/import-game.mjs <path-to-game-dir>");
    process.exit(1);
  }

  const gameDir = isAbsolute(arg) ? arg : resolve(process.cwd(), arg);

  if (!(await exists(gameDir))) {
    console.error(`game dir not found: ${gameDir}`);
    process.exit(1);
  }

  // 1. Read + validate game.json
  const metaPath = resolve(gameDir, "game.json");
  if (!(await exists(metaPath))) {
    console.error(`missing game.json in ${gameDir}`);
    process.exit(1);
  }
  let meta;
  try {
    meta = JSON.parse(await readFile(metaPath, "utf8"));
  } catch (e) {
    console.error(`game.json failed to parse:`, e.message);
    process.exit(1);
  }

  const missing = REQUIRED_FIELDS.filter(
    (k) => meta[k] === undefined || meta[k] === null || meta[k] === "",
  );
  if (missing.length > 0) {
    console.error(`game.json is missing required fields: ${missing.join(", ")}`);
    process.exit(1);
  }

  if (!/^[a-z0-9-]+$/.test(meta.slug)) {
    console.error(`slug "${meta.slug}" must match /^[a-z0-9-]+$/`);
    process.exit(1);
  }

  // 2. Verify static export
  const outDir = resolve(gameDir, "out");
  if (!(await exists(outDir))) {
    console.error(
      `expected static export at ${outDir}. Run "npm run build" inside ${gameDir} first.`,
    );
    process.exit(1);
  }

  // 3. Copy out/ into portal/public/games/<slug>/play/.
  //    The "play/" subpath is required so the portal's detail route
  //    /games/<slug>/ does not collide with the game's index.html.
  const slugRoot = resolve(portalRoot, "public", "games", meta.slug);
  const dest = resolve(slugRoot, "play");
  if (await exists(slugRoot)) {
    await rm(slugRoot, { recursive: true, force: true });
  }
  await mkdir(dest, { recursive: true });
  await cp(outDir, dest, { recursive: true });

  // 4. Copy thumbnail / OG image to /games/<slug>/ (siblings of /play/)
  //    so portal pages can reference them by stable URLs.
  const aux = ["thumbnail.webp", "thumbnail.png", "og-image.png"];
  for (const f of aux) {
    const src = resolve(gameDir, "public", f);
    const dst = resolve(slugRoot, f);
    if (await exists(src)) {
      await cp(src, dst);
    }
  }

  // 5. Write metadata into Astro content collection
  const contentDir = resolve(portalRoot, "src", "content", "games");
  await mkdir(contentDir, { recursive: true });
  await writeFile(
    resolve(contentDir, `${meta.slug}.json`),
    JSON.stringify(meta, null, 2) + "\n",
    "utf8",
  );

  console.log(`✓ imported ${meta.slug}`);
  console.log(`  metadata → src/content/games/${meta.slug}.json`);
  console.log(`  static   → public/games/${meta.slug}/`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
