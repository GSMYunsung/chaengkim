import { AppState } from 'react-native';
import PostHog from 'posthog-react-native';

// Anonymous usage events: where people drop off, what they press, how often they come back.
// Only counts and kinds of actions are sent — never coordinates, place names or item names.
// With no key (local builds, tests) nothing is created and every call is a no-op. Development
// builds stay silent too, so simulator and Maestro runs don't mix into real usage.
const KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY;
const HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';
const SEND_IN_DEV = process.env.EXPO_PUBLIC_POSTHOG_IN_DEV === '1';

const client = KEY && (!__DEV__ || SEND_IN_DEV)
  ? new PostHog(KEY, {
      host: HOST,
      disableGeoip: true,
      // A profile per random install ID (no name or contact) so retention and lifecycle insights,
      // which skip anonymous events, can show who stopped coming back.
      personProfiles: 'always',
      // Background location tasks also launch the app; the SDK's own lifecycle events would count
      // those as opens. Opens are recorded by trackAppOpens instead.
      captureAppLifecycleEvents: false,
    })
  : null;

type Events = {
  app_opened: Record<string, never>;
  onboarding_step_viewed: { step: number };
  onboarding_permission_answered: { location: boolean };
  onboarding_home_set: Record<string, never>;
  onboarding_blocked_no_items: Record<string, never>;
  onboarding_completed: { item_count: number };
  item_saved: { is_new: boolean; is_default: boolean };
  item_deleted: Record<string, never>;
  outing_started: { item_count: number };
  notification_opened: { type: string };
  leave_answered_from_notification: Record<string, never>;
  leave_check_completed: { result: string; item_count: number; recovered_count: number };
  return_check_completed: { item_count: number; missing_count: number };
  stay_renamed: Record<string, never>;
  dwell_threshold_changed: { minutes: number };
  home_registered: { replaced: boolean };
  home_action_pressed: { action: 'departure' | 'leave_check' | 'return_check' | 'edit_items' | 'add_item' | 'schedule_tile' };
  permission_settings_opened: { from: 'home_banner' | 'settings_location' | 'settings_notifications' };
  checklist_all_present: { screen: 'leave' | 'return' };
  leave_delay_reported: { delay: string };
  leave_delay_skipped: Record<string, never>;
  leave_notified: { signal: 'A' | 'B' };
  return_notified: Record<string, never>;
  history_day_selected: { has_outing: boolean };
  route_map_expanded: Record<string, never>;
  session_day_toggled: { open: boolean };
  departure_schedule_saved: { day_count: number };
  analytics_disabled: Record<string, never>;
};

export function track<E extends keyof Events>(event: E, ...props: Events[E] extends Record<string, never> ? [] : [Events[E]]) {
  client?.capture(event, props[0]);
}

/**
 * Records an open only when the user brings the app to the screen: the first time it becomes
 * active (a cold launch can start as 'unknown' or 'inactive'), then on each background → active
 * change. A launch by a background location task stays in 'background' and records nothing until
 * the user opens it; pulling down Control Center only goes active → inactive → active, so it
 * doesn't count either. Returns the unsubscribe function.
 */
export function trackAppOpens(): () => void {
  let last: string | null | undefined = AppState.currentState;
  let opened = false;
  const onActive = () => {
    if (!opened || last === 'background') track('app_opened');
    opened = true;
  };
  if (last === 'active') onActive();
  const sub = AppState.addEventListener('change', next => {
    if (next === 'active') onActive();
    last = next;
  });
  return () => sub.remove();
}

// Readable names so the event list and path insights say "홈 → 출발 체크", not "/ → /departure".
const SCREEN_NAMES: Record<string, string> = {
  '/': '홈',
  '/items': '소지품',
  '/timeline': '기록',
  '/settings': '설정',
  '/onboarding': '온보딩',
  '/departure': '출발 체크',
  '/leave-check': '소지품 확인(자리 뜸)',
  '/return-check': '귀가 체크',
  '/session-result': '귀가 완료',
  '/item-edit': '소지품 편집',
  '/test-lab': '테스트 랩',
};

let lastScreen: string | null = null;

/** Sends the screen with the one it was reached from, so each event reads as a move. */
export function trackScreen(pathname: string) {
  const name = SCREEN_NAMES[pathname] ?? pathname;
  if (name === lastScreen) return;
  client?.screen(name, { from: lastScreen ?? '앱 시작', path: pathname });
  lastScreen = name;
}

/** Whether usage events are being sent; false when there is no client at all. */
export function isAnalyticsEnabled(): boolean {
  return !!client && !client.optedOut;
}

export const analyticsAvailable = !!client;

export async function setAnalyticsEnabled(on: boolean) {
  if (!client) return;
  if (on) return client.optIn();
  // Record the opt-out itself and send it before going quiet.
  client.capture('analytics_disabled');
  await client.flush().catch(() => {});
  await client.optOut();
}
