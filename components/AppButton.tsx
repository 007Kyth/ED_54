import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { COLORS, GLOW, GLOW_SOFT, IG_GRADIENT } from '@/constants/colors';

type Props = {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  theme?: 'primary';
  onPress: () => void;
  disabled?: boolean;
};

export default function AppButton({ title, icon, theme, onPress, disabled }: Props) {
  const [hovered, setHovered] = useState(false);
  const isPrimary = theme === 'primary';

  return (
    <Pressable
      style={({ pressed }) => {
        const active = pressed || hovered;
        return [
          styles.base,
          styles.button,
          isPrimary
            ? {
                backgroundColor: active ? COLORS.sketchLine : COLORS.primary,
                experimental_backgroundImage: IG_GRADIENT,
                borderColor: COLORS.primarySoft,
                boxShadow: active ? GLOW : GLOW_SOFT,
              }
            : {
                backgroundColor: active ? COLORS.surfaceSoft : COLORS.card,
                borderColor: hovered ? COLORS.primarySoft : COLORS.border,
                boxShadow: hovered ? GLOW : undefined,
              },
          active && styles.depressed,
        ];
      }}
      onPress={onPress}
      onPressIn={() => setHovered(true)}
      onPressOut={() => setHovered(false)}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      disabled={disabled}
    >
      {({ pressed }) => {
        const active = pressed || hovered;
        const iconColor = isPrimary
          ? (active ? COLORS.background : COLORS.textOnPrimary)
          : active ? COLORS.primarySoft : COLORS.textSecondary;
        const labelColor = isPrimary
          ? (active ? COLORS.background : COLORS.textOnPrimary)
          : active ? COLORS.primarySoft : COLORS.textPrimary;
        return (
          <>
            <Ionicons name={icon} size={22} color={iconColor} style={styles.icon} />
            <Text style={[styles.label, { fontWeight: isPrimary ? '700' : '600', color: labelColor }]}>
              {title}
            </Text>
          </>
        );
      }}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: '100%',
    marginBottom: 14,
  },
  button: {
    borderRadius: 999,
    borderWidth: 1,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  depressed: {
    transform: [{ translateY: 2 }],
  },
  icon: { paddingRight: 10 },
  label: { fontSize: 16, color: COLORS.textPrimary, letterSpacing: 1.2, textTransform: 'uppercase' },
});
