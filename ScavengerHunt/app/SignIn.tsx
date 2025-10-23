import { useRouter } from 'expo-router';
import { signInWithEmailAndPassword } from 'firebase/auth';
import React, { useState } from 'react';
import { Alert, Button, StyleSheet, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from './firebaseConfig';

export default function SignIn() {
  console.log('[SignIn] render');
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSignIn = async () => {
  console.log('[SignIn] onSignIn pressed');
    if (!email || !password) {
      setError('Email and password required');
      return;
    }
    setLoading(true);
    try {
      const userCred = await signInWithEmailAndPassword(auth, email.trim(), password);
      // store token/session
      try {
        const token = await userCred.user.getIdToken();
        await AsyncStorage.setItem('userToken', token);
      } catch (err) {
        console.warn('Failed to save token to storage', err);
      }

      router.replace('/');
    } catch (e: any) {
      const code = (e?.code ?? '').toString();
      const msg = (e?.message ?? '').toString();
      if (code.includes('user-not-found') || msg.includes('user-not-found')) setError('User Not Found');
      else if (code.includes('wrong-password') || msg.includes('wrong-password')) setError('Wrong Password');
      else if (code.includes('invalid-credential') || msg.includes('invalid-credential')) setError('Incorrect Email or Password');
      else setError(msg || 'Sign in failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sign in</Text>
  <TextInput placeholder="Email" value={email} onChangeText={(t) => { setEmail(t); setError(null); }} keyboardType="email-address" autoCapitalize="none" style={styles.input} />
  <TextInput placeholder="Password" value={password} onChangeText={(t) => { setPassword(t); setError(null); }} secureTextEntry style={styles.input} />
  {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button title={loading ? 'Signing in...' : 'Sign in'} onPress={onSignIn} disabled={loading} />
      <View style={{ height: 8 }} />
  <Button title="Don't have an account? Create account" onPress={() => router.push('/SignUp' as any)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, justifyContent: 'center' },
  input: { borderWidth: 1, padding: 10, marginVertical: 8, borderRadius: 6 },
  title: { fontSize: 20, marginBottom: 12, textAlign: 'center' },
  error: { color: 'red', marginBottom: 8, textAlign: 'center' },
});