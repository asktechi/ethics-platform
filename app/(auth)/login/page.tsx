"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
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
            Magic-link authentication is wired in Phase 1. This form is a stub
            so the route and copy can be reviewed now.
          </p>

          {submitted ? (
            <div className="mt-8 border border-gold/30 bg-navy/40 px-4 py-4 text-sm leading-6 text-ivory/80">
              A sign-in link would be sent to{" "}
              <span className="text-gold">{email || "your inbox"}</span>. No
              email was sent in Phase 0.
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
              <Button type="submit" className="w-full bg-gold text-navy hover:bg-gold/90">
                Send magic link
              </Button>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-ivory/55">
            Students do not sign in here. They join a live quiz with a display
            name.{" "}
            <Link href="/dashboard" className="text-gold hover:underline">
              Continue to desk
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
