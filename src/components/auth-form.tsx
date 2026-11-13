"use client";
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

export function AuthForm() {
  const [signup, setSignup] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
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
      setError(
        "Passwords don’t match. Enter the same password in both fields.",
      );
      setBusy(false);
      return;
    }
    try {
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
          <form onSubmit={submit}>
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
            <button className="button primary full" disabled={busy}>
              {busy ? "Connecting…" : signup ? "Create account" : "Sign in"}
              <ArrowRight size={17} />
            </button>
          </form>
          <p className="auth-switch">
            {signup ? "Already have an account?" : "First time here?"}{" "}
            <button
              className="text-button"
              disabled={busy}
              onClick={() => {
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
        </div>
      </section>
    </main>
  );
}
