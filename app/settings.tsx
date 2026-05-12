import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '../src/components/Button';
import { Screen } from '../src/components/Screen';
import {
  cancelDailyRituals,
  getScheduledRituals,
  scheduleDailyRituals,
  testNotificationNow,
} from '../src/lib/notifications';
import {
  GoogleTokens,
  clearTokens,
  loadTokens,
  useGoogleAuth,
} from '../src/lib/googleAuth';
import {
  getDefaultListId,
  listTaskLists,
  setDefaultListId,
} from '../src/lib/googleTasks';
import { theme } from '../src/lib/theme';
import { env } from '../src/lib/env';

export default function SettingsScreen() {
  const [tokens, setTokens] = useState<GoogleTokens | null>(null);
  const [taskLists, setTaskLists] = useState<{ id: string; title: string }[]>([]);
  const [defaultList, setDefaultList] = useState<string | null>(null);
  const [scheduled, setScheduled] = useState<{ kickoff?: string; shutdown?: string }>({});

  async function refresh() {
    setTokens(await loadTokens());
    setDefaultList(await getDefaultListId());
    setScheduled(await getScheduledRituals());
  }

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    if (!tokens) return;
    listTaskLists()
      .then(setTaskLists)
      .catch((e) => Alert.alert('Google Tasks error', (e as Error).message));
  }, [tokens]);

  const { signIn, ready } = useGoogleAuth(async () => {
    await refresh();
  });

  return (
    <Screen title="Settings" subtitle="One-time setup. Update env vars to change keys.">
      <Text style={styles.section}>Connection check</Text>
      <Row label="Supabase URL" value={env.supabaseUrl.replace(/^https?:\/\//, '').slice(0, 32) + '…'} />
      <Row label="Anthropic key" value={env.anthropicApiKey.slice(0, 12) + '…'} />
      <Row label="User ID" value={env.userId.slice(0, 8) + '…'} />

      <Text style={styles.section}>Google Tasks sync</Text>
      {tokens ? (
        <>
          <Row label="Status" value="Connected" valueColor={theme.good} />
          {taskLists.length > 0 ? (
            <View style={{ marginVertical: 8 }}>
              <Text style={styles.subLabel}>Default list</Text>
              {taskLists.map((l) => (
                <Pressable
                  key={l.id}
                  onPress={async () => {
                    await setDefaultListId(l.id);
                    setDefaultList(l.id);
                  }}
                  style={[styles.listRow, defaultList === l.id && styles.listRowActive]}
                >
                  <Text style={styles.listText}>{l.title}</Text>
                  {defaultList === l.id ? <Text style={styles.listCheck}>✓</Text> : null}
                </Pressable>
              ))}
            </View>
          ) : null}
          <Button
            title="Disconnect Google"
            variant="ghost"
            onPress={async () => {
              await clearTokens();
              await refresh();
            }}
            style={{ marginTop: 12 }}
          />
        </>
      ) : (
        <>
          <Row label="Status" value="Not connected" valueColor={theme.warn} />
          <Button
            title={ready ? 'Connect Google Tasks' : 'Loading…'}
            onPress={() => signIn()}
            disabled={!ready}
            style={{ marginTop: 12 }}
          />
        </>
      )}

      <Text style={styles.section}>Daily rituals</Text>
      <Row label="Morning kickoff" value={scheduled.kickoff ?? 'not scheduled'} />
      <Row label="Evening shutdown" value={scheduled.shutdown ?? 'not scheduled'} />
      <View style={styles.btnRow}>
        <Button
          title="Reschedule"
          variant="secondary"
          onPress={async () => {
            await scheduleDailyRituals(true);
            await refresh();
            Alert.alert('Done', '7 AM kickoff and 8 PM shutdown scheduled.');
          }}
        />
        <Button
          title="Test now"
          variant="ghost"
          onPress={async () => {
            await testNotificationNow();
            Alert.alert('Sent', 'You should get a test notification within ~5 seconds.');
          }}
        />
        <Button
          title="Cancel"
          variant="ghost"
          onPress={async () => {
            await cancelDailyRituals();
            await refresh();
          }}
        />
      </View>

      <Text style={styles.section}>Data</Text>
      <Text style={styles.note}>
        All tasks, MITs, check-ins, decisions and chat history live in Supabase. View them via the
        Supabase dashboard or query the `tasks`, `check_ins`, `coach_messages` tables directly.
      </Text>
    </Screen>
  );
}

function Row({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, valueColor ? { color: valueColor } : null]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    color: theme.textDim,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 24,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  rowLabel: { color: theme.text },
  rowValue: { color: theme.textDim, fontSize: 13 },
  subLabel: { color: theme.textDim, fontSize: 12, marginBottom: 6, marginTop: 8 },
  listRow: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  listRowActive: { borderColor: theme.text },
  listText: { color: theme.text },
  listCheck: { color: theme.good, fontWeight: '700' },
  btnRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  note: { color: theme.textDim, fontSize: 13, lineHeight: 19 },
});
