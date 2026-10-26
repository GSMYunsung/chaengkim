import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { Text, Icon } from './ui';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { colors } from '../theme';

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
// Nothing is fetched from it; it only has to be an origin no one else can serve pages from, so
// the JS key isn't accepted on someone else's site. It is our own portfolio domain, so it must
// stay registered: if it lapsed, whoever bought it could use the key.
const MAP_ORIGIN = 'https://www.choiyunsung.dev';
// How long to wait for the Kakao SDK before showing the "couldn't load" state.
const LOAD_TIMEOUT_MS = 8000;

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

/**
 * The map page. It is built once per mounted map; later pin changes are pushed into the loaded
 * page with `setPins`, so a new stay or a place name arriving doesn't reload the Kakao map
 * (each reload counts against the map quota).
 */
function buildHtml(initial: Pin[]): string {
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
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    const PATH_COLOR = '${PIN_COLORS.path}';
    // '<' escaped so a place name can't close this <script> tag.
    let pins = ${JSON.stringify(initial).replace(/</g, '\\u003c')};
    let map = null;
    let drawn = [];
    let failed = false;

    function post(type) {
      window.ReactNativeWebView && window.ReactNativeWebView.postMessage(type);
    }

    // Place names come from external search results, so escape before building HTML.
    function esc(s) {
      return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    function dotHtml(p) {
      const d = p.radius * 2;
      return '<div class="dot" title="' + esc((p.name ? p.name + ' · ' : '') + p.label)
        + '" style="width:' + d + 'px;height:' + d + 'px;background:' + p.color + '"></div>';
    }

    function draw(fit) {
      drawn.forEach(o => o.setMap(null));
      drawn = [];
      if (!pins.length) return;
      const path = pins.map(p => new kakao.maps.LatLng(p.lat, p.lng));
      drawn.push(new kakao.maps.Polyline({
        map, path, strokeWeight: 4, strokeColor: PATH_COLOR, strokeOpacity: 0.8, strokeStyle: 'shortdash',
      }));
      pins.forEach((p, i) => {
        drawn.push(new kakao.maps.CustomOverlay({ map, position: path[i], content: dotHtml(p), zIndex: p.stop ? 3 : 2 }));
        if (p.stop && p.name) {
          drawn.push(new kakao.maps.CustomOverlay({
            map, position: path[i], content: '<div class="tag">' + esc(p.name) + '</div>', yAnchor: 1.9, zIndex: 4,
          }));
        }
      });
      if (!fit) return;
      if (path.length > 1) {
        const bounds = new kakao.maps.LatLngBounds();
        path.forEach(p => bounds.extend(p));
        map.setBounds(bounds, 40, 36, 24, 36);
      } else {
        map.setCenter(path[0]);
        map.setLevel(3);
      }
    }

    // Called from the app when pins change. Refits only when the route itself changed,
    // so a name arriving doesn't jump the view the user may have panned.
    window.setPins = function (next) {
      const moved = next.length !== pins.length || next.some((p, i) => p.lat !== pins[i].lat || p.lng !== pins[i].lng);
      pins = next;
      if (map) draw(moved);
    };

    function fail() {
      if (map || failed) return;
      failed = true;
      post('error');
    }

    ${KAKAO_JS_KEY ? `
    const sdk = document.createElement('script');
    sdk.src = 'https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_JS_KEY}&autoload=false';
    sdk.onload = function () {
      if (!(window.kakao && kakao.maps)) return fail();
      kakao.maps.load(function () {
        if (failed) return;
        map = new kakao.maps.Map(document.getElementById('map'), {
          center: new kakao.maps.LatLng(pins[0].lat, pins[0].lng), level: 4,
        });
        draw(true);
        post('ready');
      });
    };
    sdk.onerror = fail;
    document.head.appendChild(sdk);
    // If the SDK's core never arrives (blocked, offline, quota), say so instead of a blank map.
    setTimeout(fail, ${LOAD_TIMEOUT_MS});
    ` : 'fail();'}
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
  return <LoadedMap coords={coords} height={height} fill={fill} />;
}

function LoadedMap({ coords, height, fill }: { coords: Coord[]; height: number; fill?: boolean }) {
  const web = useRef<React.ComponentRef<typeof WebView>>(null);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  // The page is built from the pins at mount (or retry) time and then kept, so the WebView
  // never reloads just because coordinates or names changed.
  const [source, setSource] = useState(() => ({ html: buildHtml(toPins(coords)), baseUrl: MAP_ORIGIN }));
  const pinsJson = JSON.stringify(toPins(coords));

  useEffect(() => {
    if (state === 'ready') web.current?.injectJavaScript(`window.setPins(${pinsJson}); true;`);
  }, [pinsJson, state]);

  function onMessage(e: WebViewMessageEvent) {
    const type = e.nativeEvent.data;
    // Each 'ready' is one Kakao map load, i.e. one unit of map quota.
    if (__DEV__) console.log(`[지도] ${type === 'ready' ? '카카오 지도 로드' : '불러오기 실패'} (핀 ${coords.length}개)`);
    if (type === 'ready') setState('ready');
    if (type === 'error') setState('error');
  }

  function retry() {
    setState('loading');
    setSource({ html: buildHtml(JSON.parse(pinsJson)), baseUrl: MAP_ORIGIN });
    setAttempt(a => a + 1);
  }

  return (
    <View style={fill ? styles.fill : [styles.map, { height }]}>
      <WebView
        key={attempt}
        ref={web}
        source={source}
        style={styles.fill}
        scrollEnabled={false}
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={['*']}
        onMessage={onMessage}
        // The OS can kill the web content process while the app sits in the background, leaving
        // a blank map with no error. Rebuild the page when that happens.
        onContentProcessDidTerminate={retry}
        onRenderProcessGone={retry}
      />
      {state === 'error' && (
        <View style={styles.failed}>
          <Icon name="map-pin-off" size={22} color={colors.sub} />
          <Text style={styles.failedText}>지도를 불러오지 못했어요</Text>
          <Pressable
            style={({ pressed }) => [styles.retry, pressed && { opacity: 0.7 }]}
            onPress={retry}
            accessibilityRole="button"
            hitSlop={6}
          >
            <Text style={styles.retryText}>다시 시도</Text>
          </Pressable>
        </View>
      )}
    </View>
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
  failed: {
    ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.surface,
  },
  failedText: { fontSize: 14, fontWeight: '600', color: colors.sub },
  retry: { minHeight: 34, paddingHorizontal: 14, borderRadius: 17, backgroundColor: colors.card, justifyContent: 'center' },
  retryText: { fontSize: 13, fontWeight: '600', color: colors.blue },
});
