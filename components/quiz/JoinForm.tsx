"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { joinQuizAction, lookupQuizAction } from "@/app/quiz/_actions/player.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { readStudentCode, writeStudentCode } from "@/lib/games/student-code";
import { normalizeJoinCode } from "@/lib/quiz/codes";
import { writePlayerIdentity } from "@/lib/quiz/storage";

export function JoinForm({ initialCode = "", skipLookup = false }: { initialCode?: string; skipLookup?: boolean }) {
  const router = useRouter();
  const [code, setCode] = useState(normalizeJoinCode(initialCode));
  const [name, setName] = useState("");
  const [studentCode, setStudentCode] = useState("");
  const [teamKey, setTeamKey] = useState("");
  const [meta, setMeta] = useState<{
    pool_name?: string;
    host_name?: string;
    participant_count?: number;
    status?: string;
    mode?: string;
    team_assignment_mode?: string;
    teams?: Array<{ team_key: string; name: string; color: string }>;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const showName = skipLookup || Boolean(meta) || Boolean(initialCode);

  useEffect(() => {
    setStudentCode(readStudentCode());
  }, []);

  useEffect(() => {
    const normalized = normalizeJoinCode(initialCode);
    if (normalized.length !== 6) return;
    void lookupQuizAction(normalized).then((lookup) => {
      if (lookup.ok) setMeta(lookup.session);
    });
  }, [initialCode]);

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
          if (!studentCode) setStudentCode(readStudentCode());
          if (meta?.team_assignment_mode === "self_select" && !teamKey) {
            setError("Pick a team to join.");
            return;
          }
          const joined = await joinQuizAction(
            normalized,
            name,
            studentCode || readStudentCode(),
            meta?.team_assignment_mode === "self_select" ? teamKey || undefined : undefined,
          );
          if (!joined.ok) {
            setError(joined.error);
            return;
          }
          if (studentCode.trim() || readStudentCode()) writeStudentCode(studentCode.trim() || readStudentCode());
          writePlayerIdentity({
            participant_id: joined.join.participant_id,
            session_id: joined.join.session_id,
            participant_token: joined.join.participant_token,
            display_name: name.trim(),
            avatar_color: joined.join.avatar_color,
            host_id: joined.join.host_id,
            host_token: joined.join.host_token,
            student_code: studentCode.trim() || readStudentCode() || undefined,
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
        <>
          <div className="space-y-1.5">
            <Label className="text-ivory/70">Display name</Label>
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" autoFocus={Boolean(initialCode)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-ivory/70">Student code (optional)</Label>
            <Input
              value={studentCode}
              onChange={(event) => setStudentCode(event.target.value.toUpperCase())}
              placeholder="AX7-9K2"
              className="font-mono tracking-[0.16em]"
            />
          </div>
          {meta?.mode === "team_battle" && meta.team_assignment_mode === "self_select" ? (
            <div className="space-y-1.5">
              <Label className="text-ivory/70">Team</Label>
              <div className="grid grid-cols-2 gap-2">
                {(meta.teams ?? []).map((team) => (
                  <button
                    key={team.team_key}
                    type="button"
                    onClick={() => setTeamKey(team.team_key)}
                    className="border px-3 py-2 text-sm"
                    style={{
                      borderColor: teamKey === team.team_key ? team.color : `${team.color}66`,
                      color: team.color,
                    }}
                  >
                    {team.name}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </>
      ) : null}
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      <Button type="submit" disabled={pending} className="w-full bg-gold text-navy hover:bg-gold/90">
        {pending ? "Joining…" : showName ? "Join quiz" : "Look up code"}
      </Button>
    </form>
  );
}
