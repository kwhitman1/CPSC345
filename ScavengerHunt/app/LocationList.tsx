import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getFirestore, collection, query, where, onSnapshot, addDoc, serverTimestamp, doc, setDoc, getDocs, QuerySnapshot, DocumentData } from 'firebase/firestore';
import app, { getFirebaseAuth } from '@/lib/firebase-config';

export default function LocationList() {
  const params = useLocalSearchParams() as { huntId?: string };
  const router = useRouter();
  const huntId = params.huntId;
  const db = getFirestore(app);

  const [locations, setLocations] = useState<any[]>([]);
  const [visibleLocations, setVisibleLocations] = useState<any[]>([]);
  const [foundLocationIds, setFoundLocationIds] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [explanation, setExplanation] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!huntId) return;
    const q = query(collection(db, 'locations'), where('huntId', '==', huntId));
    const unsub = onSnapshot(q, (snap) => {
      const items: any[] = [];
      snap.forEach((d) => items.push({ id: d.id, ...(d.data() as any) }));
      setLocations(items);
    });
    return () => unsub();
  }, [huntId]);

  // load user's found locations (per-user subcollection under users/{uid}/foundLocations)
  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth || !auth.currentUser) {
      setFoundLocationIds([]);
      return;
    }
    const uid = auth.currentUser.uid;
    const q = query(collection(db, `users/${uid}/foundLocations`));
    const unsub = onSnapshot(q, (snap: QuerySnapshot<DocumentData>) => {
      const ids: string[] = [];
      snap.forEach((d) => ids.push((d.data() as any).locationId));
      setFoundLocationIds(ids);
    });
    return () => unsub();
  }, [db]);

  // compute visibility using Required Location (AND) and Time Window (OR) conditions
  useEffect(() => {
    let mounted = true;
    const compute = async () => {
      if (!huntId) return setVisibleLocations([]);

      const condSnap = await getDocs(query(collection(db, 'conditions')));

      const requiredByLocation: Record<string, string[]> = {};
      const timeWindowsByLocation: Record<string, { start: string; end: string }[]> = {};

      condSnap.forEach((c) => {
        const data: any = c.data();
        // condition types are stored as uppercase strings in ConditionEdit (REQUIRED_LOCATION, TIME_WINDOW)
        if (data.type === 'REQUIRED_LOCATION' && data.locationId && data.requiredLocationId) {
          requiredByLocation[data.locationId] = requiredByLocation[data.locationId] || [];
          requiredByLocation[data.locationId].push(data.requiredLocationId);
        }
        if (data.type === 'TIME_WINDOW' && data.locationId && data.startTime && data.endTime) {
          timeWindowsByLocation[data.locationId] = timeWindowsByLocation[data.locationId] || [];
          timeWindowsByLocation[data.locationId].push({ start: data.startTime, end: data.endTime });
        }
      });

      const nowUtc = new Date();
      const nowMinutes = nowUtc.getUTCHours() * 60 + nowUtc.getUTCMinutes();

      function timeStrToMinutes(t: string) {
        // t is expected like 'HH:MM:00' (UTC)
        const parts = t.split(':').map((s) => parseInt(s, 10));
        if (parts.length < 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1])) return NaN;
        return parts[0] * 60 + parts[1];
      }

      const visible = locations.filter((loc) => {
        // Required Location (AND): all required ids must be in found list
        const required = requiredByLocation[loc.id] || [];
        const requiredOk = required.length === 0 || required.every((rid) => foundLocationIds.includes(rid));
        if (!requiredOk) return false;

        // Time Window (OR): if no time windows, visible; otherwise visible if any window matches
        const windows = timeWindowsByLocation[loc.id] || [];
        if (windows.length === 0) return true;

        const anyMatch = windows.some((w) => {
          const s = timeStrToMinutes(w.start);
          const e = timeStrToMinutes(w.end);
          if (Number.isNaN(s) || Number.isNaN(e)) return false;
          if (s <= e) {
            return nowMinutes >= s && nowMinutes <= e;
          } else {
            // wraps past midnight (e.g., 22:00 -> 02:00)
            return nowMinutes >= s || nowMinutes <= e;
          }
        });
        return anyMatch;
      });

      if (mounted) setVisibleLocations(visible);
    };
    compute();
    return () => {
      mounted = false;
    };
  }, [locations, foundLocationIds, db, huntId]);

  const validateCoords = (lat: string, lon: string) => {
    const la = parseFloat(lat);
    const lo = parseFloat(lon);
    if (Number.isNaN(la) || Number.isNaN(lo)) return false;
    if (la < -90 || la > 90) return false;
    if (lo < -180 || lo > 180) return false;
    return true;
  };

  const handleCreate = async () => {
    if (!huntId) return Alert.alert('Missing hunt', 'No huntId provided');
    if (!name.trim()) return Alert.alert('Validation', 'Name is required');
    if (!validateCoords(latitude, longitude)) return Alert.alert('Validation', 'Invalid coordinates');

    setCreating(true);
    try {
      const docRef = await addDoc(collection(db, 'locations'), {
        huntId,
        locationName: name.trim(),
        explanation: explanation.trim(),
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        createdAt: serverTimestamp(),
      });
      setName('');
      setExplanation('');
      setLatitude('');
      setLongitude('');
  router.push(`/LocationDetail?locationId=${docRef.id}` as any);
    } catch (e) {
      console.error('create location failed', e);
      Alert.alert('Error', 'Could not create location');
    } finally {
      setCreating(false);
    }
  };

  const handleCreateSample = async () => {
    if (!huntId) return Alert.alert('Missing hunt', 'No huntId provided');
    if (locations.length > 0) return Alert.alert('Exists', 'This hunt already has locations.');

    // require signed-in user when creating resources
    try {
      const auth = getFirebaseAuth();
      if (!auth.currentUser) return Alert.alert('Sign in required', 'Please sign in to create sample location');
      const db = getFirestore(app);
      const docRef = await addDoc(collection(db, 'locations'), {
        huntId,
        locationName: 'Sample Location 1',
        explanation: 'Auto-created sample location',
        latitude: 0,
        longitude: 0,
        createdAt: serverTimestamp(),
      });
      Alert.alert('Created', `Sample location created (id: ${docRef.id})`);
      // navigate to detail for convenience
  router.push(`/LocationDetail?locationId=${docRef.id}` as any);
    } catch (e) {
      console.error('create sample failed', e);
      Alert.alert('Error', 'Could not create sample location');
    }
  };

  // helper to mark a location as found for the current user
  const markFound = async (locationId: string) => {
    const auth = getFirebaseAuth();
    if (!auth || !auth.currentUser) return Alert.alert('Sign in required', 'Please sign in to mark found');
    const uid = auth.currentUser.uid;
    try {
      await setDoc(doc(db, `users/${uid}/foundLocations`, locationId), {
        locationId,
        foundAt: serverTimestamp(),
      });
      Alert.alert('Marked found', 'Location marked as found for your account');
    } catch (e) {
      console.error('markFound failed', e);
      Alert.alert('Error', 'Could not mark found');
    }
  };

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 8 }}>Locations</Text>

      <View style={{ marginBottom: 12 }}>
        <TextInput placeholder="Location name" value={name} onChangeText={setName} style={{ borderWidth: 1, padding: 8, marginBottom: 8 }} />
        <TextInput placeholder="Explanation" value={explanation} onChangeText={setExplanation} style={{ borderWidth: 1, padding: 8, marginBottom: 8 }} />
        <TextInput placeholder="Latitude (e.g. 47.6062)" value={latitude} onChangeText={setLatitude} style={{ borderWidth: 1, padding: 8, marginBottom: 8 }} keyboardType="numeric" />
        <TextInput placeholder="Longitude (e.g. -122.3321)" value={longitude} onChangeText={setLongitude} style={{ borderWidth: 1, padding: 8, marginBottom: 8 }} keyboardType="numeric" />
        <Pressable onPress={handleCreate} style={{ padding: 12, backgroundColor: '#1f6feb', borderRadius: 6 }}>
          <Text style={{ color: '#fff' }}>{creating ? 'Creating...' : 'Add New Location'}</Text>
        </Pressable>
      </View>

      <FlatList
        data={visibleLocations}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/LocationDetail?locationId=${item.id}` as any)} style={{ padding: 12, borderBottomWidth: 1, borderColor: '#eee' }}>
            <Text style={{ fontSize: 16, fontWeight: '600' }}>{item.locationName}</Text>
            <Text style={{ color: '#666' }}>{item.explanation}</Text>
            <Pressable onPress={() => markFound(item.id)} style={{ marginTop: 6, padding: 8, backgroundColor: '#ddd', borderRadius: 6 }}>
              <Text>Mark found (for testing)</Text>
            </Pressable>
          </Pressable>
        )}
      />
    </View>
  );
}
