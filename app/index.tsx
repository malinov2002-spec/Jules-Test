import { Link, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { listMITs, todayCheckIn, listOpenTasks, markMITComplete } from '../src/lib/db';
import { theme } from '../src/lib/theme';
import { BUSINESSES, Business, isoDate, timeBucket } from '../src/lib/types';
import { BusinessTag } from '../src/components/BusinessTag';

interface MITRow {
  id: string;
  business: Business;
  description: string;
  completed: boolean;
}

export default function Home() {
  const router = useRouter();
  const [mits, setMits] = useState<MITRow[]>([]);
  const [openCounts, setOpenCounts] = useState<Record<Business, number>>({
    geo_logistics: 0,
    nestlink: 0,
    crownstone: 0,
    personal: 0,
  });
  const [kickoffDone, setKickoffDone] = useState(false);
  const [shutdownDone, setShutdownDone] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    try {
      const [mitsData, opens, ki, sd] = await Promise.all([
        listMITs(),
        listOpenTasks(),
        todayCheckIn('morning_kickoff'),
        todayCheckIn('evening_shutdown'),
      ]);
      setMits(
        mitsData.map((m) => ({
          id: m.id,
          business: m.business,
          description: m.task?.description ?? '(no task linked)',
          completed: m.completed,
        })),
      );
      const counts: Record<Business, number> = {
        geo_logistics: 0,
        nestlink: 0,
        crownstone: 0,
        personal: 0,
      };
      for (const t of opens) counts[t.business]++;
      setOpenCounts(counts);
      setKickoffDone(!!ki?.completed);
      setShutdownDone(!!sd?.completed);
    } catch (e) {
      console.warn('home load failed', e);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const greeting = (() => {
    const t = timeBucket();
    if (t === 'morning') return 'Morning.';
    if (t === 'midday') return 'Midday check.';
    if (t === 'evening') return 'Evening.';
    return 'Late.';
  })();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: theme.pad, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
            tintColor={theme.textDim}
          />
        }
      >
        <Text style={styles.greeting}>{greeting}</Text>
        <Text style={styles.date}>{isoDate()}</Text>

        <View style={styles.ritualRow}>
          <RitualCard
            label="Morning kickoff"
            done={kickoffDone}
            onPress={() => router.push('/kickoff')}
          />
          <RitualCard
            label="Evening shutdown"
            done={shutdownDone}
            onPress={() => router.push('/shutdown')}
          />
        </View>

        <Text style={styles.section}>Today's MITs</Text>
        {mits.length === 0 ? (
          <Text style={styles.empty}>
            No MITs yet — run morning kickoff to pick one per business.
          </Text>
        ) : (
          mits.map((m) => (
            <Pressable
              key={m.id}
              style={styles.mitRow}
              onPress={() => markMITComplete(m.id, !m.completed).then(load)}
            >
              <View style={[styles.check, m.completed && styles.checkDone]}>
                {m.completed ? <Text style={styles.checkMark}>✓</Text> : null}
              </View>
              <View style={{ flex: 1 }}>
                <BusinessTag business={m.business} short />
                <Text style={[styles.mitText, m.completed && styles.mitDone]}>{m.description}</Text>
              </View>
            </Pressable>
          ))
        )}

        <Text style={styles.section}>Open per business</Text>
        {BUSINESSES.map((b) => (
          <Link key={b.value} href={{ pathname: '/tasks', params: { business: b.value } }} asChild>
            <Pressable style={styles.bizRow}>
              <BusinessTag business={b.value} />
              <Text style={styles.bizCount}>{openCounts[b.value]} open</Text>
            </Pressable>
          </Link>
        ))}

        <View style={styles.actionsRow}>
          <ActionTile label="Capture" onPress={() => router.push('/capture')} />
          <ActionTile label="Coach" onPress={() => router.push('/chat')} />
          <ActionTile label="Tasks" onPress={() => router.push('/tasks')} />
          <ActionTile label="How am I doing?" onPress={() => router.push('/stats')} />
        </View>

        <Pressable style={styles.settingsLink} onPress={() => router.push('/settings')}>
          <Text style={styles.settingsText}>Settings</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function RitualCard({
  label,
  done,
  onPress,
}: {
  label: string;
  done: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.ritual, { opacity: pressed ? 0.7 : 1 }]}
    >
      <Text style={styles.ritualLabel}>{label}</Text>
      <Text style={[styles.ritualState, { color: done ? theme.good : theme.textDim }]}>
        {done ? 'done' : 'pending'}
      </Text>
    </Pressable>
  );
}

function ActionTile({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.tile, { opacity: pressed ? 0.7 : 1 }]}>
      <Text style={styles.tileText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.bg },
  greeting: { color: theme.text, fontSize: 32, fontWeight: '700' },
  date: { color: theme.textDim, marginTop: 4, marginBottom: 20 },
  ritualRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  ritual: {
    flex: 1,
    backgroundColor: theme.surface,
    borderRadius: theme.radius,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
  },
  ritualLabel: { color: theme.text, fontSize: 14, fontWeight: '600' },
  ritualState: { fontSize: 12, marginTop: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  section: {
    color: theme.textDim,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 8,
    marginBottom: 8,
  },
  empty: { color: theme.textFaint, fontStyle: 'italic', marginBottom: 16 },
  mitRow: {
    flexDirection: 'row',
    backgroundColor: theme.surface,
    borderRadius: theme.radius,
    padding: 14,
    alignItems: 'flex-start',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.border,
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: theme.textDim,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  checkDone: { backgroundColor: theme.good, borderColor: theme.good },
  checkMark: { color: theme.bg, fontWeight: '900' },
  mitText: { color: theme.text, fontSize: 16, marginTop: 6 },
  mitDone: { color: theme.textDim, textDecorationLine: 'line-through' },
  bizRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: theme.surface,
    borderRadius: theme.radius,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: theme.border,
  },
  bizCount: { color: theme.textDim, fontSize: 13 },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 24,
  },
  tile: {
    flexBasis: '48%',
    backgroundColor: theme.surfaceAlt,
    paddingVertical: 18,
    borderRadius: theme.radius,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.border,
  },
  tileText: { color: theme.text, fontSize: 15, fontWeight: '600' },
  settingsLink: { marginTop: 24, alignItems: 'center', padding: 12 },
  settingsText: { color: theme.textDim, fontSize: 13 },
});
