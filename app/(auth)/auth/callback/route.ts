import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/login?error=exchange_failed`);
  }

  const email = data.user.email ?? null;
  const name = (email ?? "instructor").split("@")[0];

  const admin = createAdminClient();
  await admin.from("users").upsert(
    {
      id: data.user.id,
      role: "instructor",
      name,
      email,
    },
    { onConflict: "id" },
  );

  return NextResponse.redirect(`${origin}${next}`);
}
