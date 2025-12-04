import React from 'react';
import { SessionProvider } from "@/context";
import { ThemeProvider } from '@/context/theme';
import { Slot, useRouter, useSegments } from "expo-router";
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import { useThemeColor } from '@/hooks/useThemeColor';
import { ThemedView } from '@/components/ThemedView';
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Pressable, View, Text, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
// Import your global CSS file
import "../global.css";
import { Provider } from 'react-redux';
import { store } from '@/store/store';

function ThemeContent({ canGoBack, isInTabs, router }: { canGoBack: boolean; isInTabs: boolean; router: any }) {
  // useTheme is available inside ThemeProvider
  // useThemeColor maps to Colors and will respect provider override
  const background = useThemeColor({}, 'background');
  const iconColor = useThemeColor({}, 'icon');

  return (
    <ThemedView style={{ flex: 1, backgroundColor: background }}>
      {/* top header with persistent back/close icon */}
      {!isInTabs && (
          <SafeAreaView style={{ backgroundColor: background }}>
          <View style={{ height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, borderBottomWidth: 0.5, borderBottomColor: iconColor }}>
            <Pressable onPress={() => (canGoBack ? router.back() : router.push('/'))} style={{ padding: 8 }}>
              <Ionicons name="arrow-back" size={24} color={iconColor as string} />
            </Pressable>
            <View style={{ flex: 1 }} />
          </View>
        </SafeAreaView>
      )}
      {/* Slot content sits below the header */}
      <View style={{ flex: 1 }}>
        <Slot />
      </View>
    </ThemedView>
  );
}

/**
 * Root Layout is the highest-level layout in the app, wrapping all other layouts and screens.
 * It provides:
 * 1. Global authentication context via SessionProvider
 * 2. Gesture handling support for the entire app
 * 3. Global styles and configurations
 *
 * This layout affects every screen in the app, including both authenticated
 * and unauthenticated routes.
 */
export default function Root() {
  const router = useRouter();
  const segments = useSegments();
  // Deep link handling: listen for incoming links and route via expo-router
  React.useEffect(() => {
    const handleUrl = (event: { url: string }) => {
      try {
        const url = event.url;
        const parsed = Linking.parse(url);
        // Example parsed.path values and query params parsing
        // Handle specialized invitation link format: scavengerhunt://hunt-detail?huntId={id}
        if (parsed.path === 'hunt-detail') {
          const huntId = (parsed.queryParams && (parsed.queryParams as any).huntId) || (parsed.queryParams && (parsed.queryParams as any).id);
          if (huntId) {
            // route to the HuntDetail screen and pass huntId as query param
            router.push(`/hunt/HuntDetail?huntId=${huntId}` as any);
            return;
          }
        }

        // Handle location-detail: scavengerhunt://location-detail?huntId={}&locationId={}
        if (parsed.path === 'location-detail') {
          const locationId = (parsed.queryParams && (parsed.queryParams as any).locationId) || (parsed.queryParams && (parsed.queryParams as any).locId) || (parsed.queryParams && (parsed.queryParams as any).id);
          const huntIdParam = (parsed.queryParams && (parsed.queryParams as any).huntId) || null;
          if (locationId) {
            const qs = huntIdParam ? `?locationId=${locationId}&huntId=${huntIdParam}` : `?locationId=${locationId}`;
            router.push(`/hunt/LocationDetail${qs}` as any);
            return;
          }
        }

        // Generic fallback: route directly using parsed.path if present
        if (parsed.path) {
          router.push('/' + (parsed.path as any) as any);
        }
      } catch (e) {
        console.warn('Failed to handle incoming url', e);
      }
    };

    const sub = Linking.addEventListener('url', handleUrl as any);
    // also handle initial URL when app cold-started from link
    (async () => {
      const initial = await Linking.getInitialURL();
      if (initial) handleUrl({ url: initial });
    })();

    return () => {
      try { sub.remove(); } catch (e) { /* ignore */ }
    };
  }, [router]);

  // Quick Actions (home screen shortcuts) - optional native feature
  React.useEffect(() => {
    const allow = process.env.EXPO_ALLOW_QUICK_ACTIONS === '1' || process.env.EXPO_ALLOW_QUICK_ACTIONS === 'true';
    if (!allow) return;
    let QuickActions: any = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      QuickActions = require('expo-quick-actions');
    } catch (e) {
      QuickActions = null;
    }
    if (!QuickActions) return;

    try {
      QuickActions.setShortcutItems([
        { type: 'ongoing', title: 'Ongoing Hunts', userInfo: { screen: 'MyActiveHunts' } },
        { type: 'completed', title: 'Completed Hunts', userInfo: { screen: 'MyCompletedHunts' } },
        { type: 'profile', title: 'Profile', userInfo: { screen: 'Profile' } },
      ]);

      const sub = QuickActions.addListener((evt: any) => {
        const t = evt.type || evt;
        if (t === 'ongoing') router.push('/drawer/MyActiveHunts' as any);
        else if (t === 'completed') router.push('/drawer/MyCompletedHunts' as any);
        else if (t === 'profile') router.push('/drawer/profile' as any);
      });

      return () => {
        try { sub.remove(); } catch (e) { }
      };
    } catch (e) {
      console.warn('Quick actions init failed', e);
    }
  }, [router]);
  const canGoBack = segments.length > 1;
  // hide header area when nested inside the tabs/drawer navigator
  const segs: any[] = segments as any[];
  const isInTabs = segs.includes('tabs') || segs.includes('app');
  // Set up the auth context and render our layout inside of it.
  return (
    <Provider store={store}>
    <SessionProvider>
      <ThemeProvider>
      {/* 
        GestureHandlerRootView is required for:
        - Drawer navigation gestures
        - Swipe gestures
        - Other gesture-based interactions
        Must wrap the entire app to function properly
      */}
  <GestureHandlerRootView style={{ flex: 1 }}>
        <ThemeContent canGoBack={canGoBack} isInTabs={isInTabs} router={router} />
      </GestureHandlerRootView>
  </ThemeProvider>
  </SessionProvider>
    </Provider>
  );
}
