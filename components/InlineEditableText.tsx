"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { cn } from "@/lib/utils";

export function InlineEditableText({
  value,
  onSave,
  as = "p",
  className,
  placeholder = "Untitled",
  multiline = false,
}: {
  value: string;
  onSave: (next: string) => Promise<void> | void;
  as?: "p" | "h1" | "h2" | "span";
  className?: string;
  placeholder?: string;
  multiline?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [pending, setPending] = useState(false);
  const ref = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (editing) {
      ref.current?.focus();
      ref.current?.select();
    }
  }, [editing]);

  async function commit() {
    const next = draft.trim();
    if (!next || next === value) {
      setDraft(value);
      setEditing(false);
      return;
    }
    setPending(true);
    try {
      await onSave(next);
      setEditing(false);
    } finally {
      setPending(false);
    }
  }

  if (editing) {
    const shared = cn(
      "w-full border border-gold/40 bg-navy px-2 py-1 text-ivory outline-none focus-visible:ring-1 focus-visible:ring-gold",
      className,
    );
    return multiline ? (
      <textarea
        ref={ref as RefObject<HTMLTextAreaElement>}
        value={draft}
        disabled={pending}
        rows={3}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
        className={shared}
      />
    ) : (
      <input
        ref={ref as RefObject<HTMLInputElement>}
        value={draft}
        disabled={pending}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            void commit();
          }
          if (event.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
        className={shared}
      />
    );
  }

  const Tag = as;
  return (
    <Tag
      role="button"
      tabIndex={0}
      title="Click to edit"
      onClick={() => setEditing(true)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          setEditing(true);
        }
      }}
      className={cn(
        "cursor-text rounded-sm outline-none hover:bg-ivory/5 focus-visible:ring-1 focus-visible:ring-gold",
        !value && "text-ivory/40",
        className,
      )}
    >
      {value || placeholder}
    </Tag>
  );
}
