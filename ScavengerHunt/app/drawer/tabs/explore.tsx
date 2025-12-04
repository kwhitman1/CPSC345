import React from 'react';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';

export default function ExploreScreen() {
  const tint = useThemeColor({}, 'tint');

  return (
    <ThemedView style={{ flex: 1, padding: 12 }}>
      <ThemedText style={{ color: tint }}>EXPLORE SCREEN</ThemedText>
    </ThemedView>
  );
}
