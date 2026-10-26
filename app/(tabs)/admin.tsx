import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import AppButton from '@/components/AppButton';
import AttendanceStats from '@/components/AttendanceStats';
import GroupChart from '@/components/GroupChart';
import PersonalQrScanner from '@/components/PersonalQrScanner';
import { COLORS } from '@/constants/colors';
import { createEvent, deleteEvent, getAllEvents, getEventByCode, type CloudEvent } from '@/lib/events';
import { useMyRole } from '@/lib/profiles';
import {
  SESSION_LABELS,
  closeOutSession,
  getSessionRecords,
  getSessionsForEvent,
  isOutSession,
  startSession,
  stopSession,
  type EventSession,
  type SessionRecord,
} from '@/lib/sessions';
import EventQrCard from '@/features/event-qr/EventQrCard';

const STATUS_COLORS = { present: COLORS.success, late: COLORS.warning, absent: COLORS.danger } as const;
const STATUS_TEXT = { not_started: 'Not started', open: 'OPEN', closed: 'Closed' } as const;

// Which session do we show in the lists? The one the admin tapped, else the
// open one, else the last one that was started.
function pickSession(sessions: EventSession[], chosenId: string | null) {
  return (
    sessions.find((s) => s.id === chosenId) ??
    sessions.find((s) => s.status === 'open') ??
    [...sessions].reverse().find((s) => s.status !== 'not_started') ??
    sessions[0] ??
    null
  );
}

function formatTime(iso: string | null) {
  return iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
}

export default function AdminScreen() {
  const role = useMyRole();

  const [events, setEvents] = useState<CloudEvent[]>([]);
  const [eventId, setEventId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<EventSession[]>([]);
  const [chosenSessionId, setChosenSessionId] = useState<string | null>(null);
  const [allRecords, setAllRecords] = useState<Record<string, SessionRecord[]>>({});
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmCloseId, setConfirmCloseId] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCode, setNewCode] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const isAdmin = role === 'admin';
  const event = events.find((e) => e.id === eventId) ?? null;
  const openSession = sessions.find((s) => s.status === 'open') ?? null;
  const viewSession = pickSession(sessions, chosenSessionId);
  const records = viewSession ? allRecords[viewSession.id] ?? [] : [];

  // Reload sessions + lists from Supabase.
  const refresh = useCallback(async () => {
    if (!isAdmin) return;
    const allEvents = await getAllEvents();
    setEvents(allEvents);
    const currentId = eventId ?? allEvents[0]?.id ?? null;
    if (currentId !== eventId) setEventId(currentId);
    if (!currentId) return;

    const list = await getSessionsForEvent(currentId);
    setSessions(list);
    const entries = await Promise.all(
      list.map(async (s) => [s.id, await getSessionRecords(s.id)] as const)
    );
    setAllRecords(Object.fromEntries(entries));
    setLoaded(true);
  }, [isAdmin, eventId]);

  // Load when the tab opens, then re-check every 5 seconds.
  useFocusEffect(
    useCallback(() => {
      refresh();
      const timer = setInterval(refresh, 5000);
      return () => clearInterval(timer);
    }, [refresh])
  );

  const handleSelectEvent = (id: string) => {
    setEventId(id);
    setChosenSessionId(null);
    setSessions([]);
    setAllRecords({});
    setLoaded(false);
    setShowQr(false);
    setShowScanner(false);
    setConfirmCloseId(null);
    setMessage(null);
    setConfirmDeleteId(null);
  };

  const handleStart = async (session: EventSession) => {
    const r = await startSession(session.id);
    setMessage(r.message);
    setChosenSessionId(null);
    setShowQr(false);
    setShowScanner(false);
    refresh();
  };

  const handleStop = async (session: EventSession) => {
    const r = await stopSession(session.id);
    setMessage(r.message);
    setShowQr(false);
    setShowScanner(false);
    refresh();
  };

  const handleClose = async (session: EventSession) => {
    if (confirmCloseId !== session.id) {
      setConfirmCloseId(session.id); // first tap = ask to confirm
      return;
    }
    const r = await closeOutSession(session.id);
    setMessage(r.message);
    setConfirmCloseId(null);
    setShowQr(false);
    setShowScanner(false);
    refresh();
  };

  const handleDeleteEvent = async () => {
    if (!event) return;
    if (confirmDeleteId !== event.id) {
      setConfirmDeleteId(event.id); // first tap = ask to confirm
      return;
    }
    const { error } = await deleteEvent(event.id);
    setConfirmDeleteId(null);
    if (error) {
      setMessage('Could not delete the event: ' + error);
      return;
    }
    const rest = events.filter((e) => e.id !== event.id);
    setEvents(rest);
    setEventId(rest[0]?.id ?? null);
    setSessions([]);
    setAllRecords({});
    setChosenSessionId(null);
    setLoaded(false);
    setShowQr(false);
    setShowScanner(false);
    setMessage('Event deleted.');
  };

  const handleCreateEvent = async () => {
    const title = newTitle.trim();
    const code = newCode.trim();
    if (!title || !code) {
      setMessage('Enter an event title and code.');
      return;
    }
    const { error } = await createEvent({ eventId: code, title, start: '', end: '' });
    if (error) {
      setMessage('Could not create the event: ' + error);
      return;
    }
    const created = await getEventByCode(code);
    setNewTitle('');
    setNewCode('');
    setMessage('Event created.');
    if (created) {
      setEvents(await getAllEvents());
      handleSelectEvent(created.id);
    }
  };

  if (role === null) {
    return (
      <View style={styles.container}>
        <Text style={styles.blockedTitle}>Checking your account...</Text>
      </View>
    );
  }

  if (!isAdmin) {
    return (
      <View style={styles.container}>
        <Text style={styles.blockedTitle}>Admins Only</Text>
        <Text style={styles.blockedSubtitle}>Only admin accounts can open this screen.</Text>
      </View>
    );
  }

  // The ONE big button: always shows what the admin should do next.
  let next: { kind: 'start' | 'close'; session: EventSession; label: string } | null = null;
  if (openSession) {
    if (isOutSession(openSession.session_type)) {
      next = {
        kind: 'close',
        session: openSession,
        label:
          confirmCloseId === openSession.id
            ? 'Tap again to confirm'
            : `Close ${SESSION_LABELS[openSession.session_type]} (marks the rest Absent)`,
      };
    } else {
      const after = sessions[sessions.findIndex((s) => s.id === openSession.id) + 1];
      if (after && after.status === 'not_started') {
        next = { kind: 'start', session: after, label: `Start ${SESSION_LABELS[after.session_type]} (sign out)` };
      }
    }
  } else {
    const first = sessions.find((s) => s.status === 'not_started');
    if (first) {
      next = {
        kind: 'start',
        session: first,
        label: isOutSession(first.session_type)
          ? `Start ${SESSION_LABELS[first.session_type]} (sign out)`
          : `Start Attendance — ${SESSION_LABELS[first.session_type]}`,
      };
    }
  }

  // Full record: one row per person, with all four sessions side by side.
  const people: Record<
    string,
    { name: string; group: string; cells: Record<string, SessionRecord | undefined> }
  > = {};
  sessions.forEach((s) => {
    (allRecords[s.id] ?? []).forEach((r) => {
      people[r.userId] = people[r.userId] ?? {
        name: r.name,
        group: r.role === 'teacher' ? 'Teachers' : r.groupLabel,
        cells: {},
      };
      people[r.userId].cells[s.session_type] = r;
    });
  });
  const personList = Object.values(people).sort((a, b) => a.name.localeCompare(b.name));

  const present = records.filter((r) => r.status === 'present');
  const late = records.filter((r) => r.status === 'late');
  const absent = records.filter((r) => r.status === 'absent');

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Admin Dashboard</Text>
      <View style={styles.swash} />

      {/* ---------- Summary ---------- */}
      <View style={styles.card}>
        <Text style={styles.small}>Event</Text>
        <Text style={styles.big}>{event ? event.title : 'No event yet — create one below'}</Text>
        <Text style={styles.small}>Current session</Text>
        <Text style={styles.big}>
          {openSession ? SESSION_LABELS[openSession.session_type] : 'None open'}
        </Text>
        <Text style={styles.small}>Status</Text>
        <Text style={styles.big}>
          {openSession ? `OPEN since ${formatTime(openSession.started_at)}` : 'Waiting for the admin to start a session'}
        </Text>
      </View>

      {message && <Text style={styles.message}>{message}</Text>}

      {/* ---------- Pick event ---------- */}
      {events.length > 0 && (
        <>
          <Text style={styles.section}>Choose event</Text>
          <View style={styles.chipRow}>
            {events.map((e) => (
              <Pressable
                key={e.id}
                style={[styles.chip, e.id === eventId && styles.chipActive]}
                onPress={() => handleSelectEvent(e.id)}
              >
                <Text style={[styles.chipText, e.id === eventId && styles.chipTextActive]}>
                  {e.title}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      {/* ---------- Delete event (admin can delete any event, even a teacher's) ---------- */}
      {event && (
        <>
          <AppButton
            title={confirmDeleteId === event.id ? 'Tap again to DELETE' : 'Delete This Event'}
            icon="trash-outline"
            onPress={handleDeleteEvent}
          />
          {confirmDeleteId === event.id && (
            <Text style={styles.warn}>
              This also deletes every attendance record of this event. It cannot be undone.
            </Text>
          )}
        </>
      )}

      {/* ---------- 4 sessions ---------- */}
      {event && (
        <>
          <Text style={styles.section}>Attendance for this event</Text>
          {loaded && sessions.length === 0 && (
            <Text style={styles.warn}>
              No sessions found for this event. Run supabase/admin_sessions.sql in the Supabase SQL
              Editor (once), then reopen this tab.
            </Text>
          )}
          {next && (
            <AppButton
              theme="primary"
              title={next.label}
              icon={next.kind === 'start' ? 'play-circle-outline' : 'stop-circle-outline'}
              onPress={() => (next!.kind === 'start' ? handleStart(next!.session) : handleClose(next!.session))}
            />
          )}
          {!next && sessions.length > 0 && !openSession && (
            <Text style={styles.hint}>All four sessions are finished for this event.</Text>
          )}
          <Text style={styles.section}>Sessions</Text>
          {sessions.map((s) => (
            <Pressable
              key={s.id}
              style={[styles.sessionRow, viewSession?.id === s.id && styles.sessionRowActive]}
              onPress={() => setChosenSessionId(s.id)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.sessionName}>{SESSION_LABELS[s.session_type]}</Text>
                <Text style={[styles.sessionStatus, s.status === 'open' && styles.statusOpen]}>
                  {STATUS_TEXT[s.status]}
                  {s.started_at ? ` · started ${formatTime(s.started_at)}` : ''}
                </Text>
              </View>

              {s.status === 'not_started' && (
                <Pressable style={styles.smallButton} onPress={() => handleStart(s)}>
                  <Text style={styles.smallButtonText}>Start</Text>
                </Pressable>
              )}
              {s.status === 'open' && !isOutSession(s.session_type) && (
                <Pressable
                  style={[styles.smallButton, styles.dangerButton]}
                  onPress={() => handleStop(s)}
                >
                  <Text style={styles.smallButtonText}>Stop</Text>
                </Pressable>
              )}
              {s.status === 'open' && isOutSession(s.session_type) && (
                <Pressable
                  style={[styles.smallButton, styles.dangerButton]}
                  onPress={() => handleClose(s)}
                >
                  <Text style={styles.smallButtonText}>
                    {confirmCloseId === s.id ? 'Tap again to confirm' : 'Close'}
                  </Text>
                </Pressable>
              )}
            </Pressable>
          ))}
          <Text style={styles.hint}>
            Late = more than 1 hour after an IN session starts. Stop turns scanning off for an IN session.
            Starting an OUT session also ends the IN session before it. Closing an OUT session marks everyone who did not tap out as Absent.
          </Text>
        </>
      )}

      {/* ---------- Scan / show QR (only while a session is open) ---------- */}
      {event && openSession && (
        <>
          <Text style={styles.section}>Record attendance — {SESSION_LABELS[openSession.session_type]}</Text>
          <AppButton
            theme="primary"
            title={showScanner ? 'Hide Camera' : 'Scan Personal QR Codes'}
            icon="scan-outline"
            onPress={() => {
              setShowScanner((v) => !v);
              setShowQr(false);
            }}
          />
          {showScanner && (
            <PersonalQrScanner sessionId={openSession.id} onRecorded={refresh} />
          )}

          <AppButton
            title={showQr ? 'Hide Event QR' : 'Show Backup Event QR'}
            icon="qr-code-outline"
            onPress={() => {
              setShowQr((v) => !v);
              setShowScanner(false);
            }}
          />
          {showQr && (
            <EventQrCard
              eventTitle={event.title}
              sessionId={openSession.id}
              sessionType={openSession.session_type}
            />
          )}
        </>
      )}

      {/* ---------- Statistics (tap through: Students / Teachers -> level -> grade/course -> section) ---------- */}
      {event && viewSession && (
        <AttendanceStats
          sessionId={viewSession.id}
          title={`${SESSION_LABELS[viewSession.session_type]} - statistics`}
        />
      )}

      {/* ---------- New event ---------- */}
      <Text style={styles.section}>Create a new event</Text>
      <TextInput
        style={styles.input}
        value={newTitle}
        onChangeText={setNewTitle}
        placeholder="Event title"
        placeholderTextColor={COLORS.textSecondary}
      />
      <TextInput
        style={[styles.input, { marginTop: 8 }]}
        value={newCode}
        onChangeText={setNewCode}
        placeholder="Event code, e.g. EVT-2026-0005"
        placeholderTextColor={COLORS.textSecondary}
        autoCapitalize="characters"
      />
      <View style={{ height: 12 }} />
      <AppButton title="Create Event" icon="add-circle-outline" onPress={handleCreateEvent} />
    </ScrollView>
  );
}

function NameList({
  title,
  people,
  color,
}: {
  title: string;
  people: SessionRecord[];
  color: string;
}) {
  return (
    <View style={styles.listCard}>
      <Text style={[styles.listTitle, { color }]}>
        {title} ({people.length})
      </Text>
      {people.length === 0 ? (
        <Text style={styles.empty}>No one yet</Text>
      ) : (
        people.map((p) => (
          <View key={p.id} style={styles.personRow}>
            <Text style={styles.personName}>{p.name}</Text>
            {p.scannedAt && <Text style={styles.personTime}>{formatTime(p.scannedAt)}</Text>}
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 48 },
  title: { fontSize: 20, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 4 },
  swash: {
    width: 56,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: COLORS.primary,
    marginTop: 8,
    marginBottom: 12,
    opacity: 0.85,
  },
  section: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, marginTop: 20, marginBottom: 8 },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
  },
  small: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary, marginTop: 6 },
  big: { fontSize: 16, fontWeight: '600', color: COLORS.textPrimary },
  warn: { fontSize: 13, color: COLORS.danger, lineHeight: 18, marginBottom: 10 },
  fullCard: {
    backgroundColor: COLORS.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    marginBottom: 8,
  },
  fullRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  fullSession: { fontSize: 12, color: COLORS.textSecondary },
  fullStatus: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary },
  message: { fontSize: 14, color: COLORS.primary, textAlign: 'center', marginTop: 12 },
  hint: { fontSize: 12, color: COLORS.textSecondary, lineHeight: 17, marginTop: 6 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginRight: 8,
    marginBottom: 8,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primaryDeep },
  chipText: { fontSize: 13, fontWeight: '600', color: COLORS.primary },
  chipTextActive: { color: COLORS.textOnPrimary },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    marginBottom: 8,
  },
  sessionRowActive: { borderColor: COLORS.primary, backgroundColor: COLORS.surface },
  sessionName: { fontSize: 15, fontWeight: '600', color: COLORS.textPrimary },
  sessionStatus: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  statusOpen: { color: COLORS.primaryDeep, fontWeight: '700' },
  smallButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginLeft: 8,
  },
  dangerButton: { backgroundColor: COLORS.danger },
  smallButtonText: { color: COLORS.textOnPrimary, fontWeight: '700', fontSize: 13 },
  listCard: {
    backgroundColor: COLORS.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    marginBottom: 10,
  },
  listTitle: { fontSize: 15, fontWeight: '700', marginBottom: 6 },
  empty: { fontSize: 13, color: COLORS.textSecondary },
  personRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    paddingHorizontal: 8,
    marginTop: 4,
    borderRadius: 8,
    backgroundColor: COLORS.surface,
  },
  personName: { flex: 1, fontSize: 13, fontWeight: '500', color: COLORS.textPrimary },
  personTime: { fontSize: 12, color: COLORS.textSecondary },
  input: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  blockedTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginTop: 24,
  },
  blockedSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 8,
  },
});
