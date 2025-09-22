import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

type HistoryItem = {
  id: string;
  type: 'encrypt' | 'decrypt';
  original: string;
  key: string;
  result: string;
  date: string;
};

export default function HistoryScreen() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const router = useRouter();

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
          <Pressable
            onPress={() => router.push({ pathname: '/detail', params: { id: item.id } })}
            style={styles.item}
          >
            <Text>{item.original}</Text>
            <Text style={styles.meta}>{new Date(item.date).toLocaleString()}</Text>
          </Pressable>
        )}
        ListEmptyComponent={<Text style={{ padding: 16 }}>No history yet.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  item: { padding: 12, borderBottomWidth: 1, borderColor: '#ccc' },
  meta: { color: '#666', fontSize: 12, marginTop: 6 },
});
