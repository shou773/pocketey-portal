#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dirname, "../public");

const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#1a0a30"/>
  <circle cx="256" cy="256" r="170" fill="#ffb020"/>
  <text x="256" y="338" text-anchor="middle" font-family="Fredoka, system-ui, sans-serif" font-size="220" font-weight="800" fill="#1a0a30">P3</text>
</svg>`;

const OG_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fff7ea"/>
      <stop offset="1" stop-color="#ffd784"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect x="40" y="40" width="1120" height="550" rx="36" fill="#1a0a30"/>
  <circle cx="240" cy="315" r="160" fill="#ffb020"/>
  <text x="240" y="385" text-anchor="middle" font-family="Fredoka, system-ui, sans-serif" font-size="180" font-weight="800" fill="#1a0a30">P3</text>
  <text x="460" y="280" font-family="Fredoka, system-ui, sans-serif" font-size="92" font-weight="800" fill="#ffb020">Pocket3D</text>
  <text x="460" y="360" font-family="Fredoka, system-ui, sans-serif" font-size="42" font-weight="500" fill="#fff7ea">1-Minute 3D Browser Games</text>
  <text x="460" y="430" font-family="Fredoka, system-ui, sans-serif" font-size="28" font-weight="400" fill="#fff7ea" opacity="0.85">Tap. Swipe. Pop. No download.</text>
</svg>`;

async function gen() {
  await mkdir(publicDir, { recursive: true });

  const iconBuf = Buffer.from(ICON_SVG);
  const ogBuf = Buffer.from(OG_SVG);

  await Promise.all([
    sharp(iconBuf).resize(192, 192).png().toFile(resolve(publicDir, "icon-192.png")),
    sharp(iconBuf).resize(512, 512).png().toFile(resolve(publicDir, "icon-512.png")),
    sharp(iconBuf).resize(180, 180).png().toFile(resolve(publicDir, "apple-touch-icon.png")),
    sharp(ogBuf).resize(1200, 630).png().toFile(resolve(publicDir, "og-default.png")),
  ]);

  console.log("Generated icons + OG image in", publicDir);
}

gen().catch((e) => {
  console.error(e);
  process.exit(1);
});
