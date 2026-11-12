#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
: "${CAPTURE_URL:?Set CAPTURE_URL to the exact preview URL to capture.}"
: "${CAPTURE_DIR:?Set CAPTURE_DIR to an output directory.}"
/usr/bin/time -p node --input-type=module -e 'const url = new URL(process.env.CAPTURE_URL); if (!["http:", "https:"].includes(url.protocol)) process.exit(1);'
CAPTURE_DIR="$(/usr/bin/time -p realpath -m -- "$CAPTURE_DIR")"

case "$CAPTURE_DIR" in
  "$PROJECT_DIR"|"$PROJECT_DIR"/*)
    echo "CAPTURE_DIR must be outside the project source directory." >&2
    exit 1
    ;;
esac

RUNTIME_DIR="${RUNTIME_DIR:-/home/runner/work/_temp/omgithub-runtime}"
/usr/bin/time -p mkdir -p "$CAPTURE_DIR"
export CAPTURE_STRICT=1
/usr/bin/time -p node "$RUNTIME_DIR/scripts/default-capture.mjs"
