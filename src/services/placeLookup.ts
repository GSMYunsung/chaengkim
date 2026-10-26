import * as Location from 'expo-location';
import { getAppStateValue, setAppStateValue } from '../db/queries';

const SEARCH_RADIUS_M = 100;

// Kakao Local category codes for shops, venues and landmarks someone would stay at.
// Category search takes one code per request, so the common stays (cafe, restaurant,
// convenience store) are asked first and the rest only when none of those is nearby.
// That keeps a typical lookup at 3 requests instead of 14.
const KAKAO_COMMON = ['CE7', 'FD6', 'CS2'];
const KAKAO_OTHERS = ['MT1', 'BK9', 'HP8', 'PM9', 'AC5', 'CT1', 'AD5', 'SW8', 'AT4', 'PO3', 'SC4'];
const KAKAO_KEY = process.env.EXPO_PUBLIC_KAKAO_REST_KEY;


async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Counts Kakao requests for one lookup, for the dev log. */
type Calls = { kakao: number };

async function kakaoNearest(lat: number, lng: number, calls: Calls): Promise<string | null> {
  if (!KAKAO_KEY) return null;
  return (await kakaoNearestIn(KAKAO_COMMON, lat, lng, calls)) ?? kakaoNearestIn(KAKAO_OTHERS, lat, lng, calls);
}

// Closest place across the given categories, asked in parallel.
async function kakaoNearestIn(codes: string[], lat: number, lng: number, calls: Calls): Promise<string | null> {
  calls.kakao += codes.length;
  const results = await Promise.all(codes.map(async code => {
    const url = `https://dapi.kakao.com/v2/local/search/category.json?category_group_code=${code}`
      + `&x=${lng}&y=${lat}&radius=${SEARCH_RADIUS_M}&sort=distance&size=1`;
    const res = await fetchWithTimeout(url, { headers: { Authorization: `KakaoAK ${KAKAO_KEY}` } }, 6000);
    if (!res.ok) return null;
    const json = (await res.json()) as { documents?: { place_name: string; distance: string }[] };
    const doc = json.documents?.[0];
    return doc ? { name: doc.place_name, d: Number(doc.distance) } : null;
  }).map(p => p.catch(() => null)));
  const nearest = results.filter((r): r is { name: string; d: number } => !!r).sort((a, b) => a.d - b.d)[0];
  return nearest?.name ?? null;
}

// Name of the building at the coordinate, when Kakao knows one (e.g. "강남파이낸스센터").
async function kakaoBuildingName(lat: number, lng: number, calls: Calls): Promise<string | null> {
  if (!KAKAO_KEY) return null;
  calls.kakao += 1;
  const res = await fetchWithTimeout(
    `https://dapi.kakao.com/v2/local/geo/coord2address.json?x=${lng}&y=${lat}`,
    { headers: { Authorization: `KakaoAK ${KAKAO_KEY}` } },
    6000,
  );
  if (!res.ok) return null;
  const json = (await res.json()) as { documents?: { road_address?: { building_name?: string } | null }[] };
  return json.documents?.[0]?.road_address?.building_name || null;
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
// Lookups in flight per cache key. Screens often ask for the same spot at once (home and
// history both open); they share one network lookup instead of each calling Kakao.
const inFlight = new Map<string, Promise<string | null>>();

export function lookupPlaceName(lat: number, lng: number): Promise<string | null> {
  const key = `poi:${lat.toFixed(4)},${lng.toFixed(4)}`;
  const pending = inFlight.get(key);
  if (pending) return pending;
  const lookup = lookupUncached(key, lat, lng).finally(() => inFlight.delete(key));
  inFlight.set(key, lookup);
  return lookup;
}

// A cached value starting with this marks "no shop here"; the rest is the address shown instead.
const NO_SHOP = '~';

async function lookupUncached(key: string, lat: number, lng: number): Promise<string | null> {
  const cached = await getAppStateValue(key);
  if (cached !== null) {
    const name = cached.startsWith(NO_SHOP) ? cached.slice(NO_SHOP.length) || null : cached;
    if (__DEV__) console.log(`[장소 검색] ${lat.toFixed(4)},${lng.toFixed(4)} → ${name ?? '이름 없음'} (캐시)`);
    return name;
  }

  const calls: Calls = { kakao: 0 };
  const shop =
    (await kakaoNearest(lat, lng, calls).catch(() => null)) ??
    (await kakaoBuildingName(lat, lng, calls).catch(() => null));
  if (__DEV__) console.log(`[장소 검색] ${lat.toFixed(4)},${lng.toFixed(4)} → ${shop ?? '못 찾음'} (카카오 ${calls.kakao}회)`);
  if (shop) {
    await setAppStateValue(key, shop);
    return shop;
  }
  // No shop nearby: remember that too, with the address shown instead, so the spot isn't searched
  // again on every screen. Like all name cache entries it's cleared with the month's history.
  const address = await reverseGeocodeName(lat, lng).catch(() => null);
  await setAppStateValue(key, NO_SHOP + (address ?? ''));
  return address;
}
