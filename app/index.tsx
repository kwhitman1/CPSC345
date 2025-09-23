import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Button, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

export default function Index() {
  const [message, setMessage] = useState('');
  const [key, setKey] = useState('1');
  const [result, setResult] = useState('');
  const [showKeyModal, setShowKeyModal] = useState(false);
  const router = useRouter();

  const calcEncrypt = () => {
    const shift = parseInt(key, 10);
    if (!isNaN(shift)) {
  const res = encrypt(message, shift);
  setResult(res);
  saveHistory('encrypt', message, key, res);
    }
  };

  const calcDecrypt = () => {
    const shift = parseInt(key, 10);
    if (!isNaN(shift)) {
      const res = decrypt(message, shift);
      setResult(res);
      saveHistory('decrypt', message, key, res);
    }
  };

  const saveHistory = async (type: 'encrypt' | 'decrypt', original: string, keyVal: string, resultVal: string) => {
    const item = { id: Date.now().toString(), type, original, key: keyVal, result: resultVal, date: new Date().toISOString() };
    const raw = await AsyncStorage.getItem('history');
    const arr = raw ? JSON.parse(raw) : [];
    arr.unshift(item);
    await AsyncStorage.setItem('history', JSON.stringify(arr));
  };

  const encrypt = (text: string, shift: number): string => {
    return text
      .split('')
      .map(char => {
        const number = char.charCodeAt(0);
        if (number >= 97 && number <= 122) {
          return String.fromCharCode(((number - 97 + shift) % 26) + 97);
        }
        return char;
      })
      .join('');
  };

  const decrypt = (text: string, shift: number): string => {
    return encrypt(text, 26 - (shift % 26));
  };

  return (
    <View
      style={{
        flex: 0.5,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Text>Enter the message to encrypt or decrypt here</Text>
      <TextInput
        value={message}
        onChangeText={setMessage}
        style={{ borderWidth: 1, padding: 10, width: '90%', marginVertical: 10 }}
      />
      <Text>Select the encryption key here</Text>
      <Pressable style={styles.pickerContainer} onPress={() => setShowKeyModal(true)}>
        <Text>{key}</Text>
      </Pressable>

      <Modal visible={showKeyModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={{ fontWeight: '600', marginBottom: 8 }}>Select key</Text>
            <FlatList
              data={Array.from({ length: 25 }).map((_, i) => String(i + 1))}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    setKey(item);
                    setShowKeyModal(false);
                  }}
                  style={styles.option}
                >
                  <Text style={styles.optionText}>{item}</Text>
                </Pressable>
              )}
            />
            <View style={{ marginTop: 12 }}>
              <Button title="Cancel" onPress={() => setShowKeyModal(false)} />
            </View>
          </View>
        </View>
      </Modal>
      
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
        <Button title="Encrypt" onPress={calcEncrypt} />
        <View style={{ width: 10 }} />
        <Button title="Decrypt" onPress={calcDecrypt} />
      </View>
      <Text>{'\n'}</Text>
      <Text>The results will appear here</Text>
      <Text>{'\n'}{result}</Text>
      <View style={{ marginTop: 12 }}>
        <Button title="View History" onPress={() => router.push('/history')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pickerContainer: { width: '10%', borderWidth: 1, borderColor: '#ccc', borderRadius: 6, overflow: 'hidden', marginVertical: 10},
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: 16 },
  modalContent: { backgroundColor: '#fff', borderRadius: 8, maxHeight: '70%', padding: 12,},
  option: { paddingVertical: 12, paddingHorizontal: 8 },
  optionText: { fontSize: 16 },
});