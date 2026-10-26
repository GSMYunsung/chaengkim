import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  getActiveSession, getActiveStay, getItems, getLeaveLogByStayId, getPlaces, getStay, updateLeaveLogResponse,
} from '../src/db/queries';
import { lookupPlaceName } from '../src/services/placeLookup';
import { isHomeStay } from '../src/services/stayNameService';
import { StayNameDialog } from '../src/components/StayNameDialog';
import {
  Screen, Intro, SectionHeader, PrimaryButton, LinkButton, Actions, Icon, Pills, Counter, Em,
  Text,
} from '../src/components/ui';
import { ChecklistGroup, ChecklistRow } from '../src/components/ChecklistRow';
import { colors, type } from '../src/theme';
import type { Item, Stay, UserDelay } from '../src/types';

const DELAYS: { value: UserDelay; label: string }[] = [
  { value: 'now', label: '방금' },
  { value: '1-3', label: '1~3분' },
  { value: '3-5', label: '3~5분' },
  { value: '5+', label: '5분 이상' },
];

export default function LeaveCheckScreen() {
  const router = useRouter();
  const { stayId } = useLocalSearchParams<{ stayId?: string }>();
  const [items, setItems] = useState<Item[]>([]);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [recovered, setRecovered] = useState<Set<string>>(new Set());
  const [place, setPlace] = useState<{ name: string; dwellMin: number; editable: boolean } | null>(null);
  const [stay, setStay] = useState<Stay | null>(null);
  const [editing, setEditing] = useState(false);
  const [logId, setLogId] = useState<string | null>(null);
  const [step, setStep] = useState<'items' | 'done'>('items');
  const [delay, setDelay] = useState<UserDelay | null>(null);

  useEffect(() => {
    loadData();
  }, [stayId]);

  async function loadData() {
    const session = await getActiveSession();
    if (!session) return;
    const allItems = await getItems();
    setItems(allItems.filter(i => session.itemIds.includes(i.id)));

    const stay = stayId ? await getStay(stayId) : await getActiveStay(session.id);
    if (!stay) return;
    setStay(stay);
    const [log, places] = await Promise.all([getLeaveLogByStayId(stay.id), getPlaces()]);
    if (log) setLogId(log.id);
    const own = stay.customName || places.find(p => p.id === stay.placeId)?.name;
    const dwellMin = log?.dwellMin ?? (Date.now() - stay.arrivedAt) / 60000;
    const editable = !isHomeStay(stay, places);
    setPlace({ name: own ?? '머문 장소', dwellMin, editable });
    if (!own) {
      lookupPlaceName(stay.anchorLat, stay.anchorLng).then(name => {
        if (name) setPlace({ name, dwellMin, editable });
      });
    }
  }

  function toggle(id: string) {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function recover(id: string) {
    setRecovered(prev => new Set(prev).add(id));
    setChecked(prev => new Set(prev).add(id));
  }

  async function handleAllChecked() {
    setChecked(new Set(items.map(i => i.id)));
    if (logId) {
      await updateLeaveLogResponse(logId, undefined, recovered.size ? 'opened' : 'allChecked', [...recovered]);
    }
    setStep('done');
  }

  async function handleSaveDelay() {
    if (logId && delay) {
      await updateLeaveLogResponse(logId, delay, recovered.size ? 'opened' : 'allChecked', [...recovered]);
    }
    router.back();
  }

  if (step === 'done') {
    return (
      <Screen>
        <Stack.Screen options={{ title: '확인 완료' }} />
        <Intro
          mascot="happy"
          title={'확인했어요.\n이제 마음 편히 가세요.'}
          subtitle={recovered.size ? '돌아가서 챙긴 물건을 기록했어요.' : '챙긴 순간의 기록에 남겼어요.'}
        />
        {logId ? (
          <>
            <SectionHeader first title="몇 분 전에 나오셨나요?" />
            <Text style={[type.body, { marginBottom: 14 }]}>알림이 제때 왔는지 확인하는 질문이에요.</Text>
            <Pills options={DELAYS} value={delay} onChange={setDelay} />
            <Actions>
              <PrimaryButton
                label={delay ? '응답 저장하고 계속' : '응답 선택 후 계속'}
                onPress={handleSaveDelay}
                disabled={!delay}
              />
              <View style={{ alignItems: 'center' }}>
                <LinkButton label="이번에는 건너뛰기" onPress={() => router.back()} />
              </View>
            </Actions>
          </>
        ) : (
          <Actions>
            <PrimaryButton label="홈으로" onPress={() => router.back()} />
          </Actions>
        )}
      </Screen>
    );
  }

  const checkedCount = items.filter(i => checked.has(i.id)).length;

  return (
    <Screen>
      <Intro mascot="alert" title={<>잠깐,{'\n'}<Em>다 챙기셨나요?</Em></>} subtitle="주변을 한 번 둘러보고 확인해 주세요." />
      {place && (
        <View style={styles.place}>
          <Icon name="coffee" size={21} color={colors.blue} />
          <View style={{ flex: 1 }}>
            <Text style={styles.placeName}>{place.name}</Text>
            <Text style={type.small}>{Math.round(place.dwellMin)}분 머문 장소</Text>
          </View>
          {place.editable && (
            <Pressable
              style={({ pressed }) => [styles.editName, pressed && { opacity: 0.6 }]}
              onPress={() => setEditing(true)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`${place.name} 이름 고치기`}
            >
              <Icon name="pencil" size={16} color={colors.sub} />
            </Pressable>
          )}
        </View>
      )}
      <StayNameDialog
        stay={editing ? stay : null}
        currentName={place?.name === '머문 장소' ? undefined : place?.name}
        onClose={() => setEditing(false)}
        onSaved={name => {
          setPlace(p => (p ? { ...p, name } : p));
          setStay(st => (st ? { ...st, customName: name } : st));
        }}
      />
      <SectionHeader
        first={!place}
        title="오늘의 소지품"
        right={<Counter>{checkedCount} / {items.length} 확인</Counter>}
      />
      <ChecklistGroup>
        {items.map(item => (
          <ChecklistRow
            key={item.id}
            item={item}
            checked={checked.has(item.id)}
            note={recovered.has(item.id) ? '돌아가서 챙겼어요' : checked.has(item.id) ? '직접 확인했어요' : '직접 확인해 주세요'}
            onToggle={() => toggle(item.id)}
            recover={() => recover(item.id)}
          />
        ))}
      </ChecklistGroup>
      <Actions note="이 버튼은 모든 물건을 직접 확인했다는 뜻이에요.">
        <PrimaryButton label="모두 챙김" onPress={handleAllChecked} />
      </Actions>
    </Screen>
  );
}

const styles = StyleSheet.create({
  place: {
    flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: colors.surface,
    borderRadius: 14, paddingVertical: 14, paddingHorizontal: 15, marginTop: -7,
  },
  editName: {
    width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.card,
  },
  placeName: { fontSize: 14, fontWeight: '600', color: colors.ink },
});
