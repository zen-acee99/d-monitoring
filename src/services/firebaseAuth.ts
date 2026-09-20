import { signInWithPopup, signOut, UserCredential } from "firebase/auth";
import { auth, googleProvider, isFirebaseConfigured } from "@/config/firebase";
import { getAllUsers, setCurrentUser, createFullAccessMatrix } from "@/services/authStore";
import { UserRecord } from "@/data/userStore";
import { usersApi } from "@/services/api";

export interface GoogleAuthResult {
  success: boolean;
  user?: UserRecord;
  error?: string;
  isNewUser?: boolean;
}

/**
 * Sign in with Google / Gmail using Firebase Authentication.
 * Matches the Google email with existing registered personnel in the system
 * to preserve their specific roles and module access privileges.
 */
export async function signInWithGoogle(): Promise<GoogleAuthResult> {
  // If Firebase API key is not yet configured with real credentials
  if (!isFirebaseConfigured()) {
    return {
      success: false,
      error: "FIREBASE_NOT_CONFIGURED",
    };
  }

  try {
    const credential: UserCredential = await signInWithPopup(auth, googleProvider);
    const googleUser = credential.user;

    if (!googleUser || !googleUser.email) {
      return { success: false, error: "No email returned from Google account." };
    }

    const email = googleUser.email.toLowerCase().trim();
    const displayName = googleUser.displayName || email.split("@")[0];

    // Sync Google OAuth session and credentials directly to the Turso users table
    try {
      const syncRes = await usersApi.syncGoogleUser({
        google_id: googleUser.uid,
        email,
        name: displayName,
        avatar_url: googleUser.photoURL || null,
      });

      if (syncRes.success && syncRes.user) {
        if (syncRes.user.status === "inactive") {
          await signOut(auth).catch(() => {});
          return {
            success: false,
            error: `Access Denied: The account for ${syncRes.user.name} (${email}) is deactivated. You no longer have access to the system.`,
          };
        }
        const sessionUser: UserRecord = {
          ...(syncRes.user as any),
          authProvider: "google",
          lastLogin: "Just now (GovMail SSO)",
        };
        setCurrentUser(sessionUser);
        return {
          success: true,
          user: sessionUser,
          isNewUser: false,
        };
      }

      if (!syncRes.success && syncRes.error) {
        await signOut(auth).catch(() => {});
        return {
          success: false,
          error: syncRes.error,
        };
      }
    } catch (e: any) {
      console.warn("Could not sync Google user to Turso users table:", e);
    }

    // Fallback: Fetch registered personnel list to match existing privileges
    let allUsers: UserRecord[] = [];
    try {
      allUsers = await getAllUsers();
    } catch {
      allUsers = [];
    }

    // Attempt match by exact email, or username prefix
    const matchedUser = allUsers.find(
      (u) =>
        u.email.toLowerCase().trim() === email ||
        u.email.toLowerCase().trim() === `${email.split("@")[0]}@dict.gov.ph` ||
        (u.email.toLowerCase().trim().startsWith(email.split("@")[0] + "@") && email.endsWith("@dict.gov.ph"))
    );

    // Strict access control: If the user is not in the registered personnel database, REJECT
    if (!matchedUser) {
      await signOut(auth).catch(() => {});
      return {
        success: false,
        error: `Access Denied: The Google account (${email}) is not registered in the system. Only authorized users added by the administrator may log in.`,
      };
    }

    // Also verify if the user's status is active
    if (matchedUser.status === "inactive") {
      await signOut(auth).catch(() => {});
      return {
        success: false,
        error: `Access Denied: The user account for ${matchedUser.name} (${email}) is currently deactivated.`,
      };
    }

    // Existing registered user with assigned permissions
    const sessionUser: UserRecord = {
      ...matchedUser,
      authProvider: "google",
      lastLogin: "Just now (Google Auth)",
    };

    // Set active session in local store and dispatch auth event
    setCurrentUser(sessionUser);

    return {
      success: true,
      user: sessionUser,
      isNewUser: false,
    };
  } catch (error: any) {
    console.error("Firebase Google Auth error:", error);
    let errorMessage = error.message || "Failed to sign in with Google.";

    if (error.code === "auth/popup-closed-by-user") {
      errorMessage = "Google sign-in popup was closed before completing.";
    } else if (error.code === "auth/popup-blocked") {
      errorMessage = "Google sign-in popup was blocked by your browser. Please allow popups.";
    } else if (error.code === "auth/cancelled-popup-request") {
      errorMessage = "Sign-in request was cancelled.";
    } else if (error.code === "auth/network-request-failed") {
      errorMessage = "Network error. Please check your internet connection.";
    } else if (error.code === "auth/invalid-api-key" || error.code === "auth/configuration-not-found") {
      errorMessage = "FIREBASE_NOT_CONFIGURED";
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Sign out from Firebase and clear active local user session.
 */
export async function signOutGoogle(): Promise<void> {
  try {
    await signOut(auth);
  } catch (e) {
    console.warn("Firebase sign out error:", e);
  }
  setCurrentUser(null);
}
