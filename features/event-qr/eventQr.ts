// BACKUP "Event Attendance QR" feature — kept in its own folder on purpose.
//
// The Admin shows this QR on a screen. Students/Teachers scan it with the
// normal Scan tab on their own phone. The QR only says WHICH session it is.
// WHO is scanning comes from the person's login, checked by the database.
import { scanEventQr, type ActionResult } from '@/lib/sessions';

export type EventQrPayload = {
  t: 'event_session';
  v: 1;
  s: string; // the session id
};

export function buildEventQrPayload(sessionId: string): string {
  const payload: EventQrPayload = { t: 'event_session', v: 1, s: sessionId };
  return JSON.stringify(payload);
}

/** Returns the session id if `raw` is an event-session QR, otherwise null. */
export function parseEventQrPayload(raw: string): string | null {
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.t === 'event_session' && parsed.v === 1 && typeof parsed.s === 'string' && parsed.s) {
      return parsed.s;
    }
  } catch {
    // not JSON -> not our QR
  }
  return null;
}

export function isEventQrPayload(raw: string): boolean {
  return parseEventQrPayload(raw) !== null;
}

/** Called by the Scan tab when it sees an event-session QR. */
export async function registerEventQrScan(raw: string): Promise<ActionResult> {
  const sessionId = parseEventQrPayload(raw);
  if (!sessionId) return { ok: false, message: 'Not an event attendance QR code.' };
  return scanEventQr(sessionId);
}
