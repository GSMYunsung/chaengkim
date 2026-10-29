import { createSession, endSession, getActiveSession, pruneOldRecords } from '../db/queries';
import { startTracking, stopTracking } from './locationService';
import type { Session } from '../types';

export async function startOutingSession(
  trigger: Session['trigger'],
  itemIds: string[],
): Promise<Session> {
  const existing = await getActiveSession();
  if (existing) return existing;
  const session = await createSession(trigger, itemIds);
  // Without location permission the outing still runs: the manual leave and return
  // checks work, only the automatic leave alerts are off (home shows a note).
  await startTracking().catch(() => {});
  return session;
}

export async function endOutingSession(sessionId: string): Promise<void> {
  await endSession(sessionId);
  await stopTracking();
  // History keeps the latest days only; an outing ending is a natural moment to trim it.
  await pruneOldRecords().catch(() => {});
}
