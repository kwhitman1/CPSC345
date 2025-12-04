import React, { useEffect, useState } from "react";
import { TextInput, Alert, FlatList, Pressable } from "react-native";
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useLocalSearchParams, useRouter } from "expo-router";
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, getDoc, serverTimestamp, getFirestore } from "firebase/firestore";
import app, { getFirebaseAuth } from "@/lib/firebase-config";

type Condition = {
  id: string;
  type: "REQUIRED_LOCATION" | "TIME_WINDOW";
  locationId: string;
  requiredLocationId?: string;
  startTime?: string; // stored as UTC "HH:MM:00"
  endTime?: string;   // stored as UTC "HH:MM:00"
};

export default function ConditionEdit() {
  const params = useLocalSearchParams() as { locationId?: string };
  const router = useRouter();
  const locationId = params.locationId;
  const db = getFirestore(app);

  const [conditions, setConditions] = useState<Condition[]>([]);
  const [loading, setLoading] = useState(true);

  const [formType, setFormType] = useState<Condition["type"]>("REQUIRED_LOCATION");
  const [requiredLocationId, setRequiredLocationId] = useState<string | undefined>(undefined);
  const [startLocal, setStartLocal] = useState(""); // "HH:MM"
  const [endLocal, setEndLocal] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const [siblingLocations, setSiblingLocations] = useState<{ id: string; name: string }[]>([]);
  const [huntId, setHuntId] = useState<string | null>(null);

  useEffect(() => {
    if (!locationId) return;
    // load location to get huntId and sibling locations
    (async () => {
      const locSnap = await getDoc(doc(db, "locations", locationId));
      if (!locSnap.exists()) {
        Alert.alert("Error", "Location not found");
        return;
      }
      const locData = locSnap.data() as any;
      setHuntId(locData.huntId || null);

      if (locData.huntId) {
        const q = query(collection(db, "locations"), where("huntId", "==", locData.huntId));
        const unsub = onSnapshot(q, (snap) => {
          const items: { id: string; name: string }[] = [];
          snap.forEach((d) => {
            if (d.id === locationId) return; // exclude self
            const dd: any = d.data();
            items.push({ id: d.id, name: dd.locationName || `Location ${d.id}` });
          });
          setSiblingLocations(items);
        });
        return () => unsub();
      }
    })();
  }, [locationId]);

  useEffect(() => {
    if (!locationId) return;
    setLoading(true);
    const q = query(collection(db, "conditions"), where("locationId", "==", locationId));
    const unsub = onSnapshot(q, (snap) => {
      const list: Condition[] = [];
      snap.forEach((d) => {
        const data = d.data() as any;
        list.push({
          id: d.id,
          type: data.type,
          locationId: data.locationId,
          requiredLocationId: data.requiredLocationId,
          startTime: data.startTime,
          endTime: data.endTime,
        });
      });
      setConditions(list);
      setLoading(false);
    }, (err) => {
      console.error("conditions onSnapshot error", err);
      setLoading(false);
    });
    return () => unsub();
  }, [locationId]);

  function localTimeToUTCString(timeLocal: string) {
    // timeLocal -> "HH:MM" (local) -> returns "HH:MM:00" (UTC)
    const parts = timeLocal.split(":").map((s) => parseInt(s, 10));
    if (parts.length < 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1])) return "";
    const now = new Date();
    now.setHours(parts[0], parts[1], 0, 0);
    const uh = now.getUTCHours().toString().padStart(2, "0");
    const um = now.getUTCMinutes().toString().padStart(2, "0");
    return `${uh}:${um}:00`;
  }

  function utcStringToLocal(timeUTC?: string) {
    // "HH:MM:00" (UTC) -> "HH:MM" (local)
    if (!timeUTC) return "";
    const parts = timeUTC.split(":").map((s) => parseInt(s, 10));
    if (parts.length < 2) return "";
    const d = new Date();
    d.setUTCHours(parts[0], parts[1], 0, 0);
    return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  }

  async function handleSave() {
    if (!locationId) return Alert.alert("Error", "Missing locationId");
    const auth = getFirebaseAuth();
    if (!auth.currentUser) {
      return Alert.alert("Not signed in", "Please sign in and try again.");
    }

    if (formType === "REQUIRED_LOCATION") {
      if (!requiredLocationId) return Alert.alert("Validation", "Select a required location.");
    } else {
      // TIME_WINDOW
      if (!startLocal || !endLocal) return Alert.alert("Validation", "Enter start and end time.");
      // basic format validation
      if (!/^\d{2}:\d{2}$/.test(startLocal) || !/^\d{2}:\d{2}$/.test(endLocal)) {
        return Alert.alert("Validation", "Time must be in HH:MM format.");
      }
    }

    try {
      const payload: any = {
        locationId,
        type: formType,
        createdAt: serverTimestamp(),
      };

      if (formType === "REQUIRED_LOCATION") {
        payload.requiredLocationId = requiredLocationId;
      } else {
        payload.startTime = localTimeToUTCString(startLocal);
        payload.endTime = localTimeToUTCString(endLocal);
      }

      if (editingId) {
        await updateDoc(doc(db, "conditions", editingId), payload);
        setEditingId(null);
      } else {
        await addDoc(collection(db, "conditions"), payload);
      }

      // clear form
      setRequiredLocationId(undefined);
      setStartLocal("");
      setEndLocal("");
      setFormType("REQUIRED_LOCATION");
      Alert.alert("Saved");
    } catch (e) {
      console.error("save condition error", e);
      Alert.alert("Error", (e as any)?.message || "Failed to save condition");
    }
  }

  function startEdit(cond: Condition) {
    setEditingId(cond.id);
    setFormType(cond.type);
    setRequiredLocationId(cond.requiredLocationId);
    setStartLocal(utcStringToLocal(cond.startTime));
    setEndLocal(utcStringToLocal(cond.endTime));
  }

  async function handleDelete(cond: Condition) {
    Alert.alert("Confirm", "Delete this condition?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteDoc(doc(db, "conditions", cond.id));
          } catch (e) {
            console.error("delete condition error", e);
            Alert.alert("Error", "Failed to delete");
          }
        },
      },
    ]);
  }

  if (!locationId) {
    return (
      <ThemedView style={{ flex: 1, padding: 16, justifyContent: "center", alignItems: "center" }}>
        <ThemedText>Missing locationId</ThemedText>
      </ThemedView>
    );
  }
  const bg = useThemeColor({}, 'background');
  const tint = useThemeColor({}, 'tint');

  return (
    <ThemedView style={{ flex: 1, padding: 16, backgroundColor: bg }}>
      <ThemedText style={{ fontSize: 18, fontWeight: "600", marginBottom: 12 }}>Conditions for location</ThemedText>

      <ThemedView style={{ marginBottom: 12 }}>
        <ThemedText style={{ marginBottom: 6 }}>Type</ThemedText>
        <ThemedView style={{ flexDirection: "row", gap: 8 }}>
          <Pressable onPress={() => setFormType("REQUIRED_LOCATION")} style={{ padding: 8, backgroundColor: formType === "REQUIRED_LOCATION" ? tint : undefined }}>
            <ThemedText>Required Location</ThemedText>
          </Pressable>
          <Pressable onPress={() => setFormType("TIME_WINDOW")} style={{ padding: 8, backgroundColor: formType === "TIME_WINDOW" ? tint : undefined }}>
            <ThemedText>Time Window</ThemedText>
          </Pressable>
        </ThemedView>
      </ThemedView>

      {formType === "REQUIRED_LOCATION" ? (
        <ThemedView style={{ marginBottom: 12 }}>
          <ThemedText style={{ marginBottom: 6 }}>Required Location</ThemedText>
          {siblingLocations.length === 0 ? (
            <ThemedText style={{ color: "#666" }}>No other locations in this hunt</ThemedText>
          ) : (
            siblingLocations.map((loc) => (
              <Pressable key={loc.id} onPress={() => setRequiredLocationId(loc.id)} style={{ padding: 8, backgroundColor: requiredLocationId === loc.id ? tint : undefined, marginBottom: 6 }}>
                <ThemedText>{loc.name}</ThemedText>
              </Pressable>
            ))
          )}
        </ThemedView>
      ) : (
        <ThemedView style={{ marginBottom: 12 }}>
          <ThemedText style={{ marginBottom: 6 }}>Start Time (local HH:MM)</ThemedText>
          <TextInput value={startLocal} onChangeText={setStartLocal} placeholder="08:30" style={{ borderWidth: 1, padding: 8, marginBottom: 8 }} />
          <ThemedText style={{ marginBottom: 6 }}>End Time (local HH:MM)</ThemedText>
          <TextInput value={endLocal} onChangeText={setEndLocal} placeholder="14:00" style={{ borderWidth: 1, padding: 8 }} />
        </ThemedView>
      )}

      <Pressable onPress={handleSave} style={{ padding: 10, backgroundColor: tint, borderRadius: 6 }}>
        <ThemedText style={{ color: '#fff' }}>{editingId ? "Save changes" : "Add condition"}</ThemedText>
      </Pressable>

      <ThemedView style={{ height: 1, backgroundColor: "#eee", marginVertical: 12 }} />

      <ThemedText style={{ fontSize: 16, marginBottom: 8 }}>Existing conditions</ThemedText>
      {loading ? (
        <ThemedText>Loading...</ThemedText>
      ) : conditions.length === 0 ? (
        <ThemedText style={{ color: "#666" }}>No conditions</ThemedText>
      ) : (
        <FlatList
          data={conditions}
          keyExtractor={(i) => i.id}
          renderItem={({ item }) => (
            <ThemedView style={{ padding: 8, borderWidth: 1, borderColor: "#eee", marginBottom: 8 }}>
              <ThemedText style={{ fontWeight: "600" }}>{item.type}</ThemedText>
              {item.type === "REQUIRED_LOCATION" ? (
                <ThemedText>Requires location: {item.requiredLocationId}</ThemedText>
              ) : (
                <ThemedText>
                  Time window: {utcStringToLocal(item.startTime)} - {utcStringToLocal(item.endTime)} (local)
                </ThemedText>
              )}
              <ThemedView style={{ flexDirection: "row", marginTop: 8 }}>
                <Pressable onPress={() => startEdit(item)} style={{ padding: 8, backgroundColor: tint, borderRadius: 6 }}>
                  <ThemedText>Edit</ThemedText>
                </Pressable>
                <ThemedView style={{ width: 12 }} />
                <Pressable onPress={() => handleDelete(item)} style={{ padding: 8, backgroundColor: '#ff4d4f', borderRadius: 6 }}>
                  <ThemedText style={{ color: '#fff' }}>Delete</ThemedText>
                </Pressable>
              </ThemedView>
            </ThemedView>
          )}
        />
      )}
      <ThemedView style={{ height: 20 }} />
      <Pressable onPress={() => router.back()} style={{ padding: 10 }}>
        <ThemedText>Done</ThemedText>
      </Pressable>
    </ThemedView>
  );
}