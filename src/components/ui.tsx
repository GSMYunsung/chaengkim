import React from 'react';
import {
  View, Text as RNText, TextInput as RNTextInput, StyleSheet, Pressable, ScrollView, ActivityIndicator, Modal,
  KeyboardAvoidingView, Platform,
  type StyleProp, type ViewStyle, type TextProps, type TextInputProps,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { Lucide, type LucideIconName } from '@react-native-vector-icons/lucide';
import { colors, font, radius, space, type } from '../theme';
import { Mascot, type MascotPose } from './Mascot';

export { Lucide as Icon };
export type { LucideIconName as IconName };

/** App text: every Text/TextInput goes through these so the brand font applies everywhere. */
export function Text({ style, ...props }: TextProps) {
  return <RNText {...props} style={[styles.font, style]} />;
}

export function TextInput({ style, ...props }: TextInputProps) {
  return <RNTextInput {...props} style={[styles.font, style]} />;
}

export function Screen({ children, edges = ['bottom'], header, scroll = true }: {
  children: React.ReactNode;
  edges?: Edge[];
  header?: React.ReactNode;
  scroll?: boolean;
}) {
  return (
    <SafeAreaView style={styles.safe} edges={edges}>
      {header}
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          // Number pads have no return key; dragging the page is how the keyboard goes away.
          keyboardDismissMode="on-drag"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, { flex: 1 }]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function TabHeader({ title, right }: { title: React.ReactNode; right?: React.ReactNode }) {
  return (
    <View style={styles.tabHeader}>
      {typeof title === 'string'
        ? <Text style={styles.tabHeaderTitle} accessibilityRole="header">{title}</Text>
        : title}
      <View style={styles.tabHeaderRight}>{right}</View>
    </View>
  );
}

/** Primary action in a tab header, e.g. "＋ 추가". */
export function HeaderButton({ label, icon = 'plus', onPress }: {
  label: string;
  icon?: LucideIconName;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
    >
      <Lucide name={icon} size={17} color={colors.blue} />
      <Text style={styles.headerButtonText}>{label}</Text>
    </Pressable>
  );
}

export function Intro({ eyebrow, title, subtitle, mascot }: {
  eyebrow?: string;
  /** Omit on tab screens, where the tab header already is the big title. */
  title?: React.ReactNode;
  subtitle?: string;
  /** Mascot pose shown beside the title for moments with a feeling (greeting, done, empty, alert). */
  mascot?: MascotPose;
}) {
  const text = (
    <>
      {!!eyebrow && <Text style={styles.eyebrow}>{eyebrow}</Text>}
      {title !== undefined && <Text style={type.title}>{title}</Text>}
      {!!subtitle && <Text style={[type.body, title !== undefined && { marginTop: 8 }]}>{subtitle}</Text>}
    </>
  );
  if (!mascot) return <View style={styles.intro}>{text}</View>;
  return (
    <View style={[styles.intro, styles.introRow]}>
      <View style={{ flex: 1 }}>{text}</View>
      <Mascot pose={mascot} size={104} />
    </View>
  );
}

/** Blue emphasis for a word inside a title, e.g. <Intro title={<>오늘도 <Em>빠짐없이</Em></>} />. */
export function Em({ children }: { children: React.ReactNode }) {
  return <Text style={{ color: colors.blue }}>{children}</Text>;
}

export function SectionHeader({ title, right, first }: {
  title: string;
  right?: React.ReactNode;
  first?: boolean;
}) {
  return (
    <View style={[styles.section, first && { marginTop: 0 }]}>
      <Text style={type.heading}>{title}</Text>
      {right}
    </View>
  );
}

export function Group({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const rows = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={[styles.group, style]}>
      {rows.map((child, i) => (
        <View key={i} style={i > 0 && styles.separator}>{child}</View>
      ))}
    </View>
  );
}

export function Row({ icon, iconStyle = 'plain', title, subtitle, right, onPress, chevron }: {
  icon?: LucideIconName;
  iconStyle?: 'plain' | 'tile' | 'tileActive';
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  chevron?: boolean;
}) {
  const body = (
    <>
      {icon && (iconStyle === 'plain'
        ? <Lucide name={icon} size={21} color={colors.ink} />
        : <ItemIcon name={icon} tone={iconStyle === 'tileActive' ? 'active' : 'tint'} />)}
      <View style={styles.rowText}>
        <Text style={type.rowName}>{title}</Text>
        {!!subtitle && <Text style={[type.small, { marginTop: 3 }]}>{subtitle}</Text>}
      </View>
      {right}
      {chevron && <Lucide name="chevron-right" size={20} color={colors.sub} />}
    </>
  );
  if (!onPress) return <View style={styles.row}>{body}</View>;
  return (
    <Pressable style={({ pressed }) => [styles.row, pressed && styles.pressed]} onPress={onPress}>
      {body}
    </Pressable>
  );
}

const ICON_TONES = {
  tint: { bg: colors.tint, fg: colors.blue },
  muted: { bg: colors.muted, fg: colors.sub },
  active: { bg: colors.tintStrong, fg: colors.blue },
  card: { bg: colors.card, fg: colors.blue },
};

export function ItemIcon({ name, tone = 'tint', small }: {
  name: LucideIconName;
  tone?: keyof typeof ICON_TONES;
  small?: boolean;
}) {
  const t = ICON_TONES[tone];
  return (
    <View style={[styles.itemIcon, small && styles.itemIconSmall, { backgroundColor: t.bg }]}>
      <Lucide name={name} size={small ? 18 : 21} color={t.fg} />
    </View>
  );
}

export function Checkbox({ checked }: { checked: boolean }) {
  return (
    <View style={[styles.checkbox, checked && styles.checkboxOn]}>
      {checked && <Lucide name="check" size={16} color={colors.onAction} />}
    </View>
  );
}

export function PrimaryButton({ label, onPress, disabled, loading, icon }: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: LucideIconName;
}) {
  const off = disabled || loading;
  return (
    <Pressable
      style={({ pressed }) => [styles.primary, off && !loading && styles.primaryDisabled, pressed && styles.pressed]}
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
    >
      {loading ? <ActivityIndicator color={colors.onAction} /> : (
        <>
          <Text style={[styles.primaryText, disabled && { color: colors.disabledText }]}>{label}</Text>
          {icon && <Lucide name={icon} size={19} color={disabled ? colors.disabledText : colors.onAction} />}
        </>
      )}
    </Pressable>
  );
}

export function SecondaryButton({ label, onPress, icon, disabled, onTint }: {
  label: string;
  onPress: () => void;
  icon?: LucideIconName;
  disabled?: boolean;
  /** White fill for buttons placed on a tinted card. */
  onTint?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.secondary, onTint && { backgroundColor: colors.card }, disabled && styles.disabled, pressed && styles.pressed]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
    >
      {icon && <Lucide name={icon} size={18} color={colors.blue} />}
      <Text style={styles.secondaryText}>{label}</Text>
    </Pressable>
  );
}

export function LinkButton({ label, onPress, icon }: { label: string; onPress: () => void; icon?: LucideIconName }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.link, pressed && styles.pressed]}
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
    >
      <Text style={styles.linkText}>{label}</Text>
      {icon && <Lucide name={icon} size={15} color={colors.blue} />}
    </Pressable>
  );
}

export function Actions({ children, note }: { children: React.ReactNode; note?: string }) {
  return (
    <View style={styles.actions}>
      {children}
      {!!note && <Text style={[type.small, { textAlign: 'center' }]}>{note}</Text>}
    </View>
  );
}

export function Strip({ icon, text, tone = 'info', action }: {
  icon: LucideIconName;
  text: string;
  tone?: 'info' | 'warn';
  action?: { label: string; onPress: () => void };
}) {
  const fg = tone === 'warn' ? colors.warn : colors.blue;
  return (
    <View style={[styles.strip, { backgroundColor: tone === 'warn' ? colors.wash : colors.tint }]}>
      <Lucide name={icon} size={17} color={fg} />
      <Text style={[styles.stripText, { color: fg }]}>{text}</Text>
      {action && (
        <Pressable onPress={action.onPress} hitSlop={8}>
          <Text style={[styles.stripText, styles.stripAction, { color: fg }]}>{action.label}</Text>
        </Pressable>
      )}
    </View>
  );
}

export function Counter({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.counter}>
      <Text style={styles.counterText} accessibilityLiveRegion="polite">{children}</Text>
    </View>
  );
}

export function Note({ children }: { children: React.ReactNode }) {
  return <Text style={[type.small, { marginTop: 12 }]}>{children}</Text>;
}

export function Pills<T extends string>({ options, value, onChange, columns = 2 }: {
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (v: T) => void;
  columns?: number;
}) {
  const basis = `${Math.floor(100 / columns) - 6}%` as const;
  return (
    <View style={styles.pills}>
      {options.map(o => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            style={[styles.pill, { flexBasis: basis }, on && styles.pillOn]}
            onPress={() => onChange(o.value)}
            accessibilityState={{ selected: on }}
          >
            <Text style={[styles.pillText, on && { color: colors.blue }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Centered confirmation dialog in the app's own style; use instead of Alert for in-app choices. */
export function Dialog({
  visible, icon, mascot, title, message, children, cancelLabel = '취소', confirmLabel, onCancel, onConfirm,
  confirmDisabled, loading,
}: {
  visible: boolean;
  icon?: LucideIconName;
  mascot?: MascotPose;
  title: string;
  message?: string;
  children?: React.ReactNode;
  cancelLabel?: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
  confirmDisabled?: boolean;
  loading?: boolean;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onCancel}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} accessibilityLabel="닫기" />
        <View style={styles.dialog} accessibilityViewIsModal>
          {mascot && <Mascot pose={mascot} size={96} style={styles.dialogMascot} />}
          {!mascot && icon && (
            <View style={styles.dialogIcon}>
              <Lucide name={icon} size={24} color={colors.warn} />
            </View>
          )}
          <Text style={[styles.dialogTitle, mascot && styles.centered]} accessibilityRole="header">{title}</Text>
          {!!message && <Text style={[type.body, { marginTop: 6 }, mascot && styles.centered]}>{message}</Text>}
          {children}
          <View style={styles.dialogActions}>
            <View style={{ flex: 1 }}>
              <SecondaryButton label={cancelLabel} onPress={onCancel} />
            </View>
            <View style={{ flex: 1 }}>
              <PrimaryButton label={confirmLabel} onPress={onConfirm} disabled={confirmDisabled} loading={loading} />
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function SuccessMark({ icon = 'check' }: { icon?: LucideIconName }) {
  return (
    <View style={styles.success}>
      <Lucide name={icon} size={31} color={colors.blue} />
    </View>
  );
}

const styles = StyleSheet.create({
  font: { fontFamily: font },
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: space.screen, paddingTop: 18, paddingBottom: 32 },
  tabHeader: {
    minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: space.screen, paddingTop: 6, gap: 10,
  },
  tabHeaderTitle: { fontSize: 28, lineHeight: 36, fontWeight: '800', letterSpacing: -1, color: colors.ink },
  headerButton: {
    flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 38, paddingLeft: 12, paddingRight: 14,
    borderRadius: 19, backgroundColor: colors.tint,
  },
  headerButtonText: { fontSize: 15, fontWeight: '700', color: colors.blue },
  tabHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  intro: { marginBottom: 25 },
  introRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eyebrow: { fontSize: 13, fontWeight: '600', color: colors.sub, marginBottom: 8, fontVariant: ['tabular-nums'] },
  section: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, marginBottom: 11 },
  group: { backgroundColor: colors.surface, borderRadius: radius.group, overflow: 'hidden' },
  separator: { borderTopWidth: 1, borderTopColor: colors.line },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 72, paddingVertical: 14, paddingHorizontal: 15 },
  rowText: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.42 },
  itemIcon: {
    width: 40, height: 40, borderRadius: radius.icon,
    alignItems: 'center', justifyContent: 'center',
  },
  itemIconSmall: { width: 32, height: 32, borderRadius: 10 },
  checkbox: {
    width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, borderColor: '#B9C0CE',
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card,
  },
  checkboxOn: { backgroundColor: colors.blue, borderColor: colors.blue },
  primary: {
    minHeight: 54, borderRadius: radius.button, backgroundColor: colors.blue,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, paddingHorizontal: 16,
  },
  primaryDisabled: { backgroundColor: colors.disabledBg },
  primaryText: { color: colors.onAction, fontSize: 16, fontWeight: '600' },
  secondary: {
    minHeight: 49, borderRadius: radius.button, backgroundColor: colors.tint,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 14,
  },
  secondaryText: { color: colors.blue, fontSize: 15, fontWeight: '600' },
  link: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 40 },
  linkText: { color: colors.blue, fontSize: 13, fontWeight: '600' },
  actions: { marginTop: 23, gap: 10 },
  strip: { flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 18 },
  stripText: { flex: 1, fontSize: 13, lineHeight: 19 },
  stripAction: { flex: 0, textDecorationLine: 'underline', fontWeight: '600' },
  counter: { backgroundColor: colors.tint, borderRadius: 8, paddingVertical: 4, paddingHorizontal: 9 },
  counterText: { fontSize: 13, fontWeight: '600', color: colors.blue, fontVariant: ['tabular-nums'] },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  pill: {
    flexGrow: 1, minHeight: 49, paddingHorizontal: 13, borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center',
  },
  pillOn: { backgroundColor: colors.tint, borderColor: colors.blue },
  pillText: { fontSize: 14, color: colors.ink },
  backdrop: {
    flex: 1, backgroundColor: 'rgba(35, 37, 41, 0.45)', justifyContent: 'center', paddingHorizontal: space.screen,
  },
  dialog: { backgroundColor: colors.card, borderRadius: 24, padding: 22 },
  dialogIcon: {
    width: 48, height: 48, borderRadius: 16, backgroundColor: colors.wash,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  centered: { textAlign: 'center' },
  dialogMascot: { alignSelf: 'center', marginBottom: 10 },
  dialogTitle: { fontSize: 19, lineHeight: 27, fontWeight: '700', letterSpacing: -0.5, color: colors.ink },
  dialogActions: { flexDirection: 'row', gap: 9, marginTop: 22 },
  success: {
    width: 62, height: 62, borderRadius: 22, backgroundColor: colors.tint,
    alignItems: 'center', justifyContent: 'center', marginTop: 11, marginBottom: 23,
  },
});
