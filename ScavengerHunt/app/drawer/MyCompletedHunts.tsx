import React, { useEffect, useState } from 'react';
import { FlatList, ActivityIndicator, Pressable, SafeAreaView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useRouter } from 'expo-router';
import { getFirestore, collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import app from '@/lib/firebase-config';
import { useSession } from '@/context';

export default function MyCompletedHunts() {
  const db = getFirestore(app);
  const router = useRouter();
  const { user } = useSession();

  const [loading, setLoading] = useState(true);
  const [completedHunts, setCompletedHunts] = useState<any[]>([]);
  const [progressMap, setProgressMap] = useState<Record<string, number | null>>({});
  const border = useThemeColor({}, 'icon');
  const tint = useThemeColor({}, 'tint');
  const text = useThemeColor({}, 'text');
  const background = useThemeColor({}, 'background');
  const insets = useSafeAreaInsets();
  const TOP_SAFE_EXTRA = 64; // extra offset to keep header / burger menu from overlapping top content

  useEffect(() => {
    if (!user) {
      setCompletedHunts([]);
      setLoading(false);
      return;
    }
    const q = query(collection(db, 'playerHunts'), where('userId', '==', user.uid), where('status', '==', 'COMPLETED'));
    const unsub = onSnapshot(q, async (snap) => {
      const entries: any[] = [];
      snap.forEach(d => entries.push({ id: d.id, ...(d.data() as any) }));

      const huntIds = Array.from(new Set(entries.map(e => e.huntId).filter(Boolean)));
      const huntMap: Record<string, any> = {};
      if (huntIds.length > 0) {
        for (let i = 0; i < huntIds.length; i += 10) {
          const chunk = huntIds.slice(i, i + 10);
          const hQ = query(collection(db, 'hunts'), where('__name__', 'in', chunk));
          const hSnap = await getDocs(hQ);
          hSnap.forEach(hd => { huntMap[hd.id] = hd.data(); });
        }
      }

      const enriched = entries.map(e => ({ ...e, huntName: huntMap[e.huntId]?.name || e.huntId }));
      setCompletedHunts(enriched);
      setLoading(false);
    }, (err) => {
      console.warn('playerHunts snapshot error', err);
      setLoading(false);
    });
    return () => unsub();
  }, [db, user]);

  useEffect(() => {
    let mounted = true;
    async function loadProgress() {
      try {
        const map: Record<string, number | null> = {};
        const huntIds = completedHunts.map(h => h.huntId).filter(Boolean);
        huntIds.forEach(id => map[id] = null);
        if (!user || huntIds.length === 0) {
          if (mounted) setProgressMap(map);
          return;
        }

        const uniqueIds = Array.from(new Set(huntIds));
        const chunks: string[][] = [];
        for (let i = 0; i < uniqueIds.length; i += 10) chunks.push(uniqueIds.slice(i, i + 10));

        const locCounts: Record<string, number> = {};
        const ciLocationSets: Record<string, Set<string>> = {};

        for (const chunk of chunks) {
          const locQ = query(collection(db, 'locations'), where('huntId', 'in', chunk));
          const locSnap = await getDocs(locQ);
          locSnap.forEach(d => {
            const data = d.data() as any;
            if (!data?.huntId) return;
            locCounts[data.huntId] = (locCounts[data.huntId] || 0) + 1;
          });
        }

        for (const chunk of chunks) {
          const ciQ = query(collection(db, 'checkIns'), where('userId', '==', user.uid), where('huntId', 'in', chunk));
          const ciSnap = await getDocs(ciQ);
          ciSnap.forEach(d => {
            const data = d.data() as any;
            if (!data?.huntId || !data?.locationId) return;
            ciLocationSets[data.huntId] = ciLocationSets[data.huntId] || new Set<string>();
            ciLocationSets[data.huntId].add(data.locationId);
          });
        }

        for (const hid of uniqueIds) {
          const total = locCounts[hid] || 0;
          const found = ciLocationSets[hid] ? ciLocationSets[hid].size : 0;
          map[hid] = total > 0 ? Math.round((found / total) * 100) : null;
        }

        if (mounted) setProgressMap(map);
      } catch (err) {
        console.warn('MyCompletedHunts loadProgress failed', err);
        if (mounted) setProgressMap({});
      }
    }
    loadProgress();
    return () => { mounted = false; };
  }, [completedHunts, user, db]);

  if (loading) return <ThemedView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator/></ThemedView>;

  return (
    <ThemedView style={{ flex: 1 }}>
  <SafeAreaView style={{ flex: 1, padding: 12, paddingTop: (insets.top || 0) + 8 + TOP_SAFE_EXTRA, backgroundColor: background as string }}>
      <ThemedView style={{ alignItems: 'center', marginBottom: 16 }}>
  <ThemedText style={{ fontSize: 64, marginBottom: 8, lineHeight: 76 }}>🎉</ThemedText>
        <ThemedText style={{ fontSize: 20, fontWeight: '700' }}>Congratulations!</ThemedText>
  <ThemedText style={{ color: text as string, marginTop: 4 }}>You've completed these hunts.</ThemedText>
      </ThemedView>

  <FlatList
        data={completedHunts}
        keyExtractor={i => i.id}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/hunt/${item.huntId}`)} style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: border as string }}>
            <ThemedText style={{ fontSize: 16, fontWeight: '600' }}>{item.huntName}</ThemedText>
            {progressMap[item.huntId] != null && <ThemedText style={{ marginTop: 6, color: text as string }}>Progress: {progressMap[item.huntId]}%</ThemedText>}
          </Pressable>
        )}
        ListEmptyComponent={() => <ThemedText>No completed hunts yet</ThemedText>}
      />
      </SafeAreaView>
    </ThemedView>
  );
}
