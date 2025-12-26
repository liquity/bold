#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
cd "$APP_DIR"

if [ ! -f ".env.release" ]; then
  echo "Error: .env.release not found"
  echo "Create .env.release with public RPC URLs before building a release."
  exit 1
fi

VERSION=$(node -p "require('./package.json').version")
RELEASE_NAME="liquity-app-v${VERSION}"
RELEASE_DIR="./release/${RELEASE_NAME}"

echo "Building Liquity App v${VERSION} using .env.release..."

mv .env.local .env.local.bak 2>/dev/null || true
cp .env.release .env.local

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

cat > "$RELEASE_DIR/start.command" << 'LAUNCHER_MAC'
#!/bin/bash
cd "$(dirname "$0")"
PORT=3000

if command -v python3 &> /dev/null; then
  echo "Starting Liquity App at http://localhost:$PORT"
  echo "Press Ctrl+C to stop"
  open "http://localhost:$PORT"
  python3 -m http.server $PORT
elif command -v python &> /dev/null; then
  echo "Starting Liquity App at http://localhost:$PORT"
  echo "Press Ctrl+C to stop"
  open "http://localhost:$PORT"
  python -m SimpleHTTPServer $PORT
else
  echo "Error: Python is required to run this app locally."
  echo "Please install Python from https://www.python.org/downloads/"
  read -p "Press Enter to exit..."
fi
LAUNCHER_MAC

chmod +x "$RELEASE_DIR/start.command"

cat > "$RELEASE_DIR/start.bat" << 'LAUNCHER_WIN'
@echo off
cd /d "%~dp0"
set PORT=3000

where python >nul 2>nul
if %ERRORLEVEL% == 0 (
  echo Starting Liquity App at http://localhost:%PORT%
  echo Press Ctrl+C to stop
  start http://localhost:%PORT%
  python -m http.server %PORT%
) else (
  echo Error: Python is required to run this app locally.
  echo Please install Python from https://www.python.org/downloads/
  pause
)
LAUNCHER_WIN

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
- Python 3 (pre-installed on Mac, download from python.org for Windows)
- A web browser
- Internet connection (to interact with Ethereum)

TROUBLESHOOTING:
----------------
- If the app doesn't start, ensure Python is installed
- If port 3000 is busy, edit start.command/start.bat to change PORT=3000

For support, visit: https://github.com/liquity/bold
README

cd ./release
zip -r "${RELEASE_NAME}.zip" "$RELEASE_NAME"
echo ""
echo "Release package created: ./release/${RELEASE_NAME}.zip"
echo "Size: $(du -h "${RELEASE_NAME}.zip" | cut -f1)"
