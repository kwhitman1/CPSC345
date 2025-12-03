import { useSession } from "@/context";
import React, { useEffect, useState } from "react";
import { View, Text, Image, Button, Alert, ActivityIndicator } from "react-native";
import app from '@/lib/firebase-config';
import { getFirestore, collection, query, where, onSnapshot, orderBy, limit, doc, getDoc, updateDoc } from 'firebase/firestore';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';

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

  const pickAndUploadImage = async () => {
    if (!user?.uid) return Alert.alert('Not signed in', 'Sign in to update your profile');

    // Try to dynamically import expo-image-picker. If not available, fallback to prompting for a URL.
    let ImagePicker: any = null;
    try {
      ImagePicker = await import('expo-image-picker');
    } catch (err) {
      // fallback
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

  return (
    <View className="flex-1 mt-4 p-4">
      {/* Welcome Section */}
      <View className="mb-8">
        {/* Profile image + name */}
        {profile?.profileImageUrl ? (
          <Image source={{ uri: profile.profileImageUrl }} style={{ width: 96, height: 96, borderRadius: 48, marginBottom: 8 }} />
        ) : (
          <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: '#eee', marginBottom: 8, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#888' }}>No Photo</Text>
          </View>
        )}

        <Text className="text-xl font-bold text-blue-900">
          Name: {profile?.name || displayName}
        </Text>
        <Text className="text-xl font-semibold  text-blue-900 mt-2">
          Email: {user?.email}
        </Text>
        <Text className="text-normL font-semibold  text-blue-900 mt-2">
          Last Seen: {user?.metadata?.lastSignInTime}
        </Text>
        <Text className="text-normal font-semibold  text-blue-900 mt-2">
          Created: {user?.metadata?.creationTime}
        </Text>

        <View style={{ marginTop: 12 }}>
          {uploading ? (
            <ActivityIndicator />
          ) : (
            <Button title="Upload Photo" onPress={pickAndUploadImage} />
          )}
        </View>
      </View>
      {/* Player hunts summary */}
      <View className="mb-6">
        <Text className="text-lg font-semibold">Your Hunts</Text>
        <Text className="text-sm mt-2">Started: {playerHunts.filter(p => p.status === 'STARTED').length}</Text>
        <Text className="text-sm">Completed: {playerHunts.filter(p => p.status === 'COMPLETED').length}</Text>
        <Text className="text-sm">Total tracked: {playerHunts.length}</Text>
      </View>

      {/* Recent check-ins */}
      <View>
        <Text className="text-lg font-semibold mb-2">Recent Check-ins</Text>
        {recentCheckIns.length === 0 ? (
          <Text className="text-sm text-gray-600">No recent check-ins</Text>
        ) : (
          recentCheckIns.map((ci) => (
            <View key={ci.id} className="mb-2">
              <Text className="text-sm font-medium">Hunt: {ci.huntId} • Location: {ci.locationId}</Text>
              <Text className="text-xs text-gray-600">{ci.timestamp?.toDate ? ci.timestamp.toDate().toLocaleString() : String(ci.timestamp)}</Text>
            </View>
          ))
        )}
      </View>
    </View>
  );
};

export default ProfileScreen;
