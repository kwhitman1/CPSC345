import React from "react";
import { Pressable, View } from "react-native";
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import ThemedButton from '@/components/ThemedButton';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useSession } from "@/context";
import { router } from "expo-router";
//
/**
 * TabsIndexScreen displays the main home screen content with personalized welcome message
 * @returns {JSX.Element} Home screen component
 */
const TabsIndexScreen = () => {
  // ============================================================================
  // Hooks
  // ============================================================================
  const { signOut, user } = useSession();

  // ============================================================================
  // Handlers
  // ============================================================================
  
  /**
   * Handles the logout process
   */
  const handleLogout = async () => {
    await signOut();
  router.replace("/firebase/SignIn");
  };

  // ============================================================================
  // Computed Values
  // ============================================================================
  
  /**
   * Gets the display name for the welcome message
   * Prioritizes user's name, falls back to email, then default greeting
   */
  const displayName = user?.displayName || user?.email?.split('@')[0] || 'Guest';

  // ============================================================================
  // Render
  // ============================================================================
  
  const tint = useThemeColor({}, 'tint');
  return (
    <ThemedView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 }}>
      <View style={{ alignItems: 'center', marginBottom: 24 }}>
        <ThemedText type="defaultSemiBold" style={{ fontSize: 20, marginBottom: 8 }}>Welcome back,</ThemedText>
        <ThemedText type="title" style={{ color: tint }}>{displayName}</ThemedText>
        <ThemedText style={{ marginTop: 8 }}>{user?.email}</ThemedText>
      </View>

      <ThemedButton title="Logout" onPress={handleLogout} style={{ paddingHorizontal: 24 }} />
    </ThemedView>
  );
};

export default TabsIndexScreen;
