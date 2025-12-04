import React, { useEffect, useState } from 'react';
import { FlatList, ActivityIndicator, Pressable } from 'react-native';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useRouter } from 'expo-router';
import { getFirestore, collection, query, where, onSnapshot, getDocs, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import app from '@/lib/firebase-config';
import { useSession } from '@/context';

export default function MyActiveHunts() {
  const db = getFirestore(app);
  const router = useRouter();
  const { user } = useSession();

  const [loading, setLoading] = useState(true);
  const [activeHunts, setActiveHunts] = useState<any[]>([]);
  const [progressMap, setProgressMap] = useState<Record<string, number | null>>({});
  const tint = useThemeColor({}, 'tint');
  const border = useThemeColor({}, 'icon');

  useEffect(() => {
    if (!user) {
      setActiveHunts([]);
      setLoading(false);
      return;
    }
    const q = query(collection(db, 'playerHunts'), where('userId', '==', user.uid), where('status', '==', 'STARTED'));
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
      const enriched = entries.map(e => ({ ...e, huntName: (huntMap[e.huntId]?.name || '') }));
      setActiveHunts(enriched);
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
        const huntIds = activeHunts.map(h => h.huntId).filter(Boolean);
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

        const huntToPlayerDoc: Record<string, string> = {};
        activeHunts.forEach(ph => { if (ph.huntId) huntToPlayerDoc[ph.huntId] = ph.id; });

        for (const hid of uniqueIds) {
          const total = locCounts[hid] || 0;
          const found = ciLocationSets[hid] ? ciLocationSets[hid].size : 0;
          const percent = total > 0 ? Math.round((found / total) * 100) : null;
          map[hid] = percent;

          try {
            if (percent === 100 && huntToPlayerDoc[hid]) {
              const playerDocId = huntToPlayerDoc[hid];
              const playerRef = doc(db, 'playerHunts', playerDocId);
              await updateDoc(playerRef, { status: 'COMPLETED', completedAt: serverTimestamp() });
            }
          } catch (e) {
            console.warn('Failed to mark playerHunt completed', hid, e);
          }
        }

        if (mounted) setProgressMap(map);
      } catch (err) {
        console.warn('MyActiveHunts loadProgress failed', err);
        if (mounted) setProgressMap({});
      }
    }
    loadProgress();
    // lazily schedule local notifications for STARTED hunts if available
    (async () => {
      try {
        // lazy-require scheduler so app doesn't break if notifications package isn't installed
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const scheduler = require('@/lib/notification-scheduler');
        if (scheduler && typeof scheduler.requestAndSetNotificationHandler === 'function') {
          const ok = await scheduler.requestAndSetNotificationHandler();
          if (ok && user) {
            await scheduler.scheduleNotificationsForUser(user.uid);
          }
        }
      } catch (e) {
        // scheduler or expo-notifications not present — ignore
      }
    })();
    return () => { mounted = false; };
  }, [activeHunts, user, db]);

  if (loading) return <ThemedView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator/></ThemedView>;

  return (
    <ThemedView style={{ flex: 1, padding: 12 }}>
      <ThemedText style={{ fontSize: 18, fontWeight: '600', marginBottom: 12 }}>My Active Hunts</ThemedText>
      <FlatList
        data={activeHunts}
        keyExtractor={i => i.id}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/hunt/${item.huntId}`)} style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: border as string }}>
            <ThemedText style={{ fontSize: 16, fontWeight: '600' }}>{item.huntName}</ThemedText>
            {progressMap[item.huntId] != null && <ThemedText style={{ marginTop: 6, color: '#333' }}>Progress: {progressMap[item.huntId]}%</ThemedText>}
          </Pressable>
        )}
        ListEmptyComponent={() => <ThemedText>No active hunts</ThemedText>}
      />
    </ThemedView>
  );
}
