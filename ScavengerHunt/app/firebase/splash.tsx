import { useEffect } from "react";
import { ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { useSession } from "@/context";
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';

export default function Splash() {
  const { user, isLoading } = useSession();

  useEffect(() => {
    if (!isLoading) {
      if (user) router.replace("/drawer/tabs");
      else router.replace("/firebase/SignIn");
    }
  }, [user, isLoading]);

  return (
    <ThemedView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="large" color="#2563EB" />
      <ThemedText style={{ marginTop: 12 }}>Checking authentication…</ThemedText>
    </ThemedView>
  );
}
