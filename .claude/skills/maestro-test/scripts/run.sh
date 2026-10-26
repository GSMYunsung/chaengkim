#!/usr/bin/env bash
# Runs the Maestro scenarios in .maestro/flows on an iOS simulator, in order, and builds one report.
#   run.sh                 all scenarios
#   run.sh 05 06           only scenarios whose file starts with these numbers (state is NOT reset)
# Env: SIM (simulator UDID, default: booted or first "iPhone 17 Pro"), PORT (Metro, default 8082)
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"
PORT="${PORT:-8082}"
BUNDLE_ID="com.yuncastlee.chaengkim"
SCHEME="chaengkim"
export PATH="/opt/homebrew/opt/openjdk@17/bin:$HOME/.maestro/bin:$PATH"
command -v maestro >/dev/null || { echo "maestro not installed (brew install mobile-dev-inc/tap/maestro)" >&2; exit 1; }

SIM="${SIM:-$(xcrun simctl list devices booted | awk -F'[()]' '/iPhone/ {print $2; exit}')}"
[ -z "$SIM" ] && SIM="$(xcrun simctl list devices available | awk -F'[()]' '/iPhone 17 Pro \(/ {print $2; exit}')"
[ -z "$SIM" ] && { echo "no iPhone simulator" >&2; exit 1; }
xcrun simctl boot "$SIM" 2>/dev/null; open -a Simulator
xcrun simctl get_app_container "$SIM" "$BUNDLE_ID" >/dev/null 2>&1 || {
  echo "app not installed on simulator $SIM — build once: npx expo run:ios --device $SIM --no-bundler" >&2; exit 1; }
curl -sf "http://localhost:$PORT/status" | grep -q running || {
  echo "Metro is not running on $PORT — start it (expo-dev-run: dev.sh metro or tunnel)" >&2; exit 1; }

# Seoul (Seongsu) as the device location; location "always" so onboarding/home registration work.
xcrun simctl location "$SIM" set 37.5446,127.0557
xcrun simctl privacy "$SIM" grant location-always "$BUNDLE_ID" 2>/dev/null || true

# Same form `expo run:ios` uses: no dev-menu intro or floating button over the screens under test.
DEV_URL="exp+$SCHEME://?__expo_url=$(node -e "console.log(encodeURIComponent('http://localhost:$PORT'))")&__expo_disable_fab=1&__expo_disable_onboarding=1"
RUN="maestro-report/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$RUN"
FLOWS=(.maestro/flows/*.yaml)
if [ $# -gt 0 ]; then
  FLOWS=(); for n in "$@"; do FLOWS+=(.maestro/flows/"$n"*.yaml); done
fi

echo "[]" > "$RUN/results.json"
for flow in "${FLOWS[@]}"; do
  name="$(basename "$flow" .yaml)"
  out="$RUN/$name"; mkdir -p "$out"
  start=$(date +%s)
  # Screenshots from takeScreenshot land in the working directory, so run inside the scenario folder.
  ( cd "$out" && maestro --device "$SIM" test --env DEV_URL="$DEV_URL" --test-output-dir . "$OLDPWD/$flow" ) > "$out/log.txt" 2>&1
  code=$?
  secs=$(( $(date +%s) - start ))
  status=$([ $code -eq 0 ] && echo pass || echo fail)
  printf '%-28s %s (%ss)\n' "$name" "$status" "$secs"
  python3 - "$RUN/results.json" "$name" "$status" "$secs" "$flow" <<'PY'
import json, sys
path, name, status, secs, flow = sys.argv[1:]
title = next((l.split(':', 1)[1].strip().strip('"') for l in open(flow, encoding='utf-8') if l.startswith('name:')), name)
r = json.load(open(path)); r.append({'id': name, 'title': title, 'status': status, 'seconds': int(secs)})
json.dump(r, open(path, 'w'), ensure_ascii=False, indent=1)
PY
done

python3 .claude/skills/maestro-test/scripts/report.py "$RUN"
echo "report: $RUN/report.html"
