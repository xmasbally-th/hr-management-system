/**
 * Supabase Database Type Definitions
 *
 * These types mirror the tables created in Supabase.
 * For full auto-generated types, run:
 *   npx supabase gen types typescript --project-id <your-project-id> > types/supabase.ts
 *
 * Manual definitions are maintained here until the CLI is configured.
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
      // ─── Step 1 Tables ───────────────────────────────────────────

      departments: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };

      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          role: "admin" | "hr" | "manager" | "employee";
          department_id: string | null;
          avatar_url: string | null;
          phone: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string; // FK → auth.users.id, required on insert
          email: string;
          full_name: string;
          role?: "admin" | "hr" | "manager" | "employee";
          department_id?: string | null;
          avatar_url?: string | null;
          phone?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string;
          role?: "admin" | "hr" | "manager" | "employee";
          department_id?: string | null;
          avatar_url?: string | null;
          phone?: string | null;
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
        ];
      };

      leave_types: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          max_days: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          max_days: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          max_days?: number;
          created_at?: string;
        };
        Relationships: [];
      };

      leave_balances: {
        Row: {
          id: string;
          user_id: string;
          leave_type_id: string;
          year: number;
          total_days: number;
          used_days: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          leave_type_id: string;
          year: number;
          total_days: number;
          used_days?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          leave_type_id?: string;
          year?: number;
          total_days?: number;
          used_days?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "leave_balances_user_id_fkey";
            columns: ["user_id"];
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

      // ─── Step 3 Tables ───────────────────────────────────────────

      leave_requests: {
        Row: {
          id: string;
          user_id: string;
          leave_type_id: string;
          start_date: string;
          end_date: string;
          total_days: number;
          reason: string | null;
          status: "pending" | "approved" | "rejected" | "cancelled";
          approved_by: string | null;
          approved_at: string | null;
          rejection_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          leave_type_id: string;
          start_date: string;
          end_date: string;
          total_days: number;
          reason?: string | null;
          status?: "pending" | "approved" | "rejected" | "cancelled";
          approved_by?: string | null;
          approved_at?: string | null;
          rejection_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          leave_type_id?: string;
          start_date?: string;
          end_date?: string;
          total_days?: number;
          reason?: string | null;
          status?: "pending" | "approved" | "rejected" | "cancelled";
          approved_by?: string | null;
          approved_at?: string | null;
          rejection_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "leave_requests_user_id_fkey";
            columns: ["user_id"];
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
            foreignKeyName: "leave_requests_approved_by_fkey";
            columns: ["approved_by"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };

      leave_vacation_details: {
        Row: {
          id: string;
          leave_request_id: string;
          destination: string | null;
          contact_number: string | null;
          emergency_contact: string | null;
          delegation_to: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          leave_request_id: string;
          destination?: string | null;
          contact_number?: string | null;
          emergency_contact?: string | null;
          delegation_to?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          leave_request_id?: string;
          destination?: string | null;
          contact_number?: string | null;
          emergency_contact?: string | null;
          delegation_to?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "leave_vacation_details_leave_request_id_fkey";
            columns: ["leave_request_id"];
            referencedRelation: "leave_requests";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "leave_vacation_details_delegation_to_fkey";
            columns: ["delegation_to"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };

      travel_requests: {
        Row: {
          id: string;
          user_id: string;
          destination: string;
          purpose: string;
          start_date: string;
          end_date: string;
          status: "pending" | "approved" | "rejected" | "cancelled" | "completed";
          approved_by: string | null;
          approved_at: string | null;
          rejection_reason: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          destination: string;
          purpose: string;
          start_date: string;
          end_date: string;
          status?: "pending" | "approved" | "rejected" | "cancelled" | "completed";
          approved_by?: string | null;
          approved_at?: string | null;
          rejection_reason?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          destination?: string;
          purpose?: string;
          start_date?: string;
          end_date?: string;
          status?: "pending" | "approved" | "rejected" | "cancelled" | "completed";
          approved_by?: string | null;
          approved_at?: string | null;
          rejection_reason?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "travel_requests_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "travel_requests_approved_by_fkey";
            columns: ["approved_by"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };

      travel_expenses: {
        Row: {
          id: string;
          travel_request_id: string;
          category: string;
          description: string | null;
          estimated_amount: number;
          actual_amount: number | null;
          receipt_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          travel_request_id: string;
          category: string;
          description?: string | null;
          estimated_amount: number;
          actual_amount?: number | null;
          receipt_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          travel_request_id?: string;
          category?: string;
          description?: string | null;
          estimated_amount?: number;
          actual_amount?: number | null;
          receipt_url?: string | null;
          created_at?: string;
          updated_at?: string;
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
          title: string;
          document_number: string;
          from_department_id: string | null;
          to_department_id: string | null;
          status: "draft" | "in_progress" | "completed" | "cancelled";
          priority: "low" | "medium" | "high" | "urgent";
          created_by: string;
          assigned_to: string | null;
          due_date: string | null;
          notes: string | null;
          file_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          document_number: string;
          from_department_id?: string | null;
          to_department_id?: string | null;
          status?: "draft" | "in_progress" | "completed" | "cancelled";
          priority?: "low" | "medium" | "high" | "urgent";
          created_by: string;
          assigned_to?: string | null;
          due_date?: string | null;
          notes?: string | null;
          file_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          document_number?: string;
          from_department_id?: string | null;
          to_department_id?: string | null;
          status?: "draft" | "in_progress" | "completed" | "cancelled";
          priority?: "low" | "medium" | "high" | "urgent";
          created_by?: string;
          assigned_to?: string | null;
          due_date?: string | null;
          notes?: string | null;
          file_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "document_tracking_from_department_id_fkey";
            columns: ["from_department_id"];
            referencedRelation: "departments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "document_tracking_to_department_id_fkey";
            columns: ["to_department_id"];
            referencedRelation: "departments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "document_tracking_created_by_fkey";
            columns: ["created_by"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "document_tracking_assigned_to_fkey";
            columns: ["assigned_to"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };

      employee_trainings: {
        Row: {
          id: string;
          user_id: string;
          training_name: string;
          provider: string | null;
          start_date: string;
          end_date: string;
          status: "planned" | "in_progress" | "completed" | "cancelled";
          certificate_url: string | null;
          hours: number | null;
          cost: number | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          training_name: string;
          provider?: string | null;
          start_date: string;
          end_date: string;
          status?: "planned" | "in_progress" | "completed" | "cancelled";
          certificate_url?: string | null;
          hours?: number | null;
          cost?: number | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          training_name?: string;
          provider?: string | null;
          start_date?: string;
          end_date?: string;
          status?: "planned" | "in_progress" | "completed" | "cancelled";
          certificate_url?: string | null;
          hours?: number | null;
          cost?: number | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "employee_trainings_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };

      notifications: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          message: string;
          type: "info" | "success" | "warning" | "error";
          is_read: boolean;
          link: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          message: string;
          type?: "info" | "success" | "warning" | "error";
          is_read?: boolean;
          link?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          message?: string;
          type?: "info" | "success" | "warning" | "error";
          is_read?: boolean;
          link?: string | null;
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
      [_ in never]: never;
    };
    Enums: {
      user_role: "admin" | "hr" | "manager" | "employee";
      request_status: "pending" | "approved" | "rejected" | "cancelled";
      document_status: "draft" | "in_progress" | "completed" | "cancelled";
      document_priority: "low" | "medium" | "high" | "urgent";
      training_status: "planned" | "in_progress" | "completed" | "cancelled";
      notification_type: "info" | "success" | "warning" | "error";
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
