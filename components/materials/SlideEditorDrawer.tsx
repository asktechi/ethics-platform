"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SlideImageTabs } from "@/components/materials/SlideImageTabs";
import { updateSlideAction } from "@/app/(app)/_actions/material.actions";
import type { Slide } from "@/types/db.helpers";

const LAYOUTS = [
  "hook",
  "point",
  "contrast",
  "scenario",
  "question",
  "reveal",
  "cue",
] as const;

type SlideLayout = (typeof LAYOUTS)[number];
type ImageTab = "none" | "pool" | "ai";

function tabFromPreference(value: string | null | undefined): ImageTab {
  if (value === "pool" || value === "ai") return value;
  return "none";
}

export function SlideEditorDrawer({
  classId,
  slide,
  open,
  onOpenChange,
  onSaved,
}: {
  classId: string;
  slide: Slide | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [cue, setCue] = useState("");
  const [speakerNote, setSpeakerNote] = useState("");
  const [layout, setLayout] = useState<SlideLayout>("point");
  const [imagePrompt, setImagePrompt] = useState("");
  const [preference, setPreference] = useState<ImageTab>("none");

  useEffect(() => {
    if (!slide) return;
    setTitle(slide.title ?? "");
    setBody(slide.body ?? "");
    setCue(slide.cue ?? "");
    setSpeakerNote(slide.speaker_note ?? "");
    setLayout((slide.layout as SlideLayout | null) ?? "point");
    setImagePrompt(slide.image_prompt ?? "");
    setPreference(tabFromPreference(slide.image_preference));
    setError(null);
  }, [slide]);

  function save() {
    if (!slide) return;
    startTransition(async () => {
      const result = await updateSlideAction({
        slideId: slide.id,
        classId,
        title,
        body,
        cue,
        speaker_note: speakerNote,
        layout,
        image_prompt: imagePrompt,
        image_preference: preference,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onSaved();
      onOpenChange(false);
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Edit slide</SheetTitle>
          <SheetDescription>
            Speaker notes, layout, and an optional background. Every slide is presentable on the
            theme gradient with no photo.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="slide-title">Title</Label>
            <Input
              id="slide-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slide-body">Body</Label>
            <Textarea
              id="slide-body"
              rows={8}
              value={body}
              onChange={(event) => setBody(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slide-cue">Cue</Label>
            <Input
              id="slide-cue"
              value={cue}
              onChange={(event) => setCue(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slide-note">Speaker note</Label>
            <Textarea
              id="slide-note"
              rows={4}
              value={speakerNote}
              onChange={(event) => setSpeakerNote(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slide-layout">Layout</Label>
            <select
              id="slide-layout"
              value={layout}
              onChange={(event) => setLayout(event.target.value as SlideLayout)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm text-ivory"
            >
              {LAYOUTS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          {slide ? (
            <SlideImageTabs
              slideId={slide.id}
              imagePrompt={imagePrompt}
              onImagePromptChange={setImagePrompt}
              preference={preference}
              onPreferenceChange={setPreference}
            />
          ) : null}
          {error ? <p className="text-sm text-red-300">{error}</p> : null}
          <Button type="button" onClick={save} disabled={pending}>
            {pending ? "Saving…" : "Save slide"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
