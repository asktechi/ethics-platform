import { Logo } from "@/components/brand/logo";
import { JoinForm } from "@/components/quiz/JoinForm";

export default function QuizJoinPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <Logo />
      <h1 className="mt-8 font-display text-3xl">Join a live quiz</h1>
      <p className="mt-2 text-sm text-ivory/60">Enter the 6-character code from the host, then your display name.</p>
      <div className="mt-8">
        <JoinForm />
      </div>
    </main>
  );
}
