import { router } from 'expo-router';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';

import AppButton from '@/components/AppButton';
import Header from '@/components/Header';
import { COLORS } from '@/constants/colors';

export default function Index() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerContainer}>
        <Header title="QR Attendance" />
        <Text style={styles.credit}> Developed by: Dominique Louis D. Schwartz</Text>
      </View>

      <View style={styles.bodyContainer}>
        <View style={styles.heroSticker}>
          <Text style={styles.mainTitle}>School Event Attendance</Text>
          <View style={styles.swash} />
          <Text style={styles.subtitle}>
            Scan QR Codes to record attendance during school activities.
          </Text>
        </View>
      </View>

      <View style={styles.footerContainer}>
        <AppButton
          theme="primary"
          title="Scan QR Code"
          icon="qr-code-outline"
          onPress={() => router.push('/scan')}
        />
        <AppButton
          title="Attendance History"
          icon="time-outline"
          onPress={() => router.push('/history')}
        />
        <AppButton
          title="Profile"
          icon="person-outline"
          onPress={() => router.push('/profile')}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  headerContainer: { flex: 1, justifyContent: 'center' },
  bodyContainer: { paddingHorizontal: 32, marginBottom: 24 },
  heroSticker: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLORS.sketchLine,
    borderRadius: 14,
    padding: 18,
    transform: [{ rotate: '-1deg' }],
  },
  credit: { color: COLORS.primarySoft, fontWeight: '700', letterSpacing: 0.5, textAlign: 'center' },
  mainTitle: { fontSize: 22, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 8 },
  swash: {
    width: 56,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.primary,
    marginTop: 4,
    marginBottom: 8,
    opacity: 0.85,
  },
  subtitle: { fontSize: 15, color: COLORS.textSecondary, lineHeight: 21 },
  footerContainer: { flex: 1 / 3, alignItems: 'center', paddingHorizontal: 24, width: '100%' },
});
