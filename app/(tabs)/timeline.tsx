import React, { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import {
  getRecentSessions, getStaysForSession, getLeaveLogsForSession, getItems, getPlaces,
} from '../../src/db/queries';
import { Screen, TabHeader, Intro, SectionHeader, Note, Text } from '../../src/components/ui';
import { Mascot } from '../../src/components/Mascot';
import { RouteMapCard, RouteMapButton } from '../../src/components/RouteMapCard';
import type { Coord } from '../../src/components/RouteMap';
import { TimelineList, buildSessionEntries, type TimelineEntry } from '../../src/components/Timeline';
import { useStayNames } from '../../src/hooks/useStayNames';
import { StayNameDialog } from '../../src/components/StayNameDialog';
import { isHomeStay, stayName } from '../../src/services/stayNameService';
import { type } from '../../src/theme';
import { formatDateLabel, formatTime } from '../../src/utils/format';
import type { LeaveLog, Place, Session, Stay } from '../../src/types';

type Day = { key: string; title: string; entries: TimelineEntry[]; stays: { stay: Stay; checked: boolean }[] };
type SessionData = { session: Session; stays: Stay[]; logs: LeaveLog[] };

export default function TimelineScreen() {
  const [data, setData] = useState<SessionData[]>([]);
  const [itemNames, setItemNames] = useState<Record<string, string>>({});
  const [placeNames, setPlaceNames] = useState<Record<string, string>>({});
  const [places, setPlaces] = useState<Place[]>([]);
  const [editing, setEditing] = useState<Stay | null>(null);
  const [stayNames, resolveStayNames] = useStayNames();

  useFocusEffect(useCallback(() => { load(); }, []));

  async function load() {
    const [sessions, items, places] = await Promise.all([getRecentSessions(10), getItems(), getPlaces()]);
    setItemNames(Object.fromEntries(items.map(i => [i.id, i.name])));
    setPlaceNames(Object.fromEntries(places.map(p => [p.id, p.name])));
    setPlaces(places);

    const perSession = await Promise.all(sessions.map(async (session: Session) => {
      const [stays, logs] = await Promise.all([getStaysForSession(session.id), getLeaveLogsForSession(session.id)]);
      return { session, stays, logs };
    }));
    setData(perSession);

    // Only stays that got a leave check appear in the timeline, so only those need a name.
    resolveStayNames(perSession.flatMap(({ stays, logs }) => {
      const checked = new Set(logs.map(l => l.stayId));
      return stays.filter(st => checked.has(st.id) && !st.placeId && !st.customName);
    }));
  }

  const days = useMemo(() => {
    const byDay = new Map<string, Day>();
    for (const { session, stays, logs } of data) {
      const title = formatDateLabel(session.startedAt);
      const day = byDay.get(title) ?? { key: title, title, entries: [], stays: [] };
      day.entries.push(...buildSessionEntries(session, stays, logs, itemNames, placeNames, stayNames));
      const checked = new Set(logs.map(l => l.stayId));
      day.stays.push(...stays.map(stay => ({ stay, checked: checked.has(stay.id) })));
      byDay.set(title, day);
    }
    return [...byDay.values()].map(d => {
      const ordered = [...d.stays].sort((a, b) => a.stay.arrivedAt - b.stay.arrivedAt);
      // The day's path; places where belongings were checked are pinned and named.
      const coords: Coord[] = ordered.map(({ stay, checked }) => ({
        lat: stay.anchorLat,
        lng: stay.anchorLng,
        label: formatTime(stay.arrivedAt),
        stop: checked,
        name: checked ? stayName(stay, placeNames, stayNames) : undefined,
      }));
      const checkedCount = ordered.filter(o => o.checked).length;
      return {
        ...d,
        entries: d.entries.sort((a, b) => a.time - b.time),
        coords,
        summary: checkedCount ? `${checkedCount}곳에서 확인` : `${coords.length}곳 기록`,
      };
    });
  }, [data, itemNames, placeNames, stayNames]);

  function editStay(stayId: string) {
    const stay = data.flatMap(d => d.stays).find(st => st.id === stayId);
    if (!stay) return;
    if (isHomeStay(stay, places)) {
      Alert.alert('집은 설정에서 바꿔요', '집 위치는 귀가 확인 기준이라 설정 탭에서 관리해요.');
      return;
    }
    setEditing(stay);
  }

  return (
    <Screen edges={['top']} header={<TabHeader title="기록" />}>
      <Intro subtitle="물건을 직접 확인한 장소와 시간을 모았어요." />
      {days.length === 0 ? (
        <View style={styles.empty}>
          <Mascot pose="sleep" size={132} />
          <Text style={type.heading}>아직 기록이 없어요</Text>
          <Text style={[type.body, { textAlign: 'center' }]}>외출을 시작하면 확인한 순간이{'\n'}여기에 쌓여요.</Text>
        </View>
      ) : days.map((day, di) => (
        <View key={day.key}>
          <SectionHeader
            first={di === 0}
            title={day.title}
            right={di > 0 && day.coords.length > 0
              ? <RouteMapButton coords={day.coords} title={`${day.title} 동선`} summary={day.summary} />
              : undefined}
          />
          {di === 0 && day.coords.length > 0 && (
            <View style={styles.map}>
              <RouteMapCard
                coords={day.coords}
                title={`${day.title} 동선`}
                summary={day.summary}
                height={180}
                legend={false}
              />
            </View>
          )}
          <TimelineList entries={day.entries} onEditStay={editStay} />
        </View>
      ))}
      {days.length > 0 && <Note>위치는 물건의 현재 위치가 아닌, 마지막으로 확인한 장소예요.</Note>}
      <StayNameDialog
        stay={editing}
        currentName={editing ? stayName(editing, placeNames, stayNames) : undefined}
        onClose={() => setEditing(null)}
        onSaved={() => load()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  map: { marginBottom: 20 },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 18 },
});
