import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Business, BUSINESSES, businessColor } from '../lib/types';

interface Props {
  business: Business;
  short?: boolean;
}

export function BusinessTag({ business, short }: Props) {
  const meta = BUSINESSES.find((b) => b.value === business)!;
  const color = businessColor(business);
  return (
    <View style={[styles.tag, { borderColor: color }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.label, { color }]}>{short ? meta.short : meta.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  label: { fontSize: 12, fontWeight: '600' },
});
