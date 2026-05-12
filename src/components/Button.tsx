import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { theme } from '../lib/theme';

interface Props {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

export function Button({ title, onPress, variant = 'primary', loading, disabled, style }: Props) {
  const palette =
    variant === 'primary'
      ? { bg: theme.text, fg: theme.bg }
      : variant === 'danger'
        ? { bg: theme.bad, fg: '#fff' }
        : variant === 'ghost'
          ? { bg: 'transparent', fg: theme.text, border: theme.border }
          : { bg: theme.surfaceAlt, fg: theme.text };

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        {
          backgroundColor: palette.bg,
          borderColor: (palette as { border?: string }).border ?? 'transparent',
          opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <Text style={[styles.txt, { color: palette.fg }]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    height: 48,
    paddingHorizontal: 20,
    borderRadius: theme.radius,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txt: { fontSize: 16, fontWeight: '600' },
});
