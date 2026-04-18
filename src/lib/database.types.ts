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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      approval_logs: {
        Row: {
          action: string
          actor_id: string
          comment: string | null
          created_at: string
          id: string
          org_id: string
          request_id: string
        }
        Insert: {
          action: string
          actor_id: string
          comment?: string | null
          created_at?: string
          id?: string
          org_id: string
          request_id: string
        }
        Update: {
          action?: string
          actor_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          org_id?: string
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_logs_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "leave_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_audit_log: {
        Row: {
          action: string
          created_at: string
          employee_id: string
          id: string
          new_values: Json | null
          old_values: Json | null
          org_id: string
          performed_by: string | null
          reason: string | null
          session_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          employee_id: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          org_id: string
          performed_by?: string | null
          reason?: string | null
          session_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          employee_id?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          org_id?: string
          performed_by?: string | null
          reason?: string | null
          session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_audit_log_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_audit_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_audit_log_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_audit_log_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "attendance_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_correction_requests: {
        Row: {
          created_at: string
          date: string
          employee_id: string
          id: string
          org_id: string
          proposed_check_in_time: string | null
          proposed_check_out_time: string | null
          reason: string
          requested_by: string
          reviewed_at: string | null
          reviewed_by: string | null
          session_id: string | null
          status: string
        }
        Insert: {
          created_at?: string
          date: string
          employee_id: string
          id?: string
          org_id: string
          proposed_check_in_time?: string | null
          proposed_check_out_time?: string | null
          reason?: string
          requested_by: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          session_id?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          date?: string
          employee_id?: string
          id?: string
          org_id?: string
          proposed_check_in_time?: string | null
          proposed_check_out_time?: string | null
          reason?: string
          requested_by?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          session_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_correction_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_correction_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_correction_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_correction_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_correction_requests_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "attendance_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_daily_summary: {
        Row: {
          date: string
          effective_status: string | null
          first_check_in: string | null
          has_overtime: boolean
          id: string
          is_incomplete_shift: boolean
          last_check_out: string | null
          org_id: string
          session_count: number
          total_overtime_minutes: number
          total_work_minutes: number
          updated_at: string
          user_id: string
        }
        Insert: {
          date: string
          effective_status?: string | null
          first_check_in?: string | null
          has_overtime?: boolean
          id?: string
          is_incomplete_shift?: boolean
          last_check_out?: string | null
          org_id: string
          session_count?: number
          total_overtime_minutes?: number
          total_work_minutes?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          date?: string
          effective_status?: string | null
          first_check_in?: string | null
          has_overtime?: boolean
          id?: string
          is_incomplete_shift?: boolean
          last_check_out?: string | null
          org_id?: string
          session_count?: number
          total_overtime_minutes?: number
          total_work_minutes?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_daily_summary_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_daily_summary_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_logs: {
        Row: {
          auto_punch_out: boolean
          check_in_lat: number | null
          check_in_lng: number | null
          check_in_time: string | null
          check_out_lat: number | null
          check_out_lng: number | null
          check_out_time: string | null
          date: string
          id: string
          is_dev: boolean
          org_id: string
          status: string
          user_id: string
        }
        Insert: {
          auto_punch_out?: boolean
          check_in_lat?: number | null
          check_in_lng?: number | null
          check_in_time?: string | null
          check_out_lat?: number | null
          check_out_lng?: number | null
          check_out_time?: string | null
          date: string
          id?: string
          is_dev?: boolean
          org_id: string
          status?: string
          user_id: string
        }
        Update: {
          auto_punch_out?: boolean
          check_in_lat?: number | null
          check_in_lng?: number | null
          check_in_time?: string | null
          check_out_lat?: number | null
          check_out_lng?: number | null
          check_out_time?: string | null
          date?: string
          id?: string
          is_dev?: boolean
          org_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_policy: {
        Row: {
          absent_cutoff_time: string
          annual_leave_per_year: number
          auto_punch_out_buffer_minutes: number
          check_in_notification_message: string | null
          check_out_notification_message: string | null
          early_login_minutes: number
          grace_period_minutes: number
          id: string
          max_late_days_before_warning: number
          minimum_overtime_minutes: number
          minimum_required_minutes: number | null
          org_id: string
          sick_leave_per_year: number
          weekly_off_days: number[]
          work_end_time: string
          work_start_time: string
        }
        Insert: {
          absent_cutoff_time?: string
          annual_leave_per_year?: number
          auto_punch_out_buffer_minutes?: number
          check_in_notification_message?: string | null
          check_out_notification_message?: string | null
          early_login_minutes?: number
          grace_period_minutes?: number
          id?: string
          max_late_days_before_warning?: number
          minimum_overtime_minutes?: number
          minimum_required_minutes?: number | null
          org_id: string
          sick_leave_per_year?: number
          weekly_off_days?: number[]
          work_end_time?: string
          work_start_time?: string
        }
        Update: {
          absent_cutoff_time?: string
          annual_leave_per_year?: number
          auto_punch_out_buffer_minutes?: number
          check_in_notification_message?: string | null
          check_out_notification_message?: string | null
          early_login_minutes?: number
          grace_period_minutes?: number
          id?: string
          max_late_days_before_warning?: number
          minimum_overtime_minutes?: number
          minimum_required_minutes?: number | null
          org_id?: string
          sick_leave_per_year?: number
          weekly_off_days?: number[]
          work_end_time?: string
          work_start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_policy_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_sessions: {
        Row: {
          check_in_time: string
          check_out_time: string | null
          created_at: string
          date: string
          duration_minutes: number
          id: string
          is_auto_punch_out: boolean
          is_dev: boolean
          is_early_departure: boolean
          is_overtime: boolean
          last_action_at: string
          needs_review: boolean
          org_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          check_in_time: string
          check_out_time?: string | null
          created_at?: string
          date: string
          duration_minutes?: number
          id?: string
          is_auto_punch_out?: boolean
          is_dev?: boolean
          is_early_departure?: boolean
          is_overtime?: boolean
          last_action_at?: string
          needs_review?: boolean
          org_id: string
          status: string
          updated_at?: string
          user_id: string
        }
        Update: {
          check_in_time?: string
          check_out_time?: string | null
          created_at?: string
          date?: string
          duration_minutes?: number
          id?: string
          is_auto_punch_out?: boolean
          is_dev?: boolean
          is_early_departure?: boolean
          is_overtime?: boolean
          last_action_at?: string
          needs_review?: boolean
          org_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_sessions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          action_ar: string
          actor_id: string
          created_at: string
          details: string | null
          id: string
          org_id: string
          target_id: string
          target_type: string
        }
        Insert: {
          action: string
          action_ar: string
          actor_id: string
          created_at?: string
          details?: string | null
          id?: string
          org_id: string
          target_id: string
          target_type: string
        }
        Update: {
          action?: string
          action_ar?: string
          actor_id?: string
          created_at?: string
          details?: string | null
          id?: string
          org_id?: string
          target_id?: string
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          color: string
          created_at: string
          id: string
          manager_uid: string | null
          name: string | null
          name_ar: string
          org_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          manager_uid?: string | null
          name?: string | null
          name_ar: string
          org_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          manager_uid?: string | null
          name?: string | null
          name_ar?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_manager_uid_fkey"
            columns: ["manager_uid"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_balances: {
        Row: {
          id: string
          org_id: string
          remaining_annual: number
          remaining_sick: number
          total_annual: number
          total_sick: number
          used_annual: number
          used_sick: number
          user_id: string
        }
        Insert: {
          id?: string
          org_id: string
          remaining_annual?: number
          remaining_sick?: number
          total_annual?: number
          total_sick?: number
          used_annual?: number
          used_sick?: number
          user_id: string
        }
        Update: {
          id?: string
          org_id?: string
          remaining_annual?: number
          remaining_sick?: number
          total_annual?: number
          total_sick?: number
          used_annual?: number
          used_sick?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_balances_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_balances_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          approver_id: string | null
          attachment_url: string | null
          created_at: string
          decided_at: string | null
          decision_note: string | null
          from_date_time: string
          id: string
          note: string
          org_id: string
          status: string
          to_date_time: string
          type: string
          user_id: string
        }
        Insert: {
          approver_id?: string | null
          attachment_url?: string | null
          created_at?: string
          decided_at?: string | null
          decision_note?: string | null
          from_date_time: string
          id?: string
          note?: string
          org_id: string
          status?: string
          to_date_time: string
          type: string
          user_id: string
        }
        Update: {
          approver_id?: string | null
          attachment_url?: string | null
          created_at?: string
          decided_at?: string | null
          decision_note?: string | null
          from_date_time?: string
          id?: string
          note?: string
          org_id?: string
          status?: string
          to_date_time?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_approver_id_fkey"
            columns: ["approver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_settings: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          message: string
          message_ar: string
          minutes_before: number | null
          org_id: string
          title: string
          title_ar: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          message: string
          message_ar: string
          minutes_before?: number | null
          org_id: string
          title: string
          title_ar: string
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          message?: string
          message_ar?: string
          minutes_before?: number | null
          org_id?: string
          title?: string
          title_ar?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_settings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          message_ar: string
          org_id: string
          read_status: boolean
          title: string
          title_ar: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          message_ar: string
          org_id: string
          read_status?: boolean
          title: string
          title_ar: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          message_ar?: string
          org_id?: string
          read_status?: boolean
          title?: string
          title_ar?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          general_manager_id: string | null
          id: string
          is_demo: boolean
          name: string
        }
        Insert: {
          created_at?: string
          general_manager_id?: string | null
          id?: string
          is_demo?: boolean
          name: string
        }
        Update: {
          created_at?: string
          general_manager_id?: string | null
          id?: string
          is_demo?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizations_general_manager_id_fkey"
            columns: ["general_manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      publishing_tag_holders: {
        Row: {
          claimed_at: string | null
          force_released_at: string | null
          force_released_by: string | null
          id: string
          org_id: string
          released_at: string | null
          user_id: string | null
        }
        Insert: {
          claimed_at?: string | null
          force_released_at?: string | null
          force_released_by?: string | null
          id?: string
          org_id: string
          released_at?: string | null
          user_id?: string | null
        }
        Update: {
          claimed_at?: string | null
          force_released_at?: string | null
          force_released_by?: string | null
          id?: string
          org_id?: string
          released_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "publishing_tag_holders_force_released_by_fkey"
            columns: ["force_released_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publishing_tag_holders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publishing_tag_holders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      overtime_requests: {
        Row: {
          created_at: string
          id: string
          note: string | null
          org_id: string
          reviewed_by: string | null
          session_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          org_id: string
          reviewed_by?: string | null
          session_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          org_id?: string
          reviewed_by?: string | null
          session_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "overtime_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "overtime_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "overtime_requests_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "attendance_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "overtime_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          department_id: string | null
          email: string | null
          employee_id: string
          id: string
          join_date: string
          name: string
          name_ar: string
          org_id: string
          phone: string
          role: string
          updated_at: string
          work_days: number[] | null
          work_end_time: string | null
          work_start_time: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          department_id?: string | null
          email?: string | null
          employee_id: string
          id: string
          join_date?: string
          name: string
          name_ar: string
          org_id: string
          phone?: string
          role?: string
          updated_at?: string
          work_days?: number[] | null
          work_end_time?: string | null
          work_start_time?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          department_id?: string | null
          email?: string | null
          employee_id?: string
          id?: string
          join_date?: string
          name?: string
          name_ar?: string
          org_id?: string
          phone?: string
          role?: string
          updated_at?: string
          work_days?: number[] | null
          work_end_time?: string | null
          work_start_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          org_id: string
          subscription: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          org_id: string
          subscription: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          org_id?: string
          subscription?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sent_scheduled_notifications: {
        Row: {
          date: string
          id: string
          notification_type: string
          org_id: string
          sent_at: string
          user_id: string
        }
        Insert: {
          date: string
          id?: string
          notification_type: string
          org_id: string
          sent_at?: string
          user_id: string
        }
        Update: {
          date?: string
          id?: string
          notification_type?: string
          org_id?: string
          sent_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sent_scheduled_notifications_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_attendance_correction_from_leave_request: {
        Args: { p_approver_id?: string; p_leave_request_id: string }
        Returns: {
          check_in_time: string
          check_out_time: string | null
          created_at: string
          date: string
          duration_minutes: number
          id: string
          is_auto_punch_out: boolean
          is_dev: boolean
          is_early_departure: boolean
          is_overtime: boolean
          last_action_at: string
          needs_review: boolean
          org_id: string
          status: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "attendance_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      current_user_department: { Args: never; Returns: string }
      current_user_org_id: { Args: never; Returns: string }
      current_user_role: { Args: never; Returns: string }
      get_redacted_department_availability: {
        Args: { p_department_id?: string }
        Returns: {
          availability_state: string
          avatar_url: string
          department_id: string
          department_name_ar: string
          employee_id: string
          has_overtime: boolean
          name_ar: string
          role: string
          team_live_state: string
          user_id: string
        }[]
      }
      get_redacted_team_attendance_day: {
        Args: { p_date: string; p_department_id?: string }
        Returns: {
          attendance_state: string
          avatar_url: string
          date: string
          department_id: string
          department_name_ar: string
          employee_id: string
          has_overtime: boolean
          name_ar: string
          role: string
          team_date_state: string
          user_id: string
        }[]
      }
      get_team_attendance_day: {
        Args: {
          p_date: string
          p_department_id?: string
          p_include_all_profiles?: boolean
        }
        Returns: {
          avatar_url: string
          date: string
          department_id: string
          department_name_ar: string
          display_status: string
          effective_status: string
          employee_id: string
          first_check_in: string
          has_auto_punch_out: boolean
          has_overtime: boolean
          is_checked_in_now: boolean
          is_incomplete_shift: boolean
          last_check_out: string
          name_ar: string
          needs_review: boolean
          role: string
          session_count: number
          team_date_state: string
          team_live_state: string
          total_overtime_minutes: number
          total_work_minutes: number
          user_id: string
        }[]
      }
      manual_edit_attendance_session: {
        Args: {
          p_check_in_time?: string
          p_check_out_time?: string
          p_reason?: string
          p_session_id: string
        }
        Returns: {
          check_in_time: string
          check_out_time: string | null
          created_at: string
          date: string
          duration_minutes: number
          id: string
          is_auto_punch_out: boolean
          is_dev: boolean
          is_early_departure: boolean
          is_overtime: boolean
          last_action_at: string
          needs_review: boolean
          org_id: string
          status: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "attendance_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      punch: {
        Args: { p_action: string; p_dev_override_time?: string }
        Returns: {
          auto_punch_out: boolean
          check_in_lat: number | null
          check_in_lng: number | null
          check_in_time: string | null
          check_out_lat: number | null
          check_out_lng: number | null
          check_out_time: string | null
          date: string
          id: string
          is_dev: boolean
          org_id: string
          status: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "attendance_logs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      recalculate_attendance_daily_summary: {
        Args: { p_date: string; p_user_id: string }
        Returns: undefined
      }
      resolve_team_attendance_date_state: {
        Args: {
          p_effective_status: string
          p_has_leave: boolean
          p_has_shift: boolean
          p_is_incomplete_shift: boolean
          p_is_working_day: boolean
        }
        Returns: string
      }
      resolve_team_attendance_live_state: {
        Args: {
          p_date: string
          p_has_leave: boolean
          p_has_regular_session: boolean
          p_has_shift: boolean
          p_is_checked_in_now: boolean
          p_is_incomplete_shift: boolean
          p_is_working_day: boolean
          p_now_time: string
          p_session_count: number
          p_team_date_state: string
          p_today: string
          p_work_end_time: string
        }
        Returns: string
      }
      seed_default_notification_settings: {
        Args: { p_enabled?: boolean; p_org_id: string }
        Returns: undefined
      }
      transfer_general_manager: {
        Args: { p_new_gm_id: string; p_org_id: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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

export type InsertTables<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = TablesInsert<DefaultSchemaTableNameOrOptions, TableName>

export type UpdateTables<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = TablesUpdate<DefaultSchemaTableNameOrOptions, TableName>

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
