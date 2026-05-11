#!/bin/bash
# Copies the current system Node binary into the App bundle.
# Run this AFTER `npm install`/`npm rebuild` in gateway/ so the bundled
# Node matches the ABI of the compiled native modules.
#
# Usage: bash bundle-node.sh [target-dir]
# Default target: ../node-runtime/

set -e

TARGET_DIR="${1:-$(dirname "$0")/../../node-runtime}"
mkdir -p "$TARGET_DIR"

NODE_BIN="$(which node)"
NODE_VERSION="$(node -v)"
NODE_ARCH="$(node -p process.arch)"
NODE_ABI="$(node -p process.versions.modules)"

echo "[bundle-node] Bundling $NODE_BIN ($NODE_VERSION, $NODE_ARCH, ABI $NODE_ABI)"
cp "$NODE_BIN" "$TARGET_DIR/node"
chmod 755 "$TARGET_DIR/node"

# Verify
BUNDLED_VERSION="$("$TARGET_DIR/node" -v)"
echo "[bundle-node] Bundled: $TARGET_DIR/node ($BUNDLED_VERSION)"
