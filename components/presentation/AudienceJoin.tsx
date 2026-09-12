"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AudienceQr } from "@/components/presentation/AudienceQr";

export function AudienceJoin({ runId }: { runId: string }) {
  const router = useRouter();
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
    const timer = window.setTimeout(() => {
      router.replace(`/present/${runId}/audience`);
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [runId, router]);

  const audienceUrl = origin ? `${origin}/present/${runId}/audience` : "";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-navy px-6 text-center">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">Join the session</p>
      <h1 className="mt-3 font-display text-4xl text-ivory">Scan to follow along</h1>
      <p className="mt-3 max-w-md text-sm text-ivory/60">
        Opening the live view in two seconds. Share this QR or the short URL with the room.
      </p>
      <div className="mt-8">
        <AudienceQr url={audienceUrl} size={220} label="Audience QR" />
      </div>
      <p className="mt-6 font-mono text-xs text-ivory/80">{audienceUrl || "Preparing link…"}</p>
    </main>
  );
}
