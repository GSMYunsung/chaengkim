import { getDatabase } from './database';
import { getItems, setAppStateValue, pruneOldRecords, getSessionsSince } from './queries';
import { startOfMonth } from '../utils/format';

// Test-lab only: fills history with believable outings so the timeline, maps, streak and
// month-based pruning can be checked without walking around for weeks.

const SPOTS = [
  { name: '회사', lat: 37.4979, lng: 127.0276 },
  { name: '성수 카페', lat: 37.5446, lng: 127.0557 },
  { name: '을지로 점심', lat: 37.5663, lng: 126.991 },
  { name: '잠실 헬스장', lat: 37.5133, lng: 127.1001 },
  { name: '판교 미팅', lat: 37.3947, lng: 127.1112 },
  // No shop within 100m: exercises the cached "no shop here" path.
  { name: '한강 둔치', lat: 37.5283, lng: 126.933 },
];

const MIN = 60_000;
let seq = 0;
const id = (p: string) => `sample-${p}-${Date.now().toString(36)}-${(seq++).toString(36)}`;

/** Day offsets (days ago) for the sample outings; today has two. Ones before this month get pruned. */
const DAYS_AGO = [0, 0, 1, 2, 4, 5, 7, 8, 9, 11, 13, 15, 24, 32, 38];

export async function seedSampleHistory(): Promise<{ added: number; kept: number; days: number; streak: number }> {
  const db = await getDatabase();
  const items = await getItems();
  const itemIds = items.filter(i => i.isDefault).map(i => i.id);
  const all = itemIds.length ? itemIds : items.map(i => i.id);

  await db.withTransactionAsync(async () => {
    for (let n = 0; n < DAYS_AGO.length; n++) {
      const day = new Date();
      day.setDate(day.getDate() - DAYS_AGO[n]);
      // Two outings today: a morning one and an afternoon one.
      const second = n === 1;
      day.setHours(second ? 13 : 8, second ? 30 : 40, 0, 0);
      if (day.getTime() > Date.now()) day.setTime(Date.now() - (second ? 2 : 5) * 60 * MIN);

      const sessionId = id('s');
      const start = day.getTime();
      let t = start + 25 * MIN;
      const stayCount = 2 + (n % 2);

      for (let k = 0; k < stayCount; k++) {
        const spot = SPOTS[(n + k) % SPOTS.length];
        const dwell = 35 + ((n * 7 + k * 11) % 80);
        const stayId = id('st');
        const arrived = t;
        const left = arrived + dwell * MIN;
        // Today's outings must not run into the future.
        if (k > 0 && left > Date.now() - 10 * MIN) break;
        // A few stays carry a name the user typed, to show the per-stay rename.
        const custom = (n + k) % 4 === 0 ? spot.name : null;
        await db.runAsync(
          'INSERT INTO stays (id, sessionId, anchorLat, anchorLng, arrivedAt, leftAt, customName) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [stayId, sessionId, spot.lat + k * 0.0004, spot.lng + k * 0.0004, arrived, left, custom],
        );
        const recovered = n === 2 && k === 0 && all[0] ? [all[0]] : [];
        await db.runAsync(
          `INSERT INTO leave_logs (id, stayId, dwellMin, signalAAt, notifiedBy, notifiedAt, distanceFromAnchorM,
             userReportedDelay, action, recoveredItemIds)
           VALUES (?, ?, ?, ?, 'A', ?, ?, ?, ?, ?)`,
          [id('ll'), stayId, dwell, left, left, 110 + k * 15, k % 2 ? '1-3' : 'now',
            recovered.length ? 'opened' : 'allChecked', JSON.stringify(recovered)],
        );
        t = left + 20 * MIN;
      }

      // Every sample outing is finished, so the app isn't left "외출 중".
      const end = Math.min(t + 15 * MIN, Date.now() - MIN);
      // One older outing came home missing an item, to show it doesn't count toward the streak.
      const returned = n === 6 ? all.slice(1) : all;
      await db.runAsync(
        'INSERT INTO sessions (id, startedAt, endedAt, trigger, itemIds, returnedItemIds) VALUES (?, ?, ?, ?, ?, ?)',
        [sessionId, start, end, 'manual', JSON.stringify(all), JSON.stringify(returned)],
      );
    }
  });

  // Outings since the one that came home short (index 6) all came home complete.
  const streak = 6;
  await setAppStateValue('returnStreak', String(streak));
  await pruneOldRecords();

  const kept = await getSessionsSince(startOfMonth());
  const days = new Set(kept.map(k => new Date(k.startedAt).getDate())).size;
  return { added: DAYS_AGO.length, kept: kept.length, days, streak };
}
