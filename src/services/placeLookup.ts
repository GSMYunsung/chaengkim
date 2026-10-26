import * as Location from 'expo-location';
import { getAppStateValue, setAppStateValue } from '../db/queries';

const SEARCH_RADIUS_M = 100;

// Kakao Local category codes for shops and venues someone would stay at long enough to leave
// something behind. Category search takes one code per request, so the common stays (cafe,
// restaurant, convenience store) are asked first and the rest only when none of those is nearby.
// The rest are the long stays (academy, school, hospital, cinema/culture, big-box store); short
// stops like banks, pharmacies and stations are left to the building name. Categories are asked
// one at a time and the search stops at a place within NEAR_ENOUGH_M (the user is in it), so a
// typical lookup takes 1–3 requests and the worst case 9.
const KAKAO_COMMON = ['CE7', 'FD6', 'CS2'];
const KAKAO_OTHERS = ['AC5', 'SC4', 'HP8', 'CT1', 'MT1'];
const KAKAO_KEY = process.env.EXPO_PUBLIC_KAKAO_REST_KEY;
const NEAR_ENOUGH_M = 20;

// After a failed search (usually offline or out of quota), Kakao isn't asked again for a while,
// so screens resolving names on every visit don't spend requests that would fail the same way.
const FAILURE_PAUSE_MS = 2 * 60 * 1000;
let pausedUntil = 0;


async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Kakao requests for one lookup, for the dev log. `failed` is set when any request didn't get a
 * real answer (offline, timeout, quota exceeded, no key), so "nothing found" can't be trusted.
 */
type Calls = { kakao: number; failed: boolean };

async function kakaoNearest(lat: number, lng: number, calls: Calls): Promise<string | null> {
  if (!KAKAO_KEY) {
    calls.failed = true;
    return null;
  }
  const common = await kakaoNearestIn(KAKAO_COMMON, lat, lng, calls);
  // A failure here (usually offline or out of quota) would fail the others too; don't spend them.
  if (common || calls.failed) return common;
  return kakaoNearestIn(KAKAO_OTHERS, lat, lng, calls);
}

// Closest place across the given categories, asked in order. Stops early at a place close enough
// to be the one the user is in, or at the first failure (the rest would fail the same way).
async function kakaoNearestIn(codes: string[], lat: number, lng: number, calls: Calls): Promise<string | null> {
  let nearest: { name: string; d: number } | null = null;
  for (const code of codes) {
    calls.kakao += 1;
    try {
      const url = `https://dapi.kakao.com/v2/local/search/category.json?category_group_code=${code}`
        + `&x=${lng}&y=${lat}&radius=${SEARCH_RADIUS_M}&sort=distance&size=1`;
      const res = await fetchWithTimeout(url, { headers: { Authorization: `KakaoAK ${KAKAO_KEY}` } }, 6000);
      if (!res.ok) throw new Error(`kakao ${res.status}`);
      const json = (await res.json()) as { documents?: { place_name: string; distance: string }[] };
      const doc = json.documents?.[0];
      if (doc && (!nearest || Number(doc.distance) < nearest.d)) nearest = { name: doc.place_name, d: Number(doc.distance) };
    } catch {
      calls.failed = true;
      break;
    }
    if (nearest && nearest.d <= NEAR_ENOUGH_M) break;
  }
  return nearest?.name ?? null;
}

// Name of the building at the coordinate, when Kakao knows one (e.g. "강남파이낸스센터").
async function kakaoBuildingName(lat: number, lng: number, calls: Calls): Promise<string | null> {
  if (!KAKAO_KEY) return null;
  calls.kakao += 1;
  try {
    const res = await fetchWithTimeout(
      `https://dapi.kakao.com/v2/local/geo/coord2address.json?x=${lng}&y=${lat}`,
      { headers: { Authorization: `KakaoAK ${KAKAO_KEY}` } },
      6000,
    );
    if (!res.ok) throw new Error(`kakao ${res.status}`);
    const json = (await res.json()) as { documents?: { road_address?: { building_name?: string } | null }[] };
    return json.documents?.[0]?.road_address?.building_name || null;
  } catch {
    calls.failed = true;
    return null;
  }
}


async function reverseGeocodeName(lat: number, lng: number): Promise<string | null> {
  const [r] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
  if (!r) return null;
  return r.name ?? ([r.district, r.street].filter(Boolean).join(' ') || null);
}

/**
 * Name of the closest shop/landmark to a stay: Kakao Local category search, then the
 * Kakao building name (when a key is configured), then the OS reverse geocoder for an address.
 * Results, including "no shop here", are cached by ~10m-rounded coordinates so revisiting the screen
 * doesn't hit the network again. (Public OpenStreetMap/Overpass servers aren't used: their usage
 * policy doesn't allow an app's regular traffic.)
 */
/**
 * `name` is what to show (shop, building or address). `final` is false when the Kakao search
 * failed and `name` is only the fallback address, so the screen should ask again next time.
 */
export type PlaceLookup = { name: string | null; final: boolean };

// Lookups in flight per cache key. Screens often ask for the same spot at once (home and
// history both open); they share one network lookup instead of each calling Kakao.
const inFlight = new Map<string, Promise<PlaceLookup>>();

export function lookupPlaceName(lat: number, lng: number): Promise<PlaceLookup> {
  const key = `poi:${lat.toFixed(4)},${lng.toFixed(4)}`;
  const pending = inFlight.get(key);
  if (pending) return pending;
  const lookup = lookupUncached(key, lat, lng).finally(() => inFlight.delete(key));
  inFlight.set(key, lookup);
  return lookup;
}

// A cached value starting with this marks "no shop here"; the rest is the address shown instead.
const NO_SHOP = '~';

// Kakao's policy allows Local API results only through live calls: they may not be stored in any
// form, even briefly. So shop names are fetched each time a screen shows them and never written
// anywhere. Only "no shop here" with Apple's address (not Kakao data) is remembered, so parks and
// riversides aren't re-searched with 9 Kakao requests on every screen.
async function lookupUncached(key: string, lat: number, lng: number): Promise<PlaceLookup> {
  const cached = await getAppStateValue(key);
  if (cached?.startsWith(NO_SHOP)) {
    const address = cached.slice(NO_SHOP.length) || null;
    if (__DEV__) console.log(`[장소 검색] ${lat.toFixed(4)},${lng.toFixed(4)} → ${address ?? '이름 없음'} (가게 없음, 저장된 주소)`);
    return { name: address, final: true };
  }

  // While paused after a failure, skip Kakao and treat it as one more failed search.
  const paused = Date.now() < pausedUntil;
  const calls: Calls = { kakao: 0, failed: paused };
  const shop = paused
    ? null
    : (await kakaoNearest(lat, lng, calls)) ?? (calls.failed ? null : await kakaoBuildingName(lat, lng, calls));
  if (calls.failed && calls.kakao > 0) pausedUntil = Date.now() + FAILURE_PAUSE_MS;
  if (__DEV__) {
    const result = shop ?? (paused ? '검색 쉬는 중' : calls.failed ? '검색 실패' : '못 찾음');
    console.log(`[장소 검색] ${lat.toFixed(4)},${lng.toFixed(4)} → ${result} (카카오 ${calls.kakao}회, 저장 안 함)`);
  }
  if (shop) return { name: shop, final: true };
  const address = await reverseGeocodeName(lat, lng).catch(() => null);
  // A failed search proves nothing, so it shows the address this time and searches again next time.
  if (calls.failed) return { name: address, final: false };
  // No shop nearby: remember that with Apple's address. Cleared with the month's history.
  await setAppStateValue(key, NO_SHOP + (address ?? ''));
  return { name: address, final: true };
}
