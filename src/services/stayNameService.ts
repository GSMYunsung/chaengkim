import { getPlaces, setStayCustomName, setStayPlace, upsertPlace } from '../db/queries';
import { distanceM } from '../utils/geo';
import type { Place, Stay } from '../types';

const SAVED_PLACE_RADIUS_M = 100;

/**
 * Renames one stay. The name is stored on that stay only, so other stays nearby keep theirs.
 * If no saved place covers this spot yet, one is created with the name so the next visit
 * (and its leave notification) starts from it — existing places are never renamed here.
 */
export async function renameStay(stay: Stay, name: string): Promise<void> {
  await setStayCustomName(stay.id, name);
  if (stay.placeId) return;

  const places = await getPlaces();
  const covering = places.find(
    p => distanceM(p.lat, p.lng, stay.anchorLat, stay.anchorLng) < p.radiusM,
  );
  if (covering) return;

  const place = await upsertPlace({
    name,
    lat: stay.anchorLat,
    lng: stay.anchorLng,
    radiusM: SAVED_PLACE_RADIUS_M,
    kind: 'saved',
    extraItemIds: [],
  });
  await setStayPlace(stay.id, place.id);
}

/** Home is the return-check reference, so it's managed in Settings rather than renamed per stay. */
export function isHomeStay(stay: Stay, places: Pick<Place, 'id' | 'kind'>[]): boolean {
  return !!stay.placeId && places.some(p => p.id === stay.placeId && p.kind === 'home');
}

/** Display name for a stay: user's own name, then saved place, then looked-up nearby shop. */
export function stayName(
  stay: Stay,
  placeNames: Record<string, string>,
  lookedUp: Record<string, string>,
): string | undefined {
  return stay.customName || (stay.placeId && placeNames[stay.placeId]) || lookedUp[stay.id] || undefined;
}
