import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BusinessTag } from '../../src/components/BusinessTag';
import { TaskRow } from '../../src/components/TaskRow';
import {
  deleteTask,
  listOpenTasks,
  updateTaskStatus,
} from '../../src/lib/db';
import {
  getDefaultListId,
  pullGoogleCompletions,
  pushTaskToGoogle,
} from '../../src/lib/googleTasks';
import { theme } from '../../src/lib/theme';
import { Business, BUSINESSES, Task } from '../../src/lib/types';

export default function TasksScreen() {
  const params = useLocalSearchParams<{ business?: string }>();
  const router = useRouter();
  const [filter, setFilter] = useState<Business | 'all'>(
    (params.business as Business | undefined) ?? 'all',
  );
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  async function load() {
    setLoading(true);
    const data = await listOpenTasks(filter === 'all' ? undefined : filter);
    setTasks(data);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, [filter]);

  async function toggleDone(task: Task) {
    try {
      await updateTaskStatus(task.id, task.status === 'done' ? 'open' : 'done');
      const listId = await getDefaultListId();
      if (listId && task.google_task_id) {
        // Fire-and-forget Google sync; never block UI on it.
        void pushTaskToGoogle({ ...task, status: task.status === 'done' ? 'open' : 'done' }, listId);
      }
      await load();
    } catch (e) {
      Alert.alert('Update failed', (e as Error).message);
    }
  }

  async function sync() {
    setSyncing(true);
    try {
      const listId = await getDefaultListId();
      if (!listId) {
        Alert.alert('Google Tasks not configured', 'Open Settings to connect Google Tasks.');
        return;
      }
      // Push every open task that's not yet synced.
      for (const t of tasks) {
        if (!t.google_task_id) {
          await pushTaskToGoogle(t, listId);
        }
      }
      const pulled = await pullGoogleCompletions(listId);
      Alert.alert('Synced', `Pulled ${pulled} completion(s) back from Google.`);
      await load();
    } catch (e) {
      Alert.alert('Sync failed', (e as Error).message);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        <Text style={styles.title}>Tasks</Text>
        <Pressable onPress={sync} disabled={syncing}>
          <Text style={[styles.sync, syncing && { opacity: 0.4 }]}>
            {syncing ? '…' : 'Sync'}
          </Text>
        </Pressable>
      </View>

      <View style={styles.filterRow}>
        <FilterChip label="All" active={filter === 'all'} onPress={() => setFilter('all')} />
        {BUSINESSES.map((b) => (
          <Pressable
            key={b.value}
            onPress={() => setFilter(b.value)}
            style={[styles.chip, filter === b.value && styles.chipActive]}
          >
            <BusinessTag business={b.value} short />
          </Pressable>
        ))}
      </View>

      <FlatList
        data={tasks}
        keyExtractor={(t) => t.id}
        renderItem={({ item }) => (
          <TaskRow
            task={item}
            onToggleDone={() => toggleDone(item)}
            onPress={() => promptTaskActions(item, load)}
          />
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {loading ? 'Loading…' : 'No open tasks here. Capture something or run a kickoff.'}
          </Text>
        }
      />

      <Pressable style={styles.fab} onPress={() => router.push('/capture')}>
        <Text style={styles.fabText}>+ Capture</Text>
      </Pressable>
    </SafeAreaView>
  );
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={{ color: active ? theme.text : theme.textDim, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

function promptTaskActions(task: Task, reload: () => Promise<void>) {
  Alert.alert(task.description, undefined, [
    { text: 'Done', onPress: async () => { await updateTaskStatus(task.id, 'done'); await reload(); } },
    { text: 'Push to later', onPress: async () => { await updateTaskStatus(task.id, 'pushed'); await reload(); } },
    {
      text: 'Drop',
      style: 'destructive',
      onPress: async () => { await updateTaskStatus(task.id, 'dropped'); await reload(); },
    },
    {
      text: 'Delete',
      style: 'destructive',
      onPress: async () => { await deleteTask(task.id); await reload(); },
    },
    { text: 'Cancel', style: 'cancel' },
  ]);
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.pad,
    paddingVertical: 8,
  },
  back: { color: theme.textDim, fontSize: 16 },
  title: { color: theme.text, fontSize: 18, fontWeight: '700' },
  sync: { color: theme.text, fontSize: 14, fontWeight: '600' },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: theme.pad,
    paddingVertical: 8,
    flexWrap: 'wrap',
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.border,
  },
  chipActive: { borderColor: theme.text },
  empty: { color: theme.textFaint, padding: theme.pad, fontStyle: 'italic' },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 30,
    backgroundColor: theme.text,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 999,
  },
  fabText: { color: theme.bg, fontWeight: '700' },
});
