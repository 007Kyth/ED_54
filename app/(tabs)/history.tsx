import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { COLORS } from '@/constants/colors';
import {
  getAttendanceHistory,
  getTeacherEventAttendance,
  type AttendanceRecord,
  type TeacherEventAttendance,
} from '@/lib/attendance';
import { useAuth } from '@/lib/auth';
import { HistorySwitch, MyAttendanceList, type HistoryTab } from '@/components/MyAttendance';
import { getProfile, type Role } from '@/lib/profiles';
import { getMySessionHistory, type MyAttendanceRow } from '@/lib/sessions';

export default function HistoryScreen() {
  const { user } = useAuth();
  const [role, setRole] = useState<Role | null>(null);
  const [studentRecords, setStudentRecords] = useState<AttendanceRecord[]>([]);
  const [teacherEvents, setTeacherEvents] = useState<TeacherEventAttendance[]>([]);
  const [sessionRecords, setSessionRecords] = useState<MyAttendanceRow[]>([]);
  const [tab, setTab] = useState<HistoryTab | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    const profile = await getProfile(user.id);
    const currentRole = profile?.role ?? 'student';
    setRole(currentRole);
    // Teachers start on My Events (unchanged); students start on My Attendance.
    setTab((t) => t ?? (currentRole === 'teacher' ? 'other' : 'attendance'));
    setSessionRecords(await getMySessionHistory(user.id));

    if (currentRole === 'teacher') {
      const events = await getTeacherEventAttendance(user.id);
      setTeacherEvents(events);
      setStudentRecords([]);
    } else {
      const records = await getAttendanceHistory(user.id);
      setStudentRecords(records);
      setTeacherEvents([]);
    }

    setLoading(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Attendance History</Text>
        <View style={styles.swash} />
        <Text style={styles.subtitle}>Loading records...</Text>
      </View>
    );
  }

  const switcher = (
    <HistorySwitch
      tab={tab ?? 'attendance'}
      onChange={setTab}
      items={
        role === 'teacher'
          ? [
              { key: 'other', label: 'My Events' },
              { key: 'attendance', label: 'My Attendance' },
            ]
          : [
              { key: 'attendance', label: 'My Attendance' },
              { key: 'other', label: 'Scanned Events' },
            ]
      }
    />
  );

  if (tab === 'attendance') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>My Attendance</Text>
        <View style={styles.swash} />
        {switcher}
        <MyAttendanceList records={sessionRecords} />
      </View>
    );
  }

  if (role === 'teacher') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>My Events</Text>
        <View style={styles.swash} />
        {switcher}
        {teacherEvents.length === 0 ? (
          <Text style={styles.subtitle}>
            No events yet. Create an event in the Teacher tab.
          </Text>
        ) : (
          <FlatList
            data={teacherEvents}
            keyExtractor={(item) => item.eventId}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <View style={styles.cardHeaderText}>
                    <Text style={styles.eventTitle}>{item.title}</Text>
                    <Text style={styles.eventCode}>{item.eventCode}</Text>
                  </View>
                  <View style={styles.countBadge}>
                    <Text style={styles.countBadgeText}>{item.attendeeCount}</Text>
                  </View>
                </View>

                {item.startTime && (
                  <Text style={styles.eventMeta}>{formatDate(item.startTime)}</Text>
                )}

                {item.attendees.length === 0 ? (
                  <Text style={styles.eventMeta}>No attendance recorded yet.</Text>
                ) : (
                  item.attendees.map((a) => (
                    <View key={a.studentId} style={styles.attendeeRow}>
                      <Text style={styles.attendeeName}>
                        {a.studentName || shortId(a.studentId)}
                      </Text>
                      <Text style={styles.attendeeTime}>{formatDate(a.scannedAt)}</Text>
                    </View>
                  ))
                )}
              </View>
            )}
          />
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Attendance History</Text>
      <View style={styles.swash} />
      {switcher}
      {studentRecords.length === 0 ? (
        <Text style={styles.subtitle}>
          No records yet. Scan a QR code to register your attendance.
        </Text>
      ) : (
        <FlatList
          data={studentRecords}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.eventTitle}>{item.eventTitle}</Text>
              <Text style={styles.eventMeta}>{item.eventId}</Text>
              <Text style={styles.eventMeta}>{formatDate(item.scannedAt)}</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString();
}

function shortId(id: string) {
  return id ? `…${id.slice(-8)}` : 'unknown';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 16,
  },
  swash: {
    width: 48,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: COLORS.primary,
    marginTop: 6,
    marginBottom: 14,
    opacity: 0.85,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginTop: 32,
  },
  list: {
    paddingBottom: 24,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 12,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardHeaderText: {
    flex: 1,
    marginRight: 8,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  eventCode: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  countBadge: {
    minWidth: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLORS.sketchLine,
    backgroundColor: COLORS.success,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    transform: [{ rotate: '-6deg' }],
  },
  countBadgeText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textOnPrimary,
  },
  eventMeta: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  attendeeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginTop: 6,
    borderRadius: 8,
    backgroundColor: COLORS.surface,
  },
  attendeeName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.textPrimary,
  },
  attendeeTime: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
});
