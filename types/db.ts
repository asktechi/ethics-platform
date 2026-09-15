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
          case_study_id: string | null;
          case_study_order: number | null;
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
          case_study_id?: string | null;
          case_study_order?: number | null;
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
          case_study_id?: string | null;
          case_study_order?: number | null;
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
          feature: "tagging" | "generation" | "hint";
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
          feature: "tagging" | "generation" | "hint";
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
          feature?: "tagging" | "generation" | "hint";
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
          pool_id: string | null;
          host_id: string;
          mode: "jeopardy" | "standard" | "rapid_fire" | "team_battle" | "case_study" | "adaptive" | "boss_battle";
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
          pool_id?: string | null;
          host_id: string;
          mode: "jeopardy" | "standard" | "rapid_fire" | "team_battle" | "case_study" | "adaptive" | "boss_battle";
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
          mode?: "jeopardy" | "standard" | "rapid_fire" | "team_battle" | "case_study" | "adaptive" | "boss_battle";
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
          student_profile_id: string | null;
          left_at: string | null;
          team_id: string | null;
          team_role: string | null;
          is_bot: boolean;
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
          student_profile_id?: string | null;
          left_at?: string | null;
          team_id?: string | null;
          team_role?: string | null;
          is_bot?: boolean;
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
          student_profile_id?: string | null;
          left_at?: string | null;
          team_id?: string | null;
          team_role?: string | null;
          is_bot?: boolean;
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
          points_earned: number;
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
          points_earned?: number;
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
          points_earned?: number;
          submitted_at?: string;
          revealed_at?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      bosses: {
        Row: {
          id: string;
          slug: string;
          name: string;
          subtitle: string | null;
          portrait_emoji: string | null;
          portrait_url: string | null;
          max_hp: number;
          standard_id: string | null;
          phase_1_taunts: string[];
          phase_2_taunts: string[];
          phase_3_taunts: string[];
          victory_line: string | null;
          defeat_line: string | null;
          palette_json: Json;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          subtitle?: string | null;
          portrait_emoji?: string | null;
          portrait_url?: string | null;
          max_hp?: number;
          standard_id?: string | null;
          phase_1_taunts?: string[];
          phase_2_taunts?: string[];
          phase_3_taunts?: string[];
          victory_line?: string | null;
          defeat_line?: string | null;
          palette_json?: Json;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          slug?: string;
          name?: string;
          subtitle?: string | null;
          portrait_emoji?: string | null;
          portrait_url?: string | null;
          max_hp?: number;
          standard_id?: string | null;
          phase_1_taunts?: string[];
          phase_2_taunts?: string[];
          phase_3_taunts?: string[];
          victory_line?: string | null;
          defeat_line?: string | null;
          palette_json?: Json;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      game_templates: {
        Row: {
          id: string;
          class_id: string;
          owner_id: string;
          name: string;
          description: string | null;
          tags: string[];
          mode: "jeopardy" | "rapid_fire" | "case_study" | "team_battle" | "adaptive" | "boss_battle";
          pool_id: string | null;
          filter_json: Json;
          settings_json: Json;
          mode_config: Json;
          case_study_ids: string[];
          adaptive_config: Json;
          boss_id: string | null;
          boss_config: Json;
          version: number;
          play_count: number;
          last_played_at: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          class_id: string;
          owner_id: string;
          name: string;
          description?: string | null;
          tags?: string[];
          mode: "jeopardy" | "rapid_fire" | "case_study" | "team_battle" | "adaptive" | "boss_battle";
          pool_id?: string | null;
          filter_json?: Json;
          settings_json?: Json;
          mode_config?: Json;
          case_study_ids?: string[];
          adaptive_config?: Json;
          boss_id?: string | null;
          boss_config?: Json;
          version?: number;
          play_count?: number;
          last_played_at?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          class_id?: string;
          owner_id?: string;
          name?: string;
          description?: string | null;
          tags?: string[];
          mode?: "jeopardy" | "rapid_fire" | "case_study" | "team_battle" | "adaptive" | "boss_battle";
          pool_id?: string | null;
          filter_json?: Json;
          settings_json?: Json;
          mode_config?: Json;
          case_study_ids?: string[];
          adaptive_config?: Json;
          boss_id?: string | null;
          boss_config?: Json;
          version?: number;
          play_count?: number;
          last_played_at?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      game_instances: {
        Row: {
          id: string;
          template_id: string;
          template_version: number;
          host_id: string;
          quiz_session_id: string | null;
          join_code: string;
          host_token: string;
          status: "scheduled" | "lobby" | "live" | "ended" | "abandoned";
          scheduled_for: string | null;
          started_at: string | null;
          ended_at: string | null;
          participant_count: number;
          avg_score: number | null;
          duration_seconds: number | null;
          settings_snapshot: Json;
          team_assignment_mode: "auto" | "manual" | "self_select";
          adaptive_state: Json;
          boss_hp_current: number | null;
          party_hp_current: number | null;
          boss_phase: number;
          boss_state: Json;
          is_rehearsal: boolean;
          rehearsal_config: Json;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          template_id: string;
          template_version?: number;
          host_id: string;
          quiz_session_id?: string | null;
          join_code: string;
          host_token?: string;
          status: "scheduled" | "lobby" | "live" | "ended" | "abandoned";
          scheduled_for?: string | null;
          started_at?: string | null;
          ended_at?: string | null;
          participant_count?: number;
          avg_score?: number | null;
          duration_seconds?: number | null;
          settings_snapshot?: Json;
          team_assignment_mode?: "auto" | "manual" | "self_select";
          adaptive_state?: Json;
          boss_hp_current?: number | null;
          party_hp_current?: number | null;
          boss_phase?: number;
          boss_state?: Json;
          is_rehearsal?: boolean;
          rehearsal_config?: Json;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          template_id?: string;
          template_version?: number;
          host_id?: string;
          quiz_session_id?: string | null;
          join_code?: string;
          host_token?: string;
          status?: "scheduled" | "lobby" | "live" | "ended" | "abandoned";
          scheduled_for?: string | null;
          started_at?: string | null;
          ended_at?: string | null;
          participant_count?: number;
          avg_score?: number | null;
          duration_seconds?: number | null;
          settings_snapshot?: Json;
          team_assignment_mode?: "auto" | "manual" | "self_select";
          adaptive_state?: Json;
          boss_hp_current?: number | null;
          party_hp_current?: number | null;
          boss_phase?: number;
          boss_state?: Json;
          is_rehearsal?: boolean;
          rehearsal_config?: Json;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      game_teams: {
        Row: {
          id: string;
          instance_id: string;
          team_key: string;
          name: string;
          color: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          instance_id: string;
          team_key: string;
          name: string;
          color: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          instance_id?: string;
          team_key?: string;
          name?: string;
          color?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      case_studies: {
        Row: {
          id: string;
          class_id: string;
          title: string;
          scenario_text: string;
          scenario_media_url: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          class_id: string;
          title: string;
          scenario_text: string;
          scenario_media_url?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          class_id?: string;
          title?: string;
          scenario_text?: string;
          scenario_media_url?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      student_profiles: {
        Row: {
          id: string;
          owner_id: string;
          display_name: string;
          student_code: string;
          email: string | null;
          org: string | null;
          cohort_tag: string | null;
          created_at: string;
          last_seen_at: string | null;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          owner_id: string;
          display_name: string;
          student_code: string;
          email?: string | null;
          org?: string | null;
          cohort_tag?: string | null;
          created_at?: string;
          last_seen_at?: string | null;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          owner_id?: string;
          display_name?: string;
          student_code?: string;
          email?: string | null;
          org?: string | null;
          cohort_tag?: string | null;
          created_at?: string;
          last_seen_at?: string | null;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      student_performance: {
        Row: {
          id: string;
          student_profile_id: string;
          class_id: string;
          standard_id: string;
          attempts: number;
          correct: number;
          accuracy: number;
          avg_ms: number;
          weakness_score: number;
          last_practiced_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          student_profile_id: string;
          class_id: string;
          standard_id: string;
          attempts?: number;
          correct?: number;
          accuracy?: number;
          avg_ms?: number;
          weakness_score?: number;
          last_practiced_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          student_profile_id?: string;
          class_id?: string;
          standard_id?: string;
          attempts?: number;
          correct?: number;
          accuracy?: number;
          avg_ms?: number;
          weakness_score?: number;
          last_practiced_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      cfa_exam_results: {
        Row: {
          id: string;
          student_profile_id: string;
          exam_level: "I" | "II" | "III";
          exam_date: string;
          band_score: number | null;
          passed: boolean | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          student_profile_id: string;
          exam_level: "I" | "II" | "III";
          exam_date: string;
          band_score?: number | null;
          passed?: boolean | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          student_profile_id?: string;
          exam_level?: "I" | "II" | "III";
          exam_date?: string;
          band_score?: number | null;
          passed?: boolean | null;
          notes?: string | null;
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
        Args: { p_join_code: string; p_display_name: string; p_student_code?: string | null };
        Returns: {
          participant_id: string;
          session_id: string;
          participant_token: string;
          avatar_color: string;
          host_id: string;
          host_token: string;
        }[];
      };
      join_game_by_code: {
        Args: { p_join_code: string; p_display_name: string; p_student_code?: string | null; p_team_key?: string | null };
        Returns: {
          instance_id: string;
          session_id: string;
          participant_id: string;
          participant_token: string;
          avatar_color: string;
        }[];
      };
      finalize_game_instance: {
        Args: { p_session_id: string };
        Returns: undefined;
      };
      end_rehearsal: {
        Args: { p_instance_id: string };
        Returns: undefined;
      };
      refresh_student_performance: {
        Args: { p_session_id: string };
        Returns: undefined;
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
          mode: string;
          team_assignment_mode: string;
          teams: Json;
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
          host_id: string;
          host_token: string;
          team_id: string | null;
          team_role: string | null;
          team_name: string | null;
          team_color: string | null;
        }[];
      };
      submit_answer: {
        Args: {
          p_participant_token: string;
          p_question_id: string;
          p_choice_key: string | null;
          p_ms_taken: number;
        };
        Returns: { ok: boolean; already_answered: boolean; is_correct: boolean | null; points: number }[];
      };
      pick_next_adaptive_question: {
        Args: { p_session_id: string; p_participant_id: string };
        Returns: string | null;
      };
      get_adaptive_play_question: {
        Args: { p_question_id: string };
        Returns: {
          question_id: string;
          stem: string;
          choices_json: Json;
          time_limit_seconds: number;
          standard_id: string | null;
          standard_code: string | null;
          standard_title: string | null;
        }[];
      };
      apply_adaptive_hint: {
        Args: { p_participant_token: string; p_question_id: string };
        Returns: { ok: boolean; already_hinted: boolean; points_cost: number; new_score: number }[];
      };
      quiz_set_question: {
        Args: { p_session_id: string; p_index: number };
        Returns: undefined;
      };
      quiz_apply_reveal: {
        Args: { p_session_id: string; p_question_id: string; p_correct_key: string };
        Returns: undefined;
      };
      init_boss_combat: {
        Args: { p_session_id: string };
        Returns: {
          boss_hp: number;
          boss_max_hp: number;
          party_hp: number | null;
          party_max_hp: number;
          phase: number;
        }[];
      };
      apply_boss_combat: {
        Args: { p_session_id: string; p_question_id: string };
        Returns: {
          boss_hp: number;
          boss_max_hp: number;
          party_hp: number | null;
          party_max_hp: number;
          phase: number;
          phase_changed: boolean;
          taunt: string | null;
          outcome: string;
          combat_log: Json;
        }[];
      };
      force_boss_outcome: {
        Args: { p_session_id: string; p_victory: boolean };
        Returns: undefined;
      };
      get_boss_combat: {
        Args: { p_session_id: string };
        Returns: Json;
      };
      finalize_boss_combat: {
        Args: { p_session_id: string };
        Returns: Json;
      };
      quiz_end_session: {
        Args: { p_session_id: string };
        Returns: undefined;
      };
      quiz_set_pause: {
        Args: { p_session_id: string; p_paused: boolean; p_remaining_ms: number };
        Returns: undefined;
      };
      quiz_skip_question: {
        Args: { p_session_id: string };
        Returns: undefined;
      };
      quiz_ensure_teams: {
        Args: { p_session_id: string };
        Returns: undefined;
      };
      quiz_reassign_team: {
        Args: { p_session_id: string; p_participant_id: string; p_team_key: string };
        Returns: undefined;
      };
      quiz_assign_join_team: {
        Args: { p_session_id: string; p_participant_id: string; p_team_key?: string | null };
        Returns: string | null;
      };
      quiz_set_connected: {
        Args: { p_session_id: string; p_online_ids: string[] };
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
