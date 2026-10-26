import React, { useState, useCallback } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import {
  getActiveSession,
  getAppStateValue,
  getItems,
  getSchedules,
  getSavedItemsCountSince,
  getStaysSince,
  getDwellThresholdMin,
} from "../../src/db/queries";
import { lookupPlaceName } from "../../src/services/placeLookup";
import { RouteMap, PIN_COLORS } from "../../src/components/RouteMap";
import {
  Screen,
  TabHeader,
  SectionHeader,
  Group,
  Row,
  Icon,
  ItemIcon,
  Em,
  Strip,
  PrimaryButton,
  SecondaryButton,
  LinkButton,
  Actions,
  Text,
  Intro,
} from "../../src/components/ui";
import { colors, type } from "../../src/theme";
import { itemIcon } from "../../src/utils/itemIcon";
import {
  WEEKDAYS,
  formatDateLabel,
  formatTime,
  startOfDay,
  startOfMonth,
} from "../../src/utils/format";
import type { DepartureSchedule, Item, Session, Stay } from "../../src/types";

export default function HomeScreen() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [schedules, setSchedules] = useState<DepartureSchedule[]>([]);
  const [savedCount, setSavedCount] = useState(0);
  const [todayStays, setTodayStays] = useState<Stay[]>([]);
  const [stopIds, setStopIds] = useState<Set<string>>(new Set());
  const [stopNames, setStopNames] = useState<Record<string, string>>({});

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, []),
  );

  async function loadData() {
    const onboarded = await getAppStateValue("onboarded");
    if (!onboarded) {
      router.replace("/onboarding");
      return;
    }
    const [s, all, sched, count, stays, dwellMin, testMode] = await Promise.all(
      [
        getActiveSession(),
        getItems(),
        getSchedules(),
        getSavedItemsCountSince(startOfMonth()),
        getStaysSince(startOfDay()),
        getDwellThresholdMin(),
        getAppStateValue("testMode"),
      ],
    );
    setSession(s);
    setItems(all);
    setSchedules(sched.filter((x) => x.enabled));
    setSavedCount(count);
    setTodayStays(stays);

    const threshold = testMode === "true" ? 1 : dwellMin;
    const now = Date.now();
    const stops = stays.filter(
      (st) => ((st.leftAt ?? now) - st.arrivedAt) / 60000 >= threshold,
    );
    setStopIds(new Set(stops.map((st) => st.id)));
    for (const st of stops) {
      lookupPlaceName(st.anchorLat, st.anchorLng).then((name) => {
        if (name) setStopNames((prev) => ({ ...prev, [st.id]: name }));
      });
    }
  }

  const stops = todayStays.filter((st) => stopIds.has(st.id));

  const active = !!session;
  const baseItems = items.filter((i) => i.isDefault);
  const sessionItems = session
    ? items.filter((i) => session.itemIds.includes(i.id))
    : [];
  const shown = active ? sessionItems : baseItems;

  const today = new Date().getDay();
  const nowHM = formatTime(Date.now());
  const todaysDeparture = schedules.find(
    (x) => x.weekday === today && x.time >= nowHM,
  );
  const meta = active
    ? `${formatDateLabel(Date.now())} · ${formatTime(session!.startedAt)} 출발`
    : todaysDeparture
      ? `${formatDateLabel(Date.now())} · ${todaysDeparture.time} 출발 예정`
      : formatDateLabel(Date.now());

  const scheduleTime = schedules[0]?.time;
  const scheduleDays = [...new Set(schedules.map((x) => x.weekday))].sort();

  return (
    <Screen
      edges={["top"]}
      header={
        <TabHeader
          title={
            <View style={styles.brand}>
              <View style={styles.brandmark}>
                <Icon name="check" size={18} color={colors.onAction} />
              </View>
              <Text style={styles.wordmark} accessibilityRole="header">
                챙김
              </Text>
            </View>
          }
          right={
            <>
              <Pressable
                style={({ pressed }) => [
                  styles.testBtn,
                  pressed && { opacity: 0.7 },
                ]}
                onPress={() => router.push("/test-lab")}
                accessibilityRole="button"
                accessibilityLabel="테스트 랩 열기"
                hitSlop={6}
              >
                <Icon name="flask-conical" size={14} color={colors.warn} />
                <Text style={styles.testText}>테스트</Text>
              </Pressable>
              <View style={styles.tag}>
                <View style={styles.tagDot} />
                <Text style={styles.tagText}>
                  {active ? "외출 중" : "외출 전"}
                </Text>
              </View>
            </>
          }
        />
      }
    >
      <Intro
        eyebrow={meta}
        title={
          active ? (
            <>
              오늘도 <Em>빠짐없이,</Em>
              {"\n"}가볍게 다녀와요.
            </>
          ) : (
            <>
              소중한 하루,{"\n"}
              <Em>빠짐없이</Em> 챙겨요.
            </>
          )
        }
        subtitle={
          active
            ? "챙긴 순간을 기록하고 있어요."
            : "나가기 전, 내 소지품을 한 번만 확인해요."
        }
      />

      {active && (
        <Strip icon="map-pin" text="외출 중 위치 기록 · 물건은 직접 확인해요" />
      )}

      <View style={styles.ready} accessibilityLabel="오늘의 소지품과 출발">
        <View style={styles.readyHeader}>
          <Text style={styles.readyTitle}>
            {active ? "오늘 함께하는 물건" : "오늘 챙길 물건"}
            <Text style={{ color: colors.blue }}> {shown.length}</Text>
          </Text>
          <LinkButton
            label="편집"
            icon="chevron-right"
            onPress={() => router.push("/items")}
          />
        </View>
        {shown.length ? (
          <View style={styles.inventory}>
            {shown.map((item) => (
              <View key={item.id} style={styles.invItem}>
                <View style={styles.invIcon}>
                  <Icon
                    name={itemIcon(item.name)}
                    size={23}
                    color={colors.blue}
                  />
                </View>
                <Text style={styles.invName} numberOfLines={2}>
                  {item.name}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <Pressable
            style={({ pressed }) => [
              styles.addItem,
              pressed && { opacity: 0.75 },
            ]}
            onPress={() => router.push("/item-edit")}
            accessibilityRole="button"
          >
            <Icon name="plus" size={20} color={colors.blue} />
            <Text style={styles.addItemText}>소지품 추가하기</Text>
          </Pressable>
        )}
        <Actions>
          {active ? (
            <>
              <PrimaryButton
                label="소지품 확인"
                onPress={() => router.push("/leave-check")}
              />
              <SecondaryButton
                label="집에 도착했어요"
                onTint
                onPress={() => router.push("/return-check")}
              />
            </>
          ) : (
            <PrimaryButton
              label="지금 출발"
              icon="arrow-right"
              onPress={() => router.push("/departure")}
            />
          )}
        </Actions>
      </View>

      {!active && (
        <>
          <SectionHeader title="다음 출발 알림" />
          <Pressable
            style={({ pressed }) => [
              styles.reminder,
              pressed && { opacity: 0.75 },
            ]}
            onPress={() => router.push("/settings")}
            accessibilityRole="button"
            accessibilityLabel="출발 알림 설정"
          >
            <View style={styles.reminderIcon}>
              <Icon name="bell" size={20} color={colors.sub} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.reminderTitle}>
                {scheduleTime
                  ? "잊지 않게 알려드릴게요"
                  : "출발 알림이 꺼져 있어요"}
              </Text>
              <Text style={type.small}>
                {scheduleTime
                  ? scheduleDays.map((d) => WEEKDAYS[d]).join(" · ")
                  : "눌러서 알림 설정하기"}
              </Text>
            </View>
            {!!scheduleTime && (
              <Text style={styles.reminderTime}>{scheduleTime}</Text>
            )}
            <Icon name="chevron-right" size={16} color={colors.sub} />
          </Pressable>
        </>
      )}

      <View style={styles.saved}>
        <ItemIcon name="shield-check" small />
        <View style={{ flex: 1 }}>
          <Text style={styles.savedTitle}>이번 달 지켜낸 물건</Text>
          <Text style={[type.small, { marginTop: 3 }]}>
            자리 뜰 때 확인하고 함께 돌아온 물건
          </Text>
        </View>
        <Text style={styles.savedValue}>
          {savedCount}
          <Text style={styles.savedUnit}>개</Text>
        </Text>
      </View>

      <SectionHeader
        title="오늘의 동선"
        right={
          stops.length > 0 ? (
            <Text style={type.small}>{stops.length}곳 머묾</Text>
          ) : undefined
        }
      />
      {todayStays.length > 0 ? (
        <>
          <View style={styles.map}>
            <RouteMap
              height={240}
              coords={todayStays.map((st) => ({
                lat: st.anchorLat,
                lng: st.anchorLng,
                label: formatTime(st.arrivedAt),
                stop: stopIds.has(st.id),
                name: stopNames[st.id],
              }))}
            />
            <View style={styles.legend}>
              {(
                [
                  ["출발", PIN_COLORS.start],
                  ["머문 곳", PIN_COLORS.stop],
                  ["지나간 곳", PIN_COLORS.path],
                  ["마지막 위치", PIN_COLORS.end],
                ] as const
              ).map(([label, color]) => (
                <View key={label} style={styles.legendItem}>
                  <View
                    style={[styles.legendDot, { backgroundColor: color }]}
                  />
                  <Text style={type.small}>{label}</Text>
                </View>
              ))}
            </View>
          </View>
          {stops.length > 0 && (
            <Group style={{ marginTop: 12 }}>
              {stops.map((st) => (
                <Row
                  key={st.id}
                  icon="map-pin"
                  title={stopNames[st.id] ?? "근처 상가 찾는 중…"}
                  subtitle={`${formatTime(st.arrivedAt)} · ${Math.round(
                    ((st.leftAt ?? Date.now()) - st.arrivedAt) / 60000,
                  )}분 머묾${st.leftAt ? "" : " · 지금 여기"}`}
                />
              ))}
            </Group>
          )}
        </>
      ) : (
        <View style={styles.mapEmpty}>
          <Icon name="map-pinned" size={24} color={colors.sub} />
          <Text style={[type.small, { textAlign: "center" }]}>
            오늘은 아직 이동 기록이 없어요.{"\n"}외출을 시작하면 머문 곳이
            이어져요.
          </Text>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  brand: { flexDirection: "row", alignItems: "center", gap: 8 },
  brandmark: {
    width: 27,
    height: 27,
    borderRadius: 9,
    backgroundColor: colors.blue,
    alignItems: "center",
    justifyContent: "center",
  },
  wordmark: {
    fontSize: 23,
    fontWeight: "800",
    letterSpacing: -0.9,
    color: colors.ink,
  },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.tint,
    borderRadius: 30,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  tagDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.blue,
  },
  tagText: { fontSize: 12, fontWeight: "600", color: colors.blue },
  ready: { backgroundColor: colors.tint, borderRadius: 20, padding: 16 },
  readyHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 32,
    marginBottom: 8,
  },
  readyTitle: { fontSize: 15, fontWeight: "600", color: colors.ink },
  inventory: { flexDirection: "row", flexWrap: "wrap", rowGap: 7 },
  invItem: { width: "25%", alignItems: "center", gap: 7, paddingVertical: 6 },
  invIcon: {
    width: 47,
    height: 47,
    borderRadius: 16,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  invName: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "500",
    color: colors.ink,
    textAlign: "center",
  },
  addItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 60,
    borderRadius: 14,
    backgroundColor: colors.card,
  },
  addItemText: { fontSize: 15, fontWeight: "600", color: colors.blue },
  reminder: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 15,
    paddingVertical: 17,
    paddingHorizontal: 15,
  },
  reminderIcon: {
    width: 37,
    height: 37,
    borderRadius: 12,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  reminderTitle: { fontSize: 13, fontWeight: "500", color: colors.ink },
  reminderTime: {
    fontSize: 21,
    fontWeight: "700",
    letterSpacing: -0.4,
    color: colors.ink,
    fontVariant: ["tabular-nums"],
  },
  testBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minHeight: 30,
    paddingHorizontal: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#EBD3A8",
    backgroundColor: colors.wash,
  },
  testText: { fontSize: 12, fontWeight: "600", color: colors.warn },
  saved: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 18,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  savedTitle: { fontSize: 14, fontWeight: "600", color: colors.ink },
  savedValue: {
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: -0.7,
    color: colors.blue,
    fontVariant: ["tabular-nums"],
  },
  savedUnit: { fontSize: 14, fontWeight: "500" },
  map: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 8,
    overflow: "hidden",
  },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    paddingHorizontal: 6,
    paddingTop: 10,
    paddingBottom: 4,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  mapEmpty: {
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
});
