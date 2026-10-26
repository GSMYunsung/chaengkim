import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { requestPermissions } from '../src/services/locationService';
import { setupNotifications } from '../src/services/notificationService';
import { upsertPlace, setAppStateValue, getItems } from '../src/db/queries';
import {
  Screen, Intro, Group, Row, Note, PrimaryButton, SecondaryButton, Actions, ItemIcon, Icon,
  Text,
} from '../src/components/ui';
import { colors, type } from '../src/theme';
import { itemIcon } from '../src/utils/itemIcon';
import type { Item } from '../src/types';

export default function OnboardingScreen() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [homeSet, setHomeSet] = useState(false);
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    getItems().then(all => setItems(all.filter(i => i.isDefault)));
  }, []);

  async function handlePermissions() {
    setLoading(true);
    await setupNotifications();
    const { foreground, background } = await requestPermissions();
    setLoading(false);
    if (!foreground) {
      Alert.alert('위치 권한 필요', '머문 장소를 떠나는 순간을 알려면 위치 권한이 필요해요.');
      return;
    }
    if (!background) {
      Alert.alert(
        '항상 위치 허용',
        '"항상 허용"이 아니면 자리 뜰 때 알림이 오지 않아요. 기기 설정에서 바꿀 수 있어요.'
      );
    }
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
            title={'잊기 쉬운 순간에,\n한 번 더 챙김.'}
            subtitle="출발할 때, 자리를 떠날 때, 집에 돌아왔을 때. 필요한 순간에만 짧게 확인해요."
          />
          <Group>
            <Row icon="bell" title="알림 허용" subtitle="확인할 순간을 놓치지 않도록" />
            <Row icon="map-pin" title="위치 허용" subtitle="머문 장소를 떠나는 순간을 알 수 있도록" />
          </Group>
          <Note>사용 중 위치 → 항상 위치 순서로 요청해요. 물건 자체를 감지하지는 않아요.</Note>
          <Actions>
            <PrimaryButton label="권한 허용하고 계속" onPress={handlePermissions} loading={loading} />
          </Actions>
        </>
      )}

      {step === 1 && (
        <>
          <Intro title={'돌아올 곳을\n알려주세요.'} subtitle="집에 도착하면 마지막 소지품 확인을 도와드려요." />
          <View style={styles.place}>
            <Icon name="house" size={21} color={colors.blue} />
            <View style={{ flex: 1 }}>
              <Text style={styles.placeName}>우리 집</Text>
              <Text style={type.small}>{homeSet ? '현재 위치로 등록했어요' : '지금 집에 있다면 현재 위치로 등록하세요'}</Text>
            </View>
            {homeSet && <Icon name="check" size={20} color={colors.blue} />}
          </View>
          <Note>집은 자리 뜰 때 알림에서 자동으로 제외돼요.</Note>
          <Actions>
            {homeSet ? (
              <PrimaryButton label="다음" onPress={() => setStep(2)} />
            ) : (
              <>
                <PrimaryButton label="현재 위치를 집으로 등록" onPress={handleSetHome} loading={loading} />
                <SecondaryButton label="나중에 설정하기" onPress={() => setStep(2)} />
              </>
            )}
          </Actions>
        </>
      )}

      {step === 2 && (
        <>
          <Intro title="늘 챙기는 물건부터" subtitle="나중에 언제든 추가하거나 바꿀 수 있어요." />
          <View style={styles.inventory}>
            {items.map(item => (
              <View key={item.id} style={styles.invItem}>
                <ItemIcon name={itemIcon(item.name)} />
                <Text style={styles.invName} numberOfLines={2}>{item.name}</Text>
              </View>
            ))}
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
  invName: { fontSize: 12, lineHeight: 17, fontWeight: '500', color: colors.ink, textAlign: 'center' },
});
