import { createSession, endSession, getActiveSession } from '../db/queries';
import { startTracking, stopTracking } from './locationService';
import type { Session } from '../types';

export async function startOutingSession(
  trigger: Session['trigger'],
  itemIds: string[],
): Promise<Session> {
  const existing = await getActiveSession();
  if (existing) return existing;
  const session = await createSession(trigger, itemIds);
  await startTracking();
  return session;
}

export async function endOutingSession(sessionId: string): Promise<void> {
  await endSession(sessionId);
  await stopTracking();
}
