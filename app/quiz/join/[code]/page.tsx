import { Logo } from "@/components/brand/logo";
import { JoinForm } from "@/components/quiz/JoinForm";
import { normalizeJoinCode } from "@/lib/quiz/codes";
import { createClient } from "@/lib/supabase/server";

export default async function QuizJoinCodePage({ params }: { params: { code: string } }) {
  const code = normalizeJoinCode(params.code);
  const supabase = createClient();
  const { data } = await supabase.rpc("lookup_quiz_by_code", { p_code: code });
  const meta = Array.isArray(data) ? data[0] : data;
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <Logo />
      <h1 className="mt-8 font-display text-3xl">Enter your name</h1>
      <p className="mt-2 text-sm text-ivory/60">
        Code <span className="font-mono tracking-[0.2em] text-gold">{code}</span>
        {meta?.pool_name ? ` · ${meta.pool_name}` : ""}
      </p>
      <div className="mt-8">
        <JoinForm initialCode={code} skipLookup />
      </div>
    </main>
  );
}
