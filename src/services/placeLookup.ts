import * as Location from 'expo-location';
import { getAppStateValue, setAppStateValue } from '../db/queries';
import { distanceM } from '../utils/geo';

const SEARCH_RADIUS_M = 100;

// Kakao Local category codes for shops, venues and landmarks someone would stay at.
const KAKAO_CATEGORIES = [
  'CE7', 'FD6', 'CS2', 'MT1', 'BK9', 'HP8', 'PM9', 'AC5', 'CT1', 'AD5', 'SW8', 'AT4', 'PO3', 'SC4',
];
const KAKAO_KEY = process.env.EXPO_PUBLIC_KAKAO_REST_KEY;

const OVERPASS_URLS = [
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function kakaoNearest(lat: number, lng: number): Promise<string | null> {
  if (!KAKAO_KEY) return null;
  const results = await Promise.all(KAKAO_CATEGORIES.map(async code => {
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
async function kakaoBuildingName(lat: number, lng: number): Promise<string | null> {
  if (!KAKAO_KEY) return null;
  const res = await fetchWithTimeout(
    `https://dapi.kakao.com/v2/local/geo/coord2address.json?x=${lng}&y=${lat}`,
    { headers: { Authorization: `KakaoAK ${KAKAO_KEY}` } },
    6000,
  );
  if (!res.ok) return null;
  const json = (await res.json()) as { documents?: { road_address?: { building_name?: string } | null }[] };
  return json.documents?.[0]?.road_address?.building_name || null;
}

type OsmNode ={ lat: number; lon: number; tags?: Record<string, string> };

async function overpassNearest(lat: number, lng: number): Promise<string | null> {
  const query = `[out:json][timeout:6];
node(around:${SEARCH_RADIUS_M},${lat},${lng})[name][~"^(shop|amenity|tourism|leisure)$"~"."];
out body 40;`;
  for (const url of OVERPASS_URLS) {
    try {
      const res = await fetchWithTimeout(url, {
        method: 'POST',
        // overpass-api.de rejects requests without an identifying User-Agent (HTTP 406).
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'chaengkim/1.0 (PoC app)' },
        body: `data=${encodeURIComponent(query)}`,
      }, 7000);
      if (!res.ok) continue;
      const json = (await res.json()) as { elements?: OsmNode[] };
      const nearest = (json.elements ?? [])
        .filter(n => n.tags?.name)
        .map(n => ({ n, d: distanceM(lat, lng, n.lat, n.lon) }))
        .sort((a, b) => a.d - b.d)[0];
      return nearest ? (nearest.n.tags!['name:ko'] ?? nearest.n.tags!.name) : null;
    } catch {
      // try the next mirror
    }
  }
  return null;
}

async function reverseGeocodeName(lat: number, lng: number): Promise<string | null> {
  const [r] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
  if (!r) return null;
  return r.name ?? ([r.district, r.street].filter(Boolean).join(' ') || null);
}

/**
 * Name of the closest shop/landmark to a stay: Kakao Local category search, then the
 * Kakao building name (when a key is configured), then OpenStreetMap, then the OS reverse geocoder. Successful lookups are cached by
 * ~10m-rounded coordinates so revisiting the screen doesn't hit the network again.
 */
export async function lookupPlaceName(lat: number, lng: number): Promise<string | null> {
  const key = `poi:${lat.toFixed(4)},${lng.toFixed(4)}`;
  const cached = await getAppStateValue(key);
  if (cached) return cached;

  const shop =
    (await kakaoNearest(lat, lng).catch(() => null)) ??
    (await kakaoBuildingName(lat, lng).catch(() => null)) ??
    (await overpassNearest(lat, lng));
  if (shop) {
    await setAppStateValue(key, shop);
    return shop;
  }
  // Address-style fallback isn't cached, so a real shop name can replace it once a source answers.
  return reverseGeocodeName(lat, lng).catch(() => null);
}
