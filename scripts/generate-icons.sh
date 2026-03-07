#!/usr/bin/env bash
# =============================================================================
# Generate Tauri app icons from the SVG logo.
# Delegates to scripts/generate-icons.mjs (Node.js + @resvg/resvg-js).
# =============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if ! command -v node &>/dev/null; then
  echo "ERROR: Node.js is required for icon generation." >&2
  exit 1
fi

cd "$ROOT/frontend-neopop"

if [ ! -d node_modules/@resvg/resvg-js ]; then
  echo "==> Installing @resvg/resvg-js..."
  npm install --save-dev @resvg/resvg-js
fi

# Run from frontend-neopop so Node resolves @resvg/resvg-js from its node_modules
node "$ROOT/scripts/generate-icons.mjs"
