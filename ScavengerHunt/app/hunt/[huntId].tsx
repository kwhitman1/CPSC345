import React, { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, Alert, Image, StyleSheet, Dimensions } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import {
  getFirestore,
  doc,
  getDoc,
  onSnapshot,
  updateDoc,
  deleteDoc,
  addDoc,
  collection,
  serverTimestamp,
  query,
  where,
  getDocs,
  writeBatch,
  QuerySnapshot,
  DocumentData,
} from 'firebase/firestore';
import * as Location from 'expo-location';
import { Linking, Platform } from 'react-native';
import app from "@/lib/firebase-config";
import { useSession } from "@/context";

// react-native-maps can crash the bundle at import time when native module is missing.
// We'll require it at runtime inside RuntimeMap to avoid that.

const MapPlaceholder = ({ width, height }: { width: number; height: number }) => (
  <View style={{ width, height, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f3f4f6', borderRadius: 8 }}>
    <Text style={{ color: '#666' }}>Map feature removed</Text>
  </View>
);

// RuntimeMap: requires react-native-maps at runtime to avoid bundling/native crashes
function RuntimeMap({ latitude, longitude, devicePos, width, height }: { latitude: number | null | undefined; longitude: number | null | undefined; devicePos?: { latitude: number; longitude: number } | null; width: number; height: number }) {
  // If coords missing, show placeholder
  if (latitude == null || longitude == null) return <MapPlaceholder width={width} height={height} />;

  // On web we must never import native-only modules. Guard with Platform.
  if (Platform.OS === 'web') return <MapPlaceholder width={width} height={height} />;

  try {
    // require at runtime so the app won't crash when native module is absent
    // eslint-disable-next-line @typescript-eslint/no-var-requires,global-require
    const MapView = require('react-native-maps').default;
    const Marker = require('react-native-maps').Marker;

    return (
      <MapView
        style={{ width, height }}
        initialRegion={{ latitude: Number(latitude), longitude: Number(longitude), latitudeDelta: 0.01, longitudeDelta: 0.01 }}
        showsUserLocation={false}
        zoomEnabled={true}
      >
        <Marker coordinate={{ latitude: Number(latitude), longitude: Number(longitude) }} title="Target" />
        {devicePos ? <Marker coordinate={{ latitude: devicePos.latitude, longitude: devicePos.longitude }} pinColor="blue" title="You" /> : null}
      </MapView>
    );
  } catch (e) {
    // module not available or failed to load
    return <MapPlaceholder width={width} height={height} />;
  }
}

export default function HuntDetail() {
  const params = useLocalSearchParams();
  const { huntId } = params as { huntId: string };
  const [hunt, setHunt] = useState<any>(null);
  const [name, setName] = useState("");
  
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const { user } = useSession();
  const isOwner = !!(user && hunt && (hunt.userId === user.uid));

  // player state
  const [playerHunt, setPlayerHunt] = useState<any | null>(null);
  const [locations, setLocations] = useState<any[]>([]);
  const [userFoundIds, setUserFoundIds] = useState<Set<string>>(new Set());
  const [checkInCounts, setCheckInCounts] = useState<Record<string, number>>({});
  const [conditionsList, setConditionsList] = useState<any[]>([]);
  // proximity guidance state
  const [devicePos, setDevicePos] = useState<{ latitude: number; longitude: number } | null>(null);
  const [guidedLocationId, setGuidedLocationId] = useState<string | null>(null);

  useEffect(() => {
    if (!huntId) return;
    const db = getFirestore(app);
    const docRef = doc(db, "hunts", huntId);

    const unsub = onSnapshot(docRef, (snap) => {
      if (!snap.exists()) {
        // Deleted remotely
        router.replace("/(app)/(drawer)/(tabs)" as any);
        return;
      }
  const data = { id: snap.id, ...(snap.data() as any) };
  setHunt(data);
  setName((data as any).name || "");
    });

    return () => unsub();
  }, [huntId, router]);

  // listen for locations count for this hunt
  const [locationCount, setLocationCount] = useState<number>(0);
  useEffect(() => {
    if (!huntId) return;
    const db = getFirestore(app);
    const locationsQ = query(collection(db, 'locations'), where('huntId', '==', huntId));
    const unsub = onSnapshot(locationsQ, (snap: QuerySnapshot<DocumentData>) => {
      const items: any[] = [];
      snap.forEach(d => items.push({ id: d.id, ...(d.data() as any) }));
      setLocations(items);
      setLocationCount(snap.size);
    });
    return () => unsub();
  }, [huntId]);

  // watch device position when the user starts guiding
  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    let mounted = true;
    async function startWatch() {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        sub = await Location.watchPositionAsync({ accuracy: Location.LocationAccuracy.Highest, distanceInterval: 5 }, (loc) => {
          if (!mounted) return;
          setDevicePos({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
        });
      } catch (e) {
        console.warn('watchPosition failed', e);
      }
    }
    if (guidedLocationId) startWatch();
    return () => {
      mounted = false;
      if (sub) sub.remove();
    };
  }, [guidedLocationId]);

  function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const toRad = (v: number) => (v * Math.PI) / 180;
    const R = 6371000; // meters
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  function bearingTo(lat1: number, lon1: number, lat2: number, lon2: number) {
    const toRad = (v: number) => (v * Math.PI) / 180;
    const toDeg = (v: number) => (v * 180) / Math.PI;
    const y = Math.sin(toRad(lon2-lon1)) * Math.cos(toRad(lat2));
    const x = Math.cos(toRad(lat1))*Math.sin(toRad(lat2)) - Math.sin(toRad(lat1))*Math.cos(toRad(lat2))*Math.cos(toRad(lon2-lon1));
    const brng = Math.atan2(y, x);
    return (toDeg(brng) + 360) % 360; // degrees
  }

  // subscribe to playerHunt for current user
  useEffect(() => {
    if (!huntId || !user) return;
    const db = getFirestore(app);
    const phQ = query(collection(db, 'playerHunts'), where('userId', '==', user.uid), where('huntId', '==', huntId));
    const unsub = onSnapshot(phQ, (snap) => {
      if (snap.empty) {
        setPlayerHunt(null);
        return;
      }
      const first = snap.docs[0];
      setPlayerHunt({ id: first.id, ...(first.data() as any) });
    });
    return () => unsub();
  }, [huntId, user]);

  // subscribe to checkIns for this hunt to build counts and user's found set
  useEffect(() => {
    if (!huntId) return;
    const db = getFirestore(app);
    const ciQ = query(collection(db, 'checkIns'), where('huntId', '==', huntId));
    const unsub = onSnapshot(ciQ, (snap) => {
      const counts: Record<string, number> = {};
      const userSet = new Set<string>();
      snap.forEach(d => {
        const data: any = d.data();
        const lid = data.locationId;
        if (!lid) return;
        counts[lid] = (counts[lid] || 0) + 1;
        if (user && data.userId === user.uid) userSet.add(lid);
      });
      setCheckInCounts(counts);
      setUserFoundIds(userSet);
    });
    return () => unsub();
  }, [huntId, user]);

  // subscribe to conditions for this hunt
  useEffect(() => {
    if (!huntId) return;
    const db = getFirestore(app);
    const condQ = query(collection(db, 'conditions'), where('huntId', '==', huntId));
    const unsub = onSnapshot(condQ, (snap) => {
      const items: any[] = [];
      snap.forEach(d => items.push({ id: d.id, ...(d.data() as any) }));
      setConditionsList(items);
    });
    return () => unsub();
  }, [huntId]);

  function timeStrToMinutes(t: string) {
    const parts = t.split(':').map((s) => parseInt(s, 10));
    if (parts.length < 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1])) return NaN;
    return parts[0] * 60 + parts[1];
  }

  const round4 = (n: number) => Math.round(n * 10000) / 10000;

  function isLocationAvailable(loc: any) {
    // requiredByLocation and time windows
    const requiredByLocation: Record<string, string[]> = {};
    const timeWindowsByLocation: Record<string, { start: string; end: string }[]> = {};
    conditionsList.forEach((c: any) => {
      if (c.type === 'REQUIRED_LOCATION' && c.locationId && c.requiredLocationId) {
        requiredByLocation[c.locationId] = requiredByLocation[c.locationId] || [];
        requiredByLocation[c.locationId].push(c.requiredLocationId);
      }
      if (c.type === 'TIME_WINDOW' && c.locationId && c.startTime && c.endTime) {
        timeWindowsByLocation[c.locationId] = timeWindowsByLocation[c.locationId] || [];
        timeWindowsByLocation[c.locationId].push({ start: c.startTime, end: c.endTime });
      }
    });

    const required = requiredByLocation[loc.id] || [];
    const requiredOk = required.length === 0 || required.every((rid) => userFoundIds.has(rid));
    if (!requiredOk) return false;

    const windows = timeWindowsByLocation[loc.id] || [];
    if (windows.length === 0) return true;
    const nowUtc = new Date();
    const nowMinutes = nowUtc.getUTCHours() * 60 + nowUtc.getUTCMinutes();
    const anyMatch = windows.some((w) => {
      const s = timeStrToMinutes(w.start);
      const e = timeStrToMinutes(w.end);
      if (Number.isNaN(s) || Number.isNaN(e)) return false;
      if (s <= e) return nowMinutes >= s && nowMinutes <= e;
      return nowMinutes >= s || nowMinutes <= e;
    });
    return anyMatch;
  }

  const ensurePlayerHunt = async () => {
    if (playerHunt) return playerHunt;
    if (!user) throw new Error('not signed in');
    const db = getFirestore(app);
    const q = query(collection(db, 'playerHunts'), where('userId', '==', user.uid), where('huntId', '==', huntId));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const d = snap.docs[0];
      const ph = { id: d.id, ...(d.data() as any) };
      setPlayerHunt(ph);
      return ph;
    }
    const docRef = await addDoc(collection(db, 'playerHunts'), { userId: user.uid, huntId, status: 'STARTED', startTime: serverTimestamp() });
    const ph = { id: docRef.id, userId: user.uid, huntId, status: 'STARTED' };
    setPlayerHunt(ph);
    return ph;
  };

  const handleCheckIn = async (loc: any) => {
    if (!user) return Alert.alert('Sign in required', 'Please sign in to check in');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return Alert.alert('Permission required', 'Location permission is required to check in.');
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.LocationAccuracy.Highest });
      const userLat = round4(pos.coords.latitude);
      const userLon = round4(pos.coords.longitude);
      const locLat = round4(Number(loc.latitude));
      const locLon = round4(Number(loc.longitude));
      if (Number.isNaN(locLat) || Number.isNaN(locLon)) return Alert.alert('Location error', 'This location is missing valid coordinates.');
      if (userLat !== locLat || userLon !== locLon) return Alert.alert('Too far', 'You are not close enough to the location.');

      // ensure playerHunt exists
      const ph = await ensurePlayerHunt();
      // write checkIn
      const db = getFirestore(app);
      await addDoc(collection(db, 'checkIns'), { userId: user.uid, huntId, locationId: loc.id, timestamp: serverTimestamp() });

      // after checkin, if all locations done, mark completed
      // compute user's found count
      const userFound = new Set(userFoundIds);
      userFound.add(loc.id);
      const total = locations.length;
      if (userFound.size >= total && ph && ph.id) {
        const playerRef = doc(db, 'playerHunts', ph.id);
        await updateDoc(playerRef, { status: 'COMPLETED', completedAt: serverTimestamp() });
      }
      Alert.alert('Checked in', 'Successfully checked in!');
    } catch (e) {
      console.error('check-in failed', e);
      Alert.alert('Error', 'Could not complete check-in');
    }
  };

  const handleAbandon = () => {
    if (!playerHunt) return Alert.alert('Not started', 'You have not started this hunt');
    Alert.alert('Abandon hunt', 'Are you sure? All progress will be lost.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Abandon', style: 'destructive', onPress: async () => {
        try {
          const db = getFirestore(app);
          if (!user) throw new Error('Not signed in');
          // delete player's checkIns for this hunt
          const ciQ = query(collection(db, 'checkIns'), where('userId', '==', user.uid), where('huntId', '==', huntId));
          const ciSnap = await getDocs(ciQ);
          const batch = writeBatch(db);
          ciSnap.forEach(d => batch.delete(d.ref));
          // delete playerHunt doc
          const phRef = doc(db, 'playerHunts', playerHunt.id);
          batch.delete(phRef);
          await batch.commit();
          setPlayerHunt(null);
          Alert.alert('Abandoned', 'Your progress has been removed.');
        } catch (e) {
          console.error('abandon failed', e);
          Alert.alert('Error', 'Could not abandon hunt');
        }
      }}
    ]);
  };

  const handleSave = async () => {
    if (!hunt) return;
    if (!user) return Alert.alert("Unauthorized", "You must be signed in to edit this hunt.");
    if (hunt.userId !== user.uid) return Alert.alert("Forbidden", "You don't own this hunt.");
    const trimmed = name.trim();
    if (!trimmed) return Alert.alert("Name required", "Please enter a hunt name");
    if (trimmed.length > 255) return Alert.alert("Too long", "Name must be <= 255 characters");

    setSaving(true);
    try {
      const db = getFirestore(app);
  const docRef = doc(db, "hunts", huntId);
  await updateDoc(docRef, { name: trimmed });
      Alert.alert("Saved", "Hunt name updated.");
    } catch (e) {
      console.error(e);
      Alert.alert("Save failed", "Could not save changes.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!hunt) return;
    if (!user) return Alert.alert("Unauthorized", "You must be signed in to delete this hunt.");
    if (hunt.userId !== user.uid) return Alert.alert("Forbidden", "You don't own this hunt.");

    Alert.alert("Confirm delete", "Are you sure you want to delete this hunt?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const db = getFirestore(app);
            await deleteDoc(doc(db, "hunts", huntId));
            router.replace("/(app)" as any);
          } catch (e) {
            console.error(e);
            Alert.alert("Delete failed", "Could not delete hunt.");
          }
        },
      },
    ]);
  };

  // Start hunt for current user (creates playerHunt)
  const handleStartHunt = async () => {
    if (!user) return Alert.alert('Sign in required', 'Please sign in to start this hunt');
    try {
      const db = getFirestore(app);
      // ensure we don't create duplicates
      const q = query(collection(db, 'playerHunts'), where('userId', '==', user.uid), where('huntId', '==', huntId));
      const snap = await getDocs(q);
      if (!snap.empty) {
        Alert.alert('Already started', 'You have already started this hunt');
        return;
      }
      await addDoc(collection(db, 'playerHunts'), {
        userId: user.uid,
        huntId,
        status: 'STARTED',
        startTime: serverTimestamp(),
        completionTime: null,
      });
      Alert.alert('Hunt started', 'Good luck!');
    } catch (e) {
      console.error('startHunt failed', e);
      Alert.alert('Error', 'Could not start hunt');
    }
  };


  if (!hunt) return (
    <View style={{flex:1,justifyContent:'center',alignItems:'center'}}><Text>Loading...</Text></View>
  )

  return (
    <View style={{ padding: 16 }}>
      <Text style={{ marginBottom: 8, color: '#444' }}>Locations in this hunt: {locationCount}</Text>
      <Pressable onPress={() => router.push(`/LocationList?huntId=${huntId}` as any)} style={{ padding: 10, backgroundColor: '#eee', borderRadius: 6, marginBottom: 12 }}>
        <Text>{isOwner ? 'Manage Locations' : 'View Locations'}</Text>
      </Pressable>

      {/* Preview list for hunts not yet started by this user */}
      { !playerHunt && locations && locations.length > 0 ? (
        <View style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 8 }}>Locations (preview)</Text>
          {locations.map((loc) => (
            <View key={loc.id} style={{ padding: 10, borderWidth: 1, borderColor: '#eee', borderRadius: 6, marginBottom: 8, backgroundColor: '#fafafa' }}>
              <Text style={{ fontSize: 14, fontWeight: '600' }}>🔒 {loc.locationName || 'Location'}</Text>
              {loc.explanation ? <Text style={{ color: '#666', marginTop: 6 }}>{loc.explanation}</Text> : <Text style={{ color: '#999', marginTop: 6 }}>Clue not provided</Text>}
            </View>
          ))}
        </View>
      ) : null}

      { !playerHunt ? (
        <Pressable onPress={handleStartHunt} style={{ padding: 10, backgroundColor: '#16a34a', borderRadius: 6, marginBottom: 12 }}>
          <Text style={{ color: '#fff' }}>Start Playing Hunt</Text>
        </Pressable>
      ) : null}

      {/* Abandon button for users who have started this hunt (only when STARTED) */}
      { playerHunt && playerHunt.status === 'STARTED' ? (
        <Pressable onPress={handleAbandon} style={{ padding: 10, backgroundColor: '#ff4d4f', borderRadius: 6, marginBottom: 12 }}>
          <Text style={{ color: '#fff' }}>Abandon Hunt</Text>
        </Pressable>
      ) : null }
      
      {/* Location progress: name/clue, completion flag for current user, and total check-ins */}
      <View style={{ marginTop: 8, marginBottom: 16 }}>
        <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 8 }}>Location Progress</Text>
        {locations.length === 0 ? (
          <Text style={{ color: '#666' }}>No locations yet</Text>
        ) : (
          locations.map((loc) => {
            const completed = userFoundIds ? userFoundIds.has(loc.id) : false;
            const total = checkInCounts[loc.id] || 0;
            // compute availability for guidance
            const available = isLocationAvailable(loc);
            return (
              <View key={loc.id} style={{ padding: 10, borderWidth: 1, borderColor: '#eee', borderRadius: 6, marginBottom: 8 }}>
                <Text style={{ fontSize: 15, fontWeight: '600' }}>{loc.locationName || 'Location'}</Text>
                {loc.explanation ? <Text style={{ color: '#666', marginTop: 6 }}>{loc.explanation}</Text> : null}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                  <Text style={{ color: completed ? '#059669' : '#9ca3af' }}>{completed ? '✅ Completed' : '⭕ Not completed'}</Text>
                  <Text style={{ color: '#333' }}>Check-ins: {total}</Text>
                </View>
                {/* Guidance controls: show Guide button when available */}
                {available && !completed ? (
                  <View style={{ marginTop: 8 }}>
                    <View style={{ flexDirection: 'row' }}>
                      <Pressable onPress={() => setGuidedLocationId(loc.id)} style={{ padding: 8, backgroundColor: '#0ea5df', borderRadius: 6 }}>
                        <Text style={{ color: '#fff' }}>Guide</Text>
                      </Pressable>
                    </View>

                    <View style={{ marginTop: 8 }}>
                      {loc.latitude != null && loc.longitude != null ? (
                        <View style={{ borderRadius: 8, overflow: 'hidden' }}>
                          <RuntimeMap latitude={Number(loc.latitude)} longitude={Number(loc.longitude)} devicePos={devicePos} width={Dimensions.get('window').width - 32} height={160} />
                        </View>
                      ) : null}
                    </View>
                  </View>
                ) : null}
                {/* If this loc is currently guided show distance/bearing */}
                { guidedLocationId === loc.id && devicePos ? (
                  (() => {
                    const d = haversineDistance(devicePos.latitude, devicePos.longitude, Number(loc.latitude), Number(loc.longitude));
                    const b = bearingTo(devicePos.latitude, devicePos.longitude, Number(loc.latitude), Number(loc.longitude));
                    return (
                      <View style={{ marginTop: 8 }}>
                        <Text style={{ color: '#111' }}>Distance: {d >= 1000 ? `${(d/1000).toFixed(2)} km` : `${Math.round(d)} m`}</Text>
                        <Text style={{ color: '#111' }}>Bearing: {Math.round(b)}°</Text>
                        <Pressable onPress={() => setGuidedLocationId(null)} style={{ marginTop: 8, padding: 8, backgroundColor: '#ef4444', borderRadius: 6 }}>
                          <Text style={{ color: '#fff' }}>Stop guiding</Text>
                        </Pressable>
                      </View>
                    );
                  })()
                ) : null}
              </View>
            );
            
          })
        )}
      </View>
      {isOwner ? (
        <>
          <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 8 }}>Edit Hunt</Text>

          <TextInput
            value={name}
            onChangeText={setName}
            style={{ borderWidth: 1, borderColor: '#ddd', padding: 8, borderRadius: 6, marginBottom: 12 }}
            maxLength={255}
          />

          

          <Pressable onPress={handleSave} style={{ backgroundColor: '#1f6feb', padding: 12, borderRadius: 6, marginBottom: 8 }}>
            <Text style={{ color: '#fff' }}>{saving ? 'Saving...' : 'Save'}</Text>
          </Pressable>

          <Pressable onPress={handleDelete} style={{ backgroundColor: '#ff4d4f', padding: 12, borderRadius: 6 }}>
            <Text style={{ color: '#fff' }}>Delete Hunt</Text>
          </Pressable>
        </>
    ) : (
        <View style={{ marginTop: 12 }}>
          <Text style={{ fontSize: 20, fontWeight: '700' }}>{hunt.name}</Text>
        </View>
      )}
    </View>
  )
}
