import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Platform, TextInput, Pressable } from 'react-native';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getFirestore, doc, onSnapshot, updateDoc } from 'firebase/firestore';
import app from '@/lib/firebase-config';
import { Linking } from 'react-native';

export default function LocationDetail() {
  const params = useLocalSearchParams() as { locationId?: string; huntId?: string };
  const router = useRouter();
  const locationId = params.locationId;
  const huntId = params.huntId;
  const db = getFirestore(app);

  const [location, setLocation] = useState<any | null>(null);
  const [marker, setMarker] = useState<{ latitude: number; longitude: number } | null>(null);
  const [latInput, setLatInput] = useState('');
  const [lonInput, setLonInput] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!locationId) return;
    const docRef = doc(db, 'locations', locationId);
    const unsub = onSnapshot(docRef, (snap) => {
      if (!snap.exists()) {
        Alert.alert('Not found', 'Location not found');
        router.back();
        return;
      }
      const data = { id: snap.id, ...(snap.data() as any) };
      setLocation(data);
      if (data.latitude != null && data.longitude != null) {
        setMarker({ latitude: Number(data.latitude), longitude: Number(data.longitude) });
        setLatInput(String(data.latitude));
        setLonInput(String(data.longitude));
      }
    });
    return () => unsub();
  }, [locationId]);

  if (!location) return (
    <ThemedView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ThemedText>Loading...</ThemedText></ThemedView>
  );

  const bg = useThemeColor({}, 'background');
  const tint = useThemeColor({}, 'tint');

  const handleMapPress = (evt: any) => {
    const { coordinate } = evt.nativeEvent || {};
    if (!coordinate) return;
    setMarker({ latitude: coordinate.latitude, longitude: coordinate.longitude });
    setLatInput(String(coordinate.latitude));
    setLonInput(String(coordinate.longitude));
  };

  const saveCoords = async () => {
    if (!location) return;
    const lat = Number(latInput);
    const lon = Number(lonInput);
    if (Number.isNaN(lat) || Number.isNaN(lon)) return Alert.alert('Invalid', 'Please enter valid numeric coordinates.');
    setSaving(true);
    try {
      const ref = doc(db, 'locations', location.id);
      await updateDoc(ref, { latitude: lat, longitude: lon });
      Alert.alert('Saved', 'Coordinates updated.');
    } catch (e) {
      console.error('save coords failed', e);
      Alert.alert('Error', 'Could not save coordinates.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ThemedView style={{ padding: 16, backgroundColor: bg }}>
      {huntId && <ThemedText style={{ fontSize: 14, color: '#666', marginBottom: 8 }}>Completed location from hunt: {huntId}</ThemedText>}
      <ThemedText style={{ fontSize: 20, fontWeight: '600', marginBottom: 8 }}>{location.locationName}</ThemedText>
      <ThemedText style={{ color: '#666', marginBottom: 8 }}>{location.explanation}</ThemedText>

      <ThemedView style={{ height: 220, justifyContent: 'center', alignItems: 'center', backgroundColor: bg, borderRadius: 8, padding: 8 }}>
        <ThemedText style={{ color: '#666' }}>Map feature removed</ThemedText>
      </ThemedView>

      <ThemedView style={{ marginTop: 12 }}>
        <ThemedText>Latitude</ThemedText>
        <TextInput value={latInput} onChangeText={setLatInput} keyboardType="numeric" style={{ borderWidth: 1, borderColor: '#ddd', padding: 8, borderRadius: 6, marginTop: 6 }} />
        <ThemedText style={{ marginTop: 8 }}>Longitude</ThemedText>
        <TextInput value={lonInput} onChangeText={setLonInput} keyboardType="numeric" style={{ borderWidth: 1, borderColor: '#ddd', padding: 8, borderRadius: 6, marginTop: 6 }} />

        <ThemedView style={{ marginTop: 12 }}>
          <Pressable onPress={saveCoords} disabled={saving} style={{ padding: 10, backgroundColor: tint, borderRadius: 6 }}>
            <ThemedText style={{ color: '#fff' }}>{saving ? 'Saving...' : 'Save coordinates'}</ThemedText>
          </Pressable>
        </ThemedView>
      </ThemedView>

      <ThemedView style={{ height: 12 }} />
      <Pressable onPress={() => router.push(`/ConditionEdit?locationId=${location.id}` as any)} style={{ padding: 10 }}>
        <ThemedText>Edit Conditions</ThemedText>
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    width: '100%',
    height: '100%'
  },
});
