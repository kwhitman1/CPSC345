import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Button, StyleSheet, Text, View } from 'react-native';

type HistoryItem = {
  id: string;
  type: 'encrypt' | 'decrypt';
  original: string;
  key: string;
  result: string;
  date: string;
};

export default function Detail() {
  const { id } = useLocalSearchParams() as { id?: string };
  const [item, setItem] = useState<HistoryItem | null>(null);
  const router = useRouter();

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      const raw = await AsyncStorage.getItem('history');
      const arr: HistoryItem[] = raw ? JSON.parse(raw) : [];
      const found = arr.find((h) => h.id === id) || null;
      setItem(found);
    };
    load();
  }, [id]);

  const deleteItem = async () => {
    if (!item) return;
    const raw = await AsyncStorage.getItem('history');
    const arr: HistoryItem[] = raw ? JSON.parse(raw) : [];
    const next = arr.filter((h) => h.id !== item.id);
    await AsyncStorage.setItem('history', JSON.stringify(next));
    router.back();
  };

  const confirmDelete = () => {
    Alert.alert(
      'Delete Message',
      'Are you sure you want to delete this message? This action is permanent.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: deleteItem },
      ]
    );
  };

  if (!item) {
    return (
      <View style={styles.container}>
        <Text style={{ padding: 16 }}>Message not found.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Original</Text>
      <Text style={styles.value}>{item.original}</Text>

      <Text style={styles.label}>Key</Text>
      <Text style={styles.value}>{item.key}</Text>

      <Text style={styles.label}>Result</Text>
      <Text style={styles.value}>{item.result}</Text>

      <View style={{ marginTop: 20 }}>
        <Button title="Delete" color="red" onPress={confirmDelete} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  label: { fontWeight: '600', marginTop: 12 },
  value: { marginTop: 6 },
});
