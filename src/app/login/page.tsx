"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

type AuthMode = "signin" | "signup";
type LoadingState = "google" | "discord" | "email" | null;

function LoginContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const redirectTo = searchParams.get("redirectTo") || "/";
  const urlError = searchParams.get("error");
  const initialMode = searchParams.get("mode") === "signup" ? "signup" : "signin";
  
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [isLoading, setIsLoading] = useState<LoadingState>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(urlError ? "Authentication failed. Please try again." : null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleOAuthLogin = async (provider: "google" | "discord") => {
    setIsLoading(provider);
    setError(null);
    const supabase = createClient();

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${redirectTo}`,
      },
    });

    if (error) {
      console.error("[Auth] OAuth error:", {
        provider,
        message: error.message,
        status: error.status,
        code: (error as Record<string, unknown>).code,
      });
      setError(error.message);
      setIsLoading(null);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!email || !password) {
      setError("Please enter both email and password.");
      return;
    }

    if (mode === "signup" && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (mode === "signup") {
      if (!displayName.trim()) {
        setError("Please enter a display name.");
        return;
      }
      if (password.length < 6) {
        setError("Password must be at least 6 characters.");
        return;
      }
      if (!/[a-z]/.test(password)) {
        setError("Password must include at least one lowercase letter.");
        return;
      }
      if (!/[A-Z]/.test(password)) {
        setError("Password must include at least one uppercase letter.");
        return;
      }
      if (!/[0-9]/.test(password)) {
        setError("Password must include at least one digit.");
        return;
      }
    }

    setIsLoading("email");
    const supabase = createClient();

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${redirectTo}`,
          data: {
            display_name: displayName.trim(),
          },
        },
      });

      if (error) {
        console.error("[Auth] Sign up error:", {
          email,
          message: error.message,
          status: error.status,
          code: (error as Record<string, unknown>).code,
        });
        setError(error.message);
        setIsLoading(null);
        return;
      }

      setSuccessMessage("Check your email for a confirmation link to complete your sign up.");
      setIsLoading(null);
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error("[Auth] Sign in error:", {
          email,
          message: error.message,
          status: error.status,
          code: (error as Record<string, unknown>).code,
        });
        setError(error.message);
        setIsLoading(null);
        return;
      }

      router.push(redirectTo);
    }
  };

  const toggleMode = () => {
    setMode(mode === "signin" ? "signup" : "signin");
    setError(null);
    setSuccessMessage(null);
  };

  return (
    <>
      <CardHeader style={{ textAlign: "center", padding: "0", paddingBottom: "1.5rem" }}>
        <CardTitle style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>
          {mode === "signin" ? "Welcome back" : "Create an account"}
        </CardTitle>
        <CardDescription>
          {mode === "signin"
            ? "Sign in to track your matches and compete with friends"
            : "Sign up to start tracking your Commander games"}
        </CardDescription>
      </CardHeader>
      <CardContent style={{ padding: "0" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {error && (
            <div style={{
              padding: "0.75rem",
              backgroundColor: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: "0.5rem",
              color: "#ef4444",
              fontSize: "0.875rem",
              textAlign: "center",
            }}>
              {error}
            </div>
          )}

          {successMessage && (
            <div style={{
              padding: "0.75rem",
              backgroundColor: "rgba(34, 197, 94, 0.1)",
              border: "1px solid rgba(34, 197, 94, 0.3)",
              borderRadius: "0.5rem",
              color: "#22c55e",
              fontSize: "0.875rem",
              textAlign: "center",
            }}>
              {successMessage}
            </div>
          )}

          <form onSubmit={handleEmailAuth} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {mode === "signup" && (
              <Input
                type="text"
                placeholder="Display name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={isLoading !== null}
                autoComplete="name"
                required
              />
            )}
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading !== null}
              autoComplete="email"
            />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading !== null}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
            />
            {mode === "signup" && (
              <Input
                type="password"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isLoading !== null}
                autoComplete="new-password"
              />
            )}
            <Button
              type="submit"
              disabled={isLoading !== null}
              style={{ width: "100%", height: "3rem", fontSize: "1rem" }}
            >
              {isLoading === "email" ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : mode === "signin" ? (
                "Sign in"
              ) : (
                "Create account"
              )}
            </Button>
          </form>

          <button
            type="button"
            onClick={toggleMode}
            disabled={isLoading !== null}
            style={{
              background: "none",
              border: "none",
              color: "#a855f7",
              fontSize: "0.875rem",
              cursor: "pointer",
              textAlign: "center",
              padding: "0.25rem",
            }}
          >
            {mode === "signin" ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", margin: "0.5rem 0" }}>
            <div style={{ flex: 1, height: "1px", backgroundColor: "#27272a" }} />
            <span style={{ color: "#71717a", fontSize: "0.75rem" }}>or continue with</span>
            <div style={{ flex: 1, height: "1px", backgroundColor: "#27272a" }} />
          </div>

          <Button
            onClick={() => handleOAuthLogin("google")}
            disabled={isLoading !== null}
            variant="outline"
            style={{ width: "100%", height: "3rem", fontSize: "1rem" }}
          >
            {isLoading === "google" ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
            ) : (
              <>
                <svg style={{ height: "1.25rem", width: "1.25rem", marginRight: "0.5rem" }} viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Google
              </>
            )}
          </Button>

          <Button
            onClick={() => handleOAuthLogin("discord")}
            disabled={isLoading !== null}
            variant="outline"
            style={{ width: "100%", height: "3rem", fontSize: "1rem" }}
          >
            {isLoading === "discord" ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
            ) : (
              <>
                <svg style={{ height: "1.25rem", width: "1.25rem", marginRight: "0.5rem" }} viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                </svg>
                Discord
              </>
            )}
          </Button>

          <p style={{ textAlign: "center", fontSize: "0.75rem", color: "#71717a", paddingTop: "0.5rem" }}>
            By signing in, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </CardContent>
    </>
  );
}

function LoginFallback() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ width: "100%", height: "3rem", backgroundColor: "#1a1a2e", borderRadius: "0.5rem" }} className="animate-pulse" />
      <div style={{ width: "100%", height: "3rem", backgroundColor: "#1a1a2e", borderRadius: "0.5rem" }} className="animate-pulse" />
    </div>
  );
}

export default function LoginPage() {
  return (
    <div 
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
        backgroundColor: "#0a0a12",
      }}
    >
      <Link 
        href="/" 
        style={{
          marginBottom: "2rem",
          fontSize: "1.5rem",
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          color: "#ffffff",
          textDecoration: "none",
        }}
      >
        <span style={{ color: "#a855f7" }}>⚔️</span>
        MTG CommandZone
      </Link>

      <Card style={{ width: "100%", maxWidth: "28rem", padding: "1.5rem" }}>
        <Suspense fallback={<LoginFallback />}>
          <LoginContent />
        </Suspense>
      </Card>

      <p style={{ marginTop: "1.5rem", color: "#a1a1aa", fontSize: "0.875rem" }}>
        Just browsing?{" "}
        <Link href="/" style={{ color: "#a855f7", textDecoration: "none" }}>
          Search for players
        </Link>
      </p>
    </div>
  );
}
