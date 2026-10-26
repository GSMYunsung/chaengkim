import { Tabs } from 'expo-router';
import { Icon, type IconName } from '../../src/components/ui';
import { colors, font } from '../../src/theme';

const TABS: { name: string; title: string; icon: IconName }[] = [
  { name: 'index', title: '홈', icon: 'house' },
  { name: 'items', title: '소지품', icon: 'briefcase-business' },
  { name: 'timeline', title: '기록', icon: 'clock-3' },
  { name: 'settings', title: '설정', icon: 'settings-2' },
];

export default function TabLayout() {
  return (
    <Tabs
      // Tabs are switched only by tapping the tab bar; system back doesn't walk tab history.
      backBehavior="none"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.blue,
        tabBarInactiveTintColor: colors.sub,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.line },
        tabBarLabelStyle: { fontFamily: font, fontSize: 11, fontWeight: '600' },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      {TABS.map(t => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            tabBarIcon: ({ color }) => <Icon name={t.icon} size={22} color={color} />,
          }}
        />
      ))}
    </Tabs>
  );
}
