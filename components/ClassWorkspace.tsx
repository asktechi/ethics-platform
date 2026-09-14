"use client";

import { useMemo, useState } from "react";
import {
  archiveClassAction,
  restoreClassAction,
  updateClassAction,
} from "@/app/(app)/_actions/class.actions";
import { ConceptList } from "@/components/ConceptList";
import { InlineEditableText } from "@/components/InlineEditableText";
import { MaterialsPanel } from "@/components/materials/MaterialsPanel";
import { QuestionsBank } from "@/components/questions/QuestionsBank";
import { PresentSetup } from "@/components/theme/PresentSetup";
import { ThemeStudio } from "@/components/theme/ThemeStudio";
import { SectionList } from "@/components/SectionList";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import type { ClassDetail } from "@/lib/data/classes";
import type { QuestionRow } from "@/lib/data/questions";
import type { PoolRow } from "@/lib/data/question-pools";
import type { MaterialListRow } from "@/lib/data/materials.types";
import type { Concept, Section, Standard } from "@/types/db.helpers";

export function ClassWorkspace({
  detail,
  sections,
  concepts,
  materials,
  questions,
  standards,
  pools,
  spend,
}: {
  detail: ClassDetail;
  sections: Section[];
  concepts: Concept[];
  materials: MaterialListRow[];
  questions: QuestionRow[];
  standards: Standard[];
  pools: PoolRow[];
  spend: number;
}) {
  const firstActive = sections.find((section) => !section.deleted_at)?.id ?? null;
  const [selectedId, setSelectedId] = useState<string | null>(firstActive);
  const [showArchived, setShowArchived] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedStillVisible = useMemo(() => {
    const selected = sections.find((section) => section.id === selectedId);
    if (!selected) return firstActive;
    if (selected.deleted_at && !showArchived) return firstActive;
    return selected.id;
  }, [firstActive, sections, selectedId, showArchived]);

  return (
    <Tabs defaultValue="overview" className="mt-8">
      <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-transparent p-0">
        <TabsTrigger value="overview" className="data-[state=active]:bg-gold data-[state=active]:text-navy">
          Overview
        </TabsTrigger>
        <TabsTrigger value="sections" className="data-[state=active]:bg-gold data-[state=active]:text-navy">
          Sections & Concepts
        </TabsTrigger>
        <TabsTrigger value="materials" className="data-[state=active]:bg-gold data-[state=active]:text-navy">
          Materials
        </TabsTrigger>
        <TabsTrigger value="questions" className="data-[state=active]:bg-gold data-[state=active]:text-navy">
          Questions
        </TabsTrigger>
        <TabsTrigger value="theme" className="data-[state=active]:bg-gold data-[state=active]:text-navy">
          Theme
        </TabsTrigger>
        <TabsTrigger value="present" className="data-[state=active]:bg-gold data-[state=active]:text-navy">
          Present
        </TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="mt-6 space-y-6">
        <div className="border border-border bg-card p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold">
            Class
          </p>
          <InlineEditableText
            as="h1"
            value={detail.title}
            className="mt-2 font-display text-3xl text-ivory"
            onSave={async (title) => {
              const result = await updateClassAction({ id: detail.id, title });
              if (!result.ok) setError(result.error);
            }}
          />
          <div className="mt-4 space-y-3">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-ivory/45">Audience</p>
              <InlineEditableText
                value={detail.audience ?? ""}
                placeholder="Click to set audience"
                className="text-sm text-ivory/80"
                onSave={async (audience) => {
                  const result = await updateClassAction({ id: detail.id, audience });
                  if (!result.ok) setError(result.error);
                }}
              />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-ivory/45">Description</p>
              <InlineEditableText
                value={detail.description ?? ""}
                placeholder="Click to add a description"
                multiline
                className="text-sm leading-6 text-ivory/80"
                onSave={async (description) => {
                  const result = await updateClassAction({ id: detail.id, description });
                  if (!result.ok) setError(result.error);
                }}
              />
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          {[
            ["Sections", detail.sectionCount],
            ["Concepts", detail.conceptCount],
            ["Materials", detail.materialCount],
            ["Questions", detail.questionCount],
          ].map(([label, count]) => (
            <div key={String(label)} className="border border-border bg-card p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-ivory/45">{label}</p>
              <p className="mt-2 font-display text-3xl text-ivory">{count}</p>
            </div>
          ))}
        </div>

        <Button asChild variant="outline" className="border-ivory/20 text-ivory">
          <Link href={`/class/${detail.id}/present`}>Open presentation setup</Link>
        </Button>

        <div className="border border-red-900/40 bg-card p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-red-300">
            Danger zone
          </p>
          <p className="mt-2 text-sm text-ivory/65">
            Archive hides this class from default lists. Restore brings it back.
            Nothing is hard-deleted.
          </p>
          {detail.deleted_at ? (
            <Button
              className="mt-4 bg-gold text-navy hover:bg-gold/90"
              onClick={() => void restoreClassAction({ id: detail.id })}
            >
              Restore class
            </Button>
          ) : (
            <Button
              variant="outline"
              className="mt-4 border-red-300/40 text-red-200"
              onClick={() => void archiveClassAction({ id: detail.id })}
            >
              Archive class
            </Button>
          )}
        </div>
        {error ? <p className="text-sm text-red-300">{error}</p> : null}
      </TabsContent>

      <TabsContent value="sections" className="mt-6">
        <div className="mb-4 flex justify-end">
          <Button
            variant="outline"
            size="sm"
            className="border-ivory/20 text-ivory"
            onClick={() => setShowArchived((value) => !value)}
          >
            {showArchived ? "Hide archived" : "Show archived"}
          </Button>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <SectionList
            classId={detail.id}
            sections={sections}
            concepts={concepts}
            selectedId={selectedStillVisible}
            onSelect={setSelectedId}
            showArchived={showArchived}
          />
          <ConceptList
            classId={detail.id}
            sectionId={selectedStillVisible}
            concepts={concepts}
            showArchived={showArchived}
          />
        </div>
      </TabsContent>

      <TabsContent value="materials" className="mt-6">
        <MaterialsPanel classId={detail.id} initialMaterials={materials} />
      </TabsContent>

      <TabsContent value="theme" className="mt-6">
        <ThemeStudio classId={detail.id} />
      </TabsContent>

      <TabsContent value="present" className="mt-6">
        <PresentSetup classId={detail.id} />
      </TabsContent>

      <TabsContent value="questions" className="mt-6">
        <QuestionsBank
          classId={detail.id}
          initialQuestions={questions}
          standards={standards}
          concepts={concepts}
          pools={pools}
          spend={spend}
        />
      </TabsContent>
    </Tabs>
  );
}
