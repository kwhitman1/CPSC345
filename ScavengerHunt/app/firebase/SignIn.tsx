import { router, Link } from "expo-router";
import { TextInput, View, Pressable } from "react-native";
import { useState } from "react";
import { useSession } from "@/context";
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import ThemedButton from '@/components/ThemedButton';
import { useThemeColor } from '@/hooks/useThemeColor';

/**
 * SignIn component handles user authentication through email and password
 * @returns {JSX.Element} Sign-in form component
 */
export default function SignIn() {
  // ============================================================================
  // Hooks & State
  // ============================================================================
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { signIn } = useSession();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // ============================================================================
  // Handlers
  // ============================================================================

  /**
   * Handles the sign-in process
   * @returns {Promise<Models.User<Models.Preferences> | null>}
   */
  const handleLogin = async () => {
    try {
      return await signIn(email, password);
    } catch (err) {
      console.log("[handleLogin] ==>", err);
      return null;
    }
  };

  /**
   * Handles the sign-in button press
   */
  const handleSignInPress = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const resp = await handleLogin();
      if (resp) {
        router.replace("/drawer/tabs" as any);
      } else {
        setError("Invalid credentials — please check your email and password.");
      }
    } catch (e: any) {
      console.log("[handleSignInPress] ==>", e);
      const code = e?.code || e?.message;
      if (code === "auth/user-not-found") setError("No account found for that email.");
      else if (code === "auth/wrong-password") setError("Incorrect password.");
      else if (code === "auth/invalid-email") setError("Please enter a valid email address.");
      else setError("Authentication failed. Please try again.");
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
      {/* Welcome Section */}
      <View className="items-center mb-8">
        <ThemedText type="title" style={{ marginBottom: 8 }}>Welcome Back</ThemedText>
        <ThemedText style={{ fontSize: 14 }}>Please sign in to continue</ThemedText>
      </View>

      {/* Form Section */}
      <View className="w-full max-w-[300px] space-y-4 mb-8">
        <View>
          <ThemedText style={{ fontSize: 12, fontWeight: '600', marginBottom: 4 }}>Email</ThemedText>
          <TextInput
            placeholder="name@mail.com"
            value={email}
            onChangeText={setEmail}
            textContentType="emailAddress"
            keyboardType="email-address"
            autoCapitalize="none"
            className="w-full p-3 border border-gray-300 rounded-lg text-base"
            style={{ backgroundColor: inputBg }}
          />
        </View>

        <View>
          <ThemedText style={{ fontSize: 12, fontWeight: '600', marginBottom: 4 }}>Password</ThemedText>
          <TextInput
            placeholder="Your password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="password"
            className="w-full p-3 border border-gray-300 rounded-lg text-base"
            style={{ backgroundColor: inputBg }}
          />
        </View>
      </View>

      <ThemedButton title={isLoading ? 'Signing in...' : 'Sign In'} onPress={handleSignInPress} disabled={isLoading} style={{ width: '100%', maxWidth: 300 }} />

      {error ? (
        <ThemedText lightColor="#b91c1c" darkColor="#fda4af" style={{ marginTop: 12 }}>{error}</ThemedText>
      ) : null}

      {/* Sign Up Link */}
      <View className="flex-row items-center mt-6">
        <ThemedText style={{ color: useThemeColor({}, 'text') === undefined ? undefined : undefined }}>Don't have an account?</ThemedText>
        <Link href="./SignUp" asChild>
          <Pressable className="ml-2">
            <ThemedText style={{ color: useThemeColor({}, 'tint'), fontWeight: '600' }}>Sign Up</ThemedText>
          </Pressable>
        </Link>
      </View>
    </ThemedView>
  );
}
