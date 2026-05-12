import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Task } from '../lib/types';
import { theme } from '../lib/theme';
import { BusinessTag } from './BusinessTag';

interface Props {
  task: Task;
  onToggleDone?: () => void;
  onPress?: () => void;
  showBusiness?: boolean;
}

export function TaskRow({ task, onToggleDone, onPress, showBusiness = true }: Props) {
  const done = task.status === 'done';
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
    >
      <Pressable onPress={onToggleDone} hitSlop={12} style={styles.checkWrap}>
        <View style={[styles.check, done && styles.checkDone]}>
          {done ? <Text style={styles.checkMark}>✓</Text> : null}
        </View>
      </Pressable>
      <View style={styles.body}>
        <Text style={[styles.desc, done && styles.descDone]} numberOfLines={2}>
          {task.description}
        </Text>
        <View style={styles.meta}>
          {showBusiness ? <BusinessTag business={task.business} short /> : null}
          {task.deadline ? <Text style={styles.metaText}>due {task.deadline}</Text> : null}
          {task.push_count > 0 ? (
            <Text style={[styles.metaText, { color: theme.warn }]}>
              pushed {task.push_count}×
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: theme.pad,
    backgroundColor: theme.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  checkWrap: { paddingTop: 2, marginRight: 12 },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: theme.textDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkDone: { backgroundColor: theme.good, borderColor: theme.good },
  checkMark: { color: '#0b0b0c', fontWeight: '900', fontSize: 14 },
  body: { flex: 1 },
  desc: { color: theme.text, fontSize: 16, lineHeight: 22 },
  descDone: { color: theme.textDim, textDecorationLine: 'line-through' },
  meta: { flexDirection: 'row', gap: 10, marginTop: 6, flexWrap: 'wrap' },
  metaText: { color: theme.textDim, fontSize: 12 },
});
