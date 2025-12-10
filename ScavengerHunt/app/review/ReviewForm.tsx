import React, { useEffect, useState } from 'react';
import { SafeAreaView, View, TextInput, Pressable, ActivityIndicator, Button } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { getFirestore, collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import app from '@/lib/firebase-config';
import { useSession } from '@/context';

export default function ReviewForm() {
  const { huntId } = useLocalSearchParams() as { huntId?: string };
  const db = getFirestore(app);
  const { user } = useSession();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const border = useThemeColor({}, 'icon');
  const text = useThemeColor({}, 'text');
  const background = useThemeColor({}, 'background');

  const [loading, setLoading] = useState(true);
  const [existing, setExisting] = useState<any | null>(null);
  const [rating, setRating] = useState<number>(5);
  const [comment, setComment] = useState<string>('');

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!user || !huntId) {
        if (mounted) setLoading(false);
        return;
      }
      try {
        const rQ = query(collection(db, 'reviews'), where('userId', '==', user.uid), where('huntId', '==', huntId));
        const snap = await getDocs(rQ);
        let found: any = null;
        snap.forEach(d => { found = { id: d.id, ...(d.data() as any) }; });
        if (mounted && found) {
          setExisting(found);
          setRating(found.rating ?? 5);
          setComment(found.comment ?? '');
        }
      } catch (err) {
        console.warn('ReviewForm load failed', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [db, huntId, user]);

  async function save() {
    if (!user || !huntId) return;
    try {
      if (existing && existing.id) {
        await updateDoc(doc(db, 'reviews', existing.id), { rating, comment, timestamp: serverTimestamp() });
      } else {
        await addDoc(collection(db, 'reviews'), { huntId, userId: user.uid, rating, comment, timestamp: serverTimestamp() });
      }
      router.back();
    } catch (err) {
      console.warn('ReviewForm save failed', err);
    }
  }

  if (loading) return <ThemedView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator /></ThemedView>;

  return (
    <ThemedView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1, padding: 16, paddingTop: (insets.top || 0) + 12, backgroundColor: background as string }}>
        <ThemedText style={{ fontSize: 18, fontWeight: '700', marginBottom: 12 }}>Review {huntId}</ThemedText>
        <ThemedText style={{ marginBottom: 8 }}>Rating</ThemedText>
        <View style={{ flexDirection: 'row', marginBottom: 12 }}>
          {[1,2,3,4,5].map(n => (
            <Pressable key={n} onPress={() => setRating(n)} style={{ marginRight: 8, padding: 8 }}>
              <ThemedText style={{ fontSize: 24 }}>{n <= rating ? '★' : '☆'}</ThemedText>
            </Pressable>
          ))}
        </View>
        <ThemedText style={{ marginBottom: 8 }}>Comment (optional)</ThemedText>
        <TextInput value={comment} onChangeText={setComment} placeholder="Share your thoughts" style={{ borderWidth: 1, borderColor: border as string, padding: 8, borderRadius: 6, marginBottom: 16, color: text as string }} multiline />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Button title="Cancel" onPress={() => router.back()} />
          <Button title="Save" onPress={save} />
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}
