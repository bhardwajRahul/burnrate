#!/usr/bin/env node
/**
 * Generate Tauri app icons from burnrate-logo.svg using resvg (Rust-based SVG renderer).
 *
 * Output (relative to repo root):
 *   src-tauri/icons/32x32.png
 *   src-tauri/icons/128x128.png
 *   src-tauri/icons/128x128@2x.png
 *   src-tauri/icons/icon.png          (256x256)
 *   src-tauri/icons/icon.icns         (macOS, via iconutil)
 *   src-tauri/icons/icon.ico          (Windows, multi-res ICO container)
 */

import { createRequire } from "module";
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const require = createRequire(join(ROOT, "frontend-neopop", "package.json"));
const { Resvg } = require("@resvg/resvg-js");

const SVG_DIST = join(ROOT, "frontend-neopop", "dist", "burnrate-logo.svg");
const SVG_PUBLIC = join(ROOT, "frontend-neopop", "public", "burnrate-logo.svg");
const SVG_PATH = existsSync(SVG_DIST) ? SVG_DIST : SVG_PUBLIC;
const ICON_DIR = join(ROOT, "src-tauri", "icons");

function renderSvgToPng(svgData, size) {
  const resvg = new Resvg(svgData, {
    fitTo: { mode: "width", value: size },
    background: "rgba(0,0,0,0)",
  });
  return resvg.render().asPng();
}

function writeIco(entries, outPath) {
  const count = entries.length;
  const headerSize = 6;
  const entrySize = 16;
  const dataOffset = headerSize + count * entrySize;

  let totalSize = dataOffset;
  for (const { png } of entries) totalSize += png.length;

  const ico = Buffer.alloc(totalSize);
  ico.writeUInt16LE(0, 0);
  ico.writeUInt16LE(1, 2);
  ico.writeUInt16LE(count, 4);

  let offset = dataOffset;
  for (let i = 0; i < count; i++) {
    const { size, png } = entries[i];
    const pos = headerSize + i * entrySize;
    ico.writeUInt8(size >= 256 ? 0 : size, pos);
    ico.writeUInt8(size >= 256 ? 0 : size, pos + 1);
    ico.writeUInt8(0, pos + 2);
    ico.writeUInt8(0, pos + 3);
    ico.writeUInt16LE(1, pos + 4);
    ico.writeUInt16LE(32, pos + 6);
    ico.writeUInt32LE(png.length, pos + 8);
    ico.writeUInt32LE(offset, pos + 12);
    png.copy(ico, offset);
    offset += png.length;
  }

  writeFileSync(outPath, ico);
}

const svgData = readFileSync(SVG_PATH, "utf8");
mkdirSync(ICON_DIR, { recursive: true });

console.log(`==> Rendering icons from ${SVG_PATH}`);

const sizes = { "32x32.png": 32, "128x128.png": 128, "128x128@2x.png": 256, "icon.png": 256 };
const rendered = {};

for (const [name, size] of Object.entries(sizes)) {
  const png = renderSvgToPng(svgData, size);
  writeFileSync(join(ICON_DIR, name), png);
  rendered[size] = png;
  console.log(`    ${name} (${size}x${size})`);
}

// .icns via iconutil (macOS only)
try {
  execSync("command -v iconutil", { stdio: "ignore" });
  const iconsetDir = join(ICON_DIR, "icon.iconset");
  mkdirSync(iconsetDir, { recursive: true });

  const icnsSizes = [16, 32, 64, 128, 256, 512];
  for (const s of icnsSizes) {
    writeFileSync(join(iconsetDir, `icon_${s}x${s}.png`), renderSvgToPng(svgData, s));
    const d = s * 2;
    if (d <= 1024) {
      writeFileSync(join(iconsetDir, `icon_${s}x${s}@2x.png`), renderSvgToPng(svgData, d));
    }
  }

  execSync(`iconutil -c icns "${iconsetDir}" -o "${join(ICON_DIR, "icon.icns")}"`, { stdio: "inherit" });
  rmSync(iconsetDir, { recursive: true, force: true });
  console.log("    icon.icns (macOS)");
} catch {
  console.log("    icon.icns skipped (iconutil not available)");
}

// .ico (multi-resolution ICO container with embedded PNGs)
const icoSizes = [16, 32, 48, 256];
const icoEntries = icoSizes.map((s) => ({
  size: s,
  png: rendered[s] || renderSvgToPng(svgData, s),
}));
writeIco(icoEntries, join(ICON_DIR, "icon.ico"));
console.log("    icon.ico (Windows)");

console.log("==> Icon generation complete");
