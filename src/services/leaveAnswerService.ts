import { getLeaveLogByStayId, updateLeaveLogResponse } from '../db/queries';
import { markLeaveAnswered } from './liveActivityService';

/**
 * "모두 챙김" answered without opening a screen, from the leave notification or the Lock Screen
 * card. Both record the same way; a leave already answered elsewhere is left as it was.
 */
export async function answerLeaveAllChecked(stayId: string): Promise<void> {
  const log = await getLeaveLogByStayId(stayId);
  if (log && !log.action) await updateLeaveLogResponse(log.id, undefined, 'allChecked', []);
  await markLeaveAnswered(stayId, true);
}
