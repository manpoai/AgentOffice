#!/bin/bash
set -e

echo "=== Building AOSE Desktop App ==="

# 1. Build shell in app mode (static export, auto-rsync to ../shell-dist/)
echo "[1/4] Building shell (static export)..."
cd shell
npm run build:app   # Auto-rsyncs out/ → ../shell-dist/ since commit 150f83e
cd ..

# 2. Install gateway production dependencies
# DO NOT use --ignore-scripts here: better-sqlite3 has a native postinstall
# that compiles the .node binding. Without it, packaged App fails on
# "Could not locate the bindings file" when the gateway starts.
echo "[2/4] Installing gateway dependencies..."
cd gateway
npm install --omit=dev
cd ..

# 3. Install electron production dependencies (postinstall rebuilds node-pty)
echo "[3/4] Installing electron production dependencies..."
cd electron
npm install --omit=dev
cd ..

# 4. Install root devDependencies (electron-builder + electron) so packaging
#    can find them. Required because electron-builder reads electron version
#    from the project that owns it.
echo "[4/4] Installing electron-builder (root devDeps)..."
NODE_ENV=development npm install --include=dev --ignore-scripts

echo ""
echo "=== Build preparation complete ==="
echo "To package the app:"
echo "  CSC_IDENTITY_AUTO_DISCOVERY=false ./node_modules/.bin/electron-builder --mac --arm64 --x64 --publish never"
echo "  ./node_modules/.bin/electron-builder --win        # Windows"
echo "  ./node_modules/.bin/electron-builder --linux      # Linux"
echo ""
echo "Output goes to release/. See docs/RELEASE_CHECKLIST.md for full release flow."
echo ""
echo "Run the packaged App without DMG (faster iteration):"
echo "  npx electron electron/main.js"
