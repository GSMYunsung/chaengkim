export type Item = {
  id: string;
  name: string;
  price: number;
  isDefault: boolean;
  createdAt: number;
};

export type PlaceKind = 'home' | 'trusted' | 'saved';

export type Place = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radiusM: number;
  kind: PlaceKind;
  extraItemIds: string[];
  createdAt: number;
};

export type DepartureSchedule = {
  id: string;
  weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  time: string; // 'HH:MM'
  enabled: boolean;
};

export type SessionTrigger = 'schedule' | 'manual';

export type Session = {
  id: string;
  startedAt: number;
  endedAt?: number;
  trigger: SessionTrigger;
  itemIds: string[];
};

export type Stay = {
  id: string;
  sessionId: string;
  anchorLat: number;
  anchorLng: number;
  arrivedAt: number;
  leftAt?: number;
  placeId?: string;
  /** Name the user gave this one stay; wins over the saved place and the looked-up shop name. */
  customName?: string | null;
};

export type NotifiedBy = 'A' | 'B';
export type UserDelay = 'now' | '1-3' | '3-5' | '5+';
export type LeaveAction = 'allChecked' | 'opened' | 'ignored';

export type LeaveLog = {
  id: string;
  stayId: string;
  dwellMin: number;
  signalAAt?: number;
  signalBAt?: number;
  notifiedBy: NotifiedBy;
  notifiedAt: number;
  distanceFromAnchorM: number;
  userReportedDelay?: UserDelay;
  action?: LeaveAction;
  recoveredItemIds: string[];
};
