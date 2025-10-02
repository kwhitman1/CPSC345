import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Button, StyleSheet, Text, View } from 'react-native';

type HistoryItem = {
  id: string;
  cipher: string;
  date: string;
};

export default function Detail() {
  const { id } = useLocalSearchParams() as { id?: string };
  const [item, setItem] = useState<HistoryItem | null>(null);
  const [decrypted, setDecrypted] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      const raw = await AsyncStorage.getItem('history');
      const arr: HistoryItem[] = raw ? JSON.parse(raw) : [];
      const found = arr.find((h) => h.id === id) || null;
      setItem(found);
    };
    load();
  }, [id]);

  const deleteItem = async () => {
    if (!item) return;
    const raw = await AsyncStorage.getItem('history');
    const arr: HistoryItem[] = raw ? JSON.parse(raw) : [];
    const next = arr.filter((h) => h.id !== item.id);
    await AsyncStorage.setItem('history', JSON.stringify(next));
    router.back();
  };

  const decrypt = (text: string, shift: number) => {
    return text
      .split('')
      .map((char) => {
        const number = char.charCodeAt(0);
        if (number >= 97 && number <= 122) {
          return String.fromCharCode(((number - 97 + 26 - (shift % 26)) % 26) + 97);
        }
        return char;
      })
      .join('');
  };

  const confirmDelete = () => {
    Alert.alert(
      'Delete Message',
      'Are you sure you want to delete this message? This action is permanent.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: deleteItem },
      ]
    );
  };

  const getKeyFromLocation = (lat: number, lon: number) => {
    const latR = Math.round(lat * 10000);
    const lonR = Math.round(lon * 10000);
    const mixed = Math.abs((latR * 73856093) ^ (lonR * 19349663));
    return (mixed % 25) + 1;
  };

  const calcDecryptWithLocation = async () => {
    if (!item) return;
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location required', 'Location permission is required to get the encryption key for decryption.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
      const { latitude, longitude } = pos.coords;
      const key = getKeyFromLocation(latitude, longitude);
      const plain = decrypt(item.cipher, key);
      setDecrypted(plain);
    } catch (err) {
      Alert.alert('Error', 'Unable to obtain location.');
    }
  };

  if (!item) {
    return (
      <View style={styles.container}>
        <Text style={{ padding: 16 }}>Message not found.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Encrypted</Text>
      <Text style={styles.value}>{item.cipher}</Text>

      <View style={{ marginTop: 12 }}>
        <Button title="Decrypt using my current location" onPress={calcDecryptWithLocation} />
      </View>

      {decrypted ? (
        <>
          <Text style={styles.label}>Decrypted</Text>
          <Text style={styles.value}>{decrypted}</Text>
        </>
      ) : null}

      <View style={{ marginTop: 20 }}>
        <Button title="Delete" color="red" onPress={confirmDelete} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  label: { fontWeight: '600', marginTop: 12 },
  value: { marginTop: 6 },
});
