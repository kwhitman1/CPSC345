import { Text } from "react-native";
import { Redirect, Stack, Slot } from "expo-router";
import { useSession } from "@/context";

export default function AppLayout() {
  const { user, isLoading } = useSession();

  if (isLoading) {
    return <Text>Loading...</Text>;
  }

  if (!user) {
    // Cast href to any to satisfy expo-router generated route union types
    return <Redirect href={"/firebase/SignIn" as any} />;
  }

  return <Slot />;
}
