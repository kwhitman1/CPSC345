import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Button, Alert, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { auth, db } from './firebaseConfig';
import { doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';

export default function HuntDetail() {
  const { huntId } = useLocalSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [name, setName] = useState('');
  const [originalUserId, setOriginalUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!huntId) return;
    const load = async () => {
      setLoading(true);
      try {
        const d = await getDoc(doc(db, 'hunts', huntId as string));
        if (!d.exists()) return Alert.alert('Not found', 'Hunt not found');
        const data = d.data() as any;
        setName(data.name ?? '');
        setOriginalUserId(data.userId ?? null);
      } catch (e: any) {
        Alert.alert('Error', e?.message ?? String(e));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [huntId]);

  const save = async () => {
    if (!huntId) return;
    const user = auth.currentUser;
    if (!user) return Alert.alert('Error', 'Not signed in');
    if (originalUserId !== user.uid) return Alert.alert('Permission denied', 'You do not own this hunt');
    const trimmed = name.trim();
    if (!trimmed) return Alert.alert('Validation', 'Name required');
    if (trimmed.length > 255) return Alert.alert('Validation', 'Name must be 255 characters or less');

    try {
      await updateDoc(doc(db, 'hunts', huntId as string), { name: trimmed });
      Alert.alert('Saved', 'Hunt updated');
    } catch (e: any) {
      Alert.alert('Update failed', e?.message ?? String(e));
    }
  };

  const confirmDelete = () => {
    Alert.alert('Delete hunt', 'Are you sure you want to delete this hunt?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: deleteHunt },
    ]);
  };

  const deleteHunt = async () => {
    if (!huntId) return;
    const user = auth.currentUser;
    if (!user) return Alert.alert('Error', 'Not signed in');
    if (originalUserId !== user.uid) return Alert.alert('Permission denied', 'You do not own this hunt');

    setDeleting(true);
    try {
      await deleteDoc(doc(db, 'hunts', huntId as string));
      // Navigate back to index. Use replace then push as a robust fallback.
      try {
        router.replace('/' as any);
      } catch {
        try { router.push('/' as any); } catch { /* ignore */ }
      }
    } catch (e: any) {
      Alert.alert('Delete failed', e?.message ?? String(e));
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return (
    <View style={styles.center}><ActivityIndicator /></View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Rename Hunt</Text>
      <TextInput value={name} onChangeText={setName} style={styles.input} />
  <View style={{ height: 12 }} />
  <Button title="Save Name" onPress={save} />
  <View style={{ height: 12 }} />
  {deleting ? <ActivityIndicator /> : <Button title="Delete Hunt" color="red" onPress={confirmDelete} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  label: { fontSize: 16, marginBottom: 6 },
  input: { borderWidth: 1, padding: 8, borderRadius: 6 },
});
