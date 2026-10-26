import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Switch, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getItems, upsertItem, deleteItem } from '../src/db/queries';
import { Screen, Intro, Group, Row, PrimaryButton, Actions, LinkButton, Text, TextInput } from '../src/components/ui';
import { colors } from '../src/theme';
import type { Item } from '../src/types';

export default function ItemEditScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [item, setItem] = useState<Item | null>(null);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [isDefault, setIsDefault] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    getItems().then(all => {
      const found = all.find(i => i.id === id);
      if (!found) return;
      setItem(found);
      setName(found.name);
      setPrice(String(found.price));
      setIsDefault(found.isDefault);
    });
  }, [id]);

  async function handleSave() {
    const trimmed = name.trim();
    const parsed = price ? parseInt(price, 10) : 0;
    if (!trimmed || isNaN(parsed) || parsed < 0) {
      Alert.alert('입력 확인', '이름과 올바른 가격을 입력해 주세요.');
      return;
    }
    setSaving(true);
    await upsertItem({ id: item?.id, name: trimmed, price: parsed, isDefault });
    setSaving(false);
    router.back();
  }

  function handleDelete() {
    if (!item) return;
    Alert.alert('소지품 삭제', `${item.name}을(를) 목록에서 지울까요?`, [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: async () => { await deleteItem(item.id); router.back(); } },
    ]);
  }

  return (
    <Screen>
      <Intro title={item ? '소지품 수정' : '새 소지품'} subtitle="내가 알아보기 쉬운 이름으로 등록해 주세요." />

      <Text style={styles.label}>물건 이름</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="예: 우산"
        placeholderTextColor="#9AA3B0"
        maxLength={30}
        autoFocus={!id}
      />
      <Text style={styles.label}>가격 (원)</Text>
      <TextInput
        style={styles.input}
        value={price}
        onChangeText={v => setPrice(v.replace(/[^0-9]/g, ''))}
        placeholder="0"
        placeholderTextColor="#9AA3B0"
        keyboardType="number-pad"
      />

      <Group>
        <Row
          title="출발할 때 기본 포함"
          subtitle="매번 선택하지 않아도 돼요"
          right={<Switch value={isDefault} onValueChange={setIsDefault} trackColor={{ true: colors.blue }} />}
        />
      </Group>

      <Actions>
        <PrimaryButton label="저장" onPress={handleSave} loading={saving} />
        {item && (
          <View style={{ alignItems: 'center' }}>
            <LinkButton label="이 소지품 삭제" onPress={handleDelete} />
          </View>
        )}
      </Actions>
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '500', color: colors.ink, marginBottom: 8 },
  input: {
    minHeight: 48, borderWidth: 1, borderColor: '#DEE3ED', borderRadius: 11,
    backgroundColor: colors.card, paddingHorizontal: 13, fontSize: 16, color: colors.ink, marginBottom: 19,
  },
});
