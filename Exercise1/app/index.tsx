import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  FlatList,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

type HistoryItem = {
  id: string;
  original: string;
  key: number;
  result: string;
  type: 'encrypt' | 'decrypt';
  timestamp: number;
};

const HISTORY_KEY = 'caesar_history_v1';

const saveHistory = async (items: HistoryItem[]) => {
  try {
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(items));
  } catch (e) {
    // ignore for now
  }
};

const getHistory = async (): Promise<HistoryItem[]> => {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as HistoryItem[];
  } catch (e) {
    return [];
  }
};

const addHistoryItem = async (item: HistoryItem) => {
  const items = await getHistory();
  items.unshift(item);
  await saveHistory(items);
};

const deleteHistoryItem = async (id: string) => {
  const items = await getHistory();
  const filtered = items.filter(i => i.id !== id);
  await saveHistory(filtered);
};

const Stack = createStackNavigator();

function generateId() {
  return String(Date.now()) + Math.random().toString(36).slice(2, 8);
}

function encrypt(text: string, shift: number): string {
  return text
    .split('')
    .map(char => {
      const number = char.charCodeAt(0);

      // lowercase a-z
      if (number >= 97 && number <= 122) {
        return String.fromCharCode(((number - 97 + shift) % 26 + 26) % 26 + 97);
      }

      // uppercase A-Z
      if (number >= 65 && number <= 90) {
        return String.fromCharCode(((number - 65 + shift) % 26 + 26) % 26 + 65);
      }

      return char;
    })
    .join('');
}

function decrypt(text: string, shift: number): string {
  return encrypt(text, 26 - (shift % 26));
}

function HomeScreen({ navigation }: any) {
  const [message, setMessage] = useState('');
  const [key, setKey] = useState('');
  const [result, setResult] = useState('');

  const doAddToHistory = async (orig: string, k: number, res: string, type: 'encrypt' | 'decrypt') => {
    const item: HistoryItem = {
      id: generateId(),
      original: orig,
      key: k,
      result: res,
      type,
      timestamp: Date.now(),
    };
    await addHistoryItem(item);
  };

  const calcEncrypt = async () => {
    const shift = parseInt(key, 10);
    if (!isNaN(shift)) {
      const res = encrypt(message, shift);
      setResult(res);
      await doAddToHistory(message, shift, res, 'encrypt');
    }
  };

  const calcDecrypt = async () => {
    const shift = parseInt(key, 10);
    if (!isNaN(shift)) {
      const res = decrypt(message, shift);
      setResult(res);
      await doAddToHistory(message, shift, res, 'decrypt');
    }
  };

  return (
    <View
      style={{
        flex: 1,
        padding: 20,
        justifyContent: 'flex-start',
        alignItems: 'center',
      }}
    >
      <Text style={{ marginBottom: 8 }}>Enter the message to encrypt or decrypt here</Text>
      <TextInput
        value={message}
        onChangeText={setMessage}
        style={{ borderWidth: 1, padding: 10, width: '100%', marginVertical: 10 }}
      />
      <Text>Enter the encryption key here</Text>
      <TextInput
        value={key}
        onChangeText={setKey}
        keyboardType="numeric"
        style={{ borderWidth: 1, padding: 10, width: '100%', marginVertical: 10 }}
      />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 10 }}>
        <Button title="Encrypt" onPress={calcEncrypt} />
        <View style={{ width: 10 }} />
        <Button title="Decrypt" onPress={calcDecrypt} />
      </View>

      <View style={{ height: 20 }} />

      <Button title="View History" onPress={() => navigation.navigate('History')} />

      <Text style={{ marginTop: 20 }}>The results will appear here</Text>
      <Text style={{ marginTop: 8 }}>{result}</Text>
    </View>
  );
}

function HistoryScreen({ navigation }: any) {
  const [items, setItems] = useState<HistoryItem[]>([]);

  const load = async () => {
    const h = await getHistory();
    setItems(h);
  };

  useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      load();
    });
    load();
    return unsub;
  }, [navigation]);

  const renderItem = ({ item }: { item: HistoryItem }) => (
    <TouchableOpacity
      onPress={() => navigation.navigate('Detail', { id: item.id })}
      style={{ padding: 12, borderBottomWidth: 1, width: '100%' }}
    >
      <Text numberOfLines={1}>{item.original}</Text>
      <Text style={{ color: '#666' }}>{item.type} · key: {item.key}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, padding: 12 }}>
      {items.length === 0 ? (
        <Text>No history yet</Text>
      ) : (
        <FlatList data={items} keyExtractor={i => i.id} renderItem={renderItem} />
      )}
    </View>
  );
}

function DetailScreen({ route, navigation }: any) {
  const { id } = route.params as { id: string };
  const [item, setItem] = useState<HistoryItem | null>(null);

  const load = async () => {
    const items = await getHistory();
    const found = items.find(i => i.id === id) || null;
    setItem(found);
  };

  useEffect(() => {
    const unsub = navigation.addListener('focus', load);
    load();
    return unsub;
  }, [navigation]);

  const confirmDelete = () => {
    Alert.alert(
      'Delete this history item?',
      'This action is permanent and cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteHistoryItem(id);
            navigation.goBack();
          },
        },
      ]
    );
  };

  if (!item) {
    return (
      <View style={{ flex: 1, padding: 12 }}>
        <Text>Item not found</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, padding: 12 }}>
      <Text style={{ fontWeight: 'bold' }}>Original</Text>
      <Text style={{ marginBottom: 12 }}>{item.original}</Text>

      <Text style={{ fontWeight: 'bold' }}>Key</Text>
      <Text style={{ marginBottom: 12 }}>{item.key}</Text>

      <Text style={{ fontWeight: 'bold' }}>Result</Text>
      <Text style={{ marginBottom: 12 }}>{item.result}</Text>

      <Button title="Delete from history" color="#d9534f" onPress={confirmDelete} />
    </View>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Home">
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Caesar Cipher' }} />
        <Stack.Screen name="History" component={HistoryScreen} />
        <Stack.Screen name="Detail" component={DetailScreen} options={{ title: 'History Detail' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
