"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import {
  approveAllSlidesAction,
  archiveMaterialAction,
  downloadOriginalAction,
  getMaterialAction,
  listMaterialsAction,
  reextractMaterialAction,
  renameMaterialAction,
  reorderMaterialsAction,
  reorderSlidesAction,
  restoreMaterialAction,
} from "@/app/(app)/_actions/material.actions";
import { EmptyState } from "@/components/EmptyState";
import { DuplicateFileModal } from "@/components/materials/DuplicateFileModal";
import { MaterialDetailPane } from "@/components/materials/MaterialDetailPane";
import { MaterialListItem } from "@/components/materials/MaterialListItem";
import { SlideEditorDrawer } from "@/components/materials/SlideEditorDrawer";
import {
  UploadDropzone,
  type UploadDropzoneHandle,
  type UploadQueueItem,
} from "@/components/materials/UploadDropzone";
import { VersionHistoryDrawer } from "@/components/materials/VersionHistoryDrawer";
import { SortableItem } from "@/components/SortableItem";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { MaterialDetail, MaterialListRow } from "@/lib/data/materials.types";
import type { Slide } from "@/types/db.helpers";

export function MaterialsPanel({
  classId,
  initialMaterials,
}: {
  classId: string;
  initialMaterials: MaterialListRow[];
}) {
  const router = useRouter();
  const dropzoneRef = useRef<UploadDropzoneHandle>(null);
  const [materials, setMaterials] = useState(initialMaterials);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialMaterials.find((row) => !row.deleted_at)?.id ?? null,
  );
  const [detail, setDetail] = useState<MaterialDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [sortMode, setSortMode] = useState<"uploaded" | "manual">("uploaded");
  const [duplicate, setDuplicate] = useState<UploadQueueItem | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [editorSlide, setEditorSlide] = useState<Slide | null>(null);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  useEffect(() => {
    setMaterials(initialMaterials);
  }, [initialMaterials]);

  const visible = useMemo(
    () =>
      materials.filter((row) => showArchived || !row.deleted_at),
    [materials, showArchived],
  );

  const refreshList = useCallback(async () => {
    const result = await listMaterialsAction({
      classId,
      includeArchived: true,
      sort: sortMode,
    });
    if (result.ok) {
      setMaterials(result.materials);
      return result.materials;
    }
    return materials;
  }, [classId, materials, sortMode]);

  const loadDetail = useCallback(async (id: string) => {
    setLoadingDetail(true);
    setDetailError(null);
    const result = await getMaterialAction({ id });
    setLoadingDetail(false);
    if (!result.ok) {
      setDetail(null);
      setDetailError(result.error);
      return;
    }
    setDetail(result.material);
  }, []);

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
  }, [loadDetail, selectedId]);

  const selectMaterial = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  const refreshAll = useCallback(async () => {
    const next = await refreshList();
    router.refresh();
    const nextSelected =
      (selectedId && next.some((row) => row.id === selectedId)
        ? selectedId
        : next.find((row) => !row.deleted_at)?.id) ?? null;
    setSelectedId(nextSelected);
    if (nextSelected) await loadDetail(nextSelected);
    else setDetail(null);
  }, [loadDetail, refreshList, router, selectedId]);

  function onListDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = visible.map((row) => row.id);
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    const next = [...ids];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setMaterials((prev) => {
      const order = new Map(next.map((id, index) => [id, index]));
      return [...prev].sort(
        (a, b) => (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999),
      );
    });
    startTransition(async () => {
      await reorderMaterialsAction({ classId, orderedIds: next });
    });
  }

  return (
    <div className="space-y-4">
      {banner ? (
        <p className="border border-gold/30 bg-gold/10 px-4 py-2 text-sm text-ivory">
          {banner}
        </p>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-2">
          <UploadDropzone
            ref={dropzoneRef}
            classId={classId}
            onUploaded={async (result) => {
              if (result?.warnings?.length) {
                setBanner(result.warnings[0] ?? null);
              }
              await refreshAll();
            }}
            onDuplicate={setDuplicate}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={sortMode === "uploaded" ? "default" : "outline"}
                onClick={() => {
                  setSortMode("uploaded");
                  void listMaterialsAction({
                    classId,
                    includeArchived: true,
                    sort: "uploaded",
                  }).then((result) => {
                    if (result.ok) setMaterials(result.materials);
                  });
                }}
              >
                Newest
              </Button>
              <Button
                type="button"
                size="sm"
                variant={sortMode === "manual" ? "default" : "outline"}
                onClick={() => setSortMode("manual")}
              >
                Manual
              </Button>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setShowArchived((value) => !value)}
            >
              {showArchived ? "Hide archived" : "Show archived"}
            </Button>
          </div>

          {visible.length === 0 ? (
            <EmptyState
              title="No materials yet"
              description="Drop a PDF, DOCX, PPTX, Markdown, text, or CSV file. The original is stored once and never overwritten."
            />
          ) : sortMode === "manual" ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={onListDragEnd}
            >
              <SortableContext
                items={visible.map((row) => row.id)}
                strategy={verticalListSortingStrategy}
              >
                <ul className="space-y-2">
                  {visible.map((material) => (
                    <li key={material.id}>
                      <SortableItem id={material.id}>
                        {({ attributes, listeners }) => (
                          <MaterialListItem
                            material={material}
                            selected={material.id === selectedId}
                            sortable
                            dragHandle={{
                              attributes: attributes as Record<string, unknown>,
                              listeners: listeners as Record<string, unknown> | undefined,
                            }}
                            onSelect={() => selectMaterial(material.id)}
                            onRename={() => {
                              setRenameId(material.id);
                              setRenameValue(material.original_filename);
                            }}
                            onReextract={() =>
                              startTransition(async () => {
                                await reextractMaterialAction({
                                  id: material.id,
                                  classId,
                                });
                                await refreshAll();
                              })
                            }
                            onDownload={() =>
                              startTransition(async () => {
                                const result = await downloadOriginalAction({
                                  id: material.id,
                                });
                                if (result.ok) window.open(result.url, "_blank");
                              })
                            }
                            onArchive={() =>
                              startTransition(async () => {
                                await archiveMaterialAction({
                                  id: material.id,
                                  classId,
                                });
                                await refreshAll();
                              })
                            }
                            onRestore={() =>
                              startTransition(async () => {
                                await restoreMaterialAction({
                                  id: material.id,
                                  classId,
                                });
                                await refreshAll();
                              })
                            }
                            onVersions={() => {
                              selectMaterial(material.id);
                              setVersionsOpen(true);
                            }}
                          />
                        )}
                      </SortableItem>
                    </li>
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          ) : (
            <ul className="space-y-2">
              {visible.map((material) => (
                <li key={material.id}>
                  <MaterialListItem
                    material={material}
                    selected={material.id === selectedId}
                    onSelect={() => selectMaterial(material.id)}
                    onRename={() => {
                      setRenameId(material.id);
                      setRenameValue(material.original_filename);
                    }}
                    onReextract={() =>
                      startTransition(async () => {
                        await reextractMaterialAction({
                          id: material.id,
                          classId,
                        });
                        await refreshAll();
                      })
                    }
                    onDownload={() =>
                      startTransition(async () => {
                        const result = await downloadOriginalAction({
                          id: material.id,
                        });
                        if (result.ok) window.open(result.url, "_blank");
                      })
                    }
                    onArchive={() =>
                      startTransition(async () => {
                        await archiveMaterialAction({
                          id: material.id,
                          classId,
                        });
                        await refreshAll();
                      })
                    }
                    onRestore={() =>
                      startTransition(async () => {
                        await restoreMaterialAction({
                          id: material.id,
                          classId,
                        });
                        await refreshAll();
                      })
                    }
                    onVersions={() => {
                      selectMaterial(material.id);
                      setVersionsOpen(true);
                    }}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="lg:col-span-3">
          <MaterialDetailPane
            detail={detail}
            loading={loadingDetail}
            error={detailError}
            onApproveAll={() => {
              if (!detail) return;
              startTransition(async () => {
                await approveAllSlidesAction({
                  materialId: detail.id,
                  classId,
                });
                await loadDetail(detail.id);
                await refreshList();
              });
            }}
            onOpenSlide={setEditorSlide}
            onReorder={(orderedIds) => {
              if (!detail) return;
              setDetail({
                ...detail,
                slides: orderedIds
                  .map((id, index) => {
                    const slide = detail.slides.find((item) => item.id === id);
                    return slide ? { ...slide, order: index + 1 } : null;
                  })
                  .filter((slide): slide is Slide => Boolean(slide)),
              });
              startTransition(async () => {
                await reorderSlidesAction({
                  classId,
                  materialId: detail.id,
                  orderedIds,
                });
              });
            }}
          />
        </div>
      </div>

      <SlideEditorDrawer
        classId={classId}
        slide={editorSlide}
        open={Boolean(editorSlide)}
        onOpenChange={(open) => {
          if (!open) setEditorSlide(null);
        }}
        onSaved={() => {
          if (selectedId) void loadDetail(selectedId);
        }}
      />

      <VersionHistoryDrawer
        classId={classId}
        open={versionsOpen}
        onOpenChange={setVersionsOpen}
        versions={detail?.versions ?? []}
        onChanged={() => {
          void refreshAll();
        }}
      />

      <DuplicateFileModal
        open={Boolean(duplicate)}
        filename={duplicate?.file.name ?? ""}
        onCancel={() => setDuplicate(null)}
        onConfirm={() => {
          if (duplicate) dropzoneRef.current?.retryAsVersion(duplicate);
          setDuplicate(null);
        }}
      />

      <Dialog open={Boolean(renameId)} onOpenChange={(open) => !open && setRenameId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename material</DialogTitle>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(event) => setRenameValue(event.target.value)}
          />
          <p className="text-xs text-ivory/50">
            This changes the display name only. The stored original and sha256 stay
            the same.
          </p>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setRenameId(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (!renameId) return;
                startTransition(async () => {
                  await renameMaterialAction({
                    id: renameId,
                    classId,
                    filename: renameValue,
                  });
                  setRenameId(null);
                  await refreshAll();
                });
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
