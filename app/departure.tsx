import React, { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { getItems } from '../src/db/queries';
import { startOutingSession } from '../src/services/sessionService';
import { Screen, Intro, SectionHeader, PrimaryButton, Actions, Counter, Em } from '../src/components/ui';
import { ChecklistGroup, ChecklistRow } from '../src/components/ChecklistRow';
import type { Item } from '../src/types';

export default function DepartureScreen() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadItems();
  }, []);

  async function loadItems() {
    const all = await getItems();
    setItems(all);
    setChecked(new Set(all.filter(i => i.isDefault).map(i => i.id)));
  }

  function toggle(id: string) {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleStart() {
    setLoading(true);
    await startOutingSession('manual', Array.from(checked));
    setLoading(false);
    router.replace('/');
  }

  return (
    <Screen>
      <Intro mascot="packing" title={<>오늘 함께할 물건을{'\n'}<Em>골라 주세요.</Em></>} subtitle="오늘 가져가는 물건만 골라 주세요." />
      <SectionHeader
        first
        title="내 소지품"
        right={<Counter>{checked.size} / {items.length} 선택</Counter>}
      />
      <ChecklistGroup>
        {items.map(item => (
          <ChecklistRow
            key={item.id}
            item={item}
            checked={checked.has(item.id)}
            note={item.isDefault ? '늘 챙기는 물건' : '필요한 날에만'}
            onToggle={() => toggle(item.id)}
          />
        ))}
      </ChecklistGroup>
      <Actions note="외출을 시작하면 위치 기록을 켜요.">
        <PrimaryButton
          label={`${checked.size}개 챙기고 외출 시작`}
          onPress={handleStart}
          loading={loading}
          disabled={checked.size === 0}
        />
      </Actions>
    </Screen>
  );
}
