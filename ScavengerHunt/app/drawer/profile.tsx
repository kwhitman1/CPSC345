import { useSession } from "@/context";
import React, { useEffect, useState } from "react";
import { Image, Alert, ActivityIndicator, FlatList, Pressable, TouchableOpacity, Share } from "react-native";
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { useTheme } from '@/context/theme';
import { useThemeColor } from '@/hooks/useThemeColor';
import app from '@/lib/firebase-config';
import { getFirestore, collection, query, where, onSnapshot, orderBy, limit, doc, getDoc, updateDoc } from 'firebase/firestore';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
// ...react-native imports consolidated above
import { useRouter } from 'expo-router';
// useTheme imported above
import { getDocs } from 'firebase/firestore';
// Lazy import for alternate app icons (only used if installed)
let AlternateIcons: any | null = null;

const ProfileScreen = () => {
  // ============================================================================
  // Hooks
  // ============================================================================
  const { user } = useSession();

  // ============================================================================
  // Computed Values
  // ============================================================================

  /**
   * Gets the display name for the welcome message
   * Prioritizes user's name, falls back to email, then default greeting
   */
  const displayName =
    user?.displayName || user?.email?.split("@")[0] || "Guest";

  // Firestore: playerHunts and recent checkIns
  const [playerHunts, setPlayerHunts] = useState<any[]>([]);
  const [recentCheckIns, setRecentCheckIns] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const db = getFirestore(app);
  const [completedHunts, setCompletedHunts] = useState<any[]>([]);
  const [progressMap, setProgressMap] = useState<Record<string, number | null>>({});
  const router = useRouter();
  // It's safe to call useTheme here because ThemeProvider wraps Root layout
  let themeCtx: any = null;
  try { themeCtx = useTheme(); } catch (e) { themeCtx = null; }

  useEffect(() => {
    if (!user?.uid) {
      setPlayerHunts([]);
      setRecentCheckIns([]);
      return;
    }
    const db = getFirestore(app);

    // load user doc for name/profileImageUrl
    const userDocRef = doc(db, 'users', user.uid);
    getDoc(userDocRef).then((d) => {
      if (d.exists()) setProfile({ id: d.id, ...(d.data() as any) });
    }).catch(() => {});

    const phQ = query(collection(db, 'playerHunts'), where('userId', '==', user.uid));
    const phUnsub = onSnapshot(phQ, (snap) => {
      const list: any[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...(d.data() as any) }));
      setPlayerHunts(list);
    }, () => setPlayerHunts([]));

    const ciQ = query(
      collection(db, 'checkIns'),
      where('userId', '==', user.uid),
      orderBy('timestamp', 'desc'),
      limit(5)
    );
    const ciUnsub = onSnapshot(ciQ, (snap) => {
      const list: any[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...(d.data() as any) }));
      setRecentCheckIns(list);
    }, () => setRecentCheckIns([]));

    return () => {
      phUnsub();
      ciUnsub();
    };
  }, [user?.uid]);

  // subscribe to completed playerHunts
  useEffect(() => {
    if (!user?.uid) {
      setCompletedHunts([]);
      setProgressMap({});
      return;
    }
    const db = getFirestore(app);
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
    }, (err) => {
      console.warn('playerHunts snapshot error', err);
      setCompletedHunts([]);
    });

    return () => unsub();
  }, [user?.uid]);

  // compute progress map for completed hunts
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
        console.warn('Profile loadProgress failed', err);
        if (mounted) setProgressMap({});
      }
    }
    loadProgress();
    return () => { mounted = false; };
  }, [completedHunts, user, db]);

  const pickAndUploadImage = async () => {
    if (!user?.uid) return Alert.alert('Not signed in', 'Sign in to update your profile');

    let ImagePicker: any = null;
    try {
      ImagePicker = require('expo-image-picker');
    } catch (err) {
    }

    if (!ImagePicker) {
      // Fallback: simple prompt to enter an image URL (not implemented UI-wise here)
      return Alert.alert('Image picker unavailable', 'Image picker is not installed in this environment. Use a URL in the users collection to set profileImageUrl.');
    }

    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert('Permission required', 'Camera roll permission is required to choose a photo');

    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8, allowsEditing: true });
    if (res.cancelled) return;

    try {
      setUploading(true);
      const storage = getStorage(app);
      const resp = await fetch(res.uri);
      const blob = await resp.blob();
      const ref = storageRef(storage, `profileImages/${user.uid}_${Date.now()}`);
      await uploadBytes(ref, blob);
      const url = await getDownloadURL(ref);

      // update user doc
      const db = getFirestore(app);
      const userDocRef = doc(db, 'users', user.uid);
      await updateDoc(userDocRef, { profileImageUrl: url });
      setProfile((p:any) => ({ ...(p || {}), profileImageUrl: url }));
      Alert.alert('Uploaded', 'Profile picture updated');
    } catch (e) {
      console.error(e);
      Alert.alert('Upload failed', 'Could not upload image');
    } finally {
      setUploading(false);
    }
  };

  // ============================================================================
  // Render
  // ============================================================================

  const bg = useThemeColor({}, 'background');
  const tint = useThemeColor({}, 'tint');

  // Alternate app icons feature (optional dependency)
  const [supportsIcons, setSupportsIcons] = useState<boolean | null>(null);
  const [currentIcon, setCurrentIcon] = useState<string | null>(null);

  // Example icon list - replace paths with your real assets in assets/app-icons/
  const ICONS = [
    { name: 'Default', id: null },
    { name: 'IconA', id: 'IconA' },
    { name: 'IconB', id: 'IconB' },
  ];

  useEffect(() => {
    // Only attempt to load the optional native module when explicitly enabled
    // via environment variable. This prevents Expo Go from failing when the
    // native module isn't present.
    const allow = process.env.EXPO_ALLOW_ALTERNATE_ICONS === '1' || process.env.EXPO_ALLOW_ALTERNATE_ICONS === 'true';
    if (!allow) {
      setSupportsIcons(false);
      setCurrentIcon(null);
      return;
    }

    // lazy-require so app still runs if the package isn't installed
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      AlternateIcons = require('expo-alternate-app-icons');
    } catch (e) {
      AlternateIcons = null;
    }

    if (!AlternateIcons) {
      setSupportsIcons(false);
      setCurrentIcon(null);
      return;
    }

    (async () => {
      try {
        const sup = !!AlternateIcons.supportsAlternateIcons;
        setSupportsIcons(sup);
        if (sup && AlternateIcons.getAppIconName) {
          const name = await AlternateIcons.getAppIconName();
          setCurrentIcon(name || null);
        }
      } catch (err) {
        setSupportsIcons(false);
      }
    })();
  }, []);

  const onSelectIcon = async (id: string | null) => {
    if (!AlternateIcons || !AlternateIcons.setAlternateAppIcon) {
      return Alert.alert('Feature unavailable', 'expo-alternate-app-icons is not installed');
    }
    try {
      const res = await AlternateIcons.setAlternateAppIcon(id);
      setCurrentIcon(res || null);
      Alert.alert('App icon updated');
    } catch (err) {
      console.warn('setAlternateAppIcon failed', err);
      Alert.alert('Failed to change icon');
    }
  };

  return (
    <ThemedView style={{ flex: 1, marginTop: 8, padding: 16, backgroundColor: bg }}>
      {/* Welcome Section */}
      <ThemedView style={{ marginBottom: 16 }}>
        {/* Scoreboard navigation - placed at very top */}
        <ThemedView style={{ marginBottom: 12 }}>
          <Pressable onPress={() => router.push('/scoreboard' as any)} style={{ padding: 10, backgroundColor: tint, borderRadius: 6, alignSelf: 'flex-start' }}>
            <ThemedText style={{ color: '#000' }}>View Scoreboard</ThemedText>
          </Pressable>
        </ThemedView>

        {/* Profile image + name */}
        {profile?.profileImageUrl ? (
          <Image source={{ uri: profile.profileImageUrl }} style={{ width: 96, height: 96, borderRadius: 48, marginBottom: 8 }} />
        ) : (
          <ThemedView style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: '#eee', marginBottom: 8, alignItems: 'center', justifyContent: 'center' }}>
            <ThemedText style={{ color: '#888' }}>No Photo</ThemedText>
          </ThemedView>
        )}

        <ThemedText style={{ fontSize: 18, fontWeight: '700' }}>
          Name: {profile?.name || displayName}
        </ThemedText>
        <ThemedText style={{ fontSize: 16, marginTop: 6 }}>
          Email: {user?.email}
        </ThemedText>
        <ThemedText style={{ fontSize: 14, marginTop: 6 }}>
          Last Seen: {user?.metadata?.lastSignInTime}
        </ThemedText>
        <ThemedText style={{ fontSize: 14, marginTop: 6 }}>
          Created: {user?.metadata?.creationTime}
        </ThemedText>

        <ThemedView style={{ marginTop: 12 }}>
          {uploading ? (
            <ActivityIndicator />
            ) : (
            <Pressable onPress={pickAndUploadImage} style={{ padding: 10, backgroundColor: tint, borderRadius: 6 }}>
              <ThemedText style={{ color: '#000' }}>Upload Photo</ThemedText>
            </Pressable>
          )}
        </ThemedView>
        <ThemedView style={{ marginTop: 12 }}>
          <Pressable onPress={async () => {
            const url = `scavengerhunt://user/${user?.uid}`;
            try {
              await Share.share({ message: `Check out my profile: ${url}` });
            } catch (e) {
              console.warn('Share failed', e);
            }
          }} style={{ padding: 10, backgroundColor: tint, borderRadius: 6, marginTop: 8 }}>
            <ThemedText style={{ color: '#000' }}>Share my profile</ThemedText>
          </Pressable>
        </ThemedView>
        
        {/* Theme controls */}
        <ThemedView style={{ marginTop: 16 }}>
          <ThemedText style={{ fontSize: 16, fontWeight: '700', marginBottom: 8 }}>Appearance</ThemedText>
          {themeCtx ? (
            <ThemedView style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable onPress={() => themeCtx.setTheme('light')} style={{ padding: 8, backgroundColor: tint, borderRadius: 6 }}>
                <ThemedText style={{ color: '#000' }}>Light</ThemedText>
              </Pressable>
              <ThemedView style={{ width: 8 }} />
              <Pressable onPress={() => themeCtx.setTheme('dark')} style={{ padding: 8, backgroundColor: tint, borderRadius: 6 }}>
                <ThemedText style={{ color: '#000' }}>Dark</ThemedText>
              </Pressable>
            </ThemedView>
          ) : (
            <ThemedText style={{ color: '#666' }}>Theme unavailable</ThemedText>
          )}
        </ThemedView>

        {/* Alternate App Icons */}
        <ThemedView style={{ marginTop: 18 }}>
          <ThemedText style={{ fontSize: 16, fontWeight: '700', marginBottom: 8 }}>App Icon</ThemedText>
          {supportsIcons === null ? (
            <ThemedText style={{ color: '#666' }}>Checking icon support...</ThemedText>
          ) : supportsIcons === false ? (
            <ThemedText style={{ color: '#666' }}>Alternate app icons not available on this platform or package not installed.</ThemedText>
          ) : (
            <ThemedView style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {ICONS.map((ic) => (
                <Pressable key={String(ic.id)} onPress={() => onSelectIcon(ic.id)} style={{ width: 96, alignItems: 'center', marginBottom: 8 }}>
                  {/* Placeholder box for icon image - replace with Image source pointing to your asset */}
                  <ThemedView style={{ width: 72, height: 72, borderRadius: 12, backgroundColor: tint, alignItems: 'center', justifyContent: 'center' }}>
                    <ThemedText style={{ color: '#000' }}>{ic.name[0]}</ThemedText>
                  </ThemedView>
                  <ThemedText style={{ marginTop: 6 }}>{ic.name}</ThemedText>
                  {currentIcon === ic.id && <ThemedText style={{ fontSize: 12, color: '#666' }}>Selected</ThemedText>}
                </Pressable>
              ))}
            </ThemedView>
          )}
        </ThemedView>
      </ThemedView>
      {/* Player hunts summary */}
      <ThemedView style={{ marginBottom: 12 }}>
        <ThemedText style={{ fontSize: 16, fontWeight: '600' }}>Your Hunts</ThemedText>
        <ThemedText style={{ marginTop: 6 }}>Started: {playerHunts.filter(p => p.status === 'STARTED').length}</ThemedText>
        <ThemedText>Completed: {playerHunts.filter(p => p.status === 'COMPLETED').length}</ThemedText>
        <ThemedText>Total tracked: {playerHunts.length}</ThemedText>
      </ThemedView>

      {/* Recent check-ins */}
      <ThemedView>
        <ThemedText style={{ fontSize: 16, fontWeight: '600', marginBottom: 6 }}>Recent Check-ins</ThemedText>
        {recentCheckIns.length === 0 ? (
          <ThemedText style={{ color: '#666' }}>No recent check-ins</ThemedText>
        ) : (
          recentCheckIns.map((ci) => (
            <ThemedView key={ci.id} style={{ marginBottom: 8 }}>
              <ThemedText style={{ fontSize: 14, fontWeight: '500' }}>Hunt: {ci.huntId} • Location: {ci.locationId}</ThemedText>
              <ThemedText style={{ fontSize: 12, color: '#666' }}>{ci.timestamp?.toDate ? ci.timestamp.toDate().toLocaleString() : String(ci.timestamp)}</ThemedText>
            </ThemedView>
          ))
        )}
      </ThemedView>

      {/* Completed Hunts */}
      <ThemedView style={{ marginTop: 18 }}>
        <ThemedText style={{ fontSize: 18, fontWeight: '700', marginBottom: 8 }}>Completed Hunts</ThemedText>
        {completedHunts.length === 0 ? (
          <ThemedText style={{ color: '#666' }}>No completed hunts yet</ThemedText>
        ) : (
          <FlatList
            data={completedHunts}
            keyExtractor={i => i.id}
            renderItem={({ item }) => (
              <Pressable onPress={() => router.push(`/hunt/${item.huntId}`)} style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: '#eee', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <ThemedView>
                  <ThemedText style={{ fontSize: 16, fontWeight: '600' }}>{item.huntName}</ThemedText>
                  {progressMap[item.huntId] != null && <ThemedText style={{ marginTop: 6, color: '#333' }}>Progress: {progressMap[item.huntId]}%</ThemedText>}
                </ThemedView>
                <Pressable onPress={async () => {
                  const url = `scavengerhunt://hunt/${item.huntId}`;
                  try {
                    await Share.share({ message: `Join this hunt: ${url}` });
                  } catch (e) { console.warn('Share failed', e); }
                }} style={{ padding: 8 }}>
                  <ThemedText style={{ color: tint }}>Share</ThemedText>
                </Pressable>
              </Pressable>
            )}
          />
        )}
      </ThemedView>
    </ThemedView>
  );
};

export default ProfileScreen;
