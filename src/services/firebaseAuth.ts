import { signInWithPopup, signOut, UserCredential } from "firebase/auth";
import { auth, googleProvider, isFirebaseConfigured } from "@/config/firebase";
import { getAllUsers, setCurrentUser, createFullAccessMatrix } from "@/services/authStore";
import { UserRecord, saveStoredUsers } from "@/data/userStore";
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

    // Attempt to sync Google OAuth session and credentials directly to the Turso users table
    try {
      const syncRes = await usersApi.syncGoogleUser({
        google_id: googleUser.uid,
        email,
        name: displayName,
        avatar_url: googleUser.photoURL || null,
      });

      if (syncRes && syncRes.success && syncRes.user) {
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
    } catch (e: any) {
      console.warn("Backend sync not available, falling back to local store:", e);
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

    let sessionUser: UserRecord;

    if (matchedUser) {
      // Verify if the user's status is active
      if (matchedUser.status === "inactive") {
        await signOut(auth).catch(() => {});
        return {
          success: false,
          error: `Access Denied: The user account for ${matchedUser.name} (${email}) is currently deactivated.`,
        };
      }

      // Existing registered user with assigned permissions
      sessionUser = {
        ...matchedUser,
        authProvider: "google",
        lastLogin: "Just now (Google Auth)",
      };
    } else {
      // Provision authenticated Google user with Super Admin access
      sessionUser = {
        id: `g-${Date.now()}`,
        name: displayName || email.split("@")[0].replace(/\./g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
        email: email,
        role: "Super Admin",
        region: "Region V (Bicol)",
        status: "active",
        isFocal: false,
        access: createFullAccessMatrix(),
        authProvider: "google",
        lastLogin: "Just now (Google Auth)",
        createdAt: new Date().toISOString().split("T")[0],
      };

      const updatedUsers = [...allUsers, sessionUser];
      saveStoredUsers(updatedUsers);
    }

    // Set active session in local store and dispatch auth event
    setCurrentUser(sessionUser);

    return {
      success: true,
      user: sessionUser,
      isNewUser: !matchedUser,
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
    } else if (error.code === "auth/unauthorized-domain") {
      const currentHost = typeof window !== "undefined" ? window.location.hostname : "your domain";
      errorMessage = `Unauthorized Domain: "${currentHost}" is not authorized in your Firebase Console. Please add "${currentHost}" to Firebase Console -> Authentication -> Settings -> Authorized Domains.`;
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
