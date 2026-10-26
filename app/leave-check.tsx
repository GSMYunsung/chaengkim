import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  getActiveSession, getActiveStay, getItems, getLeaveLogByStayId, getPlaces, getStay, updateLeaveLogResponse,
} from '../src/db/queries';
import { lookupPlaceName } from '../src/services/placeLookup';
import { isHomeStay } from '../src/services/stayNameService';
import { StayNameDialog } from '../src/components/StayNameDialog';
import {
  Screen, Intro, SectionHeader, PrimaryButton, LinkButton, Actions, Icon, Pills, Counter, Em,
  Text, SecondaryButton, Dialog, ItemIcon,
} from '../src/components/ui';
import { ChecklistGroup, ChecklistRow } from '../src/components/ChecklistRow';
import { colors, type } from '../src/theme';
import { itemIcon } from '../src/utils/itemIcon';
import type { Item, LeaveAction, Stay, UserDelay } from '../src/types';

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
  const [confirming, setConfirming] = useState(false);

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

  // Same flow as the return check: unchecked items get one confirmation before finishing.
  function confirmFinish() {
    if (items.some(i => !checked.has(i.id))) setConfirming(true);
    else finish();
  }

  async function finish() {
    if (logId) await updateLeaveLogResponse(logId, undefined, responseAction(), [...recovered]);
    setStep('done');
  }

  // "allChecked" only when every item was ticked without going back for any.
  function responseAction(): LeaveAction {
    return items.every(i => checked.has(i.id)) && !recovered.size ? 'allChecked' : 'opened';
  }

  async function handleSaveDelay() {
    if (logId && delay) {
      await updateLeaveLogResponse(logId, delay, responseAction(), [...recovered]);
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
  const allChecked = items.every(i => checked.has(i.id));
  const unchecked = items.filter(i => !checked.has(i.id));

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
      <Actions note="확인을 마쳐도 외출 기록은 계속돼요.">
        <PrimaryButton
          label={allChecked ? '모두 확인했어요' : '확인한 물건으로 완료'}
          onPress={confirmFinish}
        />
        {!allChecked && (
          <SecondaryButton label="모두 있어요" onPress={() => setChecked(new Set(items.map(i => i.id)))} />
        )}
      </Actions>

      <Dialog
        visible={confirming}
        mascot="question"
        title={`${unchecked.length}개를 아직 확인하지 않았어요`}
        message="두고 가는 물건은 없나요?"
        cancelLabel="계속 확인"
        confirmLabel="이대로 완료"
        onCancel={() => setConfirming(false)}
        onConfirm={() => { setConfirming(false); finish(); }}
      >
        <ScrollView style={styles.missing} contentContainerStyle={styles.missingContent}>
          {unchecked.map(item => (
            <View key={item.id} style={styles.missingRow}>
              <ItemIcon name={itemIcon(item.name)} tone="muted" small />
              <Text style={type.rowName}>{item.name}</Text>
            </View>
          ))}
        </ScrollView>
      </Dialog>
    </Screen>
  );
}

const styles = StyleSheet.create({
  missing: { marginTop: 16, backgroundColor: colors.surface, borderRadius: 14, maxHeight: 220 },
  missingContent: { paddingVertical: 6, paddingHorizontal: 12 },
  missingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 46 },
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
