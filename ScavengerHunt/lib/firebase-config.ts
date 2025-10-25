/**
 * Firebase configuration and initialization module.
 * This module handles the setup of Firebase services for the application.
 * @module
 */
import { initializeApp } from "firebase/app";
import type { Auth } from "firebase/auth";

// ============================================================================
// Configuration
// ============================================================================

/**
 * Firebase configuration object containing necessary credentials and endpoints
 * @type {Object}
 */
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// ============================================================================
// Firebase Initialization
// ============================================================================

/**
 * Initialize Firebase application instance
 * @type {FirebaseApp}
 */
const app = initializeApp(firebaseConfig);

// Lazy-initialized Auth instance. We avoid importing or calling
// native-only APIs at module evaluation time to prevent runtime
// errors in the bundler (for example: "Component auth has not been registered yet").
let _auth: Auth | null = null;

/**
 * Returns a Firebase Auth instance, initializing it on first call.
 * - On React Native, attempts to use initializeAuth with
 *   getReactNativePersistence(AsyncStorage).
 * - Falls back to getAuth(app) when native persistence isn't available
 *   (e.g. web or when AsyncStorage cannot be required).
 */
export function getFirebaseAuth(): Auth {
  if (_auth) return _auth as Auth;

  try {
    // Dynamic require to avoid touching native modules during module eval.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const firebaseAuth = require("firebase/auth");
    const { getAuth, initializeAuth, getReactNativePersistence } = firebaseAuth;

    try {
      // Try to require React Native AsyncStorage at runtime. If that fails
      // (web or not installed) we'll fall back to getAuth.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const AsyncStorage = require("@react-native-async-storage/async-storage").default;

      if (typeof initializeAuth === "function" && typeof getReactNativePersistence === "function") {
  _auth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
  return _auth as Auth;
      }
    } catch (innerErr) {
      // AsyncStorage or native persistence not available; fall through to getAuth
    }

    // Fallback for web and other environments.
  _auth = getAuth(app);
  return _auth as Auth;
  } catch (err) {
    // Surface the error so callers can handle it. This should be rare.
    throw err;
  }
}

export default app;
