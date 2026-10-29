import React, { useState, useCallback } from 'react';
import { View, StyleSheet, Pressable, Alert, Linking } from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import {
  getSchedules, upsertSchedule, deleteSchedule, getHomePlace, upsertPlace,
  getDwellThresholdMin, setAppStateValue, DWELL_OPTIONS,
} from '../../src/db/queries';
import {
  scheduleWeeklyDepartureNotification, cancelDepartureNotification,
} from '../../src/services/notificationService';
import { checkPermissions } from '../../src/services/locationService';
import { Screen, TabHeader, SectionHeader, Group, Row, Icon, Note, Pills, Text, TextInput } from '../../src/components/ui';
import { colors } from '../../src/theme';
import { WEEKDAYS } from '../../src/utils/format';
import { distanceM } from '../../src/utils/geo';
import type { DepartureSchedule, Place } from '../../src/types';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function formatTimeInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits;
}

export default function SettingsScreen() {
  const [schedules, setSchedules] = useState<DepartureSchedule[]>([]);
  const [time, setTime] = useState('08:30');
  const [days, setDays] = useState<number[]>([]);
  const [dwell, setDwell] = useState(15);
  const [home, setHome] = useState<Place | null>(null);
  const [atHome, setAtHome] = useState(false);
  const [perm, setPerm] = useState({ location: false, notifications: false });

  useFocusEffect(useCallback(() => { load(); }, []));

  async function load() {
    const [sched, d, h, loc, notif] = await Promise.all([
      getSchedules(), getDwellThresholdMin(), getHomePlace(), checkPermissions(), Notifications.getPermissionsAsync(),
    ]);
    const enabled = sched.filter(s => s.enabled);
    setSchedules(sched);
    setTime(enabled[0]?.time ?? sched[0]?.time ?? '08:30');
    setDays(enabled.map(s => s.weekday));
    setDwell(d);
    setHome(h);
    setAtHome(false);
    if (h && loc.foreground) {
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
        .then(pos => setAtHome(isAtHome(h, pos)))
        .catch(() => {});
    }
    setPerm({ location: loc.background, notifications: notif.granted });
  }

  // The UI edits one departure time for a set of weekdays; storage keeps one row per weekday.
  async function saveSchedule(nextTime: string, nextDays: number[]) {
    for (const s of await getSchedules()) {
      await cancelDepartureNotification(s.id);
      await deleteSchedule(s.id);
    }
    const created: DepartureSchedule[] = [];
    for (const weekday of [...nextDays].sort()) {
      const s = await upsertSchedule({ weekday: weekday as DepartureSchedule['weekday'], time: nextTime, enabled: true });
      await scheduleWeeklyDepartureNotification(s.id, s.weekday, s.time);
      created.push(s);
    }
    setSchedules(created);
  }

  function toggleDay(d: number) {
    const next = days.includes(d) ? days.filter(x => x !== d) : [...days, d];
    setDays(next);
    saveSchedule(time, next);
  }

  function commitTime() {
    if (!TIME_RE.test(time)) {
      Alert.alert('시각 확인', '08:30처럼 24시간 형식으로 입력해 주세요.');
      setTime(schedules[0]?.time ?? '08:30');
      return;
    }
    if (schedules[0]?.time !== time) saveSchedule(time, days);
  }

  async function changeDwell(v: string) {
    const n = Number(v);
    setDwell(n);
    await setAppStateValue('dwellMin', String(n));
  }

  function isAtHome(h: Place, pos: Location.LocationObject) {
    return distanceM(h.lat, h.lng, pos.coords.latitude, pos.coords.longitude) < h.radiusM;
  }

  async function registerHome() {
    try {
      const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        // iOS asks only once; after a denial the button would otherwise do nothing. Settings opens
        // only if the user chooses it (App Review 5.1.1(iv)).
        if (canAskAgain) return;
        Alert.alert('위치가 꺼져 있어요', '집을 등록하려면 기기 설정에서 챙김의 위치 접근을 허용해 주세요.', [
          { text: '취소', style: 'cancel' },
          { text: '설정 열기', onPress: () => Linking.openSettings() },
        ]);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (home && isAtHome(home, loc)) {
        setAtHome(true);
        Alert.alert('이미 우리 집이에요', '지금 위치가 등록된 집 범위 안이라 바꿀 필요가 없어요.');
        return;
      }
      if (home) {
        const ok = await new Promise<boolean>(resolve =>
          Alert.alert('집 위치를 바꿀까요?', '지금 있는 곳을 새 집 위치로 등록해요. 귀가 확인과 자리 뜰 때 알림 제외 기준이 함께 바뀌어요.', [
            { text: '취소', style: 'cancel', onPress: () => resolve(false) },
            { text: '바꾸기', onPress: () => resolve(true) },
          ]),
        );
        if (!ok) return;
      }
      const saved = await upsertPlace({
        id: home?.id,
        name: '집',
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
        radiusM: home?.radiusM ?? 150,
        kind: 'home',
        extraItemIds: home?.extraItemIds ?? [],
      });
      setHome(saved);
      setAtHome(true);
    } catch {
      Alert.alert('오류', '현재 위치를 가져올 수 없어요.');
    }
  }

  const status = (on: boolean) => (
    <Text style={[styles.status, { color: on ? colors.blue : colors.warn }]}>{on ? '허용됨' : '꺼짐'}</Text>
  );

  return (
    <Screen edges={['top']} header={<TabHeader title="설정" />}>
      <SectionHeader first title="출발 알림" />
      <View style={styles.card}>
        <Text style={styles.label}>출발할 시각</Text>
        <View style={styles.timeBox}>
          <TextInput
            style={styles.timeInput}
            value={time}
            onChangeText={v => setTime(formatTimeInput(v))}
            onEndEditing={commitTime}
            // Digits with a "완료" key: the plain number pad has no way to close it.
            keyboardType="numbers-and-punctuation"
            returnKeyType="done"
            maxLength={5}
            placeholder="08:30"
            accessibilityLabel="출발할 시각"
          />
          <Icon name="clock" size={20} color={colors.sub} />
        </View>
        <View style={styles.days} accessibilityLabel="알림 요일">
          {WEEKDAYS.map((d, i) => {
            const on = days.includes(i);
            return (
              <Pressable
                key={d}
                style={[styles.day, on && styles.dayOn]}
                onPress={() => toggleDay(i)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
              >
                <Text style={[styles.dayText, on && { color: colors.onAction }]}>{d}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <SectionHeader title="자리 뜰 때 알림" />
      <Group>
        <View style={styles.dwell}>
          <Text style={styles.rowName}>머문 시간 기준</Text>
          <Text style={styles.rowSub}>이 시간 이상 머문 뒤 떠날 때 알려드려요</Text>
          <View style={{ marginTop: 12 }}>
            <Pills
              options={DWELL_OPTIONS.map(v => ({ value: String(v), label: `${v}분` }))}
              value={String(dwell)}
              onChange={changeDwell}
            />
          </View>
        </View>
        <Row
          icon="house"
          title="우리 집"
          subtitle={
            !home ? '등록하면 귀가 확인을 도와드려요'
              : atHome ? '등록됨 · 지금 집에 있어요'
              : '등록됨 · 집에서는 자리 뜰 때 알리지 않아요'
          }
          right={
            atHome
              ? <Text style={[styles.action, { color: colors.sub }]}>현재 위치와 같음</Text>
              : <Text style={styles.action}>{home ? '현재 위치로 변경' : '현재 위치로 등록'}</Text>
          }
          onPress={atHome ? undefined : registerHome}
        />
      </Group>

      <SectionHeader title="권한 상태" />
      <Group>
        <Row title="항상 위치 허용" subtitle="외출 중에만 위치를 기록해요" right={status(perm.location)} onPress={() => Linking.openSettings()} />
        <Row title="알림 허용" subtitle="출발과 자리 이동 때 알려드려요" right={status(perm.notifications)} onPress={() => Linking.openSettings()} />
      </Group>
      <Note>권한은 기기 설정에서 바꿀 수 있어요. 항목을 누르면 설정으로 이동해요.</Note>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 16, padding: 16 },
  label: { fontSize: 13, fontWeight: '500', color: colors.ink, marginBottom: 8 },
  timeBox: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 12,
    backgroundColor: colors.card, borderRadius: 12, paddingHorizontal: 14, minHeight: 52,
  },
  timeInput: { fontSize: 24, fontWeight: '500', color: colors.ink, minWidth: 80, fontVariant: ['tabular-nums'] },
  days: { flexDirection: 'row', justifyContent: 'space-between', gap: 5, marginTop: 12 },
  day: { width: 37, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card },
  dayOn: { backgroundColor: colors.blue },
  dayText: { fontSize: 13, color: colors.ink },
  dwell: { paddingVertical: 14, paddingHorizontal: 15 },
  rowName: { fontSize: 15, fontWeight: '600', color: colors.ink },
  rowSub: { fontSize: 12, color: colors.sub, marginTop: 3 },
  status: { fontSize: 14, fontWeight: '600' },
  action: { fontSize: 13, fontWeight: '600', color: colors.blue },
});
