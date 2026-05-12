import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { theme } from '../lib/theme';
import { ChatTurn } from '../coach/anthropic';
import { runCoach } from '../coach/runner';
import { SkillName } from '../coach/skills';

interface Props {
  thread: string;
  skill: SkillName;
  initialHistory?: ChatTurn[];
  contextBuilder?: () => Promise<string> | string;
  greeting?: string;
}

interface Bubble {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export function CoachThread({
  thread,
  skill,
  initialHistory = [],
  contextBuilder,
  greeting,
}: Props) {
  const [bubbles, setBubbles] = useState<Bubble[]>(
    greeting
      ? [{ role: 'assistant', content: greeting }, ...initialHistory.map((t) => ({ role: t.role, content: t.content }))]
      : initialHistory.map((t) => ({ role: t.role, content: t.content })),
  );
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  async function send() {
    const message = input.trim();
    if (!message || busy) return;
    setInput('');
    setBubbles((b) => [...b, { role: 'user', content: message }]);
    setBusy(true);
    try {
      const ctx = contextBuilder ? await contextBuilder() : undefined;
      const reply = await runCoach({
        skill,
        thread,
        userMessage: message,
        history: bubblesToHistory(bubbles),
        contextBlock: ctx,
      });
      setBubbles((b) => [...b, { role: 'assistant', content: reply.text || '(no reply)' }]);
    } catch (e) {
      setBubbles((b) => [
        ...b,
        { role: 'system', content: `Error: ${(e as Error).message}` },
      ]);
    } finally {
      setBusy(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={80}
    >
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {bubbles.map((b, i) => (
          <View
            key={i}
            style={[
              styles.bubble,
              b.role === 'user'
                ? styles.user
                : b.role === 'system'
                  ? styles.system
                  : styles.assistant,
            ]}
          >
            <Text
              style={[
                styles.text,
                b.role === 'user' && { color: theme.bg },
                b.role === 'system' && { color: theme.warn },
              ]}
            >
              {b.content}
            </Text>
          </View>
        ))}
        {busy ? (
          <View style={[styles.bubble, styles.assistant]}>
            <ActivityIndicator color={theme.textDim} />
          </View>
        ) : null}
      </ScrollView>
      <View style={styles.inputRow}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Tell the coach…"
          placeholderTextColor={theme.textFaint}
          style={styles.input}
          multiline
          editable={!busy}
        />
        <Pressable onPress={send} disabled={busy || !input.trim()} style={styles.send}>
          <Text style={styles.sendText}>Send</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function bubblesToHistory(bubbles: Bubble[]): ChatTurn[] {
  return bubbles
    .filter((b): b is { role: 'user' | 'assistant'; content: string } =>
      b.role === 'user' || b.role === 'assistant',
    )
    .map((b) => ({ role: b.role, content: b.content }));
}

const styles = StyleSheet.create({
  bubble: {
    maxWidth: '85%',
    padding: 12,
    borderRadius: 14,
    marginBottom: 8,
  },
  user: { alignSelf: 'flex-end', backgroundColor: theme.text },
  assistant: { alignSelf: 'flex-start', backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border },
  system: { alignSelf: 'center', backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.warn },
  text: { color: theme.text, fontSize: 15, lineHeight: 22 },
  inputRow: {
    flexDirection: 'row',
    padding: 10,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    backgroundColor: theme.bg,
  },
  input: {
    flex: 1,
    backgroundColor: theme.surface,
    color: theme.text,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: theme.border,
    fontSize: 15,
  },
  send: {
    paddingHorizontal: 18,
    backgroundColor: theme.text,
    borderRadius: 12,
    justifyContent: 'center',
  },
  sendText: { color: theme.bg, fontWeight: '700' },
});

