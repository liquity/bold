#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
cd "$APP_DIR"

if [ ! -f "env.release" ]; then
  echo "Error: env.release not found"
  echo "Create env.release with public RPC URLs before building a release."
  exit 1
fi

VERSION=$(node -p "require('./package.json').version")
RELEASE_NAME="liquity-app-v${VERSION}"
RELEASE_DIR="./release/${RELEASE_NAME}"

echo "Building Liquity App v${VERSION} using env.release..."

mv .env.local .env.local.bak 2>/dev/null || true
cp env.release .env.local

cleanup() {
  rm -f .env.local
  mv .env.local.bak .env.local 2>/dev/null || true
}
trap cleanup EXIT

pnpm build

echo "Creating release package..."

rm -rf ./release
mkdir -p "$RELEASE_DIR"

cp -r ./out/* "$RELEASE_DIR/"

echo "Downloading miniserve binaries..."
MINISERVE_VERSION="0.28.0"
MINISERVE_BASE="https://github.com/svenstaro/miniserve/releases/download/v${MINISERVE_VERSION}"

mkdir -p "$RELEASE_DIR/bin"

# Mac
curl -L -o "$RELEASE_DIR/bin/miniserve-mac" "${MINISERVE_BASE}/miniserve-${MINISERVE_VERSION}-x86_64-apple-darwin"
chmod +x "$RELEASE_DIR/bin/miniserve-mac"

# Windows
curl -L -o "$RELEASE_DIR/bin/miniserve-win.exe" "${MINISERVE_BASE}/miniserve-${MINISERVE_VERSION}-x86_64-pc-windows-msvc.exe"

cat > "$RELEASE_DIR/start.command" << 'LAUNCHER_MAC'
#!/bin/bash
cd "$(dirname "$0")"

PORT=3000

echo "Starting Liquity App at http://localhost:$PORT"
echo "Press Ctrl+C to stop"
open "http://localhost:$PORT"

./bin/miniserve-mac --index index.html -p $PORT .
LAUNCHER_MAC

chmod +x "$RELEASE_DIR/start.command"

cat > "$RELEASE_DIR/start.bat" << 'LAUNCHER_WIN'
@echo off
cd /d "%~dp0"

set PORT=3000

echo Starting Liquity App at http://localhost:%PORT%
echo Press Ctrl+C to stop
start http://localhost:%PORT%

bin\miniserve-win.exe --index index.html -p %PORT% .
LAUNCHER_WIN

cat > "$RELEASE_DIR/config.json" << 'CONFIG'
{
  "rpcUrl": "",
  "subgraphUrl": ""
}
CONFIG

cat > "$RELEASE_DIR/README.txt" << 'README'
Liquity V2 App - Local Version
==============================

HOW TO RUN:
-----------
Mac/Linux: Double-click "start.command"
Windows:   Double-click "start.bat"

Your browser will open automatically at http://localhost:3000

REQUIREMENTS:
-------------
- A web browser
- Internet connection (to interact with Ethereum)
- No other software needed (server is bundled)

OPTIONAL CONFIGURATION:
-----------------------
Edit config.json to use your own RPC or subgraph:

  {
    "rpcUrl": "https://your-rpc-url.com",
    "subgraphUrl": "https://your-subgraph-url.com"
  }

Leave values empty ("") to use the default public endpoints.

TROUBLESHOOTING:
----------------

Mac "Cannot be opened" or "Not verified" error:

  You may need to approve two files the first time: start.command and miniserve-mac

  1. Double-click start.command (it may be blocked)
  2. Open System Settings > Privacy & Security
  3. Scroll down - click "Open Anyway" next to the blocked file
  4. If miniserve-mac is also blocked, repeat step 2-3 for it

  You only need to do this once - future launches will work normally.

Other issues:
- If port 3000 is busy, you'll see an error - close the other app using that port

For support, visit: https://github.com/liquity/bold
README

cd ./release
zip -r "${RELEASE_NAME}.zip" "$RELEASE_NAME"
echo ""
echo "Release package created: ./release/${RELEASE_NAME}.zip"
echo "Size: $(du -h "${RELEASE_NAME}.zip" | cut -f1)"
