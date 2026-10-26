import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { getActiveSession, getItems } from '../src/db/queries';
import { endOutingSession } from '../src/services/sessionService';
import {
  Screen, Intro, SectionHeader, PrimaryButton, SecondaryButton, Actions, Counter, Em, Dialog, ItemIcon, Text,
} from '../src/components/ui';
import { ChecklistGroup, ChecklistRow } from '../src/components/ChecklistRow';
import { colors, type } from '../src/theme';
import { itemIcon } from '../src/utils/itemIcon';
import type { Item } from '../src/types';

export default function ReturnCheckScreen() {
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [present, setPresent] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const session = await getActiveSession();
    if (!session) { router.replace('/'); return; }
    setSessionId(session.id);
    const allItems = await getItems();
    setItems(allItems.filter(i => session.itemIds.includes(i.id)));
  }

  function toggle(id: string) {
    setPresent(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // Ending the outing can't be undone, so unchecked items get one confirmation first.
  function confirmComplete() {
    if (items.some(i => !present.has(i.id))) setConfirming(true);
    else handleComplete();
  }

  async function handleComplete() {
    if (!sessionId) return;
    setLoading(true);
    await endOutingSession(sessionId);
    const missing = items.filter(i => !present.has(i.id));
    setLoading(false);
    router.replace({
      pathname: '/session-result',
      params: {
        sessionId,
        missingItemIds: JSON.stringify(missing.map(i => i.id)),
      },
    });
  }

  const allPresent = items.length > 0 && items.every(i => present.has(i.id));
  const unchecked = items.filter(i => !present.has(i.id));

  return (
    <Screen>
      <Intro mascot="hum" title={<>잘 다녀오셨어요.{'\n'}<Em>모두 함께 왔나요?</Em></>} subtitle="없는 물건은 체크하지 않고 넘어가세요." />
      <SectionHeader
        first
        title="오늘의 소지품"
        right={<Counter>{present.size} / {items.length} 확인</Counter>}
      />
      <ChecklistGroup>
        {items.map(item => (
          <ChecklistRow
            key={item.id}
            item={item}
            checked={present.has(item.id)}
            note={present.has(item.id) ? '직접 확인했어요' : '직접 확인해 주세요'}
            onToggle={() => toggle(item.id)}
          />
        ))}
      </ChecklistGroup>
      <Actions note="귀가를 마치면 위치 기록을 멈춰요.">
        <PrimaryButton
          label={allPresent ? '모두 확인하고 마치기' : '확인한 물건으로 마치기'}
          onPress={confirmComplete}
          loading={loading}
        />
        {!allPresent && (
          <SecondaryButton label="모두 있어요" onPress={() => setPresent(new Set(items.map(i => i.id)))} />
        )}
      </Actions>

      <Dialog
        visible={confirming}
        mascot="question"
        title={`${unchecked.length}개가 아직 확인되지 않았어요`}
        message="이대로 마치면 귀가가 끝나고 위치 기록도 멈춰요."
        cancelLabel="계속 확인"
        confirmLabel="마치기"
        onCancel={() => setConfirming(false)}
        onConfirm={() => { setConfirming(false); handleComplete(); }}
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
});
