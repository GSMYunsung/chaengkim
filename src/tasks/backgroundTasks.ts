import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { sendLeaveNotification, sendReturnNotification } from '../services/notificationService';
import { registerAnchorGeofence } from '../services/locationService';
import {
  getActiveSession,
  getActiveStay,
  createStay,
  updateStayLeft,
  createLeaveLog,
  getLeaveLogByStayId,
  getAppStateValue,
  setAppStateValue,
  getPlaces,
  getDwellThresholdMin,
  getStay,
  recordLateSignal,
} from '../db/queries';
import { distanceM as distance } from '../utils/geo';

import { LOCATION_TASK_NAME, GEOFENCE_TASK_NAME } from './taskNames';

export { LOCATION_TASK_NAME, GEOFENCE_TASK_NAME };


async function getThresholds() {
  const testEnabled = await getAppStateValue('testMode');
  if (testEnabled === 'true') {
    return { dwellMin: 1, anchorRadius: 20, geofenceRadius: 30, returnGraceMin: 1 };
  }
  return { dwellMin: await getDwellThresholdMin(), anchorRadius: 100, geofenceRadius: 150, returnGraceMin: 10 };
}

// Starts a new stay and arms its exit geofence (Signal B), so a leave alert can fire
// even if iOS has suspended or terminated the app and location updates stopped.
async function setAnchor(sessionId: string, lat: number, lng: number, now: number, geofenceRadius: number) {
  const stay = await createStay(sessionId, lat, lng);
  await setAppStateValue('anchorTime', String(now));
  try {
    await registerAnchorGeofence(stay.id, lat, lng, geofenceRadius);
  } catch (e) {
    console.error('Geofence register error:', e);
  }
  return stay;
}


// kCLErrorLocationUnknown (code 0): Core Location couldn't get a fix yet and keeps trying.
// Apple documents it as transient and safe to ignore, so it isn't reported as an error.
function isTransientLocationError(error: any): boolean {
  return error?.code === 0 || /kCLErrorDomain Code=0\b/.test(String(error?.message ?? ''));
}

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }: any) => {
  if (error) {
    if (!isTransientLocationError(error)) console.error('Location task error:', error);
    return;
  }
  const locations: Location.LocationObject[] = data?.locations ?? [];
  if (!locations.length) return;

  const session = await getActiveSession();
  if (!session) return;

  const thresholds = await getThresholds();
  const loc = locations[locations.length - 1];
  const { latitude, longitude } = loc.coords;
  const now = Date.now();

  const activeStay = await getActiveStay(session.id);

  if (!activeStay) {
    await setAnchor(session.id, latitude, longitude, now, thresholds.geofenceRadius);
    return;
  }

  const dist = distance(activeStay.anchorLat, activeStay.anchorLng, latitude, longitude);

  if (dist < thresholds.anchorRadius) {
    return;
  }

  // Signal A: user moved outside anchor radius
  const dwellMs = now - activeStay.arrivedAt;
  const dwellMin = dwellMs / 60000;

  if (dwellMin < thresholds.dwellMin) {
    // Didn't stay long enough — move anchor without notification
    await updateStayLeft(activeStay.id);
    await setAnchor(session.id, latitude, longitude, now, thresholds.geofenceRadius);
    return;
  }

  // Check if already notified for this stay
  const existing = await getLeaveLogByStayId(activeStay.id);
  if (existing) {
    // Signal B already alerted for this stay; record when A caught up, then move on so
    // the next stay can be detected.
    await recordLateSignal(activeStay.id, 'A', now);
    await updateStayLeft(activeStay.id);
    await setAnchor(session.id, latitude, longitude, now, thresholds.geofenceRadius);
    return;
  }

  // Check if home/trusted place
  const places = await getPlaces();
  const anchorPlace = places.find(
    p =>
      distance(p.lat, p.lng, activeStay.anchorLat, activeStay.anchorLng) < p.radiusM &&
      (p.kind === 'home' || p.kind === 'trusted'),
  );
  if (anchorPlace) {
    await updateStayLeft(activeStay.id, anchorPlace.id);
    await setAnchor(session.id, latitude, longitude, now, thresholds.geofenceRadius);
    return;
  }

  // Fire notification — Signal A wins
  const matchedPlace = places.find(
    p => distance(p.lat, p.lng, activeStay.anchorLat, activeStay.anchorLng) < p.radiusM,
  );

  const itemCount = session.itemIds.length;

  await createLeaveLog({
    stayId: activeStay.id,
    dwellMin,
    signalAAt: now,
    signalBAt: undefined,
    notifiedBy: 'A',
    notifiedAt: now,
    distanceFromAnchorM: dist,
    recoveredItemIds: [],
  });

  await updateStayLeft(activeStay.id, matchedPlace?.id);
  await setAnchor(session.id, latitude, longitude, now, thresholds.geofenceRadius);

  await sendLeaveNotification(activeStay.id, itemCount, matchedPlace?.name ?? null);
});

TaskManager.defineTask(GEOFENCE_TASK_NAME, async ({ data, error }: any) => {
  if (error) { console.error('Geofence task error:', error); return; }
  const { eventType, region } = data as {
    eventType: Location.GeofencingEventType;
    region: Location.LocationRegion;
  };

  const regionId = region.identifier;
  if (!regionId) return;
  const session = await getActiveSession();
  if (!session) return;

  const thresholds = await getThresholds();
  const now = Date.now();

  if (eventType === Location.GeofencingEventType.Enter) {
    if (!regionId.startsWith('home-')) return;
    // Starting an outing at home can report an immediate Enter; only count a real return.
    if ((now - session.startedAt) / 60000 < thresholds.returnGraceMin) return;
    const key = `returnNotified_${session.id}`;
    if (await getAppStateValue(key)) return;
    await setAppStateValue(key, String(now));
    await sendReturnNotification(session.itemIds.length);
    return;
  }

  if (eventType !== Location.GeofencingEventType.Exit) return;
  if (regionId.startsWith('home-') || regionId.startsWith('trusted-')) return;
  const stayId = regionId;

  // Check if already notified (Signal A may have fired first)
  const existing = await getLeaveLogByStayId(stayId);
  if (existing) {
    // Signal A already alerted for this stay; record when B caught up.
    await recordLateSignal(stayId, 'B', now);
    return;
  }

  const stay = await getStay(stayId);
  if (!stay) return;

  const dwellMs = now - stay.arrivedAt;
  const dwellMin = dwellMs / 60000;

  if (dwellMin < thresholds.dwellMin) return;

  const places = await getPlaces();
  const anchorPlace = places.find(
    p =>
      distance(p.lat, p.lng, stay.anchorLat, stay.anchorLng) < p.radiusM &&
      (p.kind === 'home' || p.kind === 'trusted'),
  );
  if (anchorPlace) return;

  const matchedPlace = places.find(
    p => distance(p.lat, p.lng, stay.anchorLat, stay.anchorLng) < p.radiusM,
  );

  const itemCount = session.itemIds.length;

  await createLeaveLog({
    stayId,
    dwellMin,
    signalAAt: undefined,
    signalBAt: now,
    notifiedBy: 'B',
    notifiedAt: now,
    distanceFromAnchorM: thresholds.geofenceRadius,
    recoveredItemIds: [],
  });

  await sendLeaveNotification(stayId, itemCount, matchedPlace?.name ?? null);
});
