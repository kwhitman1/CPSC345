import { useRouter } from 'expo-router';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import React, { useState } from 'react';
import { Alert, Button, StyleSheet, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth, db } from './firebaseConfig';

export default function SignUp() {
  console.log('[SignUp] render');
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSignUp = async () => {
  console.log('[SignUp] onSignUp pressed');
    if (!name || !email || !password) {
      setError('Name, email and password required');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      const userCred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const uid = userCred.user.uid;
  console.log('Created user:', userCred.user);
  Alert.alert('Success', 'Account created');

      await setDoc(doc(db, 'users', uid), {
        name: name.trim(),
        email: email.trim(),
        createdAt: new Date().toISOString(),
      });
      try {
        const token = await userCred.user.getIdToken();
        await AsyncStorage.setItem('userToken', token);
      } catch (err) {
        console.warn('Failed to save token to storage', err);
      }

      router.replace('/');
    } catch (e: any) {
      const code = e?.code ?? e?.message ?? String(e);
      if (code === 'auth/email-already-in-use') setError('An account with that email already exists');
      else setError(typeof code === 'string' ? code : 'Sign up failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sign up</Text>
  <TextInput placeholder="Name" placeholderTextColor="#9CA3AF" value={name} onChangeText={(t) => { setName(t); setError(null); }} style={styles.input} />
  <TextInput placeholder="Email" placeholderTextColor="#9CA3AF" value={email} onChangeText={(t) => { setEmail(t); setError(null); }} keyboardType="email-address" autoCapitalize="none" style={styles.input} />
  <TextInput placeholder="Password" placeholderTextColor="#9CA3AF" value={password} onChangeText={(t) => { setPassword(t); setError(null); }} secureTextEntry style={styles.input} />
  <TextInput placeholder="Confirm password" placeholderTextColor="#9CA3AF" value={confirmPassword} onChangeText={(t) => { setConfirmPassword(t); setError(null); }} secureTextEntry style={styles.input} />
  {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button title={loading ? 'Creating...' : 'Create account'} onPress={onSignUp} disabled={loading} />
      <View style={{ height: 8 }} />
  <Button title="Have an account? Sign in" onPress={() => router.push('/SignIn' as any)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, justifyContent: 'center' },
  input: { borderWidth: 1, padding: 10, marginVertical: 8, borderRadius: 6 },
  title: { fontSize: 20, marginBottom: 12, textAlign: 'center' },
  error: { color: 'red', marginBottom: 8, textAlign: 'center' },
});