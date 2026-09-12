"use client";

import { ThemeBackground } from "@/components/presentation/ThemeBackground";
import { ensureAaText } from "@/lib/presentation/contrast";
import { splitContrastBody, truncateSlideBody } from "@/lib/presentation/format";
import type { PresentationMode, SlideAssignment, SlideLayout } from "@/lib/presentation/types";
import type { ThemePalette } from "@/lib/themes/types";

export function SlideRenderer({
  slide,
  theme,
  imageUrl,
  imageAttribution,
  layout,
  mode,
}: {
  slide: SlideAssignment;
  theme: ThemePalette;
  imageUrl: string | null;
  imageAttribution?: string | null;
  layout: SlideLayout;
  mode: PresentationMode;
}) {
  const text = ensureAaText(theme.text ?? "#F5F1E8", theme.bg ?? "#0B1B2B");
  const resolved: SlideLayout = layout ?? slide.layout ?? "point";
  const body = truncateSlideBody(slide.body ?? "", slide.slideId);
  const audienceCue = mode === "audience" && resolved === "cue";

  return (
    <article
      className="relative isolate flex h-full w-full overflow-hidden"
      style={{ color: text }}
    >
      <ThemeBackground slideId={slide.slideId} theme={theme} imageUrl={imageUrl} />
      <div className="relative z-10 flex h-full w-full flex-col px-[7%] py-[8%]">
        {audienceCue ? (
          <BreakCard accent={theme.accent} text={text} />
        ) : (
          <LayoutBody
            layout={resolved}
            title={slide.title}
            body={mode === "host" && resolved === "cue" ? slide.cue || body : body}
            cue={slide.cue}
            mode={mode}
            accent={theme.accent}
            text={text}
          />
        )}
        {imageAttribution && mode !== "audience" ? (
          <p className="absolute bottom-3 right-4 max-w-[46%] text-right text-[10px] uppercase tracking-[0.14em] opacity-45">
            {imageAttribution}
          </p>
        ) : null}
      </div>
    </article>
  );
}

function LayoutBody({
  layout,
  title,
  body,
  cue,
  mode,
  accent,
  text,
}: {
  layout: SlideLayout;
  title: string;
  body: string;
  cue: string | null;
  mode: PresentationMode;
  accent: string;
  text: string;
}) {
  if (layout === "cue" && mode !== "audience") {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em]" style={{ color: accent }}>
          Instructor cue
        </p>
        <h1 className="mt-6 max-w-4xl font-display text-4xl leading-tight md:text-6xl">{cue || title}</h1>
        {body && body !== cue ? (
          <p className="mt-8 max-w-2xl text-lg leading-8 opacity-80">{body}</p>
        ) : null}
      </div>
    );
  }

  if (layout === "hook") {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center">
        <h1 className="max-w-5xl font-display text-5xl leading-[1.05] md:text-7xl">{title}</h1>
        <div className="mt-8 h-px w-24" style={{ backgroundColor: accent }} />
        {body ? <p className="mt-8 max-w-2xl text-lg leading-8 opacity-80">{body}</p> : null}
      </div>
    );
  }

  if (layout === "point") {
    return (
      <div className="flex h-full flex-col">
        <div className="flex min-h-[33%] items-end pb-6">
          <h1 className="max-w-4xl font-display text-4xl leading-tight md:text-6xl">{title}</h1>
        </div>
        <div className="min-h-0 flex-1 pt-4">
          {body ? <p className="max-w-3xl text-xl leading-9 opacity-90 md:text-2xl">{body}</p> : null}
        </div>
      </div>
    );
  }

  if (layout === "contrast") {
    const [left, right] = splitContrastBody(body);
    return (
      <div className="flex h-full flex-col">
        <h1 className="font-display text-3xl leading-tight md:text-5xl">{title}</h1>
        <div className="mt-10 grid min-h-0 flex-1 grid-cols-1 gap-0 md:grid-cols-2">
          <div className="md:border-r md:pr-8" style={{ borderColor: `${accent}66` }}>
            <p className="text-lg leading-8 md:text-xl">{left}</p>
          </div>
          <div className="mt-8 md:mt-0 md:pl-8">
            <p className="text-lg leading-8 md:text-xl">{right}</p>
          </div>
        </div>
      </div>
    );
  }

  if (layout === "scenario") {
    return (
      <div className="flex h-full items-center justify-center">
        <div
          className="max-w-3xl border px-10 py-12 text-center backdrop-blur-sm"
          style={{ borderColor: `${accent}80`, backgroundColor: "rgba(0,0,0,0.28)" }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em]" style={{ color: accent }}>
            Scenario
          </p>
          <h1 className="mt-4 font-display text-3xl leading-tight md:text-4xl">{title}</h1>
          {body ? (
            <p className="mx-auto mt-6 max-w-xl text-base leading-7 opacity-90 md:text-lg">{body}</p>
          ) : null}
        </div>
      </div>
    );
  }

  if (layout === "question") {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center">
        <h1 className="max-w-4xl font-display text-4xl leading-tight md:text-5xl">{title}</h1>
        <p
          className="mt-8 font-display text-8xl leading-none opacity-80 md:text-9xl"
          style={{ color: accent }}
        >
          ?
        </p>
        {body ? <p className="mt-8 max-w-2xl text-xl leading-8">{body}</p> : null}
      </div>
    );
  }

  if (layout === "reveal") {
    return (
      <div className="flex h-full flex-col justify-center">
        <h1 className="max-w-4xl font-display text-4xl leading-tight md:text-6xl">{title}</h1>
        {body ? (
          <p
            className="mt-10 max-w-3xl text-2xl leading-10"
            style={{
              color: text,
              textShadow: `0 0 42px ${accent}99`,
            }}
          >
            {body}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col justify-center">
      <h1 className="font-display text-4xl md:text-6xl">{title}</h1>
      {body ? <p className="mt-8 max-w-3xl text-xl leading-9">{body}</p> : null}
    </div>
  );
}

function BreakCard({ accent, text }: { accent: string; text: string }) {
  return (
    <div className="flex h-full items-center justify-center">
      <div
        className="max-w-lg border px-12 py-14 text-center"
        style={{ borderColor: `${accent}55`, backgroundColor: "rgba(11,27,43,0.35)", color: text }}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em]" style={{ color: accent }}>
          Brief pause
        </p>
        <p className="mt-5 font-display text-3xl">Hold this thought</p>
        <p className="mt-4 text-sm leading-6 opacity-70">
          The presenter is on a cue card. The next idea will be here in a moment.
        </p>
      </div>
    </div>
  );
}
