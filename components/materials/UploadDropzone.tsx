"use client";

import { forwardRef, useCallback, useImperativeHandle, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

export type UploadQueueItem = {
  id: string;
  file: File;
  progress: number;
  status: "queued" | "uploading" | "done" | "error" | "duplicate";
  error?: string;
  existingId?: string;
};

export type UploadDropzoneHandle = {
  retryAsVersion: (item: UploadQueueItem) => void;
};

const ACCEPT = {
  "text/plain": [".txt"],
  "text/markdown": [".md"],
  "application/pdf": [".pdf"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
    ".docx",
  ],
  "text/csv": [".csv"],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": [
    ".pptx",
  ],
};

export function uploadWithProgress(
  file: File,
  classId: string,
  forceVersion: boolean,
  onProgress: (pct: number) => void,
): Promise<{
  ok: boolean;
  status: number;
  body: Record<string, unknown>;
}> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/materials/upload");
    xhr.responseType = "json";
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      const body =
        typeof xhr.response === "object" && xhr.response !== null
          ? xhr.response
          : {};
      resolve({
        ok: xhr.status >= 200 && xhr.status < 300,
        status: xhr.status,
        body,
      });
    };
    xhr.onerror = () => reject(new Error("Network error"));
    const form = new FormData();
    form.append("file", file);
    form.append("class_id", classId);
    if (forceVersion) form.append("force_version", "true");
    xhr.send(form);
  });
}

export const UploadDropzone = forwardRef<
  UploadDropzoneHandle,
  {
    classId: string;
    onUploaded: (result?: { warnings?: string[]; type?: string }) => void;
    onDuplicate: (item: UploadQueueItem) => void;
  }
>(function UploadDropzone({ classId, onUploaded, onDuplicate }, ref) {
  const [queue, setQueue] = useState<UploadQueueItem[]>([]);

  const patch = useCallback((id: string, next: Partial<UploadQueueItem>) => {
    setQueue((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...next } : item)),
    );
  }, []);

  const runUpload = useCallback(
    async (item: UploadQueueItem, forceVersion: boolean) => {
      patch(item.id, { status: "uploading", progress: 0, error: undefined });
      try {
        const result = await uploadWithProgress(
          item.file,
          classId,
          forceVersion,
          (pct) => patch(item.id, { progress: pct }),
        );
        if (result.body.duplicate) {
          const next = {
            ...item,
            status: "duplicate" as const,
            existingId: String(result.body.existing_id ?? ""),
            progress: 100,
          };
          patch(item.id, next);
          onDuplicate(next);
          return;
        }
        if (!result.ok) {
          patch(item.id, {
            status: "error",
            error: String(result.body.error ?? "Upload failed"),
          });
          return;
        }
        patch(item.id, { status: "done", progress: 100 });
        onUploaded({
          warnings: Array.isArray(result.body.warnings)
            ? (result.body.warnings as string[])
            : [],
        });
      } catch (error) {
        patch(item.id, {
          status: "error",
          error: error instanceof Error ? error.message : "Upload failed",
        });
      }
    },
    [classId, onDuplicate, onUploaded, patch],
  );

  useImperativeHandle(
    ref,
    () => ({
      retryAsVersion(item: UploadQueueItem) {
        void runUpload(item, true);
      },
    }),
    [runUpload],
  );

  const onDrop = useCallback(
    (accepted: File[]) => {
      const items = accepted.map((file) => ({
        id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
        file,
        progress: 0,
        status: "queued" as const,
      }));
      setQueue((prev) => [...items, ...prev]);
      for (const item of items) {
        void runUpload(item, false);
      }
    },
    [runUpload],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPT,
    multiple: true,
  });

  return (
    <div className="space-y-3">
      <div
        {...getRootProps()}
        className={cn(
          "cursor-pointer border border-dashed border-border bg-card/40 px-4 py-8 text-center transition-colors",
          isDragActive && "border-gold bg-gold/5",
        )}
      >
        <input {...getInputProps()} />
        <Upload className="mx-auto h-6 w-6 text-gold" />
        <p className="mt-2 text-sm text-ivory">
          Drop lecture files here, or click to browse
        </p>
        <p className="mt-1 text-xs text-ivory/50">
          .txt .md .pdf .docx .csv .pptx — originals are stored immutably
        </p>
      </div>
      {queue.length > 0 ? (
        <ul className="space-y-2">
          {queue.map((item) => (
            <li
              key={item.id}
              className="border border-border bg-card/60 px-3 py-2"
            >
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate text-ivory">{item.file.name}</span>
                <span className="shrink-0 text-ivory/50">
                  {item.status === "done"
                    ? "Imported"
                    : item.status === "duplicate"
                      ? "Already uploaded"
                      : item.status === "error"
                        ? item.error
                        : `${item.progress}%`}
                </span>
              </div>
              {item.status === "uploading" || item.status === "queued" ? (
                <Progress value={item.progress} className="mt-2 h-1.5" />
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
});
