import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, FlatList, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

type HistoryItem = {
  id: string;
  cipher: string;
  date: string;
};

export default function HistoryScreen() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const router = useRouter();
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const toggle = (id: string) => {
    setSelected((s) => ({ ...s, [id]: !s[id] }));
  };

  const deleteSelected = async () => {
    const ids = Object.entries(selected).filter(([, v]) => v).map(([k]) => k);
    if (ids.length === 0) return;

    const doDelete = async () => {
      const raw = await AsyncStorage.getItem('history');
      const arr: HistoryItem[] = raw ? JSON.parse(raw) : [];
      const next = arr.filter((h) => !ids.includes(h.id));
      await AsyncStorage.setItem('history', JSON.stringify(next));
      setHistory(next);
      setSelected({});
    };

    const message = `Delete ${ids.length} item(s)? This action is permanent.`;
    if (Platform.OS === 'web') {
      if (window.confirm(message)) await doDelete();
      return;
    }

    Alert.alert('Delete messages', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: doDelete },
    ]);
  };

  useEffect(() => {
    const load = async () => {
      const raw = await AsyncStorage.getItem('history');
      setHistory(raw ? JSON.parse(raw) : []);
    };
    load();
  }, []);

  return (
    <View style={styles.container}>
      <FlatList
        data={history}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable style={styles.item}>
            <Pressable onPress={() => router.push({ pathname: '/detail', params: { id: item.id } })} style={{ flex: 1 }}>
              <Text>{item.cipher}</Text>
              <Text style={styles.meta}>{new Date(item.date).toLocaleString()}</Text>
            </Pressable>
            <Pressable onPress={() => toggle(item.id)} style={styles.checkbox}>
              <Text>{selected[item.id] ? '☑' : '☐'}</Text>
            </Pressable>
          </Pressable>
        )}
        ListEmptyComponent={<Text style={{ padding: 16 }}>No history yet.</Text>}
      />
      <View style={{ marginTop: 12 }}>
        <Pressable onPress={deleteSelected} style={styles.deleteButton}>
          <Text style={{ color: 'white' }}>Delete Selected</Text>
        </Pressable>
      </View>
    </View>
    
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  item: { padding: 12, borderBottomWidth: 1, borderColor: '#ccc', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  meta: { color: '#666', fontSize: 12, marginTop: 6 },
  checkbox: { padding: 8, justifyContent: 'center', width: 44, height: 44, alignItems: 'center', borderRadius: 6 },
  checkboxText: { fontSize: 20 },
  deleteButton: { backgroundColor: 'red', padding: 12, alignItems: 'center', borderRadius: 6 },
});
