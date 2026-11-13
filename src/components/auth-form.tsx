"use client";
import { trackAction, trackEvent } from "@/lib/analytics";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ArrowRight, MessagesSquare, ShieldCheck } from "lucide-react";
import { browserClient } from "@/lib/supabase/client";
import { FEATURED_MODELS, ENABLED_MODEL_CHOICES } from "@/lib/models";
import { Brand } from "./brand";
import { ProviderIcon } from "./model-identity";

const previewModels = FEATURED_MODELS.flatMap(({ featured, ...model }) =>
  "preview" in featured ? [{ ...model, preview: featured.preview }] : [],
);
const moreModels = FEATURED_MODELS.filter(
  (model) => !("preview" in model.featured),
);

export function AuthForm({ initialError = "" }: { initialError?: string }) {
  const [signup, setSignup] = useState(false),
    [busy, setBusy] = useState(false),
    [googleBusy, setGoogleBusy] = useState(false),
    [error, setError] = useState(initialError);
  const connecting = busy || googleBusy;

  async function signInWithGoogle() {
    if (connecting) return;
    setGoogleBusy(true);
    setError("");
    try {
      const { error } = await browserClient().auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: new URL("/auth/callback", window.location.origin).href,
        },
      });
      if (error) throw error;
      // Keep both sign-in methods disabled while the browser leaves for Google.
    } catch {
      setError("Couldn’t connect to Google. Try again or sign in with email.");
      setGoogleBusy(false);
    }
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (connecting) return;
    setBusy(true);
    setError("");
    const data = new FormData(e.currentTarget);
    const credentials = {
      email: String(data.get("email")),
      password: String(data.get("password")),
    };
    if (
      signup &&
      credentials.password !== String(data.get("confirmPassword"))
    ) {
      trackEvent("auth_validation_failed", { reason: "password_mismatch" });
      setError(
        "Passwords don’t match. Enter the same password in both fields.",
      );
      setBusy(false);
      return;
    }
    try {
      await trackAction(signup ? "sign_up" : "sign_in", {}, async () => {
        const client = browserClient();
        const result = signup
          ? await client.auth.signUp(credentials)
          : await client.auth.signInWithPassword(credentials);
        if (result.error) throw result.error;
        if (!result.data.session) {
          throw new Error(
            "Sign-up succeeded but no session was started. Email confirmation must be disabled in Supabase Auth settings.",
          );
        }
      });
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed. Try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-layout">
      <header className="auth-brand">
        <Brand />
      </header>
      <section className="auth-story" aria-labelledby="auth-product-title">
        <div className="auth-copy">
          <h1 id="auth-product-title">
            Your favorite AIs.
            <br />
            One conversation.
          </h1>
          <p>
            Bring leading AI models into one chat. Give each a perspective and
            build on their best ideas.
          </p>
          <div
            className="auth-room"
            aria-label="Example conversation with AI models"
          >
            <div className="auth-room-heading">
              <MessagesSquare size={16} aria-hidden="true" />
              <span>A fresh take on your next idea</span>
              <small>Example room</small>
            </div>
            <p className="auth-room-topic">
              “How can we make this idea better?”
            </p>
            <ul className="auth-replies">
              {previewModels.map((model) => (
                <li key={model.id}>
                  <ProviderIcon model={model.id} />
                  <div>
                    <div className="auth-reply-heading">
                      <b>{model.name}</b>
                      <span>{model.preview.perspective}</span>
                    </div>
                    <p>{model.preview.reply}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="auth-models">
            <div className="auth-models-heading">
              <h2>More minds to bring along</h2>
              <span>{ENABLED_MODEL_CHOICES.length} models available</span>
            </div>
            <ul className="auth-model-list">
              {moreModels.map((model) => (
                <li key={model.id}>
                  <ProviderIcon model={model.id} />
                  <span>
                    <b>{model.provider}</b>
                    <small>{model.name}</small>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
      <section className="auth-form-section" aria-labelledby="auth-form-title">
        <div className="auth-form-wrap">
          <h2 id="auth-form-title">
            {signup ? "Create your account." : "Welcome back."}
          </h2>
          <p>
            {signup
              ? "Bring your first room of AIs together."
              : "Sign in to your AI workspace."}
          </p>
          <button
            type="button"
            className="button full auth-google"
            disabled={connecting}
            onClick={signInWithGoogle}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.52h3.24c1.9-1.75 2.98-4.33 2.98-7.37Z"
              />
              <path
                fill="#34A853"
                d="M12 22c2.7 0 4.96-.9 6.62-2.4l-3.24-2.52c-.9.6-2.04.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H3.07v2.6A10 10 0 0 0 12 22Z"
              />
              <path
                fill="#FBBC05"
                d="M6.41 13.92a6 6 0 0 1 0-3.84v-2.6H3.07a10 10 0 0 0 0 9.04l3.34-2.6Z"
              />
              <path
                fill="#EA4335"
                d="M12 5.96c1.47 0 2.79.5 3.82 1.5l2.86-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.93 5.48l3.34 2.6C7.2 7.72 9.4 5.96 12 5.96Z"
              />
            </svg>
            {googleBusy ? "Connecting to Google…" : "Continue with Google"}
          </button>
          <div className="auth-divider">
            <span>or continue with email</span>
          </div>
          <form onSubmit={submit} aria-busy={connecting}>
            <label>
              Email
              <input
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                required
              />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                minLength={8}
                autoComplete={signup ? "new-password" : "current-password"}
                placeholder={
                  signup ? "At least 8 characters" : "Enter your password"
                }
                required
              />
            </label>
            {signup && (
              <label>
                Confirm password
                <input
                  name="confirmPassword"
                  type="password"
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="Enter your password again"
                  required
                />
              </label>
            )}
            {error && (
              <div className="error-banner" role="alert">
                {error}
              </div>
            )}
            <button className="button primary full" disabled={connecting}>
              {busy ? "Connecting…" : signup ? "Create account" : "Sign in"}
              <ArrowRight size={17} />
            </button>
          </form>
          <p className="auth-switch">
            {signup ? "Already have an account?" : "First time here?"}{" "}
            <button
              className="text-button"
              disabled={connecting}
              onClick={() => {
                trackEvent("auth_mode_changed", {
                  mode: signup ? "sign_in" : "sign_up",
                });
                setSignup(!signup);
                setError("");
              }}
            >
              {signup ? "Sign in" : "Create an account"}
            </button>
          </p>
          <div className="local-note">
            <ShieldCheck size={16} aria-hidden="true" />
            <span>Your conversations, saved to your account.</span>
          </div>
          <nav className="auth-legal" aria-label="Legal">
            <Link href="/privacy">Privacy policy</Link>
            <Link href="/terms">Terms of service</Link>
          </nav>
        </div>
      </section>
    </main>
  );
}
