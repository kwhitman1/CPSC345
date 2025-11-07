import React, { useEffect, useState } from 'react';
import { View, Text, Button, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getFirestore, doc, onSnapshot } from 'firebase/firestore';
import app from '@/lib/firebase-config';

export default function LocationDetail() {
  const params = useLocalSearchParams() as { locationId?: string };
  const router = useRouter();
  const locationId = params.locationId;
  const db = getFirestore(app);

  const [location, setLocation] = useState<any | null>(null);

  useEffect(() => {
    if (!locationId) return;
    const docRef = doc(db, 'locations', locationId);
    const unsub = onSnapshot(docRef, (snap) => {
      if (!snap.exists()) {
        Alert.alert('Not found', 'Location not found');
        router.back();
        return;
      }
      setLocation({ id: snap.id, ...(snap.data() as any) });
    });
    return () => unsub();
  }, [locationId]);

  if (!location) return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><Text>Loading...</Text></View>
  );

  return (
    <View style={{ padding: 16 }}>
      <Text style={{ fontSize: 20, fontWeight: '600', marginBottom: 8 }}>{location.locationName}</Text>
      <Text style={{ color: '#666', marginBottom: 8 }}>{location.explanation}</Text>
      <Text>Latitude: {location.latitude}</Text>
      <Text>Longitude: {location.longitude}</Text>
      <View style={{ height: 12 }} />
      <Button title="Edit Conditions" onPress={() => router.push(`/ConditionEdit?locationId=${location.id}` as any)} />
    </View>
  );
}
