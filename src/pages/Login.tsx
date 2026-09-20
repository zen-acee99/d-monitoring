import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, AlertCircle, Sparkles, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { getAllUsers, setCurrentUser } from "@/services/authStore";
import { UserRecord } from "@/data/userStore";
import { signInWithGoogle } from "@/services/firebaseAuth";
import { usersApi } from "@/services/api";

export function Login() {
  const navigate = useNavigate();
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showFirebaseNotice, setShowFirebaseNotice] = useState(false);
  const [allUsers, setAllUsers] = useState<UserRecord[]>([]);

  useEffect(() => {
    getAllUsers().then(setAllUsers);
  }, []);

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setShowFirebaseNotice(false);

    try {
      const res = await signInWithGoogle();
      if (res.success) {
        navigate("/");
        return;
      }

      if (res.error === "FIREBASE_NOT_CONFIGURED") {
        setShowFirebaseNotice(true);
      } else if (res.error) {
        setErrorMessage(res.error);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to sign in with Google.");
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleSimulatedGoogleLogin = async (gmailAddress: string) => {
    setIsGoogleLoading(true);
    setShowFirebaseNotice(false);
    setErrorMessage(null);

    const cleanEmail = gmailAddress.trim().toLowerCase();
    const displayName = cleanEmail.split("@")[0].replace(/\./g, " ").replace(/\b\w/g, l => l.toUpperCase());

    try {
      const res = await usersApi.syncGoogleUser({
        google_id: `g-${Date.now()}`,
        email: cleanEmail,
        name: displayName,
      });

      if (res.success && res.user) {
        if (res.user.status === "inactive") {
          setIsGoogleLoading(false);
          setErrorMessage(`Access Denied: The account for ${res.user.name} is deactivated. You no longer have access to the platform.`);
          return;
        }
        setCurrentUser({ ...(res.user as any), authProvider: "google", lastLogin: "Just now (GovMail SSO)" });
        setIsGoogleLoading(false);
        navigate("/");
        return;
      }

      if (res.error) {
        setIsGoogleLoading(false);
        setErrorMessage(res.error);
        return;
      }
    } catch {
      // Fallback
    }

    const matched = allUsers.find(
      (u) =>
        u.email.toLowerCase() === cleanEmail ||
        u.email.toLowerCase().startsWith(cleanEmail.split("@")[0] + "@") ||
        cleanEmail.startsWith(u.email.split("@")[0] + "@")
    );

    if (matched) {
      if (matched.status === "inactive") {
        setIsGoogleLoading(false);
        setErrorMessage(`Access Denied: The account for ${matched.name} is deactivated. You no longer have access to the platform.`);
        return;
      }
      setCurrentUser({ ...matched, authProvider: "google", lastLogin: "Just now (GovMail SSO)" });
      setIsGoogleLoading(false);
      navigate("/");
      return;
    }

    setIsGoogleLoading(false);
    setErrorMessage(
      `Access Denied: The GovMail address "${gmailAddress}" is not registered in the system. Only pre-registered personnel added by an administrator can log in.`
    );
  };

  return (
    <div className="min-h-screen bg-background-primary flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Uploaded Binary Background Image */}
      <div 
        className="absolute inset-0 bg-[url('/image.png')] bg-cover bg-center bg-no-repeat opacity-30 pointer-events-none mix-blend-screen" 
        aria-hidden="true"
      />
      {/* Dark overlay to ensure card readability */}
      <div className="absolute inset-0 bg-background-primary/80 pointer-events-none" />
      {/* Subtle background glow effect */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-brand-500/10 via-transparent to-background-primary/90 pointer-events-none" />

      <div className="w-full max-w-md z-10">
        <div className="flex flex-col items-center mb-8 text-center relative">
          {/* Dual Official Government Logos: DICT + Bagong Pilipinas */}
          <div className="flex items-center justify-center gap-5 mb-5 relative z-10">
            {/* DICT Logo (from Side Nav) */}
            <div className="w-[100px] h-[100px] aspect-square bg-background-secondary/90 backdrop-blur-md rounded-2xl flex items-center justify-center border border-border-primary shadow-[0_0_25px_rgba(59,130,246,0.25)] p-2.5 group transition-transform hover:scale-105">
              <img 
                src="/dict-logo.png" 
                alt="DICT Logo" 
                className="w-full h-full aspect-square object-contain drop-shadow-md"
              />
            </div>

            {/* Subtle Divider */}
            <div className="h-10 w-px bg-slate-700/60" />

            {/* Bagong Pilipinas Official Logo */}
            <div className="w-[100px] h-[100px] aspect-square bg-background-secondary/90 backdrop-blur-md rounded-2xl flex items-center justify-center border border-border-primary shadow-[0_0_25px_rgba(234,179,8,0.25)] p-2.5 group transition-transform hover:scale-105">
              <img 
                src="/bagong-pilipinas-logo.png" 
                alt="Bagong Pilipinas Logo" 
                className="w-full h-full aspect-square object-contain drop-shadow-md"
              />
            </div>
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-text-primary relative z-10">DICT Region V</h1>
          <p className="text-text-muted mt-2 relative z-10 font-mono text-xs tracking-widest uppercase">Unified Analytics Platform</p>
        </div>

        <Card className="border-border-primary shadow-2xl shadow-black/50 backdrop-blur-sm bg-background-secondary/90">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl">Authentication Required</CardTitle>
            <CardDescription>
              Sign in with your registered GovMail or Google account to access the platform.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Success Message Banner */}
            {successMessage && (
              <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* Error Message Banner */}
            {errorMessage && (
              <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-300 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
                <button onClick={() => setErrorMessage(null)} className="text-red-400 hover:text-white cursor-pointer">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Firebase Configuration Notice */}
            {showFirebaseNotice && (
              <div className="mb-5 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs space-y-2.5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-amber-300">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                    Firebase Keys Required in .env
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowFirebaseNotice(false)}
                    className="text-slate-400 hover:text-white cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  To connect live Gmail accounts, paste your Firebase project web credentials into <code className="text-amber-300 bg-black/40 px-1 py-0.5 rounded font-mono">.env</code> (<code className="text-slate-300">VITE_FIREBASE_API_KEY</code>, etc.).
                </p>
                <div className="pt-1 flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const firstUser = allUsers[0];
                      const testEmail = firstUser ? `${firstUser.email.split("@")[0]}@gmail.com` : "ace.malto@gmail.com";
                      handleSimulatedGoogleLogin(testEmail);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Test Gmail Login (Instant Preview)
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowFirebaseNotice(false)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            {/* Google / Gmail Sign In Button */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isGoogleLoading}
              className="w-full h-11 px-4 py-2 rounded-lg bg-white hover:bg-slate-100 text-slate-900 font-semibold text-sm transition-all flex items-center justify-center gap-3 shadow-md hover:shadow-lg border border-slate-300 active:scale-[0.99] disabled:opacity-60 cursor-pointer"
            >
              {isGoogleLoading ? (
                <span className="flex items-center gap-2 text-slate-700">
                  <span className="w-4 h-4 border-2 border-slate-600 border-t-transparent rounded-full animate-spin" />
                  Connecting with Google...
                </span>
              ) : (
                <>
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                    />
                  </svg>
                  <span>Sign in with Google / Gmail</span>
                </>
              )}
            </button>
          </CardContent>
        </Card>

        <div className="mt-8 text-center space-y-4 relative z-10">
          <p className="text-xs text-text-muted max-w-sm mx-auto leading-relaxed border border-border-primary/50 bg-background-secondary/80 backdrop-blur-sm p-3 rounded-lg">
            <strong className="text-status-orange">WARNING:</strong> This is a restricted government system. Unauthorized access, use, or modification is strictly prohibited and subject to legal action under the Cybercrime Prevention Act.
          </p>
          <p className="text-[10px] text-text-muted/60">
            &copy; {new Date().getFullYear()} Department of Information and Communications Technology Region 5
          </p>
        </div>
      </div>
    </div>
  );
}
