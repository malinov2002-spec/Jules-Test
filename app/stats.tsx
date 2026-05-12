import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '../src/components/Screen';
import { getThisWeekStats } from '../src/lib/db';
import { theme } from '../src/lib/theme';

interface Stats {
  kickoffs: number;
  shutdowns: number;
  mitsCompleted: number;
  mitsTotal: number;
  tasksDone: number;
  tasksDropped: number;
  avgMorningEnergy: number | null;
}

export default function StatsScreen() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    getThisWeekStats().then(setStats).catch(console.warn);
  }, []);

  if (!stats)
    return (
      <Screen title="How am I doing?">
        <Text style={{ color: theme.textDim }}>Crunching the last 7 days…</Text>
      </Screen>
    );

  const mitsRate =
    stats.mitsTotal > 0 ? Math.round((stats.mitsCompleted / stats.mitsTotal) * 100) : null;

  return (
    <Screen
      title="How am I doing?"
      subtitle="Last 7 days. Data over feelings. No judgment, just signal."
    >
      <Tile
        label="Mornings shown up"
        value={`${stats.kickoffs} / 7`}
        hint={stats.kickoffs >= 5 ? 'Solid.' : stats.kickoffs >= 3 ? 'Decent.' : 'Light week.'}
      />
      <Tile
        label="Evenings closed out"
        value={`${stats.shutdowns} / 7`}
        hint={
          stats.shutdowns >= 4
            ? 'You closed the loop most days.'
            : 'Open loops at night = next-morning fog.'
        }
      />
      <Tile
        label="MIT completion"
        value={mitsRate !== null ? `${mitsRate}%` : '—'}
        hint={
          mitsRate === null
            ? 'No MITs set this week.'
            : mitsRate >= 70
              ? 'Real work moved.'
              : mitsRate >= 40
                ? 'Mixed week.'
                : 'MITs not landing — too many or too big?'
        }
      />
      <Tile
        label="Tasks done"
        value={String(stats.tasksDone)}
        hint={
          stats.tasksDropped > 0
            ? `(${stats.tasksDropped} dropped — that's fine, often the right call)`
            : 'Steady.'
        }
      />
      <Tile
        label="Avg morning energy"
        value={stats.avgMorningEnergy !== null ? `${stats.avgMorningEnergy} / 10` : '—'}
        hint={
          stats.avgMorningEnergy === null
            ? ''
            : stats.avgMorningEnergy >= 7
              ? 'You ran hot this week.'
              : stats.avgMorningEnergy >= 5
                ? 'Average week.'
                : 'Energy was low — what was going on?'
        }
      />

      <Text style={styles.callout}>
        Phase 1 is silent observation. The coach is logging your patterns — energy at decision
        time, tasks you push more than 3 times, late-night commitments — but won't surface them
        until you've got 30 days of data. Until then: just keep showing up.
      </Text>
    </Screen>
  );
}

function Tile({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={styles.tileValue}>{value}</Text>
      {hint ? <Text style={styles.tileHint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    backgroundColor: theme.surface,
    padding: 16,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: 10,
  },
  tileLabel: {
    color: theme.textDim,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  tileValue: { color: theme.text, fontSize: 28, fontWeight: '700', marginTop: 4 },
  tileHint: { color: theme.textDim, fontSize: 13, marginTop: 6 },
  callout: {
    color: theme.textDim,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 16,
    padding: 14,
    backgroundColor: theme.surfaceAlt,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.border,
  },
});
