import React, { useState, useCallback } from "react";
import { View, StyleSheet, Pressable, Image } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import {
  getActiveSession,
  getAppStateValue,
  getItems,
  getSchedules,
  getReturnStreak,
  getStaysSince,
  getDwellThresholdMin,
  getPlaces,
} from "../../src/db/queries";
import { useStayNames } from "../../src/hooks/useStayNames";
import { RouteMapCard } from "../../src/components/RouteMapCard";
import { BagStage } from "../../src/components/BagStage";
import { StayNameDialog } from "../../src/components/StayNameDialog";
import { isHomeStay, stayName } from "../../src/services/stayNameService";
import {
  Screen,
  TabHeader,
  SectionHeader,
  Group,
  Row,
  Icon,
  PrimaryButton,
  SecondaryButton,
  LinkButton,
  Text,
  type IconName,
} from "../../src/components/ui";
import { colors, type } from "../../src/theme";
import {
  WEEKDAYS,
  formatTime,
  startOfDay,
} from "../../src/utils/format";
import type { DepartureSchedule, Item, Place, Session, Stay } from "../../src/types";

export default function HomeScreen() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [testMode, setTestMode] = useState(false);
  const [places, setPlaces] = useState<Place[]>([]);
  const [editing, setEditing] = useState<Stay | null>(null);
  const [schedules, setSchedules] = useState<DepartureSchedule[]>([]);
  const [streak, setStreak] = useState(0);
  const [todayStays, setTodayStays] = useState<Stay[]>([]);
  const [stopIds, setStopIds] = useState<Set<string>>(new Set());
  const [stopNames, resolveStopNames] = useStayNames();

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
    const [s, all, sched, count, stays, dwellMin, testMode, placeList] = await Promise.all(
      [
        getActiveSession(),
        getItems(),
        getSchedules(),
        getReturnStreak(),
        getStaysSince(startOfDay()),
        getDwellThresholdMin(),
        getAppStateValue("testMode"),
        getPlaces(),
      ],
    );
    setPlaces(placeList);
    setSession(s);
    setItems(all);
    setLoaded(true);
    setSchedules(sched.filter((x) => x.enabled));
    setStreak(count);
    setTodayStays(stays);

    setTestMode(testMode === "true");
    const threshold = testMode === "true" ? 1 : dwellMin;
    const now = Date.now();
    const stops = stays.filter(
      (st) => ((st.leftAt ?? now) - st.arrivedAt) / 60000 >= threshold,
    );
    setStopIds(new Set(stops.map((st) => st.id)));
    // The tab stays mounted, so only stops new since the last visit are looked up.
    resolveStopNames(stops.filter((x) => !x.customName && !x.placeId));
  }

  const stops = todayStays.filter((st) => stopIds.has(st.id));
  const placeNames = Object.fromEntries(places.map((p) => [p.id, p.name]));
  const nameOf = (st: Stay) => stayName(st, placeNames, stopNames);

  const active = !!session;
  const baseItems = items.filter((i) => i.isDefault);
  const sessionItems = session
    ? items.filter((i) => session.itemIds.includes(i.id))
    : [];
  const shown = active ? sessionItems : baseItems;

  const scheduleTime = schedules[0]?.time;
  const scheduleDays = [...new Set(schedules.map((x) => x.weekday))].sort();

  return (
    <Screen
      edges={["top"]}
      header={
        <TabHeader
          title={
            // Long-press the logo to reach the test lab even when test mode (and its button) is off.
            <Pressable
              onLongPress={() => router.push("/test-lab")}
              delayLongPress={800}
              accessibilityRole="header"
              accessibilityLabel="다챙김"
              accessibilityHint="길게 누르면 테스트 랩이 열려요"
            >
              <Image
                source={require("../../assets/brand/wordmark.png")}
                style={styles.wordmark}
                resizeMode="contain"
              />
            </Pressable>
          }
          right={
            // Dev builds always show the test lab; production only when test mode is on.
            (__DEV__ || testMode) && (
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
            )
          }
        />
      }
    >
      <BagStage
        label={active ? "오늘 함께하는 물건" : "오늘 챙길 물건"}
        items={shown}
        ready={loaded}
        onAdd={() => router.push("/item-edit")}
        canAdd={!active}
        walking={active}
      >
        <View style={styles.stageActions}>
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
          <View style={{ alignItems: "center" }}>
            <LinkButton
              label="소지품 편집"
              icon="chevron-right"
              onPress={() => router.push("/items")}
            />
          </View>
        </View>
      </BagStage>

      <View style={styles.tiles}>
        {active ? (
          <SummaryTile
            icon="map-pin"
            label="외출 시작"
            value={formatTime(session!.startedAt)}
            sub="위치 기록 중"
          />
        ) : (
          <SummaryTile
            icon="bell"
            label="다음 출발"
            value={scheduleTime ?? "꺼짐"}
            sub={
              scheduleTime
                ? scheduleDays.map((d) => WEEKDAYS[d]).join("")
                : "눌러서 알림 설정"
            }
            onPress={() => router.push("/settings")}
          />
        )}
        <SummaryTile
          icon="flame"
          label="연속 챙김"
          value={`${streak}번`}
          sub={streak ? "빠짐없이 귀가" : "모두 챙겨 오면 시작돼요"}
          accent
        />
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
          <RouteMapCard
            title="오늘의 동선"
            summary={stops.length > 0 ? `${stops.length}곳 머묾` : undefined}
            coords={todayStays.map((st) => ({
              lat: st.anchorLat,
              lng: st.anchorLng,
              label: formatTime(st.arrivedAt),
              stop: stopIds.has(st.id),
              name: nameOf(st),
            }))}
          />
          {stops.length > 0 && (
            <Group style={{ marginTop: 12 }}>
              {stops.map((st) => (
                <Row
                  key={st.id}
                  icon="map-pin"
                  title={nameOf(st) ?? "근처 상가 찾는 중…"}
                  subtitle={`${formatTime(st.arrivedAt)} · ${Math.round(
                    ((st.leftAt ?? Date.now()) - st.arrivedAt) / 60000,
                  )}분 머묾${st.leftAt ? "" : " · 지금 여기"}`}
                  right={
                    isHomeStay(st, places) ? undefined : (
                      <Pressable
                        style={({ pressed }) => [
                          styles.editName,
                          pressed && { opacity: 0.6 },
                        ]}
                        onPress={() => setEditing(st)}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={`${nameOf(st) ?? "머문 곳"} 이름 고치기`}
                      >
                        <Icon name="pencil" size={15} color={colors.sub} />
                      </Pressable>
                    )
                  }
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
      <StayNameDialog
        stay={editing}
        currentName={editing ? nameOf(editing) : undefined}
        onClose={() => setEditing(null)}
        onSaved={() => loadData()}
      />
    </Screen>
  );
}

function SummaryTile({ icon, label, value, sub, accent, onPress }: {
  icon: IconName;
  label: string;
  value: string;
  sub: string;
  accent?: boolean;
  onPress?: () => void;
}) {
  const body = (
    <>
      <View style={styles.tileHead}>
        <Icon name={icon} size={16} color={colors.blue} />
        <Text style={styles.tileLabel} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Text style={[styles.tileValue, accent && { color: colors.blue }]}>
        {value}
      </Text>
      <Text style={type.small} numberOfLines={1}>
        {sub}
      </Text>
    </>
  );
  if (!onPress) return <View style={styles.tile}>{body}</View>;
  return (
    <Pressable
      style={({ pressed }) => [styles.tile, pressed && { opacity: 0.75 }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label} ${value}`}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Wordmark artwork is 868×150.
  wordmark: { height: 24, width: (24 * 1027) / 150 },
  stageActions: { alignSelf: "stretch", gap: 10, marginTop: 20, alignItems: "stretch" },
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
  editName: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.card,
  },
  testText: { fontSize: 12, fontWeight: "600", color: colors.warn },
  tiles: { flexDirection: "row", gap: 10 },
  tile: {
    flex: 1,
    gap: 4,
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingVertical: 15,
    paddingHorizontal: 15,
  },
  tileHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  tileLabel: { flexShrink: 1, fontSize: 13, fontWeight: "500", color: colors.sub },
  tileValue: {
    fontSize: 24,
    lineHeight: 31,
    fontWeight: "700",
    letterSpacing: -0.6,
    color: colors.ink,
    fontVariant: ["tabular-nums"],
    marginTop: 4,
  },
  mapEmpty: {
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
});
