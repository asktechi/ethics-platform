"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { MobileAnswerButtons } from "@/components/quiz/player/MobileAnswerButtons";
import { MobilePlayerStage, MobileRevealPanel } from "@/components/quiz/player/MobilePlayerStage";
import { PlayerTimerRing } from "@/components/quiz/player/PlayerTimerRing";

const CHOICES = [
  { key: "A", text: "Disclose the gift to her supervisor and the client." },
  { key: "B", text: "Accept the tickets because they have a modest value." },
  { key: "C", text: "Decline but offer to pay for her own ticket." },
  { key: "D", text: "Accept and keep the matter confidential." },
];

const SHORT = "A research analyst is offered two World Series tickets by a corporate issuer during a due-diligence visit. What should she do?";

const LONG = `A CFA charterholder employed as a research analyst at a mid-sized broker-dealer is invited by the CFO of a corporate issuer to attend a championship series as the issuer's guest. The invitation arrives during an on-site due-diligence visit that her firm is conducting in connection with a forthcoming initiation of coverage. The tickets have a face value well above her firm's token-gift threshold, hotel and meals would be paid by the issuer, and the CFO has also hinted that "friends of the company" often receive early access to management after the game. Her firm's policy requires written pre-approval for any entertainment that could reasonably be seen to influence research, but the visit is already under way and the CFO is waiting for an answer at dinner. Independently, she knows that two buy-side clients will ask tomorrow whether the stock is a Buy, and her unpublished model currently shows a modest overweight. She also remembers Standard I(B) Independence and Objectivity, Standard I(A) Knowledge of the Law, and Standard IV(A) Loyalty to Employer, and she is unsure whether a verbal "I'll check with compliance in the morning" satisfies the policy. The issuer's IR officer adds that rival analysts accepted similar invitations last year and still published critical notes. She must decide, in the next few minutes, whether to attend, to attend only if she pays her own way, to decline entirely, or to accept and disclose after the fact. The facts include travel already booked by her firm, a spouse who cannot join, no personal friendship with the CFO, and a research budget that would cover her own ticket but not the suite. This vignette is intentionally long so the player question zone must scroll while the four answer choices remain pinned at the bottom of a phone screen. Students should never lose the answers while they read.`;

function Fixture({
  view,
  debug,
  scrollMid,
}: {
  view: string;
  debug: boolean;
  scrollMid: boolean;
}) {
  const long = view === "long";
  const reveal = view === "reveal";
  const caseView = view === "case";
  const boss = view === "boss";
  const rapid = view === "rapid";
  const stem = long ? LONG : SHORT;

  if (caseView) {
    return (
      <MobilePlayerStage
        debug={debug}
        headerLeft={<span>Case study</span>}
        headerCenter={<span className="text-[#2A9D8F]">Scenario</span>}
        headerRight={<span />}
        questionKey="case"
        question={
          <>
            <p className="font-display text-[1.35em] leading-snug">Gifts and Independence</p>
            <p className="mt-4 whitespace-pre-wrap text-[0.95em] leading-[1.6] text-ivory/85">{LONG}</p>
          </>
        }
        answers={
          <button type="button" className="min-h-14 w-full rounded-xl bg-gold px-4 py-3 font-medium text-navy">
            I&apos;m ready
          </button>
        }
        initialScroll={scrollMid ? "mid" : "top"}
      />
    );
  }

  return (
    <MobilePlayerStage
      debug={debug}
      headerLeft={<span>{rapid ? "Q 2 / 12" : boss ? "Q 3 / 10" : "Q 3 / 10"}</span>}
      headerCenter={
        rapid ? (
          <span className="font-mono text-2xl tabular-nums text-gold">41s</span>
        ) : (
          <PlayerTimerRing remaining={18} total={30} />
        )
      }
      headerRight={<span>240</span>}
      headerAbove={
        boss ? (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-12 text-[9px] uppercase text-ivory/50">Boss</span>
              <div className="h-1 flex-1 bg-white/10">
                <div className="h-full w-[62%] bg-amber-500" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-12 text-[9px] uppercase text-ivory/50">Party</span>
              <div className="h-1 flex-1 bg-white/10">
                <div className="h-full w-[80%] bg-sky-400" />
              </div>
            </div>
          </div>
        ) : undefined
      }
      questionKey={view}
      question={<p>{stem}</p>}
      revealPanel={
        reveal || boss ? (
          <MobileRevealPanel
            lastDelta={reveal || boss ? 80 : 0}
            correctKey="A"
            correctText={CHOICES[0].text}
            explanation="Standard I(B) requires independence and objectivity. Lavish entertainment from an issuer can reasonably be seen to influence coverage and must be declined or paid for by the member."
            damage={boss ? { amount: 70, kind: "damage" } : null}
          />
        ) : null
      }
      answers={
        <MobileAnswerButtons
          choices={CHOICES}
          phase={reveal || boss ? "reveal" : "question"}
          choice={reveal || boss ? "C" : null}
          correctKey={reveal || boss ? "A" : null}
          onLock={() => undefined}
          disabled={reveal || boss}
        />
      }
      initialScroll={scrollMid ? "mid" : "top"}
    />
  );
}

function Inner() {
  const params = useSearchParams();
  const view = params.get("view") ?? "short";
  const debug = params.get("layout") === "debug" || params.get("debug") === "1";
  const scrollMid = params.get("scroll") === "mid";
  return (
    <div className="flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-navy text-ivory">
      <Fixture view={view} debug={debug} scrollMid={scrollMid} />
    </div>
  );
}

export default function Phase73PreviewPage() {
  return (
    <Suspense fallback={<p className="p-6 text-ivory/60">Loading…</p>}>
      <Inner />
    </Suspense>
  );
}
