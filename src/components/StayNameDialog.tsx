import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import { Dialog, TextInput } from './ui';
import { colors } from '../theme';
import { renameStay } from '../services/stayNameService';
import type { Stay } from '../types';

/** Asks for a name for one stay and saves it. `stay` null keeps the dialog closed. */
export function StayNameDialog({ stay, currentName, onClose, onSaved }: {
  stay: Stay | null;
  currentName?: string;
  onClose: () => void;
  onSaved: (name: string) => void;
}) {
  return stay ? (
    // Keyed by stay so the input starts from that stay's name each time it opens.
    <Inner key={stay.id} stay={stay} currentName={currentName} onClose={onClose} onSaved={onSaved} />
  ) : null;
}

function Inner({ stay, currentName, onClose, onSaved }: {
  stay: Stay;
  currentName?: string;
  onClose: () => void;
  onSaved: (name: string) => void;
}) {
  const [name, setName] = useState(currentName ?? '');
  const [saving, setSaving] = useState(false);
  const trimmed = name.trim();

  async function save() {
    if (!trimmed) return;
    setSaving(true);
    await renameStay(stay, trimmed);
    setSaving(false);
    onSaved(trimmed);
    onClose();
  }

  return (
    <Dialog
      visible
      title="머문 곳 이름"
      message="이 기록에만 적용돼요. 처음 이름을 붙인 곳은 다음 방문 때 기본 이름으로 쓰여요."
      cancelLabel="취소"
      confirmLabel="저장"
      onCancel={onClose}
      onConfirm={save}
      confirmDisabled={!trimmed}
      loading={saving}
    >
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="예: 회사, 단골 카페"
        placeholderTextColor="#9AA3B0"
        maxLength={30}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={save}
        accessibilityLabel="머문 곳 이름"
      />
    </Dialog>
  );
}

const styles = StyleSheet.create({
  input: {
    marginTop: 16, minHeight: 48, borderWidth: 1, borderColor: '#DEE3ED', borderRadius: 11,
    backgroundColor: colors.card, paddingHorizontal: 13, fontSize: 16, color: colors.ink,
  },
});
