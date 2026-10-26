import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Stack, useLocalSearchParams, usePreventRemove, useRouter } from 'expo-router';
import {
  getStaysForSession, getLeaveLogsForSession, getItems, getSession, getPlaces, getReturnStreak,
  getAppStateValue,
} from '../src/db/queries';
import { RouteMapCard } from '../src/components/RouteMapCard';
import { TimelineList, buildSessionEntries } from '../src/components/Timeline';
import { useStayNames } from '../src/hooks/useStayNames';
import { stayName } from '../src/services/stayNameService';
import {
  Screen, Intro, Group, Row, ItemIcon, PrimaryButton, SecondaryButton, LinkButton, Actions, Strip, SectionHeader,
  Text,
} from '../src/components/ui';
import { colors, type } from '../src/theme';
import { itemIcon } from '../src/utils/itemIcon';
import { formatTime } from '../src/utils/format';
import type { Stay, LeaveLog, Item, Session } from '../src/types';

export default function SessionResultScreen() {
  const router = useRouter();
  const { sessionId, missingItemIds } = useLocalSearchParams<{
    sessionId: string;
    missingItemIds: string;
  }>();

  const [session, setSession] = useState<Session | null>(null);
  const [stays, setStays] = useState<Stay[]>([]);
  const [logs, setLogs] = useState<LeaveLog[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [placeNames, setPlaceNames] = useState<Record<string, string>>({});
  const [stayNames, resolveStayNames] = useStayNames();
  const [streak, setStreak] = useState(0);
  const [showMetrics, setShowMetrics] = useState(false);
  const [testMode, setTestMode] = useState(false);
  const [showDay, setShowDay] = useState(false);
  const [names, setNames] = useState<Record<string, string>>({});
  const [leaving, setLeaving] = useState(false);

  // The outing is already closed; going back would reopen a finished check. Only "홈으로" leaves.
  usePreventRemove(!leaving, () => {});

  useEffect(() => {
    if (leaving) router.replace('/');
  }, [leaving]);

  // Measurement data is a testing aid: always in dev builds, in production only in test mode.
  useEffect(() => {
    getAppStateValue('testMode').then(v => setTestMode(v === 'true'));
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    Promise.all([
      getStaysForSession(sessionId),
      getLeaveLogsForSession(sessionId),
      getItems(),
      getSession(sessionId),
      getPlaces(),
      getReturnStreak(),
    ]).then(([stayList, logList, allItems, s, places, count]) => {
      setStays(stayList);
      setLogs(logList);
      setItems(allItems);
      setSession(s);
      setPlaceNames(Object.fromEntries(places.map(p => [p.id, p.name])));
      setNames(Object.fromEntries(allItems.map(i => [i.id, i.name])));
      setStreak(count);
    });
  }, [sessionId]);

  const missingIds: string[] = missingItemIds ? JSON.parse(missingItemIds) : [];
  const missingItems = items.filter(i => missingIds.includes(i.id));
  const sessionCount = session?.itemIds.length ?? 0;

  // Most recent moment the user confirmed their belongings during this outing.
  const lastCheck = [...logs].reverse().find(l => l.action && l.action !== 'ignored');
  const lastStay = lastCheck && stays.find(s => s.id === lastCheck.stayId);
  const lastCheckLabel = lastCheck
    ? `${formatTime(lastCheck.notifiedAt)} · ${lastStay ? stayName(lastStay, placeNames, stayNames) ?? '머문 장소' : '머문 장소'}`
    : session ? `${formatTime(session.startedAt)} · 집에서 출발할 때` : '';

  const goHome = () => setLeaving(true);

  // Names are looked up live and only for what's on screen (Kakao results aren't stored): the
  // last checked place up front, the rest once the day's record is opened.
  useEffect(() => {
    const checked = new Set(logs.map(l => l.stayId));
    const named = stays.filter(st => checked.has(st.id) && !st.placeId && !st.customName);
    resolveStayNames(showDay ? named : named.filter(st => st.id === lastStay?.id));
  }, [logs, stays, showDay, lastStay?.id, resolveStayNames]);

  const dayRecord = (
    <>
      <SecondaryButton
        label={showDay ? '당일 기록 접기' : '당일 기록 살펴보기'}
        icon={showDay ? 'chevron-up' : 'map-pinned'}
        onPress={() => setShowDay(v => !v)}
      />
      {showDay && session && (
        <View style={styles.day}>
          <SectionHeader first title="이번 외출 동선" />
          {stays.length > 0 ? (
            <RouteMapCard
              title="이번 외출 동선"
              summary={`${stays.length}곳 기록`}
              height={260}
              legend={false}
              coords={stays.map(s => ({ lat: s.anchorLat, lng: s.anchorLng, label: formatTime(s.arrivedAt) }))}
            />
          ) : (
            <Text style={type.small}>기록된 위치가 없어요.</Text>
          )}
          <SectionHeader title="확인 기록" />
          <TimelineList entries={buildSessionEntries(session, stays, logs, names, placeNames, stayNames)} />
        </View>
      )}
    </>
  );

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: missingItems.length ? '마지막 확인' : '귀가 완료',
          headerBackVisible: false,
          headerLeft: () => null,
          gestureEnabled: false,
        }}
      />
      {missingItems.length ? (
        <>
          <Intro mascot="question" title={`${missingItems.length}개가 보이지 않나요?`} subtitle="마지막으로 직접 확인한 기록을 살펴보세요." />
          <Strip icon="search" tone="warn" text="현재 물건의 위치를 감지한 정보는 아니에요." />
          {missingItems.map(item => (
            <Group key={item.id} style={{ marginBottom: 12 }}>
              <Row icon={itemIcon(item.name)} iconStyle="tile" title={item.name} subtitle={`${lastCheckLabel} 마지막 확인`} />
            </Group>
          ))}
          <Actions>
            {dayRecord}
            <PrimaryButton label="홈으로" onPress={goHome} />
          </Actions>
        </>
      ) : (
        <>
          <Intro mascot="heart" title="오늘도 잘 챙겼어요." subtitle="외출을 마치고 위치 기록을 멈췄어요." />
          <Group>
            <Row icon="check-check" title={`${sessionCount}개 소지품 확인 완료`} subtitle="모든 물건이 함께 돌아왔어요" />
          </Group>
          <View style={styles.saved}>
            <ItemIcon name="flame" small />
            <View style={{ flex: 1 }}>
              <Text style={styles.savedTitle}>연속 챙김</Text>
              <Text style={[type.small, { marginTop: 3 }]}>빠짐없이 귀가한 외출</Text>
            </View>
            <Text style={styles.savedValue}>{streak}번</Text>
          </View>
          <Actions>
            {dayRecord}
            <PrimaryButton label="홈으로" onPress={goHome} />
          </Actions>
        </>
      )}

      {(__DEV__ || testMode) && (
        <>
          <View style={styles.metricsToggle}>
            <LinkButton
              label={showMetrics ? '측정 데이터 숨기기' : '측정 데이터 보기 (테스트)'}
              icon={showMetrics ? 'chevron-up' : 'chevron-down'}
              onPress={() => setShowMetrics(v => !v)}
            />
          </View>
          {showMetrics && <Metrics logs={logs} stays={stays} />}
        </>
      )}
    </Screen>
  );
}

function Metrics({ logs, stays }: { logs: LeaveLog[]; stays: Stay[] }) {
  const responded = logs.filter(l => l.action && l.action !== 'ignored').length;
  const avgDwell = logs.length ? (logs.reduce((s, l) => s + l.dwellMin, 0) / logs.length).toFixed(0) : '—';
  const stats: [string, string][] = [
    ['자리 뜰 때 알림', `${logs.length}회`],
    ['응답', `${responded}회`],
    ['신호 A', `${logs.filter(l => l.notifiedBy === 'A').length}회`],
    ['신호 B', `${logs.filter(l => l.notifiedBy === 'B').length}회`],
    ['평균 체류', `${avgDwell}분`],
    ['머문 장소', `${stays.length}곳`],
  ];

  return (
    <View style={styles.statGrid}>
      {stats.map(([label, value]) => (
        <View key={label} style={styles.stat}>
          <Text style={styles.statValue}>{value}</Text>
          <Text style={type.small}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  saved: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18, paddingTop: 18,
    borderTopWidth: 1, borderTopColor: colors.line,
  },
  savedTitle: { fontSize: 14, fontWeight: '600', color: colors.ink },
  savedValue: { fontSize: 24, fontWeight: '700', letterSpacing: -0.7, color: colors.blue, fontVariant: ['tabular-nums'] },
  metricsToggle: { alignItems: 'center', marginTop: 28, marginBottom: 8 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: colors.surface, borderRadius: 16, padding: 8 },
  stat: { width: '33.33%', alignItems: 'center', paddingVertical: 12, gap: 2 },
  statValue: { fontSize: 18, fontWeight: '700', color: colors.ink, fontVariant: ['tabular-nums'] },
  day: { marginTop: 8, marginBottom: 8 },
});
