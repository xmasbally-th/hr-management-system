/**
 * Supabase Database Type Definitions
 *
 * These types mirror the actual Supabase schema (verified 2026-05-05).
 * For full auto-generated types, run:
 *   npx supabase gen types typescript --project-id <your-project-id> > types/supabase.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      audit_logs: {
        Row: {
          id: string;
          user_id: string;
          action: string;
          target_type: string;
          target_id: string;
          details: Record<string, unknown> | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          action: string;
          target_type: string;
          target_id: string;
          details?: Record<string, unknown> | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          action?: string;
          target_type?: string;
          target_id?: string;
          details?: Record<string, unknown> | null;
          created_at?: string;
        };
        Relationships: [];
      };

      departments: {
        Row: {
          id: string;
          name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      positions: {
        Row: {
          id: string;
          name: string;
          department_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          department_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          department_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "positions_department_id_fkey";
            columns: ["department_id"];
            referencedRelation: "departments";
            referencedColumns: ["id"];
          },
        ];
      };

      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          title_th: string | null;
          title_en: string | null;
          first_name_th: string | null;
          first_name_en: string | null;
          last_name_th: string | null;
          last_name_en: string | null;
          position_number: string | null;
          position_title: string | null;
          employee_type: string | null;
          department_id: string | null;
          position_id: string | null;
          birth_date: string | null;
          hire_date: string | null;
          gender: string | null;
          religion: string | null;
          blood_type: string | null;
          current_address: string | null;
          phone: string | null;
          avatar_url: string | null;
          education_level: string | null;
          profile_completed_at: string | null;
          role: "admin" | "hr" | "manager" | "employee";
          status: "pending" | "approved" | "rejected";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name: string;
          title_th?: string | null;
          title_en?: string | null;
          first_name_th?: string | null;
          first_name_en?: string | null;
          last_name_th?: string | null;
          last_name_en?: string | null;
          position_number?: string | null;
          position_title?: string | null;
          employee_type?: string | null;
          department_id?: string | null;
          position_id?: string | null;
          birth_date?: string | null;
          hire_date?: string | null;
          gender?: string | null;
          religion?: string | null;
          blood_type?: string | null;
          current_address?: string | null;
          phone?: string | null;
          avatar_url?: string | null;
          education_level?: string | null;
          profile_completed_at?: string | null;
          role?: "admin" | "hr" | "manager" | "employee";
          status?: "pending" | "approved" | "rejected";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string;
          title_th?: string | null;
          title_en?: string | null;
          first_name_th?: string | null;
          first_name_en?: string | null;
          last_name_th?: string | null;
          last_name_en?: string | null;
          position_number?: string | null;
          position_title?: string | null;
          employee_type?: string | null;
          department_id?: string | null;
          position_id?: string | null;
          birth_date?: string | null;
          hire_date?: string | null;
          gender?: string | null;
          religion?: string | null;
          blood_type?: string | null;
          current_address?: string | null;
          phone?: string | null;
          avatar_url?: string | null;
          education_level?: string | null;
          profile_completed_at?: string | null;
          role?: "admin" | "hr" | "manager" | "employee";
          status?: "pending" | "approved" | "rejected";
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_department_id_fkey";
            columns: ["department_id"];
            referencedRelation: "departments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "profiles_position_id_fkey";
            columns: ["position_id"];
            referencedRelation: "positions";
            referencedColumns: ["id"];
          },
        ];
      };

      notification_preferences: {
        Row: {
          user_id: string;
          preferences: Record<string, boolean>;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          preferences?: Record<string, boolean>;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          preferences?: Record<string, boolean>;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };

      system_settings: {
        Row: {
          key: string;
          value: unknown;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          key: string;
          value: unknown;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          key?: string;
          value?: unknown;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "system_settings_updated_by_fkey";
            columns: ["updated_by"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };

      employee_types: {
        Row: {
          id: string;
          name: string;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      education_levels: {
        Row: {
          id: string;
          name: string;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      decoration_catalog: {
        Row: {
          id: string;
          name: string;
          abbreviation: string | null;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          abbreviation?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          abbreviation?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      profile_educations: {
        Row: {
          id: string;
          profile_id: string;
          entry_year: number | null;
          graduation_year: number | null;
          institution: string;
          country: string | null;
          degree: string;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          entry_year?: number | null;
          graduation_year?: number | null;
          institution: string;
          country?: string | null;
          degree: string;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string;
          entry_year?: number | null;
          graduation_year?: number | null;
          institution?: string;
          country?: string | null;
          degree?: string;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profile_educations_profile_id_fkey";
            columns: ["profile_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };

      profile_decorations: {
        Row: {
          id: string;
          profile_id: string;
          decoration_name: string;
          abbreviation: string | null;
          document_reference: string | null;
          approved_date: string | null;
          position_at_grant: string | null;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          decoration_name: string;
          abbreviation?: string | null;
          document_reference?: string | null;
          approved_date?: string | null;
          position_at_grant?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string;
          decoration_name?: string;
          abbreviation?: string | null;
          document_reference?: string | null;
          approved_date?: string | null;
          position_at_grant?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profile_decorations_profile_id_fkey";
            columns: ["profile_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };

      profile_admin_positions: {
        Row: {
          id: string;
          profile_id: string;
          appointment_order_number: string | null;
          position_title: string;
          responsible_unit: string | null;
          start_date: string;
          end_date: string | null;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          appointment_order_number?: string | null;
          position_title: string;
          responsible_unit?: string | null;
          start_date: string;
          end_date?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string;
          appointment_order_number?: string | null;
          position_title?: string;
          responsible_unit?: string | null;
          start_date?: string;
          end_date?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profile_admin_positions_profile_id_fkey";
            columns: ["profile_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };

      leave_types: {
        Row: {
          id: string;
          name: string;
          max_days_per_year: number;
          is_accumulative: boolean;
          conditions: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          max_days_per_year: number;
          is_accumulative?: boolean;
          conditions?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          max_days_per_year?: number;
          is_accumulative?: boolean;
          conditions?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };

      leave_balances: {
        Row: {
          id: string;
          employee_id: string;
          leave_type_id: string;
          fiscal_year: number;
          total_days: number;
          used_days: number;
          remaining_days: number;
          accumulated_days: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          employee_id: string;
          leave_type_id: string;
          fiscal_year: number;
          total_days: number;
          used_days?: number;
          remaining_days?: number;
          accumulated_days?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          employee_id?: string;
          leave_type_id?: string;
          fiscal_year?: number;
          total_days?: number;
          used_days?: number;
          remaining_days?: number;
          accumulated_days?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "leave_balances_employee_id_fkey";
            columns: ["employee_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "leave_balances_leave_type_id_fkey";
            columns: ["leave_type_id"];
            referencedRelation: "leave_types";
            referencedColumns: ["id"];
          },
        ];
      };

      leave_requests: {
        Row: {
          id: string;
          employee_id: string;
          leave_type_id: string;
          start_date: string;
          end_date: string;
          total_days: number;
          reason: string | null;
          contact_number: string | null;
          medical_cert_url: string | null;
          expected_delivery_date: string | null;
          submission_channel: string | null;
          status: "pending" | "approved" | "rejected" | "cancelled";
          approver_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          employee_id: string;
          leave_type_id: string;
          start_date: string;
          end_date: string;
          total_days: number;
          reason?: string | null;
          contact_number?: string | null;
          medical_cert_url?: string | null;
          expected_delivery_date?: string | null;
          submission_channel?: string | null;
          status?: "pending" | "approved" | "rejected" | "cancelled";
          approver_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          employee_id?: string;
          leave_type_id?: string;
          start_date?: string;
          end_date?: string;
          total_days?: number;
          reason?: string | null;
          contact_number?: string | null;
          medical_cert_url?: string | null;
          expected_delivery_date?: string | null;
          submission_channel?: string | null;
          status?: "pending" | "approved" | "rejected" | "cancelled";
          approver_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "leave_requests_employee_id_fkey";
            columns: ["employee_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "leave_requests_leave_type_id_fkey";
            columns: ["leave_type_id"];
            referencedRelation: "leave_types";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "leave_requests_approver_id_fkey";
            columns: ["approver_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };

      leave_vacation_details: {
        Row: {
          request_id: string;
          accumulated_days: number;
          annual_days: number;
          substitute_1_id: string | null;
          substitute_2_id: string | null;
          substitute_3_id: string | null;
          branch_head_opinion: string | null;
        };
        Insert: {
          request_id: string;
          accumulated_days: number;
          annual_days: number;
          substitute_1_id?: string | null;
          substitute_2_id?: string | null;
          substitute_3_id?: string | null;
          branch_head_opinion?: string | null;
        };
        Update: {
          request_id?: string;
          accumulated_days?: number;
          annual_days?: number;
          substitute_1_id?: string | null;
          substitute_2_id?: string | null;
          substitute_3_id?: string | null;
          branch_head_opinion?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "leave_vacation_details_request_id_fkey";
            columns: ["request_id"];
            referencedRelation: "leave_requests";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "leave_vacation_details_substitute_1_id_fkey";
            columns: ["substitute_1_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "leave_vacation_details_substitute_2_id_fkey";
            columns: ["substitute_2_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "leave_vacation_details_substitute_3_id_fkey";
            columns: ["substitute_3_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };

      travel_requests: {
        Row: {
          id: string;
          employee_id: string;
          travel_type: string;
          title: string;
          location: string;
          start_date: string;
          end_date: string;
          total_days: number;
          submission_channel: string | null;
          status: "pending" | "approved" | "rejected" | "cancelled" | "completed";
          approver_id: string | null;
          order_document_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          employee_id: string;
          travel_type: string;
          title: string;
          location: string;
          start_date: string;
          end_date: string;
          total_days: number;
          submission_channel?: string | null;
          status?: "pending" | "approved" | "rejected" | "cancelled" | "completed";
          approver_id?: string | null;
          order_document_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          employee_id?: string;
          travel_type?: string;
          title?: string;
          location?: string;
          start_date?: string;
          end_date?: string;
          total_days?: number;
          submission_channel?: string | null;
          status?: "pending" | "approved" | "rejected" | "cancelled" | "completed";
          approver_id?: string | null;
          order_document_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "travel_requests_employee_id_fkey";
            columns: ["employee_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "travel_requests_approver_id_fkey";
            columns: ["approver_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };

      travel_expenses: {
        Row: {
          id: string;
          travel_request_id: string;
          expense_category: string;
          estimated_amount: number;
          actual_amount: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          travel_request_id: string;
          expense_category: string;
          estimated_amount: number;
          actual_amount?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          travel_request_id?: string;
          expense_category?: string;
          estimated_amount?: number;
          actual_amount?: number | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "travel_expenses_travel_request_id_fkey";
            columns: ["travel_request_id"];
            referencedRelation: "travel_requests";
            referencedColumns: ["id"];
          },
        ];
      };

      document_tracking: {
        Row: {
          id: string;
          reference_id: string;
          document_type: string;
          sent_for_signature_date: string | null;
          returned_date: string | null;
          scanned_upload_date: string | null;
          sent_to_agency_date: string | null;
          notes: string | null;
        };
        Insert: {
          id?: string;
          reference_id: string;
          document_type: string;
          sent_for_signature_date?: string | null;
          returned_date?: string | null;
          scanned_upload_date?: string | null;
          sent_to_agency_date?: string | null;
          notes?: string | null;
        };
        Update: {
          id?: string;
          reference_id?: string;
          document_type?: string;
          sent_for_signature_date?: string | null;
          returned_date?: string | null;
          scanned_upload_date?: string | null;
          sent_to_agency_date?: string | null;
          notes?: string | null;
        };
        Relationships: [];
      };

      employee_trainings: {
        Row: {
          id: string;
          employee_id: string;
          course_name: string;
          training_type: string;
          location: string | null;
          start_date: string;
          end_date: string;
          total_hours: number | null;
          total_cost: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          employee_id: string;
          course_name: string;
          training_type: string;
          location?: string | null;
          start_date: string;
          end_date: string;
          total_hours?: number | null;
          total_cost?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          employee_id?: string;
          course_name?: string;
          training_type?: string;
          location?: string | null;
          start_date?: string;
          end_date?: string;
          total_hours?: number | null;
          total_cost?: number | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "employee_trainings_employee_id_fkey";
            columns: ["employee_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };

      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          message: string;
          is_read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type?: string;
          message: string;
          is_read?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: string;
          message?: string;
          is_read?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      get_my_role: {
        Args: Record<string, never>;
        Returns: string;
      };
      is_hr_or_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      is_manager_or_above: {
        Args: Record<string, never>;
        Returns: boolean;
      };
    };
    Enums: {
      user_role: "admin" | "hr" | "manager" | "employee";
      profile_status: "pending" | "approved" | "rejected";
      request_status: "pending" | "approved" | "rejected" | "cancelled";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

// ─── Convenience aliases ─────────────────────────────────────────────
export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

export type InsertDto<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];

export type UpdateDto<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];

// ─── Shorthand row types ─────────────────────────────────────────────
export type Department = Tables<"departments">;
export type Position = Tables<"positions">;
export type Profile = Tables<"profiles">;
export type LeaveType = Tables<"leave_types">;
export type LeaveBalance = Tables<"leave_balances">;
export type LeaveRequest = Tables<"leave_requests">;
export type LeaveVacationDetail = Tables<"leave_vacation_details">;
export type TravelRequest = Tables<"travel_requests">;
export type TravelExpense = Tables<"travel_expenses">;
export type DocumentTracking = Tables<"document_tracking">;
export type EmployeeTraining = Tables<"employee_trainings">;
export type Notification = Tables<"notifications">;

// ─── Role type ───────────────────────────────────────────────────────
export type UserRole = Profile["role"];
export type ProfileStatus = Profile["status"];
