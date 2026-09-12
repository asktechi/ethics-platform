import type { Material, Slide } from "@/types/db.helpers";

export type MaterialWithMeta = Material & {
  archived: boolean;
  slideCount: number;
  versionLabel: string;
  warnings: string[];
  uploaded_at: string;
};

export type MaterialListRow = MaterialWithMeta;

export type MaterialDetail = MaterialWithMeta & {
  slides: Slide[];
  versions: Material[];
};

export type ListMaterialsOptions = {
  includeArchived?: boolean;
  sort?: "uploaded" | "manual";
};
