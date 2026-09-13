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
          concept_id: string | null;
          image_id: string | null;
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
          concept_id?: string | null;
          image_id?: string | null;
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
          concept_id?: string | null;
          image_id?: string | null;
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
          fallback_query: string | null;
          last_generated_at: string | null;
          generation_source: "unsplash" | "upload" | "none";
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
          fallback_query?: string | null;
          last_generated_at?: string | null;
          generation_source?: "unsplash" | "upload" | "none";
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
          fallback_query?: string | null;
          last_generated_at?: string | null;
          generation_source?: "unsplash" | "upload" | "none";
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
          source_url: string | null;
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
          source_url?: string | null;
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
          source_url?: string | null;
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
          theme_override_id: string | null;
          image_attribution: string | null;
          variation_json: Json;
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
          theme_override_id?: string | null;
          image_attribution?: string | null;
          variation_json?: Json;
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
          theme_override_id?: string | null;
          image_attribution?: string | null;
          variation_json?: Json;
          assigned_at?: string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      presentation_runs: {
        Row: {
          id: string;
          class_id: string;
          run_id: string;
          started_by: string;
          started_at: string;
          ended_at: string | null;
          status: "setup" | "live" | "ended";
          settings_json: Json;
          theme_ids_used: string[];
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          class_id: string;
          run_id?: string;
          started_by: string;
          started_at?: string;
          ended_at?: string | null;
          status?: "setup" | "live" | "ended";
          settings_json?: Json;
          theme_ids_used?: string[];
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          class_id?: string;
          run_id?: string;
          started_by?: string;
          started_at?: string;
          ended_at?: string | null;
          status?: "setup" | "live" | "ended";
          settings_json?: Json;
          theme_ids_used?: string[];
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      questions: {
        Row: {
          id: string;
          class_id: string | null;
          stem: string;
          choices_json: Json | null;
          answer_key: string | null;
          explanation: string | null;
          standard_id: string | null;
          concept_id: string | null;
          difficulty: "easy" | "medium" | "hard" | null;
          source: "mine" | "imported" | "ai_generated";
          approved: boolean;
          rejected: boolean;
          tag_approved: boolean;
          ai_tag_confidence: number | null;
          ai_tag_reasoning: string | null;
          import_batch_id: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          class_id?: string | null;
          stem: string;
          choices_json?: Json | null;
          answer_key?: string | null;
          explanation?: string | null;
          standard_id?: string | null;
          concept_id?: string | null;
          difficulty?: "easy" | "medium" | "hard" | null;
          source: "mine" | "imported" | "ai_generated";
          approved?: boolean;
          rejected?: boolean;
          tag_approved?: boolean;
          ai_tag_confidence?: number | null;
          ai_tag_reasoning?: string | null;
          import_batch_id?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          class_id?: string | null;
          stem?: string;
          choices_json?: Json | null;
          answer_key?: string | null;
          explanation?: string | null;
          standard_id?: string | null;
          concept_id?: string | null;
          difficulty?: "easy" | "medium" | "hard" | null;
          source?: "mine" | "imported" | "ai_generated";
          approved?: boolean;
          rejected?: boolean;
          tag_approved?: boolean;
          ai_tag_confidence?: number | null;
          ai_tag_reasoning?: string | null;
          import_batch_id?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      import_batches: {
        Row: {
          id: string;
          class_id: string;
          filename: string;
          question_count: number;
          imported_by: string;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          class_id: string;
          filename: string;
          question_count?: number;
          imported_by: string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          class_id?: string;
          filename?: string;
          question_count?: number;
          imported_by?: string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      ai_usage_log: {
        Row: {
          id: string;
          user_id: string;
          class_id: string | null;
          feature: "tagging" | "generation";
          model: string;
          input_tokens: number;
          output_tokens: number;
          cost_usd: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          class_id?: string | null;
          feature: "tagging" | "generation";
          model: string;
          input_tokens?: number;
          output_tokens?: number;
          cost_usd?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          class_id?: string | null;
          feature?: "tagging" | "generation";
          model?: string;
          input_tokens?: number;
          output_tokens?: number;
          cost_usd?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      question_pools: {
        Row: {
          id: string;
          class_id: string;
          name: string;
          shuffle_on_play: boolean;
          time_per_q: number | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          class_id: string;
          name: string;
          shuffle_on_play?: boolean;
          time_per_q?: number | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          class_id?: string;
          name?: string;
          shuffle_on_play?: boolean;
          time_per_q?: number | null;
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
          current_question_index: number;
          started_at: string | null;
          ended_at: string | null;
          reveal_answer: boolean;
          settings_json: Json;
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
          current_question_index?: number;
          started_at?: string | null;
          ended_at?: string | null;
          reveal_answer?: boolean;
          settings_json?: Json;
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
          current_question_index?: number;
          started_at?: string | null;
          ended_at?: string | null;
          reveal_answer?: boolean;
          settings_json?: Json;
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
          participant_token: string;
          score: number;
          streak: number;
          last_correct_at: string | null;
          connected: boolean;
          avatar_color: string | null;
          joined_at: string;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          session_id: string;
          display_name: string;
          participant_token?: string;
          score?: number;
          streak?: number;
          last_correct_at?: string | null;
          connected?: boolean;
          avatar_color?: string | null;
          joined_at?: string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          session_id?: string;
          display_name?: string;
          participant_token?: string;
          score?: number;
          streak?: number;
          last_correct_at?: string | null;
          connected?: boolean;
          avatar_color?: string | null;
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
          choice_key: string | null;
          is_correct: boolean | null;
          ms_taken: number | null;
          submitted_at: string;
          revealed_at: string | null;
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
          choice_key?: string | null;
          is_correct?: boolean | null;
          ms_taken?: number | null;
          submitted_at?: string;
          revealed_at?: string | null;
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
          choice_key?: string | null;
          is_correct?: boolean | null;
          ms_taken?: number | null;
          submitted_at?: string;
          revealed_at?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      quiz_session_summary: {
        Row: {
          session_id: string;
          pool_id: string;
          host_id: string;
          mode: string;
          time_per_q: number | null;
          status: string;
          join_code: string;
          participant_count: number;
          current_question_index: number;
          started_at: string | null;
          ended_at: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      join_quiz: {
        Args: { p_join_code: string; p_display_name: string };
        Returns: {
          participant_id: string;
          session_id: string;
          participant_token: string;
          avatar_color: string;
        }[];
      };
      lookup_quiz_by_code: {
        Args: { p_code: string };
        Returns: {
          session_id: string;
          pool_name: string;
          host_name: string;
          participant_count: number;
          status: string;
          join_code: string;
          time_per_q: number | null;
        }[];
      };
      get_participant_by_token: {
        Args: { p_token: string };
        Returns: {
          id: string;
          session_id: string;
          display_name: string;
          score: number;
          streak: number;
          avatar_color: string | null;
          join_code: string;
          status: string;
        }[];
      };
      submit_answer: {
        Args: {
          p_participant_token: string;
          p_question_id: string;
          p_choice_key: string | null;
          p_ms_taken: number;
        };
        Returns: { ok: boolean; already_answered: boolean }[];
      };
      quiz_set_question: {
        Args: { p_session_id: string; p_index: number };
        Returns: undefined;
      };
      quiz_apply_reveal: {
        Args: { p_session_id: string; p_question_id: string; p_correct_key: string };
        Returns: undefined;
      };
      quiz_end_session: {
        Args: { p_session_id: string };
        Returns: undefined;
      };
      get_final_leaderboard: {
        Args: { p_session_id: string };
        Returns: {
          participant_id: string;
          display_name: string;
          score: number;
          streak: number;
          avatar_color: string | null;
          rank: number;
        }[];
      };
      health_public_table_count: {
        Args: Record<string, never>;
        Returns: number;
      };
      get_run_by_run_id: {
        Args: { p_run_id: string };
        Returns: {
          id: string;
          class_id: string;
          run_id: string;
          status: string;
          settings_json: Json;
        }[];
      };
      load_pool_questions: {
        Args: { p_pool_id: string };
        Returns: {
          question_id: string;
          stem: string;
          choices_json: Json;
          answer_key: string;
          explanation: string;
          difficulty: string;
          item_order: number;
        }[];
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
