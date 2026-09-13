"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Upload } from "lucide-react";
import { nanoid } from "nanoid";
import { Button } from "@/components/ui/button";
import type { CanonicalQuestion, ParseResult } from "@/lib/importers/types";
import { cn } from "@/lib/utils";

const ACCEPT = {
  "text/csv": [".csv"],
  "text/tab-separated-values": [".tsv"],
  "text/plain": [".txt", ".md"],
  "application/pdf": [".pdf"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
  "application/vnd.ms-excel": [".xls"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "application/msword": [".doc"],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": [".pptx"],
};

type Props = {
  classId: string;
};

export function ImportReview({ classId }: Props) {
  const router = useRouter();
  const [results, setResults] = useState<ParseResult[] | null>(null);
  const [rows, setRows] = useState<CanonicalQuestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [onlyWarnings, setOnlyWarnings] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<{ id: string; field: string } | null>(null);
  const [splitId, setSplitId] = useState<string | null>(null);
  const [splitAt, setSplitAt] = useState(0);
  const parentRef = useRef<HTMLDivElement>(null);

  const warningCount = rows.reduce((sum, row) => sum + row.warnings.length, 0);
  const visible = useMemo(
    () => (onlyWarnings ? rows.filter((row) => row.warnings.length > 0) : rows),
    [onlyWarnings, rows],
  );
  const validCount = rows.filter((row) => row.stem.trim().length >= 10).length;

  const virtualizer = useVirtualizer({
    count: visible.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 88,
    overscan: 12,
  });

  async function parseFiles(files: File[]) {
    setError(null);
    setBusy(true);
    try {
      const data = new FormData();
      files.forEach((file) => data.append("files", file));
      const response = await fetch("/api/questions/parse", { method: "POST", body: data });
      const json = await response.json();
      if (!response.ok || !json.ok) {
        setError(json.error ?? "Parse failed.");
        return;
      }
      const parsed = json.results as ParseResult[];
      setResults(parsed);
      setRows(parsed.flatMap((result) => result.questions));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Parse failed.");
    } finally {
      setBusy(false);
    }
  }

  function updateRow(id: string, patch: Partial<CanonicalQuestion>) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function updateChoice(id: string, key: string, text: string) {
    setRows((current) =>
      current.map((row) => {
        if (row.id !== id) return row;
        const choices = row.choices.some((choice) => choice.key === key)
          ? row.choices.map((choice) => (choice.key === key ? { ...choice, text } : choice))
          : [...row.choices, { key, text }];
        return { ...row, choices };
      }),
    );
  }

  function choiceText(row: CanonicalQuestion, key: string) {
    return row.choices.find((choice) => choice.key === key)?.text ?? "";
  }

  async function commit() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/questions/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId,
          questions: rows.filter((row) => row.stem.trim()),
          importBatchName: (results ?? []).map((result) => result.file).join(", ") || "import",
        }),
      });
      const json = await response.json();
      if (!response.ok || !json.ok) {
        setError(json.error ?? "Commit failed.");
        return;
      }
      router.push(`/class/${classId}/questions?imported=${json.importedCount}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Commit failed.");
    } finally {
      setBusy(false);
    }
  }

  const drop = useDropzone({
    accept: ACCEPT,
    multiple: true,
    disabled: busy,
    onDrop: (files) => void parseFiles(files),
  });

  if (!results) {
    return (
      <div className="space-y-4">
        <div
          {...drop.getRootProps()}
          className={cn(
            "cursor-pointer border border-dashed border-border bg-card/40 px-4 py-10 text-center",
            drop.isDragActive && "border-gold bg-gold/5",
          )}
        >
          <input {...drop.getInputProps()} />
          <Upload className="mx-auto h-6 w-6 text-gold" />
          <p className="mt-2 text-sm text-ivory">Drop question files here, or click to browse</p>
          <p className="mt-1 text-xs text-ivory/50">
            .pptx .docx .doc .xlsx .xls .csv .tsv .txt .md .pdf — review first, then confirm. Nothing is written yet.
          </p>
        </div>
        {busy ? <p className="text-sm text-ivory/60">Parsing… no database writes yet.</p> : null}
        {error ? <p className="text-sm text-red-300">{error}</p> : null}
      </div>
    );
  }

  const totalParsed = results.reduce((sum, result) => sum + result.questions.length, 0);
  if (totalParsed === 0) {
    return (
      <div className="space-y-4 border border-border bg-card p-5">
        <p className="font-display text-xl text-ivory">No questions detected</p>
        <ul className="text-sm text-ivory/70">
          {results.map((result) => (
            <li key={result.file}>
              {result.file} ({result.fileType}) — {result.detectedPattern}. {result.globalWarnings.join(" ")}
            </li>
          ))}
        </ul>
        <Button type="button" variant="outline" onClick={() => { setResults(null); setRows([]); }}>
          Try another file
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 border border-border bg-card px-4 py-3 text-sm text-ivory/80">
        <span>Files parsed: {results.length}</span>
        <span>Total questions: {rows.length}</span>
        <span className={warningCount ? "text-gold" : ""}>Warnings: {warningCount}</span>
        <Button type="button" size="sm" variant="outline" onClick={() => setOnlyWarnings(false)}>
          Approve all rows without warnings
        </Button>
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={onlyWarnings} onChange={(event) => setOnlyWarnings(event.target.checked)} />
          Show only rows with warnings
        </label>
        <Button
          type="button"
          size="sm"
          className="bg-gold text-navy hover:bg-gold/90"
          disabled={busy || validCount < 1}
          onClick={() => void commit()}
        >
          {busy ? "Importing…" : "Confirm and import"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => { setResults(null); setRows([]); }}>
          Start over
        </Button>
      </div>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      {results.flatMap((result) => result.globalWarnings).length ? (
        <p className="text-xs text-ivory/50">{results.flatMap((result) => result.globalWarnings).join(" · ")}</p>
      ) : null}

      <div className="overflow-x-auto border border-border">
        <div className="min-w-[1400px] bg-card text-sm">
          <div className="grid grid-cols-[40px_minmax(220px,2fr)_repeat(4,minmax(120px,1fr))_70px_minmax(180px,1.4fr)_120px_140px_160px] gap-2 border-b border-border px-3 py-2 text-xs uppercase tracking-[0.12em] text-ivory/45">
            <span>#</span>
            <span>Stem</span>
            <span>A</span>
            <span>B</span>
            <span>C</span>
            <span>D</span>
            <span>Answer</span>
            <span>Explanation</span>
            <span>Standard</span>
            <span>Warnings</span>
            <span>Actions</span>
          </div>
          <div ref={parentRef} className="h-[min(70vh,720px)] overflow-auto">
            <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
              {virtualizer.getVirtualItems().map((item) => {
                const row = visible[item.index];
                const isOpen = expanded.has(row.id);
                return (
                  <div
                    key={row.id}
                    className={cn(
                      "absolute left-0 grid w-full grid-cols-[40px_minmax(220px,2fr)_repeat(4,minmax(120px,1fr))_70px_minmax(180px,1.4fr)_120px_140px_160px] gap-2 border-b border-white/5 px-3 py-2",
                      row.warnings.length ? "bg-gold/5" : "",
                    )}
                    style={{ transform: `translateY(${item.start}px)` }}
                  >
                    <span className="text-ivory/40">{item.index + 1}</span>
                    <Cell
                      value={row.stem}
                      expanded={isOpen}
                      editing={editing?.id === row.id && editing.field === "stem"}
                      onEdit={() => setEditing({ id: row.id, field: "stem" })}
                      onExpand={() =>
                        setExpanded((current) => {
                          const next = new Set(current);
                          if (next.has(row.id)) next.delete(row.id);
                          else next.add(row.id);
                          return next;
                        })
                      }
                      onChange={(value) => updateRow(row.id, { stem: value })}
                      onBlur={() => setEditing(null)}
                    />
                    {(["A", "B", "C", "D"] as const).map((key) => (
                      <Cell
                        key={key}
                        value={choiceText(row, key)}
                        editing={editing?.id === row.id && editing.field === key}
                        onEdit={() => setEditing({ id: row.id, field: key })}
                        onChange={(value) => updateChoice(row.id, key, value)}
                        onBlur={() => setEditing(null)}
                      />
                    ))}
                    <input
                      className="h-8 w-full border border-border bg-navy px-1 text-center uppercase text-gold"
                      value={row.answer_key ?? ""}
                      maxLength={1}
                      onChange={(event) => updateRow(row.id, { answer_key: event.target.value.toUpperCase() || null })}
                    />
                    <Cell
                      value={row.explanation ?? ""}
                      expanded={isOpen}
                      editing={editing?.id === row.id && editing.field === "explanation"}
                      onEdit={() => setEditing({ id: row.id, field: "explanation" })}
                      onExpand={() =>
                        setExpanded((current) => {
                          const next = new Set(current);
                          if (next.has(row.id)) next.delete(row.id);
                          else next.add(row.id);
                          return next;
                        })
                      }
                      onChange={(value) => updateRow(row.id, { explanation: value })}
                      onBlur={() => setEditing(null)}
                    />
                    <input
                      className="h-8 w-full border border-border bg-navy px-1 text-xs"
                      value={row.standard_hint ?? ""}
                      onChange={(event) => updateRow(row.id, { standard_hint: event.target.value || null })}
                    />
                    <span className="text-xs text-gold">{row.warnings.join("; ") || "—"}</span>
                    <div className="flex flex-wrap gap-1">
                      <button type="button" className="text-xs text-ivory/60 underline" onClick={() => setRows((current) => current.filter((item) => item.id !== row.id))}>
                        Delete
                      </button>
                      <button
                        type="button"
                        className="text-xs text-ivory/60 underline"
                        onClick={() => setRows((current) => {
                          const copy = { ...row, id: nanoid(10) };
                          const at = current.findIndex((item) => item.id === row.id);
                          return [...current.slice(0, at + 1), copy, ...current.slice(at + 1)];
                        })}
                      >
                        Duplicate
                      </button>
                      <button
                        type="button"
                        className="text-xs text-ivory/60 underline"
                        onClick={() => {
                          setSplitId(row.id);
                          setSplitAt(Math.floor(row.stem.length / 2));
                        }}
                      >
                        Split
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {splitId ? (
        <SplitDialog
          stem={rows.find((row) => row.id === splitId)?.stem ?? ""}
          cursor={splitAt}
          onCursor={setSplitAt}
          onCancel={() => setSplitId(null)}
          onSplit={(left, right) => {
            setRows((current) => {
              const source = current.find((row) => row.id === splitId);
              if (!source) return current;
              const first = { ...source, stem: left };
              const second = { ...source, id: nanoid(10), stem: right, answer_key: null, warnings: [...source.warnings, "split from compound stem"] };
              return current.flatMap((row) => (row.id === splitId ? [first, second] : [row]));
            });
            setSplitId(null);
          }}
        />
      ) : null}
    </div>
  );
}

function Cell({
  value,
  editing,
  expanded,
  onEdit,
  onExpand,
  onChange,
  onBlur,
}: {
  value: string;
  editing?: boolean;
  expanded?: boolean;
  onEdit: () => void;
  onExpand?: () => void;
  onChange: (value: string) => void;
  onBlur: () => void;
}) {
  if (editing) {
    return (
      <textarea
        autoFocus
        className="min-h-16 w-full border border-gold bg-navy p-1 text-xs text-ivory"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
      />
    );
  }
  return (
    <button
      type="button"
      className={cn("w-full text-left text-xs text-ivory/85", expanded ? "whitespace-pre-wrap" : "line-clamp-3")}
      onClick={onEdit}
      onDoubleClick={onExpand}
    >
      {value || "—"}
    </button>
  );
}

function SplitDialog({
  stem,
  cursor,
  onCursor,
  onCancel,
  onSplit,
}: {
  stem: string;
  cursor: number;
  onCursor: (value: number) => void;
  onCancel: () => void;
  onSplit: (left: string, right: string) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/80 p-4">
      <div className="w-full max-w-xl space-y-3 border border-border bg-card p-4">
        <p className="text-sm text-ivory/70">Click in the stem where the second question should start.</p>
        <textarea
          className="h-40 w-full border border-border bg-navy p-2 text-sm"
          value={stem}
          onSelect={(event) => onCursor(event.currentTarget.selectionStart ?? 0)}
          onChange={() => undefined}
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            className="bg-gold text-navy hover:bg-gold/90"
            onClick={() => onSplit(stem.slice(0, cursor).trim(), stem.slice(cursor).trim())}
          >
            Split here
          </Button>
        </div>
      </div>
    </div>
  );
}
