import React, { useEffect, useState } from 'react';
import { Text, View, Button, Alert, TextInput, FlatList, Pressable, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import { auth, db } from './firebaseConfig';
import { collection, query, where, onSnapshot, addDoc, getDocs } from 'firebase/firestore';

type Hunt = { id: string; name: string; userId: string; createdAt: string };

export default function Index() {
  const router = useRouter();
  const [hunts, setHunts] = useState<Hunt[]>([]);
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    const q = query(collection(db, 'hunts'), where('userId', '==', user.uid));
    const unsub = onSnapshot(q, (snap) => {
      const items: Hunt[] = [];
      snap.forEach((doc) => items.push({ id: doc.id, ...(doc.data() as any) }));
      setHunts(items);
    }, (err) => console.warn('hunts snapshot error', err));
    return unsub;
  }, []);

  const onLogout = async () => {
    try {
      await signOut(auth);
      await AsyncStorage.removeItem('userToken');
      router.replace('/SignIn' as any);
    } catch (e: any) {
      Alert.alert('Logout failed', e?.message ?? String(e));
    }
  };

  const createHunt = async () => {
    const user = auth.currentUser;
    if (!user) return Alert.alert('Error', 'Not signed in');
    const name = newName.trim();
    if (!name) return Alert.alert('Validation', 'Hunt name required');
    if (name.length > 255) return Alert.alert('Validation', 'Name must be 255 characters or less');

    setLoading(true);
    try {
      // check duplicate for this user
      const q = query(collection(db, 'hunts'), where('userId', '==', user.uid), where('name', '==', name));
      const existing = await getDocs(q);
      if (!existing.empty) {
        return Alert.alert('Validation', 'A hunt with that name already exists for you');
      }

      const docRef = await addDoc(collection(db, 'hunts'), {
        name,
        userId: user.uid,
        createdAt: new Date().toISOString(),
      });
      setNewName('');
      router.push({ pathname: '/HuntDetail', params: { huntId: docRef.id } } as any);
    } catch (e: any) {
      Alert.alert('Create failed', e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }: { item: Hunt }) => (
    <Pressable onPress={() => router.push({ pathname: '/HuntDetail', params: { huntId: item.id } } as any)} style={styles.item}>
      <Text style={styles.itemText}>{item.name}</Text>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Your Hunts</Text>

      <FlatList data={hunts} keyExtractor={(i) => i.id} renderItem={renderItem} ListEmptyComponent={<Text>No hunts yet</Text>} />

      <View style={{ height: 12 }} />
      <TextInput placeholder="New hunt name" value={newName} onChangeText={setNewName} style={styles.input} />
      <Button title={loading ? 'Creating...' : 'Create Hunt'} onPress={createHunt} disabled={loading} />
      <View style={{ height: 24 }} />
      <Button title="Logout" onPress={onLogout} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  heading: { fontSize: 20, marginBottom: 12 },
  input: { borderWidth: 1, padding: 8, marginVertical: 8, borderRadius: 6 },
  item: { padding: 12, borderBottomWidth: 1, borderColor: '#eee' },
  itemText: { fontSize: 16 },
});
