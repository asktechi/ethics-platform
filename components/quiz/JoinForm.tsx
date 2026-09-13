"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { joinQuizAction, lookupQuizAction } from "@/app/quiz/_actions/player.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { normalizeJoinCode } from "@/lib/quiz/codes";
import { writePlayerIdentity } from "@/lib/quiz/storage";

export function JoinForm({ initialCode = "", skipLookup = false }: { initialCode?: string; skipLookup?: boolean }) {
  const router = useRouter();
  const [code, setCode] = useState(normalizeJoinCode(initialCode));
  const [name, setName] = useState("");
  const [meta, setMeta] = useState<{ pool_name?: string; host_name?: string; participant_count?: number; status?: string } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const showName = skipLookup || Boolean(meta) || Boolean(initialCode);

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        start(async () => {
          const normalized = normalizeJoinCode(code);
          if (normalized.length !== 6) {
            setError("Enter the 6-character join code.");
            return;
          }
          if (!showName || !name.trim()) {
            const lookup = await lookupQuizAction(normalized);
            if (!lookup.ok) {
              setError(lookup.error);
              return;
            }
            setMeta(lookup.session);
            setCode(normalized);
            if (!name.trim()) return;
          }
          const joined = await joinQuizAction(normalized, name);
          if (!joined.ok) {
            setError(joined.error);
            return;
          }
          writePlayerIdentity({
            participant_id: joined.join.participant_id,
            session_id: joined.join.session_id,
            participant_token: joined.join.participant_token,
            display_name: name.trim(),
            avatar_color: joined.join.avatar_color,
            host_id: joined.join.host_id,
            host_token: joined.join.host_token,
          });
          router.push(`/quiz/play/${joined.join.session_id}`);
        });
      }}
    >
      <div className="space-y-1.5">
        <Label className="text-ivory/70">Join code</Label>
        <Input
          value={code}
          onChange={(event) => setCode(normalizeJoinCode(event.target.value))}
          placeholder="ABC123"
          className="text-center font-mono text-lg tracking-[0.3em]"
          maxLength={6}
          autoCapitalize="characters"
        />
      </div>
      {meta ? (
        <p className="text-sm text-ivory/60">
          {meta.pool_name} · {meta.host_name} · {meta.participant_count} joined · {meta.status}
        </p>
      ) : null}
      {showName ? (
        <div className="space-y-1.5">
          <Label className="text-ivory/70">Display name</Label>
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" autoFocus={Boolean(initialCode)} />
        </div>
      ) : null}
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      <Button type="submit" disabled={pending} className="w-full bg-gold text-navy hover:bg-gold/90">
        {pending ? "Joining…" : showName ? "Join quiz" : "Look up code"}
      </Button>
    </form>
  );
}
