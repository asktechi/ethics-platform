import { Logo } from "@/components/brand/logo";
import { AudienceQr } from "@/components/presentation/AudienceQr";
import { normalizeJoinCode } from "@/lib/quiz/codes";
import { headers } from "next/headers";

export default function QuizJoinQrPage({ params }: { params: { code: string } }) {
  const code = normalizeJoinCode(params.code);
  const headerList = headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "127.0.0.1:43127";
  const proto = headerList.get("x-forwarded-proto") ?? "http";
  const joinUrl = `${proto}://${host}/quiz/join/${code}`;

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-4 py-12 text-center">
      <Logo />
      <p className="mt-8 text-xs uppercase tracking-[0.18em] text-gold">Scan to join</p>
      <p className="mt-3 font-mono text-5xl tracking-[0.28em] text-gold">{code}</p>
      <div className="mt-8">
        <AudienceQr url={joinUrl} size={280} label="Open on your phone" />
      </div>
      <p className="mt-6 break-all text-sm text-ivory/50">{joinUrl}</p>
    </main>
  );
}
