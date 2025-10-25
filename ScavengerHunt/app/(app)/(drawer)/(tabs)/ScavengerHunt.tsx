import React, { useEffect, useState } from "react";
import { View, Text, TextInput, FlatList, Pressable, Alert } from "react-native";
import { useSession } from "@/context";
import { useRouter } from "expo-router";
import { useDispatch, useSelector } from 'react-redux';
import { setHunts, addHunt } from '@/store/huntsSlice';
import { RootState } from '@/store/store';
import {
  getFirestore,
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  getDocs,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import app from "@/lib/firebase-config";

export default function ScavengerHunt() {
  const { user } = useSession();
  const router = useRouter();
  const dispatch = useDispatch();
  const hunts = useSelector((s: RootState) => s.hunts.items);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!user) return;
    const db = getFirestore(app);
    const q = query(
      collection(db, "hunts"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const items: any[] = [];
      snapshot.forEach((doc) => items.push({ id: doc.id, ...doc.data() }));
      dispatch(setHunts(items));
    });

    return () => unsub();
  }, [user]);

  const handleCreate = async () => {
    if (!user) return;
    const trimmed = name.trim();
    if (!trimmed) return Alert.alert("Name required", "Please enter a hunt name");
    if (trimmed.length > 255) return Alert.alert("Name too long", "Max 255 characters");

    setCreating(true);
    try {
      const db = getFirestore(app);
      const existing = await getDocs(
        query(collection(db, "hunts"), where("userId", "==", user.uid), where("name", "==", trimmed))
      );
      if (!existing.empty) {
        Alert.alert("Name exists", "You already have a hunt with that name. Pick a unique name.");
        setCreating(false);
        return;
      }

      const docRef = await addDoc(collection(db, "hunts"), {
        name: trimmed,
        userId: user.uid,
        createdAt: serverTimestamp(),
      });

  setName("");
  dispatch(addHunt({ id: docRef.id, name: trimmed, userId: user.uid, createdAt: new Date() }));
  router.push(`/hunt/${docRef.id}` as any);
    } catch (e) {
      console.error(e);
      Alert.alert("Create failed", "Could not create hunt");
    } finally {
      setCreating(false);
    }
  };

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 20, fontWeight: "bold", marginBottom: 8 }}>Your Hunts</Text>

      <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
        <TextInput
          placeholder="New hunt name"
          value={name}
          onChangeText={setName}
          style={{ flex: 1, borderWidth: 1, borderColor: "#ddd", padding: 8, borderRadius: 6 }}
          maxLength={255}
        />
        <Pressable onPress={handleCreate} style={{ padding: 10, backgroundColor: "#1f6feb", borderRadius: 6 }}>
          <Text style={{ color: "#fff" }}>{creating ? "..." : "Create"}</Text>
        </Pressable>
      </View>

      <FlatList
        data={hunts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/hunt/${item.id}` as any)}
            style={{ padding: 12, borderBottomWidth: 1, borderColor: "#eee" }}
          >
            <Text style={{ fontSize: 16 }}>{item.name}</Text>
            <Text style={{ fontSize: 12, color: "#666" }}>{item.id}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}
