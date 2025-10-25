import { router, Link } from "expo-router";
import { Text, TextInput, View, Pressable } from "react-native";
import { useState } from "react";
import { useSession } from "@/context";

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
        router.replace("/(app)/(drawer)/(tabs)/" as any);
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

  return (
    <View className="flex-1 justify-center items-center p-4">
      {/* Welcome Section */}
      <View className="items-center mb-8">
        <Text className="text-2xl font-bold text-gray-800 mb-2">
          Welcome Back
        </Text>
        <Text className="text-sm text-gray-500">
          Please sign in to continue
        </Text>
      </View>

      {/* Form Section */}
      <View className="w-full max-w-[300px] space-y-4 mb-8">
        <View>
          <Text className="text-sm font-medium text-gray-700 mb-1 ml-1">
            Email
          </Text>
          <TextInput
            placeholder="name@mail.com"
            value={email}
            onChangeText={setEmail}
            textContentType="emailAddress"
            keyboardType="email-address"
            autoCapitalize="none"
            className="w-full p-3 border border-gray-300 rounded-lg text-base bg-white"
          />
        </View>

        <View>
          <Text className="text-sm font-medium text-gray-700 mb-1 ml-1">
            Password
          </Text>
          <TextInput
            placeholder="Your password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="password"
            className="w-full p-3 border border-gray-300 rounded-lg text-base bg-white"
          />
        </View>
      </View>

      
      <Pressable
        onPress={handleSignInPress}
        disabled={isLoading}
        className="bg-blue-600 w-full max-w-[300px] py-3 rounded-lg active:bg-blue-700"
      >
        <Text className="text-white font-semibold text-base text-center">
          {isLoading ? "Signing in..." : "Sign In"}
        </Text>
      </Pressable>

  
      {error ? (
        <Text className="text-red-600 mt-4">{error}</Text>
      ) : null}

      {/* Sign Up Link */}
      <View className="flex-row items-center mt-6">
        <Text className="text-gray-600">Don't have an account?</Text>
        <Link href="/sign-up" asChild>
          <Pressable className="ml-2">
            <Text className="text-blue-600 font-semibold">Sign Up</Text>
          </Pressable>
        </Link>
      </View>
    </View>
  );
}
