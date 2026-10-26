import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { getDatabase } from '../db/database';
import type { LeaveLog } from '../types';

type StayRow = {
  id: string;
  anchorLat: number;
  anchorLng: number;
  arrivedAt: number;
  leftAt: number | null;
  placeId: string | null;
};

export async function exportLeaveLogsToCSV(logs: LeaveLog[]): Promise<void> {
  const db = await getDatabase();

  // fetch stay coords for all logs
  const stayIds = [...new Set(logs.map(l => l.stayId))];
  const placeholders = stayIds.map(() => '?').join(',');
  const stays = stayIds.length > 0
    ? await db.getAllAsync<StayRow>(
        `SELECT id, anchorLat, anchorLng, arrivedAt, leftAt, placeId FROM stays WHERE id IN (${placeholders})`,
        stayIds,
      )
    : [];
  const stayMap = Object.fromEntries(stays.map(s => [s.id, s]));

  const header = [
    'id', 'stayId', 'anchorLat', 'anchorLng', 'arrivedAt',
    'dwellMin', 'signalAAt', 'signalBAt',
    'notifiedBy', 'notifiedAt', 'distanceFromAnchorM',
    'userReportedDelay', 'action', 'recoveredItemCount',
  ].join(',');

  const rows = logs.map(log => {
    const stay = stayMap[log.stayId];
    return [
      log.id,
      log.stayId,
      stay?.anchorLat.toFixed(6) ?? '',
      stay?.anchorLng.toFixed(6) ?? '',
      stay?.arrivedAt ?? '',
      log.dwellMin.toFixed(1),
      log.signalAAt ?? '',
      log.signalBAt ?? '',
      log.notifiedBy,
      log.notifiedAt,
      log.distanceFromAnchorM.toFixed(1),
      log.userReportedDelay ?? '',
      log.action ?? '',
      log.recoveredItemIds.length,
    ].join(',');
  });

  const csv = [header, ...rows].join('\n');
  const fileUri = (FileSystem.documentDirectory ?? '') + 'chaengkim_log.csv';
  await FileSystem.writeAsStringAsync(fileUri, csv, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(fileUri, {
      mimeType: 'text/csv',
      dialogTitle: '측정 로그 내보내기',
      UTI: 'public.comma-separated-values-text',
    });
  }
}

