import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { CoachThread } from '../src/components/CoachThread';
import { Screen } from '../src/components/Screen';
import { listOpenTasks, listTasksCreatedOn, startCheckIn } from '../src/lib/db';
import { buildContextBlock } from '../src/coach/runner';
import { isoDate } from '../src/lib/types';
import { theme } from '../src/lib/theme';

export default function KickoffScreen() {
  const [ready, setReady] = useState(false);
  const [context, setContext] = useState<string>('');

  useEffect(() => {
    (async () => {
      await startCheckIn('morning_kickoff');
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const [open, openYesterday] = await Promise.all([
        listOpenTasks(),
        listTasksCreatedOn(isoDate(yesterday)),
      ]);
      const stillOpenFromYesterday = openYesterday.filter(
        (t) => t.status === 'open' || t.status === 'captured_for_review',
      );
      const ctx = buildContextBlock([
        `Open tasks total: ${open.length}`,
        `By business:`,
        ...['geo_logistics', 'nestlink', 'crownstone', 'personal'].map((b) => {
          const filtered = open.filter((t) => t.business === b);
          const top = filtered
            .slice(0, 3)
            .map((t) => `  - ${t.description}${t.deadline ? ` (due ${t.deadline})` : ''}`)
            .join('\n');
          return `  ${b}: ${filtered.length} open${top ? `\n${top}` : ''}`;
        }),
        `Open from yesterday: ${stillOpenFromYesterday.length}`,
        ...stillOpenFromYesterday.slice(0, 5).map((t) => `  - ${t.description} [${t.business}]`),
      ]);
      setContext(ctx);
      setReady(true);
    })();
  }, []);

  if (!ready)
    return (
      <Screen title="Morning kickoff" subtitle="Loading context…">
        <Text style={{ color: theme.textDim }}>One sec.</Text>
      </Screen>
    );

  return (
    <CoachThread
      thread={`kickoff:${isoDate()}`}
      skill="morning_kickoff"
      contextBuilder={() => context}
      greeting="Ready for kickoff?"
    />
  );
}
