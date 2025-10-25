import { Redirect } from "expo-router";

export default function Index() {
  // Remove trailing slash to match expo-router Href types
  return <Redirect href="/(app)/(drawer)/(tabs)" />;
}
