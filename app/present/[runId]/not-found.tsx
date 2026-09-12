import { SessionStatusScreen } from "@/components/presentation/SessionStatusScreen";

export default function PresentNotFound() {
  return (
    <SessionStatusScreen
      tone="error"
      title="Check the link with your instructor"
      body="That presentation run was not found. Ask for the current audience URL."
    />
  );
}
