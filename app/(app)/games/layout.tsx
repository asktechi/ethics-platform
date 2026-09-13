import { GamesMotion } from "@/components/games/GamesMotion";

export default function GamesLayout({ children }: { children: React.ReactNode }) {
  return <GamesMotion>{children}</GamesMotion>;
}
