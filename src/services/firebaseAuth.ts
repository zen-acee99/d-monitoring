import { signInWithPopup, signOut, UserCredential } from "firebase/auth";
import { auth, googleProvider, isFirebaseConfigured } from "@/config/firebase";
import { getAllUsers, setCurrentUser } from "@/services/authStore";
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
 * Strictly verifies that the Google email exists in the registered User List.
 * If the email is not in the User List, login is immediately blocked and signed out.
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
      await signOut(auth).catch(() => {});
      setCurrentUser(null);
      return { success: false, error: "No email returned from Google account." };
    }

    const email = googleUser.email.toLowerCase().trim();
    const displayName = googleUser.displayName || email.split("@")[0];

    // 1. Verify against backend Turso User List
    try {
      let idToken: string | undefined;
      try {
        idToken = await googleUser.getIdToken();
      } catch {}

      const syncRes = await usersApi.syncGoogleUser({
        google_id: googleUser.uid,
        email,
        name: displayName,
        avatar_url: googleUser.photoURL || null,
        idToken,
      });

      if (syncRes) {
        if (syncRes.success && syncRes.user) {
          if (syncRes.user.status === "inactive") {
            await signOut(auth).catch(() => {});
            setCurrentUser(null);
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

        // If backend explicitly rejected the email (403 / not in User List), stop immediately!
        if (
          syncRes.status === 403 ||
          syncRes.status === 401 ||
          syncRes.status === 404 ||
          (syncRes.error &&
            (syncRes.error.toLowerCase().includes("access denied") ||
              syncRes.error.toLowerCase().includes("not registered") ||
              syncRes.error.toLowerCase().includes("not in the")))
        ) {
          await signOut(auth).catch(() => {});
          setCurrentUser(null);
          return {
            success: false,
            error:
              syncRes.error ||
              `Access Denied: The GovMail address "${email}" is not in the User List. Only registered personnel added by an administrator can log in.`,
          };
        }
      }
    } catch (e: any) {
      console.warn("Backend sync check warning:", e);
    }

    // 2. Fallback: Fetch registered personnel list and verify exact email match ONLY
    let allUsers: UserRecord[] = [];
    try {
      allUsers = await getAllUsers();
    } catch {
      allUsers = [];
    }

    const matchedUser = allUsers.find(
      (u) => u.email && u.email.toLowerCase().trim() === email
    );

    // STRICT ACCESS CONTROL: Block any email not present in the User List!
    if (!matchedUser) {
      await signOut(auth).catch(() => {});
      setCurrentUser(null);
      return {
        success: false,
        error: `Access Denied: The GovMail address "${email}" is not in the User List. Only registered personnel added by an administrator can log in.`,
      };
    }

    // Verify if the user's status is active
    if (matchedUser.status === "inactive") {
      await signOut(auth).catch(() => {});
      setCurrentUser(null);
      return {
        success: false,
        error: `Access Denied: The user account for ${matchedUser.name} (${email}) is currently deactivated.`,
      };
    }

    // Existing registered user with assigned permissions
    const sessionUser: UserRecord = {
      ...matchedUser,
      authProvider: "google",
      lastLogin: "Just now (GovMail SSO)",
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
