import { Stack, useRouter } from "expo-router";
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View, Button, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { auth } from './firebaseConfig';
import { subscribe } from './eventBus';

export default function RootLayout() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [didRedirect, setDidRedirect] = useState(false);

  useEffect(() => {
    console.log('[_layout] mounting and registering auth listener');
    const unsub = onAuthStateChanged(auth, (u) => {
      console.log('[_layout] auth state changed, user=', u);
      setUser(u);
      setChecking(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!checking && !didRedirect) {
      if (user) {
        router.replace('/' as any);
      } else {
        router.replace('/SignIn' as any);
      }
      setDidRedirect(true);
    }
  }, [checking, user, didRedirect]);

  if (checking) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  const onLogout = async () => {
    try {
      await signOut(auth);
      await AsyncStorage.removeItem('userToken');
      router.replace('/SignIn' as any);
    } catch (e: any) {
      Alert.alert('Logout failed', e?.message ?? String(e));
    }
  };

  return (
    <Stack
      screenOptions={({ route }) => ({
        headerRight: () => {
          const name = route?.name ?? '';
          const isAuthScreen = /SignIn|SignUp/i.test(name);
          if (isAuthScreen) return undefined;
          return (
            <View>
              <Button title="Logout" onPress={onLogout} />
            </View>
          );
        },
      })}
    />
  );
}
