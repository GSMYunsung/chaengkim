#!/usr/bin/env bash
# Helper for running this Expo app's development build on a USB/Wi-Fi connected iPhone.
#
#   dev.sh status   Device, Mac IP, Metro and phone-connection state
#   dev.sh metro    Start Metro (dev-client) on $PORT in the foreground — run it in the background
#   dev.sh tunnel   Same as metro, but through an Expo tunnel (for Wi-Fi that blocks device-to-device traffic)
#   dev.sh wait     Block until Metro on $PORT answers /status
#   dev.sh launch   Open the installed dev build on the phone, pointed at this Mac's Metro (tunnel URL if tunneling)
#   dev.sh verify   Wait up to 25s for the phone to connect to Metro
#   dev.sh build    Native rebuild + install + Metro (foreground, several minutes)
#   dev.sh free     Stop whatever listens on $PORT, only if it belongs to this project
set -u

PROJECT="$(cd "$(dirname "$0")/../../../.." && pwd)"
PORT="${PORT:-8082}"
cd "$PROJECT" || exit 1

app_field() { node -e "const e=require('./app.json').expo;console.log(($1)??'')"; }
SCHEME="$(app_field 'e.scheme')"
BUNDLE_ID="$(app_field 'e.ios&&e.ios.bundleIdentifier')"

# CoreDevice id (for devicectl) of the first connected iPhone.
device_id() {
  xcrun devicectl list devices 2>/dev/null | awk '/(connected|available)/ && /iPhone/ { for (i=1;i<=NF;i++) if ($i ~ /^[0-9A-F]{8}-[0-9A-F]{4}-/) { print $i; exit } }'
}
device_name() {
  xcrun devicectl list devices 2>/dev/null | awk '/(connected|available)/ && /iPhone/ { print $1; exit }'
}
# Hardware UDID (for `expo run:ios --device`) of the physical iPhone.
device_udid() {
  local name; name="$(device_name)"
  [ -z "$name" ] && return
  xcrun xctrace list devices 2>/dev/null | awk '/== Simulators ==/ { exit } { print }' \
    | grep -F "$name" | grep -oE '\(([0-9A-F]{8}-[0-9A-F]{16}|[0-9a-f]{40})\)' | tr -d '()' | head -1
}
# First routable IPv4 of this Mac (link-local 169.254.x is skipped: it's the USB link and dies often).
mac_ip() {
  for n in 0 1 2 3 4 5 6 7 8; do
    ip="$(ipconfig getifaddr "en$n" 2>/dev/null)"
    case "$ip" in ""|169.254.*) ;; *) echo "$ip"; return ;; esac
  done
}
metro_up() { curl -s -m 2 "http://localhost:$PORT/status" | grep -q running; }
# Public tunnel URL if Metro was started with --tunnel (read from the manifest's bundle host).
tunnel_url() {
  curl -s -m 5 -H "expo-platform: ios" -H "accept: application/expo+json,application/json" "http://localhost:$PORT/" 2>/dev/null \
    | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const h=new URL(JSON.parse(d).launchAsset.url).hostname;if(/\.(on\.expo\.app|exp\.direct)$/.test(h))console.log('https://'+h)}catch{}})"
}
metro_pid() { lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t 2>/dev/null | head -1; }

case "${1:-status}" in
  status)
    echo "project:   $PROJECT"
    echo "app:       scheme=$SCHEME bundle=$BUNDLE_ID"
    echo "device:    $(device_name) id=$(device_id) udid=$(device_udid)"
    echo "mac ip:    $(mac_ip)"
    if metro_up; then
      pid="$(metro_pid)"
      echo "metro:     running on $PORT (pid $pid, cwd $(lsof -p "$pid" 2>/dev/null | awk '$4=="cwd"{print $NF}'))"
    else
      echo "metro:     not running on $PORT"
    fi
    echo "phone conn:"
    lsof -nP -iTCP:"$PORT" -sTCP:ESTABLISHED 2>/dev/null | awk 'NR>1 && $9 !~ /127\.0\.0\.1|\[::1\]/ {print "  " $9}' | sort -u
    ;;
  free)
    pid="$(metro_pid)"
    [ -z "$pid" ] && { echo "port $PORT is free"; exit 0; }
    cwd="$(lsof -p "$pid" 2>/dev/null | awk '$4=="cwd"{print $NF}')"
    if [ "$cwd" != "$PROJECT" ]; then
      echo "port $PORT is used by another project ($cwd); not killing it" >&2
      exit 2
    fi
    kill "$pid" && sleep 1 && echo "stopped Metro (pid $pid)"
    ;;
  metro)
    # Never set CI=1 here: it disables Fast Refresh / reloads.
    exec npx expo start --dev-client --port "$PORT"
    ;;
  tunnel)
    # SDK 58's default tunnel is Expo's own; no @expo/ngrok needed.
    exec npx expo start --dev-client --port "$PORT" --tunnel
    ;;
  wait)
    for _ in $(seq 1 90); do metro_up && { echo "metro ready on $PORT"; exit 0; }; sleep 1; done
    echo "metro did not come up on $PORT" >&2; exit 1
    ;;
  launch)
    id="$(device_id)"
    [ -z "$id" ] && { echo "no connected iPhone" >&2; exit 1; }
    metro_up || { echo "metro is not running on $PORT" >&2; exit 1; }
    server="$(tunnel_url)"
    if [ -z "$server" ]; then
      ip="$(mac_ip)"
      [ -z "$ip" ] && { echo "no routable Mac IPv4 (hotspot/IPv6-only?) — put Mac and phone on the same Wi-Fi, or use: dev.sh tunnel" >&2; exit 1; }
      server="http://$ip:$PORT"
    fi
    url="$SCHEME://expo-development-client/?url=$(node -e "console.log(encodeURIComponent('$server'))")"
    out="$(xcrun devicectl device process launch --terminate-existing --device "$id" --payload-url "$url" "$BUNDLE_ID" 2>&1)"
    case "$out" in
      *"Launched application"*) echo "launched $BUNDLE_ID → $server" ;;
      *DeviceLocked*|*"device is locked"*) echo "phone is locked — unlock it and run launch again" >&2; exit 3 ;;
      *"is not installed"*) echo "app is not installed — run: dev.sh build" >&2; exit 4 ;;
      *) echo "$out" | tail -5 >&2; exit 1 ;;
    esac
    ;;
  verify)
    # After launch: wait for the phone to open a connection to Metro.
    if [ -n "$(tunnel_url)" ]; then
      echo "tunnel mode: phone traffic arrives via the local tunnel client, so it can't be told apart here —" >&2
      echo "check the Metro log for 'iOS Bundled' instead." >&2
      exit 6
    fi
    for _ in $(seq 1 25); do
      conns="$(lsof -nP -iTCP:"$PORT" -sTCP:ESTABLISHED 2>/dev/null | awk 'NR>1 && $9 !~ /127\.0\.0\.1|\[::1\]/ {print $9}' | sort -u)"
      [ -n "$conns" ] && { echo "phone connected:"; echo "$conns" | sed 's/^/  /'; exit 0; }
      sleep 1
    done
    echo "no phone connection to Metro after 25s — phone is likely on a different network than $(mac_ip)," >&2
    echo "or Local Network permission for the app is off (설정 → 개인정보 보호 및 보안 → 로컬 네트워크)." >&2
    echo "If the Wi-Fi isolates clients (public IP on the Mac, e.g. school/cafe), restart with: dev.sh free && dev.sh tunnel" >&2
    exit 5
    ;;
  build)
    udid="$(device_udid)"
    [ -z "$udid" ] && { echo "no connected iPhone UDID" >&2; exit 1; }
    # --port and --no-bundler are mutually exclusive; this also starts Metro on $PORT.
    exec npx expo run:ios --device "$udid" --port "$PORT"
    ;;
  *)
    sed -n '2,12p' "$0"; exit 1 ;;
esac
