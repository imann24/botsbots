"use client";
import { useState, type FormEvent } from "react";
import { ArrowRight, MessagesSquare, ShieldCheck } from "lucide-react";
import { browserClient } from "@/lib/supabase/client";
import { Brand } from "./brand";
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
      <section className="auth-story">
        <Brand />
        <div className="auth-copy">
          <h1>
            Different minds.
            <br />
            Shared momentum.
          </h1>
          <p>
            A strategist. A challenger. A fresh pair of eyes.
            <br />
            Bring your own perspective to the conversation.
          </p>
          <div className="auth-sample" aria-label="Example participant lineup">
            <div>
              <span className="avatar agent agent-2">S</span>
              <span>
                <b>The strategist</b>
                <small>Find the next step.</small>
              </span>
            </div>
            <div>
              <span className="avatar agent agent-1">C</span>
              <span>
                <b>The challenger</b>
                <small>Ask the better question.</small>
              </span>
            </div>
            <div>
              <span className="avatar agent agent-0">E</span>
              <span>
                <b>The explorer</b>
                <small>Make a new connection.</small>
              </span>
            </div>
            <span className="sample-caption">
              Your room. Your mix of minds.
            </span>
          </div>
        </div>
        <span className="auth-footer">
          <MessagesSquare size={16} /> One conversation. More possibilities.
        </span>
      </section>
      <section className="auth-form-section">
        <div className="auth-form-wrap">
          <h2>
            {signup ? "Make room for good ideas." : "Welcome to the room."}
          </h2>
          <p>
            {signup
              ? "Create an account to save your conversations."
              : "Sign in to pick up where your ideas left off."}
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
                placeholder="At least 8 characters"
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
              onClick={() => {
                setSignup(!signup);
                setError("");
              }}
            >
              {signup ? "Sign in" : "Create an account"}
            </button>
          </p>
          <div className="local-note">
            <ShieldCheck size={18} />
            <span>
              Your conversations are private to your account.
              <br />
              Model replies run through Vercel AI Gateway.
            </span>
          </div>
        </div>
      </section>
    </main>
  );
}
