import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { collection, getFirestore, onSnapshot, query, where, getDocs } from 'firebase/firestore';
import app from '@/lib/firebase-config';
import { useSession } from '@/context';

type Hunt = {
  id: string;
  name?: string;
  description?: string;
  isVisible?: boolean;
};

export default function HuntDiscovery() {
  const db = getFirestore(app);
  const router = useRouter();
  const { user } = useSession();

  const [queryText, setQueryText] = useState('');
  const [loading, setLoading] = useState(true);
  const [hunts, setHunts] = useState<Hunt[]>([]);
  const [progressMap, setProgressMap] = useState<Record<string, number | null>>({});

  useEffect(() => {
    const q = query(collection(db, 'hunts'), where('isVisible', '==', true));
    const unsub = onSnapshot(q, (snap) => {
      const items: Hunt[] = [];
      snap.forEach((d) => items.push({ id: d.id, ...(d.data() as any) }));
      setHunts(items);
      setLoading(false);
    }, (err) => {
      console.warn('hunts snapshot error', err);
      setLoading(false);
    });
    return () => unsub();
  }, [db]);

  useEffect(() => {
    let mounted = true;
    async function loadProgressBatched() {
      try {
        const entries: Record<string, number | null> = {};
        const huntIds = hunts.map(h => h.id);
        huntIds.forEach(id => entries[id] = null);

        if (!user || huntIds.length === 0) {
          if (mounted) setProgressMap(entries);
          return;
        }

        // Firestore "in" supports up to 10 items; chunk if necessary
        const chunks: string[][] = [];
        for (let i = 0; i < huntIds.length; i += 10) chunks.push(huntIds.slice(i, i + 10));

        // 1) find started hunts for this user
        const started = new Set<string>();
        for (const chunk of chunks) {
          const phQ = query(collection(db, 'playerHunts'), where('userId', '==', user.uid), where('huntId', 'in', chunk));
          const phSnap = await getDocs(phQ);
          phSnap.forEach(d => {
            const data = d.data() as any;
            if (data?.huntId) started.add(data.huntId);
          });
        }

        if (started.size === 0) {
          if (mounted) setProgressMap(entries);
          return;
        }

        const startedIds = Array.from(started);
        const startedChunks: string[][] = [];
        for (let i = 0; i < startedIds.length; i += 10) startedChunks.push(startedIds.slice(i, i + 10));

  const ciCounts: Record<string, number> = {};
  // track unique locationIds per hunt to avoid double-counting multiple check-ins
  const ciLocationSets: Record<string, Set<string>> = {};
        const locCounts: Record<string, number> = {};

        // load checkIns counts
        for (const chunk of startedChunks) {
          const ciQ = query(collection(db, 'checkIns'), where('userId', '==', user.uid), where('huntId', 'in', chunk));
          const ciSnap = await getDocs(ciQ);
          ciSnap.forEach(d => {
            const data = d.data() as any;
            if (!data?.huntId || !data?.locationId) return;
            ciLocationSets[data.huntId] = ciLocationSets[data.huntId] || new Set<string>();
            ciLocationSets[data.huntId].add(data.locationId);
          });
        }

        // load location totals
        for (const chunk of startedChunks) {
          const locQ = query(collection(db, 'locations'), where('huntId', 'in', chunk));
          const locSnap = await getDocs(locQ);
          locSnap.forEach(d => {
            const data = d.data() as any;
            if (!data?.huntId) return;
            locCounts[data.huntId] = (locCounts[data.huntId] || 0) + 1;
          });
        }

        for (const hid of startedIds) {
          const total = locCounts[hid] || 0;
          const found = ciLocationSets[hid] ? ciLocationSets[hid].size : 0;
          entries[hid] = total > 0 ? Math.round((found / total) * 100) : null;
        }

        if (mounted) setProgressMap(entries);
      } catch (err) {
        console.warn('HuntDiscovery loadProgress failed', err);
        if (mounted) setProgressMap({});
      }
    }
    loadProgressBatched();
    return () => { mounted = false; };
  }, [user, hunts, db]);

  const filtered = useMemo(() => {
    const t = queryText.trim().toLowerCase();
    if (!t) return hunts;
    return hunts.filter(h => (h.name || '').toLowerCase().includes(t));
  }, [hunts, queryText]);

  if (loading) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator/></View>;

  return (
    <View style={{ flex: 1, padding: 12 }}>
      <TextInput placeholder="Search hunts" value={queryText} onChangeText={setQueryText} style={{ borderWidth: 1, borderColor: '#ddd', padding: 8, borderRadius: 8, marginBottom: 12 }} />

      <FlatList
        data={filtered}
        keyExtractor={i => i.id}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => router.push(`/hunt/${item.id}`)} style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: '#eee' }}>
            <Text style={{ fontSize: 16, fontWeight: '600' }}>{item.name}</Text>
            {progressMap[item.id] != null && <Text style={{ marginTop: 6, color: '#333' }}>Progress: {progressMap[item.id]}%</Text>}
            {item.description ? <Text style={{ marginTop: 4, color: '#666' }}>{item.description}</Text> : null}
          </TouchableOpacity>
        )}
        ListEmptyComponent={() => <Text>No hunts found</Text>}
      />
    </View>
  );
}
