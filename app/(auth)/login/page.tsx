"use client";

import { FormEvent, useState } from "react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (signInError) {
        setError(signInError.message);
        return;
      }

      setSubmitted(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to send link.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-navy text-ivory">
      <header className="px-4 py-5">
        <Logo />
      </header>

      <main className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-md border border-border bg-card p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">
            Instructor access
          </p>
          <h1 className="mt-3 font-display text-3xl text-ivory">
            Sign in with email
          </h1>
          <p className="mt-2 text-sm leading-6 text-ivory/65">
            A one-time magic link will be sent to your inbox. Students do not
            sign in here; they join a live quiz with a display name.
          </p>

          {submitted ? (
            <div className="mt-8 border border-gold/30 bg-navy/40 px-4 py-4 text-sm leading-6 text-ivory/80">
              A sign-in link was sent to{" "}
              <span className="text-gold">{email}</span>. Open it on this
              device to reach the instructor desk.
            </div>
          ) : (
            <form className="mt-8 space-y-4" onSubmit={onSubmit}>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="instructor@firm.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="border-border bg-navy text-ivory placeholder:text-ivory/35"
                />
              </div>
              {error ? (
                <p className="text-sm text-red-300" role="alert">
                  {error}
                </p>
              ) : null}
              <Button
                type="submit"
                disabled={pending}
                className="w-full bg-gold text-navy hover:bg-gold/90"
              >
                {pending ? "Sending…" : "Send magic link"}
              </Button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
