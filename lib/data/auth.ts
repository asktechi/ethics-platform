import { createClient } from "@/lib/supabase/server";

export async function ensureInstructorRow() {
  const { supabase, user } = await requireUser();
  const email = user.email ?? null;
  const name = email ? email.split("@")[0] : "Instructor";
  await supabase.from("users").upsert(
    {
      id: user.id,
      role: "instructor",
      name,
      email,
    },
    { onConflict: "id" },
  );
  return { supabase, user };
}

export async function requireUser() {
  const supabase = createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("You must be signed in.");
  }

  return { supabase, user };
}

export async function getInstructorProfile() {
  const { supabase, user } = await requireUser();
  const { data } = await supabase
    .from("users")
    .select("id, name, email, role")
    .eq("id", user.id)
    .maybeSingle();

  const email = data?.email ?? user.email ?? "";
  const name = data?.name || (email ? email.split("@")[0] : "Instructor");

  return {
    id: user.id,
    name,
    email,
    initials: name.slice(0, 2).toUpperCase(),
  };
}
