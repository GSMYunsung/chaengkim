import * as Location from 'expo-location';
import { LOCATION_TASK_NAME, GEOFENCE_TASK_NAME } from '../tasks/taskNames';
import { getHomePlace, getPlaces } from '../db/queries';

export async function requestPermissions(): Promise<{ foreground: boolean; background: boolean }> {
  const { status: fg } = await Location.requestForegroundPermissionsAsync();
  if (fg !== 'granted') return { foreground: false, background: false };
  const { status: bg } = await Location.requestBackgroundPermissionsAsync();
  return { foreground: true, background: bg === 'granted' };
}

export async function checkPermissions(): Promise<{ foreground: boolean; background: boolean }> {
  const fg = await Location.getForegroundPermissionsAsync();
  const bg = await Location.getBackgroundPermissionsAsync();
  return {
    foreground: fg.status === 'granted',
    background: bg.status === 'granted',
  };
}

export async function startTracking(): Promise<void> {
  const isRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => false);
  if (!isRunning) {
    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      accuracy: Location.Accuracy.Balanced,
      distanceInterval: 30,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: '챙김 추적 중',
        notificationBody: '소지품 알림을 위해 위치를 확인합니다',
        notificationColor: '#4F8EF7',
      },
      pausesUpdatesAutomatically: false,
    });
  }
  await registerHomeGeofence();
}

export async function stopTracking(): Promise<void> {
  const isRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => false);
  if (isRunning) await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);

  const geofencing = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK_NAME).catch(() => false);
  if (geofencing) await Location.stopGeofencingAsync(GEOFENCE_TASK_NAME).catch(() => {});
}

export async function registerAnchorGeofence(
  stayId: string,
  lat: number,
  lng: number,
  radiusM: number,
): Promise<void> {
  const places = await getPlaces();
  // Home is added separately below with its own identifier, so only true trusted places here.
  const trustedPlaces = places.filter(p => p.kind === 'trusted');
  const homePlace = await getHomePlace();

  const regions: Location.LocationRegion[] = [
    {
      identifier: stayId,
      latitude: lat,
      longitude: lng,
      radius: radiusM,
      notifyOnEnter: false,
      notifyOnExit: true,
    },
    ...trustedPlaces.map(p => ({
      identifier: `trusted-${p.id}`,
      latitude: p.lat,
      longitude: p.lng,
      radius: p.radiusM,
      notifyOnEnter: true,
      notifyOnExit: false,
    })),
  ];

  if (homePlace) {
    regions.push({
      identifier: `home-${homePlace.id}`,
      latitude: homePlace.lat,
      longitude: homePlace.lng,
      radius: homePlace.radiusM,
      notifyOnEnter: true,
      notifyOnExit: false,
    });
  }

  // Calling start again replaces the regions of a running task. Stopping first is unsafe:
  // location updates can arrive back-to-back, and a second stop on an already-unregistered
  // task throws "Task not found". Calls are chained so registrations never overlap.
  geofenceQueue = geofenceQueue
    .catch(() => {})
    .then(() => Location.startGeofencingAsync(GEOFENCE_TASK_NAME, regions));
  return geofenceQueue;
}

let geofenceQueue: Promise<void> = Promise.resolve();

async function registerHomeGeofence(): Promise<void> {
  const homePlace = await getHomePlace();
  if (!homePlace) return;
  const geofencing = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK_NAME).catch(() => false);
  if (!geofencing) {
    await Location.startGeofencingAsync(GEOFENCE_TASK_NAME, [
      {
        identifier: `home-${homePlace.id}`,
        latitude: homePlace.lat,
        longitude: homePlace.lng,
        radius: homePlace.radiusM,
        notifyOnEnter: true,
        notifyOnExit: false,
      },
    ]);
  }
}
