import React, { useEffect, useState } from "react";
import { TextInput, FlatList, Alert, Switch } from "react-native";
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';
import { Pressable } from 'react-native';
import { useSession } from "@/context";
import { useRouter } from "expo-router";
import { useDispatch, useSelector } from 'react-redux';
import { setHunts, addHunt, removeHunt } from '@/store/huntsSlice';
import { RootState } from '@/store/store';
import { getFirestore, collection, query, where, onSnapshot, addDoc, getDocs, orderBy, serverTimestamp, writeBatch, doc, deleteDoc, updateDoc } from "firebase/firestore";
import app, { getFirebaseAuth } from "@/lib/firebase-config";

export default function ScavengerHunt() {
  const { user } = useSession();
  const router = useRouter();
  const dispatch = useDispatch();
  const hunts = useSelector((s: RootState) => s.hunts.items);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [multiMode, setMultiMode] = useState(false);

  // theme colors (call hooks at top-level of component)
  const tint = useThemeColor({}, 'tint');
  const iconColor = useThemeColor({}, 'icon');

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
      snapshot.forEach((d) => {
        const raw = d.data() as any;
        items.push({
          id: d.id,
          name: raw.name,
          userId: raw.userId,
          isVisible: raw.isVisible ?? false,
          createdAt: raw.createdAt && raw.createdAt.toDate ? raw.createdAt.toDate().toISOString() : null,
        });
      });
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
        isVisible: false,
        createdAt: serverTimestamp(),
      });

  setName("");
  dispatch(addHunt({ id: docRef.id, name: trimmed, userId: user.uid, createdAt: new Date().toISOString() }));
  router.push(`/hunt/${docRef.id}` as any);
    } catch (e) {
      console.error(e);
      Alert.alert("Create failed", "Could not create hunt");
    } finally {
      setCreating(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const clearSelection = () => {
    setSelected({});
  };

  const handleBulkDelete = async () => {
    const ids = Object.keys(selected).filter((id) => selected[id]);
    if (ids.length === 0) return Alert.alert("No selection", "Please select hunts to delete.");

    Alert.alert(
      "Delete hunts",
      `Delete ${ids.length} hunt(s)? This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
            onPress: async () => {
            try {
              const db = getFirestore(app);
              const batch = writeBatch(db);

              for (const id of ids) {
                const locationsQ = query(collection(db, 'locations'), where('huntId', '==', id));
                const locSnap = await getDocs(locationsQ);
                locSnap.forEach((locDoc) => {
                  const locId = locDoc.id;
                });


                for (const locDoc of locSnap.docs) {
                  const condSnap = await getDocs(query(collection(db, 'conditions'), where('locationId', '==', locDoc.id)));
                  condSnap.forEach((c) => batch.delete(doc(db, 'conditions', c.id)));
                  batch.delete(doc(db, 'locations', locDoc.id));
                }

                batch.delete(doc(db, 'hunts', id));
              }

              await batch.commit();
              ids.forEach((id) => dispatch(removeHunt(id)));
              clearSelection();
            } catch (e) {
              console.error(e);
              Alert.alert("Delete failed", "Could not delete selected hunts.");
            }
          },
        },
      ]
    );
  };

  return (
    <ThemedView style={{ flex: 1, padding: 16 }}>
      <ThemedView style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <ThemedText style={{ fontSize: 20, fontWeight: "bold" }}>Your Hunts</ThemedText>
          <ThemedView style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable onPress={handleBulkDelete} style={{ padding: 8, backgroundColor: Object.values(selected).filter(Boolean).length ? tint : iconColor, borderRadius: 6 }}>
              <ThemedText style={{ color: '#000' }}>Delete Selected ({Object.values(selected).filter(Boolean).length})</ThemedText>
            </Pressable>
            <Pressable onPress={clearSelection} style={{ padding: 8, backgroundColor: iconColor, borderRadius: 6, marginLeft: 8 }}>
              <ThemedText style={{ color: '#000' }}>Clear</ThemedText>
            </Pressable>
          </ThemedView>
      </ThemedView>

      <ThemedView style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
        <TextInput
          placeholder="New hunt name"
          value={name}
          onChangeText={setName}
          style={{ flex: 1, borderWidth: 1, borderColor: iconColor as string, padding: 8, borderRadius: 6 }}
          maxLength={255}
        />
  <Pressable onPress={handleCreate} style={{ padding: 10, backgroundColor: tint, borderRadius: 6 }}>
          <ThemedText style={{ color: "#000" }}>{creating ? "Create" : "Create"}</ThemedText>
        </Pressable>
      </ThemedView>

      <FlatList
        data={hunts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => (multiMode ? toggleSelect(item.id) : router.push(`/hunt/${item.id}` as any))}
            style={{ padding: 12, borderBottomWidth: 1, borderColor: iconColor as string, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <ThemedView style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Pressable onPress={() => toggleSelect(item.id)} style={{ padding: 8 }}>
                <ThemedText>{selected[item.id] ? '☑️' : '⬜'}</ThemedText>
              </Pressable>
              <ThemedText style={{ fontSize: 16 }}>{item.name}</ThemedText>
            </ThemedView>
            <ThemedView style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <ThemedText style={{ marginRight: 8 }}>{(item as any).isVisible ? 'Public' : 'Private'}</ThemedText>
              <Switch value={!!(item as any).isVisible} onValueChange={async (val) => {
                try {
                  const db = getFirestore(app);
                  await updateDoc(doc(db, 'hunts', item.id), { isVisible: val });
                } catch (e) {
                  console.error(e);
                  Alert.alert('Update failed', 'Could not update visibility');
                }
              }} />
            </ThemedView>
          </Pressable>
        )}
      />
    </ThemedView>
  );
}
