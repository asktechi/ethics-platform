export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          role: "instructor" | "student";
          name: string | null;
          email: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id: string;
          role: "instructor" | "student";
          name?: string | null;
          email?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          role?: "instructor" | "student";
          name?: string | null;
          email?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      levels: {
        Row: {
          id: string;
          name: string;
          slug: string;
          order: number;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          order: number;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          order?: number;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      classes: {
        Row: {
          id: string;
          level_id: string;
          title: string;
          audience: string | null;
          description: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          level_id: string;
          title: string;
          audience?: string | null;
          description?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          level_id?: string;
          title?: string;
          audience?: string | null;
          description?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      sections: {
        Row: {
          id: string;
          class_id: string;
          title: string;
          order: number;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          class_id: string;
          title: string;
          order: number;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          class_id?: string;
          title?: string;
          order?: number;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      concepts: {
        Row: {
          id: string;
          section_id: string;
          title: string;
          order: number;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          section_id: string;
          title: string;
          order: number;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          section_id?: string;
          title?: string;
          order?: number;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      standards: {
        Row: {
          id: string;
          code: string;
          title: string;
          body: string | null;
          category: "introduction" | "concept" | "standard";
          order: number;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          code: string;
          title: string;
          body?: string | null;
          category: "introduction" | "concept" | "standard";
          order: number;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          code?: string;
          title?: string;
          body?: string | null;
          category?: "introduction" | "concept" | "standard";
          order?: number;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      concept_standards: {
        Row: {
          concept_id: string;
          standard_id: string;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          concept_id: string;
          standard_id: string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          concept_id?: string;
          standard_id?: string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      materials: {
        Row: {
          id: string;
          class_id: string;
          concept_id: string | null;
          type:
            | "text"
            | "pptx"
            | "pdf"
            | "image"
            | "question_set"
            | "docx"
            | "csv";
          original_filename: string;
          storage_path: string;
          sha256: string;
          uploaded_by: string;
          version_of: string | null;
          is_current: boolean;
          byte_size: number | null;
          list_order: number | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          class_id: string;
          concept_id?: string | null;
          type:
            | "text"
            | "pptx"
            | "pdf"
            | "image"
            | "question_set"
            | "docx"
            | "csv";
          original_filename: string;
          storage_path: string;
          sha256: string;
          uploaded_by: string;
          version_of?: string | null;
          is_current?: boolean;
          byte_size?: number | null;
          list_order?: number | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          class_id?: string;
          concept_id?: string | null;
          type?:
            | "text"
            | "pptx"
            | "pdf"
            | "image"
            | "question_set"
            | "docx"
            | "csv";
          original_filename?: string;
          storage_path?: string;
          sha256?: string;
          uploaded_by?: string;
          version_of?: string | null;
          is_current?: boolean;
          byte_size?: number | null;
          list_order?: number | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      slides: {
        Row: {
          id: string;
          material_id: string;
          order: number;
          title: string | null;
          body: string | null;
          cue: string | null;
          speaker_note: string | null;
          layout:
            | "hook"
            | "point"
            | "contrast"
            | "scenario"
            | "question"
            | "reveal"
            | "cue"
            | null;
          image_prompt: string | null;
          status: "draft" | "approved";
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          material_id: string;
          order: number;
          title?: string | null;
          body?: string | null;
          cue?: string | null;
          speaker_note?: string | null;
          layout?:
            | "hook"
            | "point"
            | "contrast"
            | "scenario"
            | "question"
            | "reveal"
            | "cue"
            | null;
          image_prompt?: string | null;
          status?: "draft" | "approved";
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          material_id?: string;
          order?: number;
          title?: string | null;
          body?: string | null;
          cue?: string | null;
          speaker_note?: string | null;
          layout?:
            | "hook"
            | "point"
            | "contrast"
            | "scenario"
            | "question"
            | "reveal"
            | "cue"
            | null;
          image_prompt?: string | null;
          status?: "draft" | "approved";
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      themes: {
        Row: {
          id: string;
          name: string;
          palette_json: Json;
          is_professional_locked: boolean;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          palette_json: Json;
          is_professional_locked?: boolean;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          palette_json?: Json;
          is_professional_locked?: boolean;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      image_pools: {
        Row: {
          id: string;
          concept_id: string;
          keywords: string[] | null;
          approved_at: string | null;
          approved_by: string | null;
          is_locked: boolean;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          concept_id: string;
          keywords?: string[] | null;
          approved_at?: string | null;
          approved_by?: string | null;
          is_locked?: boolean;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          concept_id?: string;
          keywords?: string[] | null;
          approved_at?: string | null;
          approved_by?: string | null;
          is_locked?: boolean;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      image_pool_items: {
        Row: {
          id: string;
          image_pool_id: string;
          url: string;
          thumb_url: string | null;
          source: string | null;
          photographer: string | null;
          order: number;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          image_pool_id: string;
          url: string;
          thumb_url?: string | null;
          source?: string | null;
          photographer?: string | null;
          order?: number;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          image_pool_id?: string;
          url?: string;
          thumb_url?: string | null;
          source?: string | null;
          photographer?: string | null;
          order?: number;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      theme_assignments: {
        Row: {
          id: string;
          class_id: string;
          slide_id: string | null;
          theme_id: string;
          image_url: string | null;
          run_id: string | null;
          assigned_at: string;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          class_id: string;
          slide_id?: string | null;
          theme_id: string;
          image_url?: string | null;
          run_id?: string | null;
          assigned_at?: string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          class_id?: string;
          slide_id?: string | null;
          theme_id?: string;
          image_url?: string | null;
          run_id?: string | null;
          assigned_at?: string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      questions: {
        Row: {
          id: string;
          stem: string;
          choices_json: Json | null;
          answer_key: string | null;
          explanation: string | null;
          standard_id: string | null;
          concept_id: string | null;
          difficulty: "easy" | "medium" | "hard" | null;
          source: "mine" | "ai_generated";
          approved: boolean;
          created_by: string;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          stem: string;
          choices_json?: Json | null;
          answer_key?: string | null;
          explanation?: string | null;
          standard_id?: string | null;
          concept_id?: string | null;
          difficulty?: "easy" | "medium" | "hard" | null;
          source: "mine" | "ai_generated";
          approved?: boolean;
          created_by: string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          stem?: string;
          choices_json?: Json | null;
          answer_key?: string | null;
          explanation?: string | null;
          standard_id?: string | null;
          concept_id?: string | null;
          difficulty?: "easy" | "medium" | "hard" | null;
          source?: "mine" | "ai_generated";
          approved?: boolean;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      question_pools: {
        Row: {
          id: string;
          class_id: string;
          name: string;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          class_id: string;
          name: string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          class_id?: string;
          name?: string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      question_pool_items: {
        Row: {
          id: string;
          pool_id: string;
          question_id: string;
          order: number;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          pool_id: string;
          question_id: string;
          order?: number;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          pool_id?: string;
          question_id?: string;
          order?: number;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      quiz_sessions: {
        Row: {
          id: string;
          pool_id: string;
          host_id: string;
          mode: "jeopardy" | "standard";
          time_per_q: number | null;
          status: "draft" | "live" | "ended";
          join_code: string;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          pool_id: string;
          host_id: string;
          mode: "jeopardy" | "standard";
          time_per_q?: number | null;
          status: "draft" | "live" | "ended";
          join_code: string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          pool_id?: string;
          host_id?: string;
          mode?: "jeopardy" | "standard";
          time_per_q?: number | null;
          status?: "draft" | "live" | "ended";
          join_code?: string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      quiz_participants: {
        Row: {
          id: string;
          session_id: string;
          display_name: string;
          joined_at: string;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          session_id: string;
          display_name: string;
          joined_at?: string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          session_id?: string;
          display_name?: string;
          joined_at?: string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      quiz_responses: {
        Row: {
          id: string;
          session_id: string;
          participant_id: string;
          question_id: string;
          answer: string | null;
          is_correct: boolean | null;
          ms_taken: number | null;
          submitted_at: string;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          session_id: string;
          participant_id: string;
          question_id: string;
          answer?: string | null;
          is_correct?: boolean | null;
          ms_taken?: number | null;
          submitted_at?: string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          session_id?: string;
          participant_id?: string;
          question_id?: string;
          answer?: string | null;
          is_correct?: boolean | null;
          ms_taken?: number | null;
          submitted_at?: string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      join_quiz: {
        Args: { p_join_code: string; p_display_name: string };
        Returns: { participant_id: string; session_id: string }[];
      };
      health_public_table_count: {
        Args: Record<string, never>;
        Returns: number;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
