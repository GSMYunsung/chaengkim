import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Checkbox, ItemIcon, Text } from './ui';
import { colors, type } from '../theme';
import { itemIcon } from '../utils/itemIcon';
import type { Item } from '../types';

export function ChecklistGroup({ children }: { children: React.ReactNode }) {
  return <View style={styles.group}>{children}</View>;
}

export function ChecklistRow({ item, checked, note, onToggle, recover }: {
  item: Item;
  checked: boolean;
  note: string;
  onToggle: () => void;
  recover?: () => void;
}) {
  return (
    <View style={[styles.card, checked && styles.cardOn]}>
      <Pressable
        style={({ pressed }) => [styles.row, pressed && { opacity: 0.75 }]}
        onPress={onToggle}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={item.name}
      >
        <ItemIcon name={itemIcon(item.name)} tone={checked ? 'active' : 'muted'} />
        <View style={{ flex: 1 }}>
          <Text style={type.rowName}>{item.name}</Text>
          <Text style={[type.small, { marginTop: 3 }]}>{note}</Text>
        </View>
        <Checkbox checked={checked} />
      </Pressable>
      {recover && !checked && (
        <Pressable style={styles.recover} onPress={recover} hitSlop={6} accessibilityRole="button">
          <Text style={styles.recoverText}>돌아가서 챙겼어요</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 9 },
  card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 14 },
  cardOn: { backgroundColor: colors.checkedBg, borderColor: colors.checkedBorder },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 76, padding: 13 },
  recover: { marginLeft: 65, marginTop: -6, marginBottom: 10, alignSelf: 'flex-start', paddingVertical: 5 },
  recoverText: { fontSize: 12, fontWeight: '600', color: colors.blue },
});
