import { useSession } from "@/context";
import React, { useEffect, useState } from "react";
import { View, Text } from "react-native";
import app from '@/lib/firebase-config';
import { getFirestore, collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';

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

  useEffect(() => {
    if (!user?.uid) {
      setPlayerHunts([]);
      setRecentCheckIns([]);
      return;
    }
    const db = getFirestore(app);

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

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <View className="flex-1 mt-4 p-4">
      {/* Welcome Section */}
      <View className="mb-8">
        <Text className="text-xl font-bold text-blue-900">
          Name: {displayName}
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
