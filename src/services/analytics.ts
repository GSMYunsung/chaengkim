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
      personProfiles: 'never',
      captureAppLifecycleEvents: true,
    })
  : null;

type Events = {
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
};

export function track<E extends keyof Events>(event: E, ...props: Events[E] extends Record<string, never> ? [] : [Events[E]]) {
  client?.capture(event, props[0]);
}

export function trackScreen(pathname: string) {
  client?.screen(pathname);
}

/** Whether usage events are being sent; false when there is no client at all. */
export function isAnalyticsEnabled(): boolean {
  return !!client && !client.optedOut;
}

export const analyticsAvailable = !!client;

export async function setAnalyticsEnabled(on: boolean) {
  if (!client) return;
  if (on) await client.optIn();
  else await client.optOut();
}
