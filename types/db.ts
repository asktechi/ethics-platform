/** Placeholder row types. Full schema and generated types land in Phase 1. */

export type SoftDeletable = {
  deleted_at: string | null;
};

export type User = {
  id: string;
  email: string;
  display_name: string | null;
  role: "instructor" | "student";
  created_at: string;
};

export type Level = {
  id: string;
  slug: string;
  title: string;
  sort_order: number;
};

export type Class = {
  id: string;
  level_id: string;
  title: string;
  created_at: string;
} & SoftDeletable;

export type Section = {
  id: string;
  class_id: string;
  title: string;
  sort_order: number;
};

export type Concept = {
  id: string;
  section_id: string;
  title: string;
  sort_order: number;
};

export type Standard = {
  id: string;
  code: string;
  title: string;
  sort_order: number;
};

export type ConceptStandard = {
  concept_id: string;
  standard_id: string;
};

export type Material = {
  id: string;
  concept_id: string | null;
  filename: string;
  content_hash: string;
  storage_path: string;
  version_of: string | null;
  created_at: string;
} & SoftDeletable;

export type Slide = {
  id: string;
  material_id: string;
  sort_order: number;
  title: string;
  body: string | null;
};

export type Theme = {
  id: string;
  name: string;
  palette: Record<string, string>;
};

export type ThemeAssignment = {
  id: string;
  class_id: string;
  theme_id: string;
  locked: boolean;
};

export type ImagePool = {
  id: string;
  concept_id: string;
  approved_at: string | null;
};

export type Question = {
  id: string;
  prompt: string;
  approved_at: string | null;
};

export type QuestionPool = {
  id: string;
  name: string;
};

export type QuestionPoolItem = {
  pool_id: string;
  question_id: string;
};

export type QuizSession = {
  id: string;
  class_id: string;
  join_code: string;
  status: "lobby" | "live" | "closed";
};

export type QuizParticipant = {
  id: string;
  session_id: string;
  display_name: string;
};

export type QuizResponse = {
  id: string;
  session_id: string;
  participant_id: string;
  question_id: string;
  is_correct: boolean;
};

export type DatabasePlaceholder = {
  users: User;
  levels: Level;
  classes: Class;
  sections: Section;
  concepts: Concept;
  standards: Standard;
  concept_standards: ConceptStandard;
  materials: Material;
  slides: Slide;
  themes: Theme;
  theme_assignments: ThemeAssignment;
  image_pools: ImagePool;
  questions: Question;
  question_pools: QuestionPool;
  question_pool_items: QuestionPoolItem;
  quiz_sessions: QuizSession;
  quiz_participants: QuizParticipant;
  quiz_responses: QuizResponse;
};
