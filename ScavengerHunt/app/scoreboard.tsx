import React, { useEffect, useState } from 'react';
import { FlatList, Image, Pressable, View } from 'react-native';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import app from '@/lib/firebase-config';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import { useRouter } from 'expo-router';

type LeaderEntry = {
  huntId: string;
  displayName: string | null; // hunt name
  coverImageUrl: string | null;
  completedCount: number;
};

const ScoreboardScreen = () => {
  const [leaders, setLeaders] = useState<LeaderEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let mounted = true;
    const db = getFirestore(app);

    (async () => {
      try {
        // 1) Query playerHunts where status == 'COMPLETED' and count per huntId
        const phQ = query(collection(db, 'playerHunts'), where('status', '==', 'COMPLETED'));
        const phSnap = await getDocs(phQ);

        const counts: Record<string, number> = {};
        const huntIds: Set<string> = new Set();
        phSnap.forEach(doc => {
          const data = doc.data() as any;
          const hid = data?.huntId;
          if (!hid) return;
          huntIds.add(hid);
          counts[hid] = (counts[hid] || 0) + 1;
        });

        if (huntIds.size === 0) {
          if (mounted) {
            setLeaders([]);
            setLoading(false);
          }
          return;
        }

        // 2) Fetch hunts docs for these huntIds in chunks
        const ids = Array.from(huntIds);
        const huntMap: Record<string, any> = {};
        for (let i = 0; i < ids.length; i += 10) {
          const chunk = ids.slice(i, i + 10);
          // fetch all hunts in this chunk by id
          const hQ = query(collection(db, 'hunts'));
          const hSnap = await getDocs(hQ);
          hSnap.forEach(h => {
            if (chunk.includes(h.id)) huntMap[h.id] = h.data();
          });
        }

        // 3) Build the leader list by hunts
        const list: LeaderEntry[] = ids.map(id => ({
          huntId: id,
          displayName: huntMap[id]?.name || huntMap[id]?.displayName || null,
          coverImageUrl: huntMap[id]?.coverImageUrl || null,
          completedCount: counts[id] || 0,
        }));

        // 5) Sort descending by completedCount
        list.sort((a, b) => b.completedCount - a.completedCount);

        if (mounted) {
          setLeaders(list);
          setLoading(false);
        }
      } catch (err) {
        console.warn('Scoreboard load failed', err);
        if (mounted) setLoading(false);
      }
    })();

    return () => { mounted = false; };
  }, []);

  return (
    <ThemedView style={{ flex: 1, padding: 16 }}>
      <ThemedText style={{ fontSize: 20, fontWeight: '700', marginBottom: 12 }}>Global Scoreboard</ThemedText>
      {loading ? (
        <ThemedText>Loading...</ThemedText>
      ) : (
        <FlatList
          data={leaders}
          keyExtractor={(i) => i.huntId}
          renderItem={({ item, index }) => (
            <Pressable onPress={() => router.push((`/hunt/${item.huntId}`) as any)} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eee' }}>
              <ThemedText style={{ width: 36, fontWeight: '700' }}>{index + 1}</ThemedText>
              {item.coverImageUrl ? (
                <Image source={{ uri: item.coverImageUrl }} style={{ width: 48, height: 48, borderRadius: 6, marginRight: 12 }} />
              ) : (
                <ThemedView style={{ width: 48, height: 48, borderRadius: 6, backgroundColor: '#ddd', marginRight: 12, alignItems: 'center', justifyContent: 'center' }}>
                  <ThemedText>{item.displayName ? item.displayName[0] : '?'}</ThemedText>
                </ThemedView>
              )}
              <ThemedView style={{ flex: 1 }}>
                <ThemedText style={{ fontWeight: '600' }}>{item.displayName || item.huntId}</ThemedText>
                <ThemedText style={{ color: '#666' }}>{item.completedCount} completed</ThemedText>
              </ThemedView>
            </Pressable>
          )}
        />
      )}
    </ThemedView>
  );
};

export default ScoreboardScreen;
