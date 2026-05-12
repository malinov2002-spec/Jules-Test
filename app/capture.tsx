import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../src/components/Button';
import { BusinessTag } from '../src/components/BusinessTag';
import { CoachThread } from '../src/components/CoachThread';
import { Screen } from '../src/components/Screen';
import { createTask } from '../src/lib/db';
import { BUSINESSES, Business } from '../src/lib/types';
import { theme } from '../src/lib/theme';

export default function CaptureScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<'quick' | 'coach'>('quick');
  const [description, setDescription] = useState('');
  const [business, setBusiness] = useState<Business | null>(null);
  const [deadline, setDeadline] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!description.trim()) return;
    if (!business) {
      Alert.alert('Pick a business', 'Tag it: Geo, NestLink, Crownstone, or Personal.');
      return;
    }
    setSaving(true);
    try {
      await createTask({
        description: description.trim(),
        business,
        deadline: deadline.trim() || null,
        source: 'mobile_quick_capture',
      });
      setDescription('');
      setBusiness(null);
      setDeadline('');
      router.back();
    } catch (e) {
      Alert.alert('Save failed', (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (mode === 'coach') {
    return (
      <CoachThread
        thread={`capture:${Date.now()}`}
        skill="quick_capture"
        greeting="What you got? Brain dump everything — I'll sort it."
      />
    );
  }

  return (
    <Screen title="Quick capture" subtitle="Type the task, tag it, hit save. That's it.">
      <View style={styles.modeRow}>
        <Pressable
          onPress={() => setMode('quick')}
          style={[styles.modeBtn, mode === 'quick' && styles.modeBtnActive]}
        >
          <Text style={[styles.modeText, mode === 'quick' && styles.modeTextActive]}>Form</Text>
        </Pressable>
        <Pressable
          onPress={() => setMode('coach')}
          style={[styles.modeBtn, (mode as string) === 'coach' && styles.modeBtnActive]}
        >
          <Text style={[styles.modeText, (mode as string) === 'coach' && styles.modeTextActive]}>
            Talk to coach
          </Text>
        </Pressable>
      </View>

      <TextInput
        value={description}
        onChangeText={setDescription}
        placeholder="e.g. File Q2 IFTA for trucks 1047 + 1048"
        placeholderTextColor={theme.textFaint}
        style={styles.input}
        multiline
        autoFocus
      />

      <Text style={styles.label}>Business</Text>
      <View style={styles.bizRow}>
        {BUSINESSES.map((b) => (
          <Pressable key={b.value} onPress={() => setBusiness(b.value)}>
            <View style={[styles.bizChip, business === b.value && styles.bizChipActive]}>
              <BusinessTag business={b.value} />
            </View>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Deadline (optional, YYYY-MM-DD)</Text>
      <TextInput
        value={deadline}
        onChangeText={setDeadline}
        placeholder="2026-05-15"
        placeholderTextColor={theme.textFaint}
        style={styles.inputSmall}
        autoCapitalize="none"
      />

      <Button title="Save task" onPress={save} loading={saving} style={{ marginTop: 24 }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  modeRow: {
    flexDirection: 'row',
    backgroundColor: theme.surface,
    borderRadius: theme.radius,
    padding: 4,
    marginBottom: 16,
  },
  modeBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  modeBtnActive: { backgroundColor: theme.surfaceAlt },
  modeText: { color: theme.textDim, fontWeight: '600' },
  modeTextActive: { color: theme.text },
  input: {
    backgroundColor: theme.surface,
    color: theme.text,
    borderRadius: theme.radius,
    padding: 14,
    minHeight: 80,
    borderWidth: 1,
    borderColor: theme.border,
    fontSize: 16,
  },
  inputSmall: {
    backgroundColor: theme.surface,
    color: theme.text,
    borderRadius: theme.radius,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.border,
    fontSize: 15,
  },
  label: {
    color: theme.textDim,
    marginTop: 16,
    marginBottom: 8,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  bizRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  bizChip: {
    padding: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  bizChipActive: { borderColor: theme.text },
});
