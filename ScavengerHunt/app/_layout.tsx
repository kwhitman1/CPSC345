import { SessionProvider } from "@/context";
import { Slot, useRouter, useSegments } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Pressable, View, Text, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
// Import your global CSS file
import "../global.css";
import { Provider } from 'react-redux';
import { store } from '@/store/store';

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
  const canGoBack = segments.length > 1;
  // hide header area when nested inside the tabs/drawer navigator
  const segs: any[] = segments as any[];
  const isInTabs = segs.includes('tabs') || segs.includes('app');
  // Set up the auth context and render our layout inside of it.
  return (
    <Provider store={store}>
    <SessionProvider>
      {/* 
        GestureHandlerRootView is required for:
        - Drawer navigation gestures
        - Swipe gestures
        - Other gesture-based interactions
        Must wrap the entire app to function properly
      */}
  <GestureHandlerRootView style={{ flex: 1 }}>
        {/* top header with persistent back/close icon */}
        {!isInTabs && (
          <SafeAreaView style={{ backgroundColor: 'transparent' }}>
            <View style={{ height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, borderBottomWidth: 0.5, borderBottomColor: '#eee' }}>
              <Pressable onPress={() => (canGoBack ? router.back() : router.push('/'))} style={{ padding: 8 }}>
                <Ionicons name="arrow-back" size={24} color="#111" />
              </Pressable>
              <View style={{ flex: 1 }} />
            </View>
          </SafeAreaView>
        )}
        {/* Slot content sits below the header */}
        <View style={{ flex: 1 }}>
          <Slot />
        </View>
      </GestureHandlerRootView>
      </SessionProvider>
    </Provider>
  );
}
