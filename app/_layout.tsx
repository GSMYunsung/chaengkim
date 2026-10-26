import '../src/tasks/backgroundTasks';
import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { setupNotifications, LEAVE_ACTION_ALL_CHECKED } from '../src/services/notificationService';
import { getLeaveLogByStayId, updateLeaveLogResponse } from '../src/db/queries';
import { colors, font } from '../src/theme';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function RootLayout() {
  const router = useRouter();

  useEffect(() => {
    setupNotifications();
  }, []);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as any;
      if (data?.type === 'departure') {
        router.push('/departure');
      } else if (data?.type === 'leave') {
        if (response.actionIdentifier === LEAVE_ACTION_ALL_CHECKED) {
          // "모두 챙김" answered from the notification itself: record it without opening a screen.
          getLeaveLogByStayId(data.stayId).then(log => {
            if (log && !log.action) updateLeaveLogResponse(log.id, undefined, 'allChecked', []);
          });
          return;
        }
        router.push({ pathname: '/leave-check', params: { stayId: data.stayId } });
      } else if (data?.type === 'return') {
        router.push('/return-check');
      }
    });
    return () => sub.remove();
  }, []);

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerShadowVisible: false,
          headerTintColor: colors.ink,
          headerTitleStyle: { fontFamily: font, fontSize: 16, fontWeight: '600', color: colors.ink },
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: { backgroundColor: colors.bg },
          // Going back is only possible through a visible header back button, never by swiping.
          gestureEnabled: false,
          fullScreenGestureEnabled: false,
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="departure" options={{ title: '출발 체크' }} />
        <Stack.Screen name="leave-check" options={{ title: '소지품 확인' }} />
        <Stack.Screen name="return-check" options={{ title: '귀가 체크' }} />
        <Stack.Screen name="item-edit" options={{ title: '소지품 편집' }} />
        <Stack.Screen name="test-lab" options={{ title: '테스트 랩' }} />
        <Stack.Screen name="session-result" options={{ title: '귀가 완료', headerBackVisible: false }} />
        <Stack.Screen name="+not-found" />
      </Stack>
    </>
  );
}
