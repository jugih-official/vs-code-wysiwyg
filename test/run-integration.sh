#!/usr/bin/env bash
# Runs test/integration in a separate, clean VS Code instance on a virtual display, against a temporary copy of
# the distribution_system project (the tests write files).
#   LIVE_URL=http://localhost:5091 test/run-integration.sh    (the live step needs the app running at LIVE_URL)
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
src="${DS_SOURCE:-/home/jukka/repos/distribution_system}"
tmp="$(mktemp -d)"
mkdir -p "$tmp/ds/src"
cp "$src"/MainWindow.xaml "$src"/*.csproj "$src"/README.md "$tmp/ds/"
cp -r "$src/Resources" "$tmp/ds/"
rsync -a --exclude bin --exclude obj "$src/src/Distribution.Web" "$tmp/ds/src/"
export DS_ROOT="$tmp/ds"
export RESULT_FILE="${RESULT_FILE:-$tmp/result.json}"
xvfb-run -a "${VSCODE_BIN:-/usr/share/code/code}" --extensionDevelopmentPath="$here" --extensionTestsPath="$here/test/integration" \
  --user-data-dir="$tmp/user" --extensions-dir="$tmp/ext" --disable-workspace-trust --skip-welcome --skip-release-notes \
  "$DS_ROOT" || status=$?
cat "$RESULT_FILE" 2>/dev/null || echo "no result file"
rm -rf "$tmp/ds"
exit "${status:-0}"
