import { Platform } from 'react-native';
import { addUserInteractionListener } from 'expo-widgets';
import OutingActivity, { ALL_CHECKED_TARGET, type OutingActivityProps } from '../liveActivity/OutingActivity';
import {
  getActiveSession, getActiveStay, getAppStateValue, getItems, getPlaces, getStay, setAppStateValue,
} from '../db/queries';
import { distanceM } from '../utils/geo';
import { reverseGeocodeName } from './placeLookup';
import type { Session, Stay } from '../types';

// The outing card on the Lock Screen and in the Dynamic Island (iOS Live Activity). It starts
// with the outing, follows the current stay from the background location task, asks after a
// leave, and ends with the return check. Every call is best effort: a card that can't be shown
// (Live Activities turned off, iOS too old, Android) must never break the outing itself.

const STATE_KEY = 'liveActivityState';
export const SHOW_PLACE_KEY = 'liveActivityShowPlace';
const MAX_NAMES = 4;
// Apple's geocoder throttles apps that ask too often; walking moves the stay anchor every
// ~100m, so a fresh address is asked at most this often and the card says "지금 있는 곳" between.
const GEOCODE_GAP_MS = 60 * 1000;
let lastGeocodeAt = 0;

/** What the card shows beyond the session itself, kept so background updates don't lose it. */
type CardState = {
  sessionId: string;
  stayId: string | null;
  place: string | null;
  hereSince: number;
  /** The previous stay's label: the leave of that stay is detected after the next one starts. */
  prevStayId: string | null;
  prevPlace: string | null;
  leftStayId: string | null;
  leftPlace: string | null;
  checked: string | null;
};

const supported = Platform.OS === 'ios';

function current() {
  if (!supported) return null;
  try {
    return OutingActivity.getInstances()[0] ?? null;
  } catch {
    return null;
  }
}

async function readState(sessionId: string): Promise<CardState> {
  const raw = await getAppStateValue(STATE_KEY);
  const saved = raw ? (JSON.parse(raw) as CardState) : null;
  if (saved?.sessionId === sessionId) return saved;
  return {
    sessionId, stayId: null, place: null, hereSince: Date.now(),
    prevStayId: null, prevPlace: null, leftStayId: null, leftPlace: null, checked: null,
  };
}

async function itemsLine(itemIds: string[]): Promise<string> {
  const byId = new Map((await getItems()).map(i => [i.id, i.name]));
  const names = itemIds.map(id => byId.get(id)).filter((n): n is string => !!n);
  if (!names.length) return '챙길 물건 없음';
  const shown = names.slice(0, MAX_NAMES).join(' · ');
  return names.length > MAX_NAMES ? `${shown} 외 ${names.length - MAX_NAMES}개` : shown;
}

/**
 * The stay's name for the card: the user's own name, then a saved place, then Apple's address.
 * Kakao shop names are left out on purpose: Kakao's terms forbid keeping its results in any
 * form, and the system keeps a Live Activity's content on the device.
 */
async function placeLabel(stay: Stay): Promise<string | null> {
  if ((await getAppStateValue(SHOW_PLACE_KEY)) === 'off') return null;
  if (stay.customName) return stay.customName;
  const saved = (await getPlaces()).find(p =>
    (stay.placeId && p.id === stay.placeId) || distanceM(p.lat, p.lng, stay.anchorLat, stay.anchorLng) < p.radiusM);
  if (saved) return saved.name;
  if (Date.now() - lastGeocodeAt < GEOCODE_GAP_MS) return null;
  lastGeocodeAt = Date.now();
  return reverseGeocodeName(stay.anchorLat, stay.anchorLng).catch(() => null);
}

async function render(session: Session, state: CardState): Promise<OutingActivityProps> {
  await setAppStateValue(STATE_KEY, JSON.stringify(state));
  return {
    items: await itemsLine(session.itemIds),
    itemCount: session.itemIds.length,
    outingStart: session.startedAt,
    place: state.place,
    hereSince: state.hereSince,
    leftStayId: state.leftStayId,
    leftPlace: state.leftPlace,
    checked: state.checked,
  };
}

async function push(change: (state: CardState) => CardState | Promise<CardState>) {
  const card = current();
  if (!card) return;
  const session = await getActiveSession();
  if (!session) return;
  const state = await change(await readState(session.id));
  await card.update(await render(session, state));
}

/** Starts the card for a new outing. Only works while the app is on screen (an iOS rule). */
export async function startOutingActivity(session: Session): Promise<void> {
  if (!supported) return;
  try {
    for (const old of OutingActivity.getInstances()) await old.end('immediate');
    const state = await readState(session.id);
    OutingActivity.start(await render(session, { ...state, hereSince: session.startedAt }), 'chaengkim://');
  } catch (e) {
    if (__DEV__) console.log('[잠금화면 카드] 시작 못 함', e);
  }
}

/** A new stay began (the background task moved its anchor): show where and since when. */
export async function showCurrentStay(stay: Stay): Promise<void> {
  try {
    const place = await placeLabel(stay);
    await push(s => ({
      ...s,
      prevStayId: s.stayId, prevPlace: s.place,
      stayId: stay.id, place, hereSince: stay.arrivedAt,
    }));
  } catch (e) {
    if (__DEV__) console.log('[잠금화면 카드] 장소 갱신 못 함', e);
  }
}

/** A leave was detected for this stay: ask on the card, with the "다 챙김" button. */
export async function showLeavePrompt(stayId: string, fallbackName: string | null): Promise<void> {
  try {
    await push(async s => {
      const known = stayId === s.stayId ? s.place : stayId === s.prevStayId ? s.prevPlace : null;
      const stay = known ? null : await getStay(stayId);
      const label = known ?? (stay ? await placeLabel(stay) : null) ?? fallbackName;
      return { ...s, leftStayId: stayId, leftPlace: label, checked: null };
    });
  } catch (e) {
    if (__DEV__) console.log('[잠금화면 카드] 질문 표시 못 함', e);
  }
}

/** The leave of this stay was answered (card, notification or screen): stop asking. */
export async function markLeaveAnswered(stayId: string, allChecked: boolean): Promise<void> {
  try {
    await push(s => {
      if (s.leftStayId !== stayId) return s;
      const d = new Date();
      const time = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
      return { ...s, leftStayId: null, leftPlace: null, checked: allChecked ? `${time} 다 챙겼어요` : `${time} 확인했어요` };
    });
  } catch (e) {
    if (__DEV__) console.log('[잠금화면 카드] 답 표시 못 함', e);
  }
}

/** Redraws the card from the current stay, e.g. after a rename or the place setting changed. */
export async function refreshOutingActivity(): Promise<void> {
  try {
    const session = await getActiveSession();
    const stay = session ? await getActiveStay(session.id) : null;
    if (!stay) return push(s => s);
    lastGeocodeAt = 0;
    const place = await placeLabel(stay);
    await push(s => ({ ...s, stayId: stay.id, place, hereSince: stay.arrivedAt }));
  } catch (e) {
    if (__DEV__) console.log('[잠금화면 카드] 다시 그리지 못 함', e);
  }
}

export async function endOutingActivity(): Promise<void> {
  if (!supported) return;
  try {
    for (const card of OutingActivity.getInstances()) await card.end('immediate');
  } catch (e) {
    if (__DEV__) console.log('[잠금화면 카드] 끝내지 못 함', e);
  }
}

/**
 * On app launch: a card left over from an outing that already ended is removed, and an outing
 * without its card (started before this version, or the system ended it) gets one again.
 */
export async function reconcileOutingActivity(): Promise<void> {
  if (!supported) return;
  const session = await getActiveSession();
  if (!session) return endOutingActivity();
  if (!current()) await startOutingActivity(session);
}

/** Calls `onAllChecked` with the stay id when "다 챙김" is pressed on the card. */
export function listenOutingActivityButtons(onAllChecked: (stayId: string) => void): () => void {
  if (!supported) return () => {};
  const sub = addUserInteractionListener(event => {
    if (event.source !== 'OutingActivity' || !event.target?.startsWith(ALL_CHECKED_TARGET)) return;
    onAllChecked(event.target.slice(ALL_CHECKED_TARGET.length));
  });
  return () => sub.remove();
}
