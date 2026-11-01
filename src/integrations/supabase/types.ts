export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_role: string
          after: Json | null
          before: Json | null
          created_at: string
          entity_id: string
          entity_type: string
          id: number
          reason: string | null
          ticket_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_role: string
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: never
          reason?: string | null
          ticket_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_role?: string
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: never
          reason?: string | null
          ticket_id?: string | null
        }
        Relationships: []
      }
      departments: {
        Row: {
          description: string
          handles: string[]
          id: string
          name: string
        }
        Insert: {
          description: string
          handles: string[]
          id: string
          name: string
        }
        Update: {
          description?: string
          handles?: string[]
          id?: string
          name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
        }
        Relationships: []
      }
      report_events: {
        Row: {
          actor_id: string | null
          actor_role: string
          after_photo_url: string | null
          created_at: string
          id: string
          note: string | null
          report_id: string
          type: string
        }
        Insert: {
          actor_id?: string | null
          actor_role: string
          after_photo_url?: string | null
          created_at?: string
          id?: string
          note?: string | null
          report_id: string
          type: string
        }
        Update: {
          actor_id?: string | null
          actor_role?: string
          after_photo_url?: string | null
          created_at?: string
          id?: string
          note?: string | null
          report_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_events_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "public_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_events_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          ai_confidence: number | null
          ai_json: Json | null
          ai_summary: string | null
          area_name: string | null
          category: string
          city: string | null
          created_at: string
          deleted_at: string | null
          deleted_reason: string | null
          department_id: string | null
          description: string | null
          drafted_complaint: string | null
          duplicate_of: string | null
          id: string
          is_anonymous: boolean
          lat: number
          live_context: Json | null
          lon: number
          needs_review: boolean
          photo_url: string | null
          report_count: number
          reporter_id: string
          review_reason: string | null
          severity: number
          severity_override: number | null
          severity_override_reason: string | null
          severity_reasons: string[]
          sla_deadline: string | null
          status: Database["public"]["Enums"]["report_status"]
          ticket_id: string
          updated_at: string
        }
        Insert: {
          ai_confidence?: number | null
          ai_json?: Json | null
          ai_summary?: string | null
          area_name?: string | null
          category?: string
          city?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_reason?: string | null
          department_id?: string | null
          description?: string | null
          drafted_complaint?: string | null
          duplicate_of?: string | null
          id?: string
          is_anonymous?: boolean
          lat: number
          live_context?: Json | null
          lon: number
          needs_review?: boolean
          photo_url?: string | null
          report_count?: number
          reporter_id: string
          review_reason?: string | null
          severity?: number
          severity_override?: number | null
          severity_override_reason?: string | null
          severity_reasons?: string[]
          sla_deadline?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          ticket_id?: string
          updated_at?: string
        }
        Update: {
          ai_confidence?: number | null
          ai_json?: Json | null
          ai_summary?: string | null
          area_name?: string | null
          category?: string
          city?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_reason?: string | null
          department_id?: string | null
          description?: string | null
          drafted_complaint?: string | null
          duplicate_of?: string | null
          id?: string
          is_anonymous?: boolean
          lat?: number
          live_context?: Json | null
          lon?: number
          needs_review?: boolean
          photo_url?: string | null
          report_count?: number
          reporter_id?: string
          review_reason?: string | null
          severity?: number
          severity_override?: number | null
          severity_override_reason?: string | null
          severity_reasons?: string[]
          sla_deadline?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          ticket_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_duplicate_of_fkey"
            columns: ["duplicate_of"]
            isOneToOne: false
            referencedRelation: "public_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_duplicate_of_fkey"
            columns: ["duplicate_of"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      public_changes: {
        Row: {
          action: string | null
          actor_role: string | null
          created_at: string | null
          id: number | null
          ticket_id: string | null
        }
        Relationships: []
      }
      public_events: {
        Row: {
          actor_role: string | null
          after_photo_url: string | null
          created_at: string | null
          id: string | null
          note: string | null
          report_id: string | null
          type: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_events_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "public_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_events_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      public_reports: {
        Row: {
          ai_confidence: number | null
          ai_summary: string | null
          area_name: string | null
          category: string | null
          city: string | null
          created_at: string | null
          department_id: string | null
          department_name: string | null
          description: string | null
          drafted_complaint: string | null
          duplicate_of: string | null
          id: string | null
          lat: number | null
          live_context: Json | null
          lon: number | null
          needs_review: boolean | null
          photo_url: string | null
          report_count: number | null
          reporter_name: string | null
          review_reason: string | null
          severity: number | null
          severity_overridden: boolean | null
          severity_reasons: string[] | null
          sla_deadline: string | null
          status: Database["public"]["Enums"]["report_status"] | null
          ticket_id: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_duplicate_of_fkey"
            columns: ["duplicate_of"]
            isOneToOne: false
            referencedRelation: "public_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_duplicate_of_fkey"
            columns: ["duplicate_of"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      actor_role: { Args: { _user_id: string }; Returns: string }
      admin_restore: {
        Args: { _reason: string; _report_id: string }
        Returns: undefined
      }
      admin_set_role: {
        Args: {
          _grant: boolean
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: undefined
      }
      admin_soft_delete: {
        Args: { _reason: string; _report_id: string }
        Returns: undefined
      }
      admin_update_report: {
        Args: { _patch: Json; _reason: string; _report_id: string }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      set_report_status: {
        Args: {
          _after_photo?: string
          _note?: string
          _report_id: string
          _status: Database["public"]["Enums"]["report_status"]
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "official" | "citizen"
      report_status:
        | "open"
        | "in_progress"
        | "resolved"
        | "escalated"
        | "rejected"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "official", "citizen"],
      report_status: [
        "open",
        "in_progress",
        "resolved",
        "escalated",
        "rejected",
      ],
    },
  },
} as const
