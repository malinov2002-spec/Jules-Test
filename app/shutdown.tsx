import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { CoachThread } from '../src/components/CoachThread';
import { Screen } from '../src/components/Screen';
import { listMITs, startCheckIn, todayCheckIn } from '../src/lib/db';
import { buildContextBlock } from '../src/coach/runner';
import { isoDate } from '../src/lib/types';
import { theme } from '../src/lib/theme';

export default function ShutdownScreen() {
  const [ready, setReady] = useState(false);
  const [context, setContext] = useState<string>('');

  useEffect(() => {
    (async () => {
      await startCheckIn('evening_shutdown');
      const [mits, kickoff] = await Promise.all([
        listMITs(),
        todayCheckIn('morning_kickoff'),
      ]);
      const ctx = buildContextBlock([
        `Morning intention: ${kickoff?.daily_intention ?? '(none recorded)'}`,
        `Morning energy: ${kickoff?.energy ?? '(none)'}/10`,
        `Today's MITs:`,
        ...mits.map(
          (m) =>
            `  - [${m.business}] ${m.task?.description ?? '(no task)'} ${
              m.completed ? '✓ done' : '○ open'
            }`,
        ),
      ]);
      setContext(ctx);
      setReady(true);
    })();
  }, []);

  if (!ready)
    return (
      <Screen title="Evening shutdown" subtitle="Loading today's plan…">
        <Text style={{ color: theme.textDim }}>One sec.</Text>
      </Screen>
    );

  return (
    <CoachThread
      thread={`shutdown:${isoDate()}`}
      skill="evening_shutdown"
      contextBuilder={() => context}
      greeting="Time to shut down. How did today actually go?"
    />
  );
}
