import React from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { colors, radius, space } from '../theme';

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function Chip({
  label,
  selected,
  onPress,
  color = colors.accent,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  color?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.chip,
        selected && { backgroundColor: color, borderColor: color },
        pressed && { opacity: 0.7 },
      ]}
    >
      <Text style={[styles.chipText, selected && { color: colors.bg }]}>{label}</Text>
    </Pressable>
  );
}

export function ChipRow({
  options,
  value,
  onChange,
  colorFor,
}: {
  options: readonly string[];
  value: string;
  onChange: (v: string) => void;
  colorFor?: (v: string) => string;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipRow}
    >
      {options.map((o) => (
        <Chip
          key={o}
          label={o}
          selected={o === value}
          onPress={() => onChange(o)}
          color={colorFor?.(o)}
        />
      ))}
    </ScrollView>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((o) => {
        const sel = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: sel }}
            style={[styles.segment, sel && styles.segmentSelected]}
          >
            <Text style={[styles.segmentText, sel && styles.segmentTextSelected]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Field({
  label,
  labelRight,
  error,
  hint,
  ...props
}: TextInputProps & {
  label: string;
  labelRight?: React.ReactNode;
  error?: string;
  hint?: string;
}) {
  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {labelRight}
      </View>
      <TextInput
        placeholderTextColor={colors.textFaint}
        {...props}
        style={[styles.input, error ? { borderColor: colors.loss } : null, props.style]}
      />
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  style,
  disabled,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}) {
  const bg =
    variant === 'primary'
      ? colors.accent
      : variant === 'danger'
        ? 'transparent'
        : colors.surfaceAlt;
  const fg = variant === 'primary' ? colors.bg : variant === 'danger' ? colors.loss : colors.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg },
        variant === 'danger' && { borderWidth: 1, borderColor: colors.loss },
        (pressed || disabled) && { opacity: 0.6 },
        style,
      ]}
    >
      <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>
    </Pressable>
  );
}

/** Cross-platform confirm dialog (Alert.alert is a no-op on web). */
export function confirm(
  title: string,
  message: string,
  onConfirm: () => void,
  confirmLabel = 'Delete',
) {
  if (Platform.OS === 'web') {
    if (globalThis.confirm?.(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
}

export function notify(title: string, message: string) {
  if (Platform.OS === 'web') globalThis.alert?.(`${title}\n\n${message}`);
  else Alert.alert(title, message);
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: space.lg,
  },
  sectionTitle: {
    color: colors.sky,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: space.xl,
    marginBottom: space.sm,
  },
  chipRow: { gap: space.sm, paddingVertical: 2 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  segment: { flex: 1, paddingVertical: 8, borderRadius: radius.sm, alignItems: 'center' },
  segmentSelected: { backgroundColor: colors.brand },
  segmentText: { color: colors.textDim, fontWeight: '600', fontSize: 13 },
  segmentTextSelected: { color: colors.bg, fontWeight: '800' },
  field: { marginBottom: space.lg },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 22,
    marginBottom: 6,
  },
  label: { color: colors.textDim, fontSize: 13, fontWeight: '600' },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 16,
  },
  error: { color: colors.loss, fontSize: 12, marginTop: 4 },
  hint: { color: colors.textFaint, fontSize: 12, marginTop: 4 },
  button: {
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontSize: 16, fontWeight: '700' },
});
