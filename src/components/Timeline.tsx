import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Icon, type IconName, Text } from './ui';
import { colors, type } from '../theme';
import { formatTime } from '../utils/format';
import type { LeaveLog, Session, Stay } from '../types';

export type TimelineEntry = { time: number; icon: IconName; label: string; sub: string; confirmed?: boolean };

function describeCheck(log: LeaveLog, names: Record<string, string>): { sub: string; confirmed: boolean } {
  if (log.recoveredItemIds.length) {
    return { sub: `돌아가서 챙김 · ${log.recoveredItemIds.map(id => names[id] ?? '삭제된 물건').join(', ')}`, confirmed: true };
  }
  if (log.action === 'allChecked') return { sub: '모든 소지품 확인', confirmed: true };
  if (log.action === 'opened') return { sub: '소지품 확인', confirmed: true };
  return { sub: '알림에 응답하지 않았어요', confirmed: false };
}

export function buildSessionEntries(
  session: Session,
  stays: Stay[],
  logs: LeaveLog[],
  names: Record<string, string>,
  placeNames: Record<string, string>,
  /** Nearby shop/landmark names looked up per stay id (see placeLookup). */
  stayNames: Record<string, string> = {},
): TimelineEntry[] {
  const logByStay = Object.fromEntries(logs.map(l => [l.stayId, l]));
  const entries: TimelineEntry[] = [{
    time: session.startedAt,
    icon: 'house',
    label: '집에서 출발',
    sub: `${session.itemIds.length}개 소지품과 외출 시작`,
  }];
  for (const stay of stays) {
    const log = logByStay[stay.id];
    // Stays without a leave notification are just pass-through anchors; only show places that mattered.
    if (!log) continue;
    const place = (stay.placeId && placeNames[stay.placeId]) || stayNames[stay.id] || '머문 장소';
    entries.push({ time: stay.arrivedAt, icon: 'coffee', label: place, sub: '머무르기 시작' });
    entries.push({ time: log.notifiedAt, icon: 'check-check', label: `${place}에서 확인`, ...describeCheck(log, names) });
  }
  if (session.endedAt) {
    entries.push({ time: session.endedAt, icon: 'house', label: '집에 도착', sub: '귀가 확인 완료 · 위치 기록 종료' });
  }
  return entries.sort((a, b) => a.time - b.time);
}

export function TimelineList({ entries }: { entries: TimelineEntry[] }) {
  return (
    <View>
      {entries.map((e, i) => (
        <View key={`${e.time}-${i}`} style={styles.event}>
          <Text style={styles.time}>{formatTime(e.time)}</Text>
          <View style={styles.track}>
            <Icon name={e.icon} size={21} color={colors.blue} style={styles.icon} />
            {i < entries.length - 1 && <View style={styles.line} />}
          </View>
          <View style={styles.body}>
            <Text style={styles.label}>{e.label}</Text>
            <Text style={[type.small, { marginTop: 4 }]}>{e.sub}</Text>
            {e.confirmed && <Text style={styles.badge}>직접 확인한 기록</Text>}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  event: { flexDirection: 'row', gap: 10, paddingBottom: 25 },
  time: { width: 39, fontSize: 12, color: colors.sub, paddingTop: 3, fontVariant: ['tabular-nums'] },
  track: { width: 29, alignItems: 'center', paddingTop: 1 },
  icon: { backgroundColor: colors.bg, zIndex: 1 },
  line: { position: 'absolute', top: 26, bottom: -26, width: 1, backgroundColor: colors.track },
  body: { flex: 1 },
  label: { fontSize: 15, fontWeight: '600', color: colors.ink },
  badge: {
    alignSelf: 'flex-start', marginTop: 9, fontSize: 12, color: colors.blue, backgroundColor: colors.tint,
    paddingVertical: 7, paddingHorizontal: 9, borderRadius: 8, overflow: 'hidden',
  },
});
