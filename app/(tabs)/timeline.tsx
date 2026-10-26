import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, Alert, Pressable } from 'react-native';
import { useFocusEffect } from 'expo-router';
import {
  getSessionsSince, getStaysForSession, getLeaveLogsForSession, getItems, getPlaces,
} from '../../src/db/queries';
import { Screen, TabHeader, Text } from '../../src/components/ui';
import { Mascot } from '../../src/components/Mascot';
import { RouteMapCard } from '../../src/components/RouteMapCard';
import type { Coord } from '../../src/components/RouteMap';
import { TimelineList, buildSessionEntries, type TimelineEntry } from '../../src/components/Timeline';
import { useStayNames } from '../../src/hooks/useStayNames';
import { StayNameDialog } from '../../src/components/StayNameDialog';
import { isHomeStay, stayName } from '../../src/services/stayNameService';
import { colors, type } from '../../src/theme';
import { WEEKDAYS, formatDateLabel, formatTime, startOfMonth } from '../../src/utils/format';
import type { LeaveLog, Place, Session, Stay } from '../../src/types';

type SessionData = { session: Session; stays: Stay[]; logs: LeaveLog[] };
type Day = {
  date: number; // day of month
  title: string;
  entries: TimelineEntry[];
  coords: Coord[];
  outings: number;
  checkedCount: number;
  /** Some outing that day came home without an item. */
  missed: boolean;
};

export default function TimelineScreen() {
  const [data, setData] = useState<SessionData[]>([]);
  const [itemNames, setItemNames] = useState<Record<string, string>>({});
  const [placeNames, setPlaceNames] = useState<Record<string, string>>({});
  const [places, setPlaces] = useState<Place[]>([]);
  const [editing, setEditing] = useState<Stay | null>(null);
  const [stayNames, resolveStayNames] = useStayNames();
  // Null = default selection (today, or the latest day with records). Reset on every visit.
  const [picked, setPicked] = useState<number | null>(null);

  useFocusEffect(useCallback(() => { setPicked(null); load(); }, []));

  async function load() {
    const [sessions, items, places] = await Promise.all([
      getSessionsSince(startOfMonth()), getItems(), getPlaces(),
    ]);
    setItemNames(Object.fromEntries(items.map(i => [i.id, i.name])));
    setPlaceNames(Object.fromEntries(places.map(p => [p.id, p.name])));
    setPlaces(places);

    const perSession = await Promise.all(sessions.map(async (session: Session) => {
      const [stays, logs] = await Promise.all([getStaysForSession(session.id), getLeaveLogsForSession(session.id)]);
      return { session, stays, logs };
    }));
    setData(perSession);
  }

  const days = useMemo(() => {
    const byDate = new Map<number, Day & { stays: { stay: Stay; checked: boolean }[] }>();
    for (const { session, stays, logs } of data) {
      const date = new Date(session.startedAt).getDate();
      const day = byDate.get(date) ?? {
        date, title: formatDateLabel(session.startedAt), entries: [], coords: [], stays: [],
        outings: 0, checkedCount: 0, missed: false,
      };
      day.outings += 1;
      day.entries.push(...buildSessionEntries(session, stays, logs, itemNames, placeNames, stayNames));
      const checked = new Set(logs.map(l => l.stayId));
      day.stays.push(...stays.map(stay => ({ stay, checked: checked.has(stay.id) })));
      const returned = session.returnedItemIds;
      if (returned && returned.length < session.itemIds.length) day.missed = true;
      byDate.set(date, day);
    }
    const result = new Map<number, Day>();
    for (const [date, d] of byDate) {
      const ordered = [...d.stays].sort((a, b) => a.stay.arrivedAt - b.stay.arrivedAt);
      result.set(date, {
        ...d,
        entries: d.entries.sort((a, b) => a.time - b.time),
        // The day's path; places where belongings were checked are pinned and named.
        coords: ordered.map(({ stay, checked }) => ({
          lat: stay.anchorLat,
          lng: stay.anchorLng,
          label: formatTime(stay.arrivedAt),
          stop: checked,
          name: checked ? stayName(stay, placeNames, stayNames) : undefined,
        })),
        checkedCount: ordered.filter(o => o.checked).length,
      });
    }
    return result;
  }, [data, itemNames, placeNames, stayNames]);

  const totals = useMemo(() => {
    const logs = data.flatMap(d => d.logs);
    return {
      outings: data.length,
      checks: logs.filter(l => l.action && l.action !== 'ignored').length,
      recovered: logs.reduce((n, l) => n + l.recoveredItemIds.length, 0),
    };
  }, [data]);

  const now = new Date();
  const todayDate = now.getDate();
  const latest = days.size ? Math.max(...days.keys()) : todayDate;
  const selected = picked ?? (days.has(todayDate) ? todayDate : latest);
  const day = days.get(selected);

  // Names are looked up live for the day on screen only (Kakao results aren't stored), and only
  // for stays that got a leave check, since those are the ones the timeline names. Days already
  // shown while the tab has been mounted aren't asked again.
  useEffect(() => {
    resolveStayNames(data
      .filter(d => new Date(d.session.startedAt).getDate() === selected)
      .flatMap(({ stays, logs }) => {
        const checked = new Set(logs.map(l => l.stayId));
        return stays.filter(st => checked.has(st.id) && !st.placeId && !st.customName);
      }));
  }, [data, selected, resolveStayNames]);

  function editStay(stayId: string) {
    const stay = data.flatMap(d => d.stays).find(st => st.id === stayId);
    if (!stay) return;
    if (isHomeStay(stay, places)) {
      Alert.alert('집은 설정에서 바꿔요', '집 위치는 귀가 확인 기준이라 설정 탭에서 관리해요.');
      return;
    }
    setEditing(stay);
  }

  const selectedTitle = formatDateLabel(new Date(now.getFullYear(), now.getMonth(), selected).getTime());

  return (
    <Screen edges={['top']} header={<TabHeader title="기록" />}>
      <View style={styles.summary}>
        <Mascot pose={data.length ? 'idle' : 'sleep'} size={76} />
        <View style={{ flex: 1 }}>
          <Text style={styles.summaryTitle}>
            {now.getMonth() + 1}월, <Text style={{ color: colors.blue }}>{totals.outings}번</Text> 외출했어요
          </Text>
          <View style={styles.chips}>
            <View style={[styles.chip, styles.chipBlue]}>
              <Text style={[styles.chipText, { color: colors.blue }]}>확인 {totals.checks}번</Text>
            </View>
            {totals.recovered > 0 && (
              <View style={styles.chip}>
                <Text style={styles.chipText}>돌아가서 챙김 {totals.recovered}개</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      <MonthCalendar
        year={now.getFullYear()}
        month={now.getMonth()}
        today={todayDate}
        selected={selected}
        marks={days}
        onSelect={setPicked}
      />
      <Text style={styles.hint}>이번 달 기록만 보관해요. 위치는 마지막으로 확인한 장소예요.</Text>

      <View style={styles.dayCard}>
        <View style={styles.dayHead}>
          <Text style={styles.dayTitle}>{selectedTitle}</Text>
          <Text style={[type.small, { marginTop: 3 }]}>
            {day
              ? `외출 ${day.outings}번${day.checkedCount ? ` · ${day.checkedCount}곳에서 확인` : ''}`
              : '이날은 외출 기록이 없어요'}
          </Text>
        </View>
        {day ? (
          <View style={styles.dayBody}>
            {day.coords.length > 0 && (
              <View style={styles.map}>
                <RouteMapCard
                  coords={day.coords}
                  title={`${day.title} 동선`}
                  summary={day.checkedCount ? `${day.checkedCount}곳에서 확인` : `${day.coords.length}곳 기록`}
                  height={170}
                  legend={false}
                />
              </View>
            )}
            <TimelineList entries={day.entries} onEditStay={editStay} />
          </View>
        ) : (
          <View style={styles.dayEmpty}>
            <Mascot pose="sleep" size={84} />
          </View>
        )}
      </View>

      <StayNameDialog
        stay={editing}
        currentName={editing ? stayName(editing, placeNames, stayNames) : undefined}
        onClose={() => setEditing(null)}
        onSaved={() => load()}
      />
    </Screen>
  );
}

/** One month grid (Sun–Sat). Blue dot: went out that day. Orange dot: something didn't come home. */
function MonthCalendar({ year, month, today, selected, marks, onSelect }: {
  year: number;
  month: number;
  today: number;
  selected: number;
  marks: Map<number, Day>;
  onSelect: (date: number) => void;
}) {
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array<null>(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7) cells.push(null);

  return (
    <View style={styles.calendar}>
      <View style={styles.week}>
        {WEEKDAYS.map((w, i) => (
          <Text key={w} style={[styles.weekday, i === 0 && { color: '#D2504B' }]}>{w}</Text>
        ))}
      </View>
      {Array.from({ length: cells.length / 7 }, (_, row) => (
        <View key={row} style={styles.week}>
          {cells.slice(row * 7, row * 7 + 7).map((date, col) => {
            if (!date) return <View key={col} style={styles.cell} />;
            const mark = marks.get(date);
            const isSel = date === selected;
            const future = date > today;
            return (
              <Pressable
                key={col}
                style={styles.cell}
                onPress={() => onSelect(date)}
                disabled={future}
                accessibilityRole="button"
                accessibilityState={{ selected: isSel, disabled: future }}
                accessibilityLabel={`${month + 1}월 ${date}일${mark ? `, 외출 ${mark.outings}번` : ''}${mark?.missed ? ', 빠뜨린 물건 있음' : ''}`}
              >
                <View style={[styles.dateCircle, date === today && styles.todayRing, isSel && styles.selectedFill]}>
                  <Text
                    style={[
                      styles.dateText,
                      col === 0 && { color: '#D2504B' },
                      future && { color: '#C2C7D0' },
                      isSel && { color: colors.onAction, fontWeight: '700' },
                    ]}
                  >
                    {date}
                  </Text>
                </View>
                <View style={styles.dots}>
                  {mark && <View style={[styles.dot, { backgroundColor: colors.blue }]} />}
                  {mark?.missed && <View style={[styles.dot, { backgroundColor: '#F08A24' }]} />}
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  summary: {
    flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingVertical: 14, paddingLeft: 12, paddingRight: 16,
  },
  summaryTitle: { fontSize: 18, lineHeight: 25, fontWeight: '700', letterSpacing: -0.4, color: colors.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  chip: { minHeight: 26, justifyContent: 'center', paddingHorizontal: 9, borderRadius: 13, backgroundColor: colors.surface },
  chipBlue: { backgroundColor: colors.tint },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.sub },
  calendar: {
    marginTop: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 20,
    paddingVertical: 10, paddingHorizontal: 6,
  },
  week: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '600', color: colors.sub, paddingVertical: 6 },
  cell: { flex: 1, alignItems: 'center', paddingVertical: 3, minHeight: 50 },
  dateCircle: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  todayRing: { borderWidth: 1.5, borderColor: colors.blue },
  selectedFill: { backgroundColor: colors.blue, borderColor: colors.blue },
  dateText: { fontSize: 15, color: colors.ink, fontVariant: ['tabular-nums'] },
  dots: { flexDirection: 'row', gap: 3, height: 6, marginTop: 3 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  hint: { ...type.small, marginTop: 10, marginBottom: 16, marginLeft: 4 },
  dayCard: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 18, overflow: 'hidden',
  },
  dayHead: { paddingVertical: 14, paddingHorizontal: 16 },
  dayTitle: { fontSize: 16, fontWeight: '700', color: colors.ink },
  dayBody: { paddingHorizontal: 14, paddingBottom: 4, borderTopWidth: 1, borderTopColor: colors.line },
  dayEmpty: { alignItems: 'center', paddingBottom: 16 },
  map: { marginTop: 12, marginBottom: 18 },
});
