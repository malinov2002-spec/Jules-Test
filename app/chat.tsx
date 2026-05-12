import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { CoachThread } from '../src/components/CoachThread';
import { Screen } from '../src/components/Screen';
import { ChatTurn } from '../src/coach/anthropic';
import { loadThread } from '../src/lib/db';
import { theme } from '../src/lib/theme';

export default function ChatScreen() {
  const [history, setHistory] = useState<ChatTurn[] | null>(null);

  useEffect(() => {
    (async () => {
      const rows = await loadThread('main', 30);
      setHistory(
        rows
          .filter((r) => r.role === 'user' || r.role === 'assistant')
          .map((r) => ({ role: r.role as 'user' | 'assistant', content: r.content })),
      );
    })();
  }, []);

  if (!history)
    return (
      <Screen title="Coach">
        <Text style={{ color: theme.textDim }}>Loading…</Text>
      </Screen>
    );

  return (
    <CoachThread
      thread="main"
      skill="free_chat"
      initialHistory={history}
      greeting={history.length === 0 ? "What's on your mind?" : undefined}
    />
  );
}
