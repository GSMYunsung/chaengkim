import React, { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';
import {
  getRecentSessions, getStaysForSession, getLeaveLogsForSession, getItems, getPlaces,
} from '../../src/db/queries';
import { Screen, TabHeader, Intro, SectionHeader, Note, Icon, Text } from '../../src/components/ui';
import { TimelineList, buildSessionEntries, type TimelineEntry } from '../../src/components/Timeline';
import { useStayNames } from '../../src/hooks/useStayNames';
import { colors, type } from '../../src/theme';
import { formatDateLabel } from '../../src/utils/format';
import type { LeaveLog, Session, Stay } from '../../src/types';

type Day = { key: string; title: string; entries: TimelineEntry[] };
type SessionData = { session: Session; stays: Stay[]; logs: LeaveLog[] };

export default function TimelineScreen() {
  const [data, setData] = useState<SessionData[]>([]);
  const [itemNames, setItemNames] = useState<Record<string, string>>({});
  const [placeNames, setPlaceNames] = useState<Record<string, string>>({});
  const [stayNames, resolveStayNames] = useStayNames();

  useFocusEffect(useCallback(() => { load(); }, []));

  async function load() {
    const [sessions, items, places] = await Promise.all([getRecentSessions(10), getItems(), getPlaces()]);
    setItemNames(Object.fromEntries(items.map(i => [i.id, i.name])));
    setPlaceNames(Object.fromEntries(places.map(p => [p.id, p.name])));

    const perSession = await Promise.all(sessions.map(async (session: Session) => {
      const [stays, logs] = await Promise.all([getStaysForSession(session.id), getLeaveLogsForSession(session.id)]);
      return { session, stays, logs };
    }));
    setData(perSession);

    // Only stays that got a leave check appear in the timeline, so only those need a name.
    resolveStayNames(perSession.flatMap(({ stays, logs }) => {
      const checked = new Set(logs.map(l => l.stayId));
      return stays.filter(st => checked.has(st.id) && !st.placeId);
    }));
  }

  const days = useMemo(() => {
    const byDay = new Map<string, Day>();
    for (const { session, stays, logs } of data) {
      const title = formatDateLabel(session.startedAt);
      const day = byDay.get(title) ?? { key: title, title, entries: [] };
      day.entries.push(...buildSessionEntries(session, stays, logs, itemNames, placeNames, stayNames));
      byDay.set(title, day);
    }
    return [...byDay.values()].map(d => ({ ...d, entries: d.entries.sort((a, b) => a.time - b.time) }));
  }, [data, itemNames, placeNames, stayNames]);

  return (
    <Screen edges={['top']} header={<TabHeader title="기록" />}>
      <Intro title="챙긴 순간의 기록" subtitle="물건을 직접 확인한 장소와 시간을 모았어요." />
      {days.length === 0 ? (
        <View style={styles.empty}>
          <Icon name="clock-3" size={26} color={colors.sub} />
          <Text style={type.heading}>아직 기록이 없어요</Text>
          <Text style={[type.body, { textAlign: 'center' }]}>외출을 시작하면 확인한 순간이{'\n'}여기에 쌓여요.</Text>
        </View>
      ) : days.map((day, di) => (
        <View key={day.key}>
          <SectionHeader first={di === 0} title={day.title} />
          <TimelineList entries={day.entries} />
        </View>
      ))}
      {days.length > 0 && <Note>위치는 물건의 현재 위치가 아닌, 마지막으로 확인한 장소예요.</Note>}
    </Screen>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderRadius: 16, paddingVertical: 28, paddingHorizontal: 18 },
});
