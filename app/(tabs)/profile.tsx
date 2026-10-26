import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import AcademicPlacement from '@/components/AcademicPlacement';
import AppButton from '@/components/AppButton';
import { COLORS } from '@/constants/colors';
import { signOut, useAuth } from '@/lib/auth';
import { getMyQrToken, getProfile, updateProfile, type Profile } from '@/lib/profiles';
import { buildPersonalQRPayload } from '@/lib/qr';

export default function ProfileScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [nameHover, setNameHover] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!user) return;
    const p = await getProfile(user.id);
    setProfile(p);
    setDraftName(p?.full_name ?? '');
    setQrToken(await getMyQrToken(user.id));
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile])
  );

  const handleSaveName = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await updateProfile(user.id, { full_name: draftName.trim() });
    setSaving(false);
    if (error) {
      Alert.alert('Error', error);
    } else {
      setProfile((prev) => (prev ? { ...prev, full_name: draftName.trim() } : prev));
      setEditing(false);
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      router.replace('/login');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to sign out.');
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      <Text style={styles.title}>My Profile</Text>
      <View style={styles.swash} />

      {profile && (
        <View style={styles.infoCard}>
          {profile.role === 'admin' ? (
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>Admin</Text>
            </View>
          ) : profile.role === 'teacher' ? (
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>Teacher</Text>
            </View>
          ) : (
            <View style={[styles.roleBadge, styles.roleBadgeStudent]}>
              <Text style={[styles.roleBadgeText, styles.roleBadgeTextStudent]}>
                Student
              </Text>
            </View>
          )}

          <Text style={styles.label}>Name</Text>
          {editing ? (
            <View style={styles.nameEditRow}>
              <TextInput
                style={styles.input}
                value={draftName}
                onChangeText={setDraftName}
                placeholder="Your display name"
                placeholderTextColor={COLORS.textSecondary}
                editable={!saving}
              />
              <Pressable
                  style={({ pressed }) => [
                    styles.saveButton,
                    (pressed || nameHover) && styles.saveButtonPressed,
                  ]}
                  onPress={handleSaveName}
                  onHoverIn={() => setNameHover(true)}
                  onHoverOut={() => setNameHover(false)}
                >
                  <Text style={styles.saveButtonText}>Save</Text>
                </Pressable>
            </View>
          ) : (
            <Pressable
              style={({ pressed }) => [
                styles.nameRow,
                (pressed || nameHover) && styles.nameRowHover,
              ]}
              onPress={() => setEditing(true)}
              onHoverIn={() => setNameHover(true)}
              onHoverOut={() => setNameHover(false)}
            >
              <Text style={styles.value}>
                {profile.full_name || 'Tap to add your name'}
              </Text>
              <Text style={styles.editHint}>Edit</Text>
            </Pressable>
          )}

          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{profile.email}</Text>

          <Text style={styles.label}>User ID</Text>
          <Text style={styles.valueSmall}>{profile.id}</Text>
        </View>
      )}

      {profile && profile.role === 'student' && user && (
        <View style={styles.infoCard}>
          <Text style={styles.qrTitle}>My Grade / Course</Text>
          <AcademicPlacement userId={user.id} />
        </View>
      )}

      {profile && profile.role !== 'admin' && (
        <View style={styles.qrCard}>
          <Text style={styles.qrTitle}>My Attendance QR</Text>
          <Text style={styles.qrHint}>Show this to the Admin so they can scan you in.</Text>
          <View style={styles.qrBox}>
            {qrToken ? (
              <QRCode value={buildPersonalQRPayload(qrToken)} size={180} />
            ) : (
              <Text style={styles.qrHint}>QR code not available yet.</Text>
            )}
          </View>
        </View>
      )}

      <AppButton
        title="Sign Out"
        icon="log-out-outline"
        onPress={handleSignOut}
        disabled={signingOut}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40 },
  qrCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLORS.sketchLine,
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
    alignItems: 'center',
  },
  qrTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  qrHint: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4, marginBottom: 12, textAlign: 'center' },
  qrBox: { backgroundColor: '#FFFFFF', padding: 12, borderRadius: 10 },
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
  infoCard: {
    backgroundColor: COLORS.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 24,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLORS.sketchLine,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 12,
    transform: [{ rotate: '-4deg' }],
  },
  roleBadgeStudent: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.primary,
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textOnPrimary,
  },
  roleBadgeTextStudent: {
    color: COLORS.primary,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 4,
    marginTop: 8,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  nameRowHover: {
    backgroundColor: COLORS.surfaceSoft,
  },
  nameEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginLeft: 8,
  },
  saveButtonPressed: {
    backgroundColor: COLORS.primaryDeep,
    transform: [{ translateY: 1 }],
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textOnPrimary,
  },
  editHint: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  value: {
    fontSize: 15,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },
  valueSmall: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
});
