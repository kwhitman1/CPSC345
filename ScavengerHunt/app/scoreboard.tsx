import React, { useEffect, useState } from 'react';
import { FlatList, Image, Pressable, View } from 'react-native';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import app from '@/lib/firebase-config';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import { useRouter } from 'expo-router';

type LeaderEntry = {
  userId: string;
  displayName: string | null;
  profileImageUrl: string | null;
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
        // 1) Query playerHunts where status == 'COMPLETED'
        const phQ = query(collection(db, 'playerHunts'), where('status', '==', 'COMPLETED'));
        const phSnap = await getDocs(phQ);

        // 2) Group by userId and count
        const counts: Record<string, number> = {};
        const userIds: Set<string> = new Set();
        phSnap.forEach(doc => {
          const data = doc.data() as any;
          const uid = data?.userId;
          if (!uid) return;
          userIds.add(uid);
          counts[uid] = (counts[uid] || 0) + 1;
        });

        if (userIds.size === 0) {
          if (mounted) {
            setLeaders([]);
            setLoading(false);
          }
          return;
        }

        // 3) Fetch user docs for these userIds in chunks
        const ids = Array.from(userIds);
        const userMap: Record<string, any> = {};
        for (let i = 0; i < ids.length; i += 10) {
          const chunk = ids.slice(i, i + 10);
          const uQ = query(collection(db, 'users'));
          const uSnap = await getDocs(uQ);
          uSnap.forEach(u => {
            const d = u.data() as any;
            if (chunk.includes(u.id)) userMap[u.id] = d;
          });
        }

        // 4) Build the leader list
        const list: LeaderEntry[] = ids.map(id => ({
          userId: id,
          displayName: userMap[id]?.displayName || null,
          profileImageUrl: userMap[id]?.profileImageUrl || null,
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
          keyExtractor={(i) => i.userId}
          renderItem={({ item, index }) => (
            <Pressable onPress={() => router.push((`/user/${item.userId}`) as any)} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eee' }}>
              <ThemedText style={{ width: 36, fontWeight: '700' }}>{index + 1}</ThemedText>
              {item.profileImageUrl ? (
                <Image source={{ uri: item.profileImageUrl }} style={{ width: 48, height: 48, borderRadius: 24, marginRight: 12 }} />
              ) : (
                <ThemedView style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#ddd', marginRight: 12, alignItems: 'center', justifyContent: 'center' }}>
                  <ThemedText>{item.displayName ? item.displayName[0] : '?'}</ThemedText>
                </ThemedView>
              )}
              <ThemedView style={{ flex: 1 }}>
                <ThemedText style={{ fontWeight: '600' }}>{item.displayName || item.userId}</ThemedText>
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
