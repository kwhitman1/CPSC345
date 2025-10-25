import React, { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, Alert } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import {
  getFirestore,
  doc,
  getDoc,
  onSnapshot,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import app from "@/lib/firebase-config";
import { useSession } from "@/context";

export default function HuntDetail() {
  const params = useLocalSearchParams();
  const { huntId } = params as { huntId: string };
  const [hunt, setHunt] = useState<any>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const { user } = useSession();

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

  if (!hunt) return (
    <View style={{flex:1,justifyContent:'center',alignItems:'center'}}><Text>Loading...</Text></View>
  )

  return (
    <View style={{ padding: 16 }}>
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
    </View>
  )
}
