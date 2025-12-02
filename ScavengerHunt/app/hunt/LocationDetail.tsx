import React, { useEffect, useState } from 'react';
import { View, Text, Button, Alert, StyleSheet, Platform, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getFirestore, doc, onSnapshot, updateDoc } from 'firebase/firestore';
import app from '@/lib/firebase-config';
import { Linking } from 'react-native';

export default function LocationDetail() {
  const params = useLocalSearchParams() as { locationId?: string };
  const router = useRouter();
  const locationId = params.locationId;
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
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><Text>Loading...</Text></View>
  );

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
    <View style={{ padding: 16 }}>
      <Text style={{ fontSize: 20, fontWeight: '600', marginBottom: 8 }}>{location.locationName}</Text>
      <Text style={{ color: '#666', marginBottom: 8 }}>{location.explanation}</Text>

      <View style={{ height: 220, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f3f4f6', borderRadius: 8, padding: 8 }}>
        <Text style={{ color: '#666' }}>Map feature removed</Text>
      </View>

      <View style={{ marginTop: 12 }}>
        <Text>Latitude</Text>
        <TextInput value={latInput} onChangeText={setLatInput} keyboardType="numeric" style={{ borderWidth: 1, borderColor: '#ddd', padding: 8, borderRadius: 6, marginTop: 6 }} />
        <Text style={{ marginTop: 8 }}>Longitude</Text>
        <TextInput value={lonInput} onChangeText={setLonInput} keyboardType="numeric" style={{ borderWidth: 1, borderColor: '#ddd', padding: 8, borderRadius: 6, marginTop: 6 }} />

        <View style={{ marginTop: 12 }}>
          <Button title={saving ? 'Saving...' : 'Save coordinates'} onPress={saveCoords} disabled={saving} />
        </View>
      </View>

      <View style={{ height: 12 }} />
      <Button title="Edit Conditions" onPress={() => router.push(`/ConditionEdit?locationId=${location.id}` as any)} />
    </View>
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
