#!/bin/bash
set -e

echo "=== Building AgentOfficeSuite Desktop App ==="

# 1. Build shell in app mode (static export)
echo "[1/4] Building shell (CSR mode)..."
cd shell
npm run build:app
cd ..

# 2. Move static files to shell-dist/
echo "[2/4] Preparing shell-dist..."
rm -rf shell-dist
mv shell/out shell-dist

# 3. Install gateway production dependencies
echo "[3/4] Installing gateway dependencies..."
cd gateway
npm install --omit=dev
cd ..

# 4. Install electron dependencies
echo "[4/4] Installing electron dependencies..."
cd electron
npm install --omit=dev
cd ..

echo ""
echo "=== Build preparation complete ==="
echo "To package the app, run:"
echo "  npx electron-builder --mac     # macOS"
echo "  npx electron-builder --win     # Windows"
echo "  npx electron-builder --linux   # Linux"
echo ""
echo "To test without packaging:"
echo "  npx electron electron/main.js"
