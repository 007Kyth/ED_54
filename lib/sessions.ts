// Attendance sessions (Morning IN, Noon OUT, Afternoon IN, Afternoon OUT).
// The RULES (Present/Late/Absent, duplicates, closing) live in the database
// functions from supabase/admin_sessions.sql. This file only calls them.
import { supabase } from './supabase';

export type SessionType = 'morning_in' | 'noon_out' | 'afternoon_in' | 'afternoon_out';
export type SessionStatus = 'not_started' | 'open' | 'closed';
export type AttendanceStatus = 'present' | 'late' | 'absent';

export const SESSION_ORDER: SessionType[] = [
  'morning_in',
  'noon_out',
  'afternoon_in',
  'afternoon_out',
];

export const SESSION_LABELS: Record<SessionType, string> = {
  morning_in: 'Morning IN',
  noon_out: 'Noon OUT',
  afternoon_in: 'Afternoon IN',
  afternoon_out: 'Afternoon OUT',
};

export function isOutSession(type: SessionType) {
  return type === 'noon_out' || type === 'afternoon_out';
}

export type EventSession = {
  id: string;
  event_id: string;
  session_type: SessionType;
  status: SessionStatus;
  started_at: string | null;
  closed_at: string | null;
};

export type SessionRecord = {
  id: string;
  userId: string;
  name: string;
  status: AttendanceStatus;
  scannedAt: string | null;
  role: string;
  groupLabel: string; // e.g. "Senior High - Grade 11 STEM", or "Teachers"
};

export type ActionResult = {
  ok: boolean;
  message: string;
  status?: AttendanceStatus;
  name?: string;
};

async function callRpc(fn: string, args: Record<string, string>): Promise<ActionResult> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) {
    if (error.message.includes('Could not find the function')) {
      return {
        ok: false,
        message: 'Database is not set up yet. Run supabase/admin_sessions.sql in Supabase.',
      };
    }
    return { ok: false, message: error.message };
  }
  return data as ActionResult;
}

export async function getSessionsForEvent(eventId: string): Promise<EventSession[]> {
  const { data, error } = await supabase
    .from('event_sessions')
    .select('id, event_id, session_type, status, started_at, closed_at')
    .eq('event_id', eventId);

  if (error || !data) return [];

  const list = data as EventSession[];
  return list.sort(
    (a, b) => SESSION_ORDER.indexOf(a.session_type) - SESSION_ORDER.indexOf(b.session_type)
  );
}

export async function getSessionRecords(sessionId: string): Promise<SessionRecord[]> {
  const { data, error } = await supabase.rpc('session_people', { p_session_id: sessionId });

  if (error || !data) return [];

  return (data as any[]).map((row) => ({
    id: row.id,
    userId: row.user_id,
    name: row.name || 'Unknown user',
    status: row.status as AttendanceStatus,
    scannedAt: row.scanned_at,
    role: row.role,
    groupLabel: row.group_label || 'Unassigned students',
  }));
}

export function startSession(sessionId: string) {
  return callRpc('start_session', { p_session_id: sessionId });
}

/** Admin stops an IN session (nobody is marked Absent). */
export function stopSession(sessionId: string) {
  return callRpc('stop_session', { p_session_id: sessionId });
}

export function closeOutSession(sessionId: string) {
  return callRpc('close_out_session', { p_session_id: sessionId });
}

/** Admin scans a person's personal QR code. */
export function scanPersonalQr(sessionId: string, qrToken: string) {
  return callRpc('scan_personal_qr', { p_session_id: sessionId, p_qr_token: qrToken });
}

/** A logged-in user records THEMSELVES from the event QR code. */
export function scanEventQr(sessionId: string) {
  return callRpc('scan_event_qr', { p_session_id: sessionId });
}

// ---------------------------------------------------------------------------
// MY attendance (History tab): rows where I was scanned by an admin, scanned the
// event QR myself, or was marked absent automatically. The database only lets a
// person read their own rows.
// ---------------------------------------------------------------------------
export type MyAttendanceRow = {
  id: string;
  eventTitle: string;
  sessionType: SessionType;
  status: 'present' | 'late' | 'absent';
  scannedAt: string | null;
  method: 'personal_qr' | 'event_qr' | 'auto_absent' | null;
};

export async function getMySessionHistory(userId: string): Promise<MyAttendanceRow[]> {
  const { data, error } = await supabase
    .from('session_attendance')
    .select('id, status, scanned_at, method, created_at, event_sessions ( session_type ), events ( title )')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map((r: any) => ({
    id: r.id,
    eventTitle: r.events?.title ?? '',
    sessionType: r.event_sessions?.session_type,
    status: r.status,
    scannedAt: r.scanned_at,
    method: r.method,
  }));
}
