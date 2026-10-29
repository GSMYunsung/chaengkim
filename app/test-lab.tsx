import React, { useState, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, Switch, Alert, ActivityIndicator, Keyboard } from 'react-native';
import { Text, TextInput } from '../src/components/ui';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { getAppStateValue, setAppStateValue, getActiveSession, createStay, createLeaveLog, getAllLeaveLogs, getActiveStay, getItems } from '../src/db/queries';
import { sendLeaveNotification } from '../src/services/notificationService';
import { startOutingSession, endOutingSession } from '../src/services/sessionService';
import { registerAnchorGeofence } from '../src/services/locationService';
import { exportLeaveLogsToCSV } from '../src/utils/csv';
import { colors } from '../src/theme';
import type { Item, LeaveLog } from '../src/types';

const COLORS = {
  primary: colors.blue, bg: colors.bg, card: colors.surface,
  textPrimary: colors.ink, textSecondary: colors.sub,
  success: '#22C55E', warning: '#F59E0B', danger: '#EF4444',
  testBg: '#FFF7ED', testBorder: '#F59E0B',
  mockBg: '#F0FDF4', mockBorder: '#22C55E',
};

const PRESET_LOCATIONS = [
  { label: '강남역', lat: 37.497952, lng: 127.027619 },
  { label: '홍대입구', lat: 37.557527, lng: 126.925595 },
  { label: '명동', lat: 37.563576, lng: 126.982837 },
];

export default function TestLabScreen() {
  const router = useRouter();
  const [testMode, setTestMode] = useState(false);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [activeStayId, setActiveStayId] = useState<string | null>(null);
  const [logs, setLogs] = useState<LeaveLog[]>([]);
  const [locationInterval, setLocationInterval] = useState<ReturnType<typeof setInterval> | null>(null);
  const [mockLatInput, setMockLatInput] = useState('');
  const [mockLngInput, setMockLngInput] = useState('');
  const [mockCoord, setMockCoord] = useState<{ lat: number; lng: number; label?: string } | null>(null);
  const [items, setItems] = useState<Item[]>([]);

  useFocusEffect(useCallback(() => {
    loadState();
    startLocationRefresh();
    return () => stopLocationRefresh();
  }, []));

  async function loadState() {
    const tm = await getAppStateValue('testMode');
    setTestMode(tm === 'true');
    const session = await getActiveSession();
    setSessionId(session?.id ?? null);
    if (session) {
      const stay = await getActiveStay(session.id);
      setActiveStayId(stay?.id ?? null);
    }
    setLogs(await getAllLeaveLogs());
    const allItems = await getItems();
    setItems(allItems);
    const mockLat = await getAppStateValue('mockLat');
    const mockLng = await getAppStateValue('mockLng');
    const mockLabel = await getAppStateValue('mockLabel');
    if (mockLat && mockLng) {
      setMockCoord({ lat: parseFloat(mockLat), lng: parseFloat(mockLng), label: mockLabel ?? undefined });
      setMockLatInput(mockLat);
      setMockLngInput(mockLng);
    }
  }

  function startLocationRefresh() {
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      .then(setLocation).catch(() => {});
    const id = setInterval(async () => {
      try {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setLocation(loc);
      } catch {}
    }, 5000);
    setLocationInterval(id);
  }

  function stopLocationRefresh() {
    if (locationInterval) clearInterval(locationInterval);
  }

  async function toggleTestMode(val: boolean) {
    await setAppStateValue('testMode', val ? 'true' : 'false');
    setTestMode(val);
  }

  async function applyMockLocation(lat: number, lng: number, label?: string) {
    await setAppStateValue('mockLat', String(lat));
    await setAppStateValue('mockLng', String(lng));
    await setAppStateValue('mockLabel', label ?? '');
    setMockCoord({ lat, lng, label });
    setMockLatInput(String(lat));
    setMockLngInput(String(lng));
    Keyboard.dismiss();
  }

  async function clearMockLocation() {
    await setAppStateValue('mockLat', '');
    await setAppStateValue('mockLng', '');
    await setAppStateValue('mockLabel', '');
    setMockCoord(null);
    setMockLatInput('');
    setMockLngInput('');
  }

  function handleApplyInput() {
    const lat = parseFloat(mockLatInput);
    const lng = parseFloat(mockLngInput);
    if (isNaN(lat) || isNaN(lng)) {
      Alert.alert('잘못된 좌표', '올바른 위도/경도를 입력하세요');
      return;
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      Alert.alert('범위 초과', '위도 -90~90, 경도 -180~180');
      return;
    }
    applyMockLocation(lat, lng, '직접 입력');
  }

  function effectiveCoord() {
    if (mockCoord) return { latitude: mockCoord.lat, longitude: mockCoord.lng };
    if (location) return location.coords;
    return null;
  }

  async function handleStartTestSession() {
    if (sessionId) { Alert.alert('이미 세션 진행 중'); return; }
    const allItems = await getItems();
    const defaultIds = allItems.filter(i => i.isDefault).map(i => i.id);
    const session = await startOutingSession('manual', defaultIds.length ? defaultIds : allItems.map(i => i.id));
    setSessionId(session.id);
    Alert.alert('테스트 세션 시작', `${allItems.filter(i => defaultIds.includes(i.id)).length}개 소지품 · ${session.id.slice(0, 8)}…`);
    await loadState();
  }

  async function handleSetAnchor() {
    if (!sessionId) { Alert.alert('먼저 세션을 시작하세요'); return; }
    const coord = effectiveCoord();
    if (!coord) { Alert.alert('위치 정보 없음'); return; }
    const { latitude, longitude } = coord;
    const stay = await createStay(sessionId, latitude, longitude);
    setActiveStayId(stay.id);
    await setAppStateValue('anchorTime', String(Date.now()));
    await registerAnchorGeofence(stay.id, latitude, longitude, testMode ? 30 : 150).catch(() => {});
    const src = mockCoord ? `가상 위치 (${mockCoord.label ?? ''})` : '실제 GPS';
    Alert.alert('앵커 설정', `${src}\n${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
    await loadState();
  }

  async function handleSimulateDeparture() {
    if (!activeStayId) { Alert.alert('앵커를 먼저 설정하세요'); return; }
    const anchorTimeStr = await getAppStateValue('anchorTime');
    if (!anchorTimeStr) { Alert.alert('앵커 정보 없음'); return; }

    const now = Date.now();
    const dwellMin = (now - parseInt(anchorTimeStr)) / 60000;

    await createLeaveLog({
      stayId: activeStayId,
      dwellMin,
      signalAAt: now,
      notifiedBy: 'A',
      notifiedAt: now,
      distanceFromAnchorM: 25,
      recoveredItemIds: [],
    });

    const stayIdForCheck = activeStayId;
    const itemCount = items.length;
    await sendLeaveNotification(stayIdForCheck, itemCount, null, true);
    setActiveStayId(null);
    await loadState();
    router.push({ pathname: '/leave-check', params: { stayId: stayIdForCheck } });
  }

  async function handleSimulateHome() {
    if (!sessionId) { Alert.alert('세션 없음'); return; }
    const sid = sessionId;
    await endOutingSession(sid);
    setSessionId(null);
    setActiveStayId(null);
    router.push({
      pathname: '/session-result',
      params: { sessionId: sid, missingItemIds: '[]' },
    });
  }

  async function handleClearLogs() {
    Alert.alert('로그 초기화', '모든 측정 로그를 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제', style: 'destructive', onPress: async () => {
          const { getDatabase } = await import('../src/db/database');
          const db = await getDatabase();
          await db.execAsync('DELETE FROM leave_logs; DELETE FROM stays; DELETE FROM sessions;');
          setSessionId(null);
          setActiveStayId(null);
          setLogs([]);
          Alert.alert('완료', '로그가 초기화되었습니다.');
        }
      },
    ]);
  }

  async function handleSeedSample() {
    const { seedSampleHistory } = await import('../src/db/sampleData');
    const r = await seedSampleHistory();
    await loadState();
    Alert.alert(
      '샘플 기록 추가',
      `샘플 외출 ${r.added}건을 넣고 지난달 기록은 정리했어요.\n이번 달 ${r.days}일, 외출 ${r.kept}건이 남았어요. 연속 챙김은 ${r.streak}번이에요.`,
    );
  }

  async function handleClearPlaceCache() {
    const { clearPlaceNameCache } = await import('../src/db/queries');
    const n = await clearPlaceNameCache();
    Alert.alert('장소 이름 캐시 비움', `저장된 '가게 없음' 장소 ${n}개를 지웠어요. 상호명은 원래 저장하지 않고 화면마다 새로 찾아요.`);
  }

  async function handleExportCSV() {
    if (logs.length === 0) {
      Alert.alert('내보낼 데이터 없음', '아직 측정 로그가 없어요.');
      return;
    }
    await exportLeaveLogsToCSV(logs);
  }

  const coord = effectiveCoord();

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={[styles.banner, testMode && styles.bannerActive]}>
          <View style={styles.bannerLeft}>
            <Text style={styles.bannerIcon}>🧪</Text>
            <View>
              <Text style={styles.bannerTitle}>테스트 모드</Text>
              <Text style={styles.bannerSub}>
                {testMode ? '임계값 축소: 체류 1분, 반경 20m' : '실제 임계값: 체류는 설정값(기본 15분), 반경 100m'}
              </Text>
            </View>
          </View>
          <Switch
            value={testMode}
            onValueChange={toggleTestMode}
            trackColor={{ true: COLORS.warning }}
          />
        </View>

        {/* GPS / 가상 위치 */}
        <View style={styles.card}>
          <View style={styles.gpsHeader}>
            <Text style={styles.cardTitle}>📍 현재 위치</Text>
            {mockCoord && (
              <View style={styles.mockBadge}>
                <Text style={styles.mockBadgeText}>가상</Text>
              </View>
            )}
          </View>
          {coord ? (
            <>
              <Text style={styles.gpsText}>
                {coord.latitude.toFixed(6)}, {coord.longitude.toFixed(6)}
              </Text>
              {mockCoord ? (
                <Text style={styles.gpsSub}>가상 위치 · {mockCoord.label}</Text>
              ) : location ? (
                <Text style={styles.gpsSub}>
                  정확도 ±{location.coords.accuracy?.toFixed(0) ?? '?'}m · {new Date(location.timestamp).toLocaleTimeString('ko-KR')}
                </Text>
              ) : null}
            </>
          ) : (
            <ActivityIndicator color={COLORS.primary} style={{ marginTop: 8 }} />
          )}
        </View>

        {/* 가상 위치 설정 */}
        <View style={[styles.card, mockCoord ? styles.cardMock : {}]}>
          <Text style={styles.cardTitle}>🗺️ 가상 위치 설정</Text>

          {/* 프리셋 */}
          <View style={styles.presetRow}>
            {PRESET_LOCATIONS.map(p => (
              <TouchableOpacity
                key={p.label}
                style={[styles.presetBtn, mockCoord?.label === p.label && styles.presetBtnActive]}
                onPress={() => applyMockLocation(p.lat, p.lng, p.label)}
              >
                <Text style={[styles.presetText, mockCoord?.label === p.label && styles.presetTextActive]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* 직접 입력 */}
          <View style={styles.inputRow}>
            <TextInput
              style={styles.coordInput}
              placeholder="위도 (예: 37.5665)"
              placeholderTextColor="#9CA3AF"
              keyboardType="decimal-pad"
              value={mockLatInput}
              onChangeText={setMockLatInput}
            />
            <TextInput
              style={styles.coordInput}
              placeholder="경도 (예: 126.9780)"
              placeholderTextColor="#9CA3AF"
              keyboardType="decimal-pad"
              value={mockLngInput}
              onChangeText={setMockLngInput}
            />
          </View>
          <View style={styles.mockBtnRow}>
            <TouchableOpacity style={styles.applyBtn} onPress={handleApplyInput}>
              <Text style={styles.applyBtnText}>적용</Text>
            </TouchableOpacity>
            {mockCoord && (
              <TouchableOpacity style={styles.clearBtn} onPress={clearMockLocation}>
                <Text style={styles.clearBtnText}>가상 위치 해제</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>세션 상태</Text>
          <View style={styles.statusRow}>
            <StatusBadge label="세션" active={!!sessionId} value={sessionId ? sessionId.slice(0, 8) + '…' : '없음'} />
            <StatusBadge label="앵커" active={!!activeStayId} value={activeStayId ? activeStayId.slice(0, 8) + '…' : '없음'} />
          </View>
        </View>

        <Text style={styles.sectionTitle}>시뮬레이션</Text>
        <View style={styles.btnGrid}>
          <ActionBtn emoji="▶️" label="세션 시작" onPress={handleStartTestSession} disabled={!!sessionId} />
          <ActionBtn emoji="📍" label="앵커 설정" onPress={handleSetAnchor} disabled={!sessionId || !coord} />
          <ActionBtn emoji="🚶" label="이탈 시뮬레이션" onPress={handleSimulateDeparture} disabled={!activeStayId} color={COLORS.warning} />
          <ActionBtn emoji="🏠" label="귀가 시뮬레이션" onPress={handleSimulateHome} disabled={!sessionId} color={COLORS.success} />
          <ActionBtn emoji="🗂" label="샘플 기록 넣기" onPress={handleSeedSample} disabled={!!sessionId} />
          <ActionBtn emoji="🧹" label="장소 이름 캐시 비우기" onPress={handleClearPlaceCache} />
        </View>

        <View style={styles.logsHeader}>
          <Text style={styles.sectionTitle}>측정 로그 ({logs.length}건)</Text>
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <TouchableOpacity onPress={handleExportCSV}>
              <Text style={styles.exportText}>CSV 내보내기</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleClearLogs}>
              <Text style={styles.clearText}>초기화</Text>
            </TouchableOpacity>
          </View>
        </View>
        {logs.slice(-5).reverse().map(log => (
          <View key={log.id} style={styles.logRow}>
            <Text style={styles.logSignal}>신호 {log.notifiedBy}</Text>
            <Text style={styles.logDetail}>
              체류 {log.dwellMin.toFixed(1)}분 · {log.distanceFromAnchorM.toFixed(0)}m
            </Text>
            <Text style={styles.logAction}>{log.action ?? '미응답'}</Text>
            <Text style={styles.logTime}>
              {new Date(log.notifiedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        ))}
        {logs.length === 0 && <Text style={styles.emptyLogs}>아직 로그 없음</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatusBadge({ label, active, value }: { label: string; active: boolean; value: string }) {
  return (
    <View style={[badgeStyles.wrap, active && badgeStyles.wrapActive]}>
      <Text style={badgeStyles.label}>{label}</Text>
      <Text style={[badgeStyles.value, active && badgeStyles.valueActive]}>{value}</Text>
    </View>
  );
}

function ActionBtn({ emoji, label, onPress, disabled, color }: { emoji: string; label: string; onPress: () => void; disabled?: boolean; color?: string }) {
  return (
    <TouchableOpacity
      style={[actionStyles.btn, disabled && actionStyles.disabled, color ? { borderColor: color } : {}]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={actionStyles.emoji}>{emoji}</Text>
      <Text style={[actionStyles.label, color ? { color } : {}]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 16, paddingBottom: 40 },
  banner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 2, borderColor: '#E5E7EB' },
  bannerActive: { backgroundColor: COLORS.testBg, borderColor: COLORS.testBorder },
  bannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  bannerIcon: { fontSize: 28 },
  bannerTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  bannerSub: { fontSize: 11, color: COLORS.textSecondary, marginTop: 1 },
  card: { backgroundColor: COLORS.card, borderRadius: 14, padding: 16, marginBottom: 12 },
  cardMock: { borderWidth: 2, borderColor: COLORS.mockBorder, backgroundColor: COLORS.mockBg },
  cardTitle: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  gpsHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  mockBadge: { backgroundColor: COLORS.success, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  mockBadgeText: { fontSize: 10, fontWeight: '700', color: '#fff' },
  gpsText: { fontSize: 16, fontWeight: '600', color: COLORS.textPrimary },
  gpsSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4 },
  presetRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  presetBtn: { flex: 1, borderRadius: 8, paddingVertical: 8, backgroundColor: '#F3F4F6', alignItems: 'center', borderWidth: 1.5, borderColor: 'transparent' },
  presetBtnActive: { borderColor: COLORS.success, backgroundColor: '#DCFCE7' },
  presetText: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },
  presetTextActive: { color: '#16A34A' },
  inputRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  coordInput: { flex: 1, backgroundColor: '#F3F4F6', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10, fontSize: 13, color: COLORS.textPrimary, borderWidth: 1, borderColor: '#E5E7EB' },
  mockBtnRow: { flexDirection: 'row', gap: 8 },
  applyBtn: { flex: 1, backgroundColor: COLORS.primary, borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  applyBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  clearBtn: { flex: 1, backgroundColor: '#FEE2E2', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  clearBtnText: { color: COLORS.danger, fontWeight: '700', fontSize: 13 },
  statusRow: { flexDirection: 'row', gap: 10 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 10 },
  btnGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  logsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  clearText: { fontSize: 13, color: COLORS.danger, fontWeight: '600' },
  exportText: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },
  logRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: 10, padding: 12, marginBottom: 8, gap: 8 },
  logSignal: { fontSize: 12, fontWeight: '700', color: COLORS.primary, width: 40 },
  logDetail: { flex: 1, fontSize: 12, color: COLORS.textSecondary },
  logAction: { fontSize: 12, color: COLORS.textSecondary },
  logTime: { fontSize: 11, color: '#9CA3AF', width: 44, textAlign: 'right' },
  emptyLogs: { textAlign: 'center', color: COLORS.textSecondary, fontSize: 13, marginTop: 12 },
});

const badgeStyles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#F3F4F6', borderRadius: 10, padding: 10 },
  wrapActive: { backgroundColor: '#EEF4FF' },
  label: { fontSize: 10, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase', marginBottom: 2 },
  value: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  valueActive: { color: COLORS.primary },
});

const actionStyles = StyleSheet.create({
  btn: { width: '47%', backgroundColor: COLORS.card, borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 2, borderColor: '#E5E7EB' },
  disabled: { opacity: 0.4 },
  emoji: { fontSize: 24, marginBottom: 4 },
  label: { fontSize: 12, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },
});
