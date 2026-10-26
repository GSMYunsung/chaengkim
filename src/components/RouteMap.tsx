import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from './ui';
import { WebView } from 'react-native-webview';

export type Coord = {
  lat: number;
  lng: number;
  label?: string;
  /** A place the user actually stayed at — drawn with its own pin color and a name tag. */
  stop?: boolean;
  name?: string;
};

type Props = {
  coords: Coord[];
  height?: number;
  /** Fill the parent (full-screen view) instead of using a fixed height. */
  fill?: boolean;
};

export const PIN_COLORS = {
  start: '#22C55E',
  end: '#EF4444',
  stop: '#F59E0B',
  path: '#4F8EF7',
};

const KAKAO_JS_KEY = process.env.EXPO_PUBLIC_KAKAO_JS_KEY;
// Kakao Maps only serves registered web domains; the WebView document is given this origin,
// so it must be listed under 플랫폼 → Web in the Kakao Developers console. It must be https:
// the SDK loads its core with protocol-relative URLs, and iOS ATS blocks the http variant.
const MAP_ORIGIN = 'https://localhost';

type Pin = Coord & { color: string; radius: number };

function toPins(coords: Coord[]): Pin[] {
  return coords.map((c, i) => {
    const edge = i === 0 ? 'start' : i === coords.length - 1 ? 'end' : null;
    return {
      ...c,
      label: c.label ?? `${i + 1}`,
      color: c.stop ? PIN_COLORS.stop : edge ? PIN_COLORS[edge] : PIN_COLORS.path,
      radius: c.stop ? 11 : edge ? 9 : 5,
    };
  });
}

function buildHtml(coords: Coord[]): string {
  const pins = JSON.stringify(toPins(coords));
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map { width: 100%; height: 100%; }
    .tag {
      font: 600 12px -apple-system, 'Apple SD Gothic Neo', sans-serif; color: #202632;
      background: #fff; border-radius: 8px; padding: 3px 7px; white-space: nowrap;
      box-shadow: 0 1px 4px rgba(0,0,0,.2);
    }
    .dot { border: 2px solid #fff; border-radius: 50%; box-shadow: 0 1px 3px rgba(0,0,0,.25); }
    .leaflet-tooltip.tag { border: 0; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    const pins = ${pins};
    const PATH_COLOR = '${PIN_COLORS.path}';

    // Place names come from external search results, so escape before building HTML.
    function esc(s) {
      return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    function dotHtml(p) {
      const d = p.radius * 2;
      return '<div class="dot" title="' + esc((p.name ? p.name + ' · ' : '') + p.label)
        + '" style="width:' + d + 'px;height:' + d + 'px;background:' + p.color + '"></div>';
    }

    let rendered = false;

    function renderKakao() {
      kakao.maps.load(function () {
        if (rendered) return;
        rendered = true;
        const path = pins.map(p => new kakao.maps.LatLng(p.lat, p.lng));
        const map = new kakao.maps.Map(document.getElementById('map'), { center: path[0], level: 4 });
        new kakao.maps.Polyline({
          map, path, strokeWeight: 4, strokeColor: PATH_COLOR, strokeOpacity: 0.8, strokeStyle: 'shortdash',
        });
        pins.forEach((p, i) => {
          new kakao.maps.CustomOverlay({ map, position: path[i], content: dotHtml(p), zIndex: p.stop ? 3 : 2 });
          if (p.stop && p.name) {
            new kakao.maps.CustomOverlay({
              map, position: path[i], content: '<div class="tag">' + esc(p.name) + '</div>', yAnchor: 1.9, zIndex: 4,
            });
          }
        });
        if (path.length > 1) {
          const bounds = new kakao.maps.LatLngBounds();
          path.forEach(p => bounds.extend(p));
          map.setBounds(bounds, 40, 36, 24, 36);
        } else {
          map.setLevel(3);
        }
      });
    }

    // OpenStreetMap fallback for when no Kakao key is set or the domain isn't registered yet.
    function renderLeaflet() {
      if (rendered) return;
      rendered = true;
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(css);
      const s = document.createElement('script');
      s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      s.onload = function () {
        const map = L.map('map');
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap', maxZoom: 19 }).addTo(map);
        const line = L.polyline(pins.map(p => [p.lat, p.lng]), {
          color: PATH_COLOR, weight: 4, opacity: 0.8, dashArray: '8,4',
        }).addTo(map);
        pins.forEach(p => {
          const m = L.circleMarker([p.lat, p.lng], {
            radius: p.radius, color: '#ffffff', fillColor: p.color, fillOpacity: 1, weight: 2,
          }).addTo(map).bindPopup(esc((p.name ? p.name + ' · ' : '') + p.label));
          if (p.stop && p.name) m.bindTooltip(esc(p.name), { permanent: true, direction: 'top', offset: [0, -10], className: 'tag' });
        });
        map.fitBounds(line.getBounds(), { padding: [36, 36], maxZoom: 17 });
      };
      document.head.appendChild(s);
    }

    ${KAKAO_JS_KEY ? `
    const sdk = document.createElement('script');
    sdk.src = 'https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_JS_KEY}&autoload=false';
    sdk.onload = function () { window.kakao && kakao.maps ? renderKakao() : renderLeaflet(); };
    sdk.onerror = renderLeaflet;
    document.head.appendChild(sdk);
    // If the SDK's core never arrives (blocked or offline), don't leave a blank map.
    setTimeout(renderLeaflet, 6000);
    ` : 'renderLeaflet();'}
  </script>
</body>
</html>`;
}

export function RouteMap({ coords, height = 320, fill }: Props) {
  if (coords.length === 0) {
    return (
      <View style={[styles.empty, { height }]}>
        <Text style={styles.emptyText}>좌표 없음</Text>
      </View>
    );
  }

  return (
    <WebView
      source={{ html: buildHtml(coords), baseUrl: MAP_ORIGIN }}
      style={fill ? styles.fill : [styles.map, { height }]}
      scrollEnabled={false}
      javaScriptEnabled
      domStorageEnabled
      originWhitelist={['*']}
    />
  );
}

const styles = StyleSheet.create({
  map: { borderRadius: 14, overflow: 'hidden' },
  fill: { flex: 1 },
  empty: {
    backgroundColor: '#F3F4F6', borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  emptyText: { color: '#9CA3AF', fontSize: 14 },
});
