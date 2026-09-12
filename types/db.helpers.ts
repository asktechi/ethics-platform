import type { Database, Tables, TablesInsert, TablesUpdate } from "./db";

export type User = Tables<"users">;
export type UserInsert = TablesInsert<"users">;
export type UserUpdate = TablesUpdate<"users">;

export type Level = Tables<"levels">;
export type LevelInsert = TablesInsert<"levels">;
export type LevelUpdate = TablesUpdate<"levels">;

export type Class = Tables<"classes">;
export type ClassInsert = TablesInsert<"classes">;
export type ClassUpdate = TablesUpdate<"classes">;

export type Section = Tables<"sections">;
export type SectionInsert = TablesInsert<"sections">;
export type SectionUpdate = TablesUpdate<"sections">;

export type Concept = Tables<"concepts">;
export type ConceptInsert = TablesInsert<"concepts">;
export type ConceptUpdate = TablesUpdate<"concepts">;

export type Standard = Tables<"standards">;
export type StandardInsert = TablesInsert<"standards">;
export type StandardUpdate = TablesUpdate<"standards">;

export type ConceptStandard = Tables<"concept_standards">;
export type Material = Tables<"materials">;
export type Slide = Tables<"slides">;
export type Theme = Tables<"themes">;
export type ImagePool = Tables<"image_pools">;
export type ImagePoolItem = Tables<"image_pool_items">;
export type ThemeAssignment = Tables<"theme_assignments">;
export type Question = Tables<"questions">;
export type QuestionPool = Tables<"question_pools">;
export type QuestionPoolItem = Tables<"question_pool_items">;
export type QuizSession = Tables<"quiz_sessions">;
export type QuizParticipant = Tables<"quiz_participants">;
export type QuizResponse = Tables<"quiz_responses">;

export type PublicTableName = keyof Database["public"]["Tables"];
export type RowOf<T extends PublicTableName> = Tables<T>;
export type InsertOf<T extends PublicTableName> = TablesInsert<T>;
export type UpdateOf<T extends PublicTableName> = TablesUpdate<T>;
