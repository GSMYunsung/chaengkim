import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export const LEAVE_ACTION_ALL_CHECKED = 'ALL_CHECKED';

// The foreground display handler is set once in app/_layout.tsx.
export async function setupNotifications(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: '챙김 알림',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  await Notifications.setNotificationCategoryAsync('LEAVE_CHECK', [
    {
      identifier: LEAVE_ACTION_ALL_CHECKED,
      buttonTitle: '✅ 모두 챙김',
      options: { isDestructive: false, opensAppToForeground: false },
    },
    {
      identifier: 'OPEN_CHECK',
      buttonTitle: '확인하기',
      options: { isDestructive: false, opensAppToForeground: true },
    },
  ]);

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function scheduleWeeklyDepartureNotification(
  id: string,
  weekday: number,
  timeStr: string,
): Promise<string> {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const notifId = await Notifications.scheduleNotificationAsync({
    identifier: `departure-${id}`,
    content: {
      title: '챙김',
      body: '오늘 들고 나갈 물건 확인할까요?',
      data: { type: 'departure' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: weekday + 1, // expo uses 1=Sunday
      hour: hours,
      minute: minutes,
    },
  });
  return notifId;
}

export async function cancelDepartureNotification(scheduleId: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(`departure-${scheduleId}`).catch(() => {});
}

export async function sendLeaveNotification(
  stayId: string,
  itemCount: number,
  placeName: string | null,
  isTest = false,
): Promise<void> {
  const label = placeName ?? '이 장소';
  const title = isTest ? '[테스트] 챙겼나요?' : '챙겼나요?';
  const body = isTest
    ? '테스트 이탈 알림입니다. 소지품을 확인하세요.'
    : itemCount > 0
      ? `${label}에서 ${itemCount}개 챙기셨나요?`
      : `${label}에서 소지품 확인하세요`;

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: { stayId, type: 'leave' },
      categoryIdentifier: 'LEAVE_CHECK',
    },
    trigger: null,
  });
}

export async function sendReturnNotification(itemCount: number): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '집에 도착했어요',
      body: itemCount > 0 ? `${itemCount}개 소지품이 함께 왔는지 확인할까요?` : '소지품이 함께 왔는지 확인할까요?',
      data: { type: 'return' },
    },
    trigger: null,
  });
}
