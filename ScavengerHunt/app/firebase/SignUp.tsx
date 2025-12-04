import { router, Link } from "expo-router";
import { TextInput, View, Pressable } from "react-native";
import { useState } from "react";
import { useSession } from "@/context";
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import ThemedButton from '@/components/ThemedButton';
import { useThemeColor } from '@/hooks/useThemeColor';

/**
 * SignUp component handles new user registration
 * @returns {JSX.Element} Sign-up form component
 */
export default function SignUp() {
  // ============================================================================
  // Hooks & State
  // ============================================================================
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const { signUp } = useSession();
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // ============================================================================
  // Handlers
  // ============================================================================

  /**
   * Handles the registration process
   * @returns {Promise<Models.User<Models.Preferences> | null>}
   */
  const handleRegister = async () => {
    try {
  // pass trimmed name to avoid leading/trailing whitespace being stored
  return await signUp(email, password, name.trim());
    } catch (err) {
      console.log("[handleRegister] ==>", err);
      return null;
    }
  };

  /**
   * Handles the sign-up button press
   */
  const handleSignUpPress = async () => {
    setError(null);
    // validate name
    const trimmed = name.trim();
    if (!trimmed || trimmed.length < 2) {
      setError("Please enter your full name (at least 2 characters).");
      return;
    }

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setIsLoading(true);
    try {
      const resp = await handleRegister();
      if (resp) {
        router.replace("/drawer/tabs" as any);
      } else {
        setError("Registration failed. Please try again.");
      }
    } catch (e: any) {
      const code = e?.code || e?.message;
      if (code === "auth/email-already-in-use") setError("Email already in use.");
      else setError("Registration failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================================================
  // Render
  // ============================================================================

  const inputBg = useThemeColor({}, 'background');

  return (
    <ThemedView className="flex-1 justify-center items-center p-4">
      <View className="items-center mb-8">
        <ThemedText type="title" style={{ marginBottom: 8 }}>Create Account</ThemedText>
        <ThemedText style={{ fontSize: 14 }}>Sign up to get started</ThemedText>
      </View>

      <View className="w-full max-w-[300px] space-y-4 mb-8">
        <View>
          <ThemedText style={{ fontSize: 12, fontWeight: '600', marginBottom: 4 }}>Name</ThemedText>
          <TextInput placeholder="Your full name" value={name} onChangeText={setName} textContentType="name" autoCapitalize="words" style={{ backgroundColor: inputBg }} className="w-full p-3 border border-gray-300 rounded-lg text-base" />
        </View>

        <View>
          <ThemedText style={{ fontSize: 12, fontWeight: '600', marginBottom: 4 }}>Email</ThemedText>
          <TextInput placeholder="name@mail.com" value={email} onChangeText={setEmail} textContentType="emailAddress" keyboardType="email-address" autoCapitalize="none" style={{ backgroundColor: inputBg }} className="w-full p-3 border border-gray-300 rounded-lg text-base" />
        </View>

        <View>
          <ThemedText style={{ fontSize: 12, fontWeight: '600', marginBottom: 4 }}>Password</ThemedText>
          <TextInput placeholder="Create a password" value={password} onChangeText={setPassword} secureTextEntry textContentType="newPassword" style={{ backgroundColor: inputBg }} className="w-full p-3 border border-gray-300 rounded-lg text-base" />
        </View>

        <View>
          <ThemedText style={{ fontSize: 12, fontWeight: '600', marginBottom: 4 }}>Confirm Password</ThemedText>
          <TextInput placeholder="Confirm password" value={confirm} onChangeText={setConfirm} secureTextEntry textContentType="newPassword" style={{ backgroundColor: inputBg }} className="w-full p-3 border border-gray-300 rounded-lg text-base" />
        </View>
      </View>

      <ThemedButton title={isLoading ? 'Creating...' : 'Sign Up'} onPress={handleSignUpPress} disabled={isLoading} style={{ width: '100%', maxWidth: 300 }} />

      {error ? <ThemedText lightColor="#b91c1c" darkColor="#fca5a5" style={{ marginTop: 12 }}>{error}</ThemedText> : null}

      <View className="flex-row items-center mt-6">
        <ThemedText>Already have an account?</ThemedText>
        <Link href="./SignIn" asChild>
          <Pressable className="ml-2">
            <ThemedText style={{ color: useThemeColor({}, 'tint'), fontWeight: '600' }}>Sign In</ThemedText>
          </Pressable>
        </Link>
      </View>
    </ThemedView>
  );
}
