import React, { useCallback, useState } from 'react';
import { View, StyleSheet, Alert, Pressable } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { requestPermissions } from '../src/services/locationService';
import { setupNotifications } from '../src/services/notificationService';
import { upsertPlace, setAppStateValue, getItems } from '../src/db/queries';
import {
  Screen, Intro, Group, Row, Note, PrimaryButton, SecondaryButton, Actions, ItemIcon, Icon,
  Text,
} from '../src/components/ui';
import { colors, radius, type } from '../src/theme';
import { itemIcon } from '../src/utils/itemIcon';
import type { Item } from '../src/types';

export default function OnboardingScreen() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [homeSet, setHomeSet] = useState(false);
  const [canLocate, setCanLocate] = useState(false);
  const [items, setItems] = useState<Item[]>([]);

  // Reload on focus so items added from the item screen show up when coming back.
  useFocusEffect(useCallback(() => {
    getItems().then(all => setItems(all.filter(i => i.isDefault)));
  }, []));

  // App Review 5.1.1(iv): whatever the user answers, onboarding moves on without
  // nudging them toward Settings. Features that need location say so where they are used.
  async function handlePermissions() {
    setLoading(true);
    await setupNotifications();
    const { foreground } = await requestPermissions();
    setCanLocate(foreground);
    setLoading(false);
    setStep(1);
  }

  async function handleSetHome() {
    setLoading(true);
    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      await upsertPlace({
        name: '집',
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
        radiusM: 150,
        kind: 'home',
        extraItemIds: [],
      });
      setHomeSet(true);
    } catch {
      Alert.alert('오류', '현재 위치를 가져올 수 없어요.');
    }
    setLoading(false);
  }

  async function handleFinish() {
    // The app has nothing to check without items, so the first one is required.
    if (items.length === 0) {
      Alert.alert('소지품을 하나 이상 추가해 주세요', '나갈 때마다 함께 확인할 물건이에요.', [
        { text: '확인', onPress: () => router.push('/item-edit') },
      ]);
      return;
    }
    await setAppStateValue('onboarded', 'true');
    router.replace('/');
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.progress} accessibilityLabel={`${step + 1} / 3 단계`}>
        {[0, 1, 2].map(i => (
          <View key={i} style={[styles.bar, step >= i && styles.barOn]} />
        ))}
      </View>

      {step === 0 && (
        <>
          <Intro
            mascot="heart"
            title={'잊기 쉬운 순간에,\n한 번 더 챙김.'}
            subtitle="출발할 때, 자리를 떠날 때, 집에 돌아왔을 때. 필요한 순간에만 짧게 확인해요."
          />
          <Group>
            <Row icon="bell" title="알림" subtitle="확인할 순간을 놓치지 않도록" />
            <Row icon="map-pin" title="위치" subtitle="머문 장소를 떠나는 순간을 알 수 있도록" />
          </Group>
          <Note>사용 중 위치 → 항상 위치 순서로 요청해요. 물건 자체를 감지하지는 않아요.</Note>
          <Actions>
            <PrimaryButton label="계속" onPress={handlePermissions} loading={loading} />
          </Actions>
        </>
      )}

      {step === 1 && (
        <>
          <Intro mascot="walk" title={'돌아올 곳을\n알려주세요.'} subtitle="집에 도착하면 마지막 소지품 확인을 도와드려요." />
          <View style={styles.place}>
            <Icon name="house" size={21} color={colors.blue} />
            <View style={{ flex: 1 }}>
              <Text style={styles.placeName}>우리 집</Text>
              <Text style={type.small}>
                {homeSet ? '현재 위치로 등록했어요'
                  : canLocate ? '지금 집에 있다면 현재 위치로 등록하세요'
                  : '위치를 허용하지 않아 나중에 설정 탭에서 등록할 수 있어요'}
              </Text>
            </View>
            {homeSet && <Icon name="check" size={20} color={colors.blue} />}
          </View>
          <Note>집은 자리 뜰 때 알림에서 자동으로 제외돼요.</Note>
          <Actions>
            {homeSet ? (
              <PrimaryButton label="다음" onPress={() => setStep(2)} />
            ) : canLocate ? (
              <>
                <PrimaryButton label="현재 위치를 집으로 등록" onPress={handleSetHome} loading={loading} />
                <SecondaryButton label="나중에 설정하기" onPress={() => setStep(2)} />
              </>
            ) : (
              <PrimaryButton label="다음" onPress={() => setStep(2)} />
            )}
          </Actions>
        </>
      )}

      {step === 2 && (
        <>
          <Intro mascot="packing" title="늘 챙기는 물건부터" subtitle="나중에 언제든 추가하거나 바꿀 수 있어요." />
          <View style={styles.inventory}>
            {items.map(item => (
              <View key={item.id} style={styles.invItem}>
                <ItemIcon name={itemIcon(item.name)} />
                <Text style={styles.invName} numberOfLines={2}>{item.name}</Text>
              </View>
            ))}
            <Pressable
              style={({ pressed }) => [styles.invItem, pressed && { opacity: 0.75 }]}
              onPress={() => router.push('/item-edit')}
              accessibilityRole="button"
              accessibilityLabel="소지품 추가"
            >
              <View style={styles.addIcon}>
                <Icon name="plus" size={21} color={colors.blue} />
              </View>
              <Text style={[styles.invName, { color: colors.blue }]}>추가</Text>
            </Pressable>
          </View>
          <Actions>
            <PrimaryButton label="챙김 시작하기" onPress={handleFinish} />
          </Actions>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  progress: { flexDirection: 'row', gap: 5, marginTop: 7, marginBottom: 25 },
  bar: { width: 27, height: 4, borderRadius: 2, backgroundColor: colors.line },
  barOn: { backgroundColor: colors.blue },
  place: {
    flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: colors.surface,
    borderRadius: 14, paddingVertical: 14, paddingHorizontal: 15,
  },
  placeName: { fontSize: 14, fontWeight: '600', color: colors.ink },
  inventory: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 7 },
  invItem: { width: '25%', alignItems: 'center', gap: 7, paddingVertical: 6 },
  addIcon: {
    width: 40, height: 40, borderRadius: radius.icon, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderStyle: 'dashed', borderColor: colors.checkedBorder,
  },
  invName: { fontSize: 12, lineHeight: 17, fontWeight: '500', color: colors.ink, textAlign: 'center' },
});
