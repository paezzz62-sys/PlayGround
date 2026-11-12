#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
cd "$PROJECT_DIR"
PORT="${PORT:-3000}"
WEB_METADATA_DIR="${OPENCODE_WEB_DIR:-/home/runner/work/_temp/omgithub-web}"

[[ "$PORT" =~ ^[0-9]+$ ]] || { echo "PORT must be a numeric port." >&2; exit 1; }
/usr/bin/time -p npm ci --no-audit --no-fund
/usr/bin/time -p npm run build
[[ -f "$PROJECT_DIR/dist/index.html" ]] || { echo "Build did not create dist/index.html." >&2; exit 1; }
/usr/bin/time -p mkdir -p "$WEB_METADATA_DIR"
PROJECT_DIR="$PROJECT_DIR" WEB_METADATA_DIR="$WEB_METADATA_DIR" /usr/bin/time -p node --input-type=module -e 'import { writeFileSync } from "node:fs"; import { resolve } from "node:path"; const project = process.env.PROJECT_DIR; const directory = resolve(project, "dist"); writeFileSync(resolve(process.env.WEB_METADATA_DIR, "deployment-output.json"), JSON.stringify({ project, directory }) + "\n");'
/usr/bin/time -p npm run preview -- --host 0.0.0.0 --port "$PORT" --strictPort
