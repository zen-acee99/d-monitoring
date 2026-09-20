import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth, GoogleAuthProvider } from "firebase/auth";

// Firebase web client configuration
// Provide keys in .env as VITE_FIREBASE_*
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyCb70dqweG8f_hmJYFZq89UzW4rsLHjlJc",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "monitoring-56cf1.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "monitoring-56cf1",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "monitoring-56cf1.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "403731363483",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:403731363483:web:aa00c5e5844eae519ab83e",
};

// Singleton Firebase App
export const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Singleton Firebase Auth
export const auth: Auth = getAuth(app);

// Preconfigured Google Auth Provider for Gmail sign-in
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: "select_account",
});

// Check if user has configured real credentials in .env
export function isFirebaseConfigured(): boolean {
  const key = import.meta.env.VITE_FIREBASE_API_KEY;
  return Boolean(key && !key.includes("DemoKey"));
}
