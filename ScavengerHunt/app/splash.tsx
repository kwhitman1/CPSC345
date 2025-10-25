import { useEffect } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { useSession } from "@/context";

export default function Splash() {
  const { user, isLoading } = useSession();

  useEffect(() => {
    if (!isLoading) {
      if (user) router.replace("/(app)/(drawer)/(tabs)");
      else router.replace("/sign-in");
    }
  }, [user, isLoading]);

  return (
    <View className="flex-1 items-center justify-center bg-white">
      <ActivityIndicator size="large" color="#2563EB" />
      <Text className="mt-4 text-gray-700">Checking authentication…</Text>
    </View>
  );
}
