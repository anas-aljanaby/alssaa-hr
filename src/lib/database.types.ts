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
      organizations: {
        Row: {
          id: string;
          name: string;
          is_demo: boolean;
          created_at: string;
          general_manager_id: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          is_demo?: boolean;
          created_at?: string;
          general_manager_id?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          is_demo?: boolean;
          created_at?: string;
          general_manager_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'organizations_general_manager_id_fkey';
            columns: ['general_manager_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };

      profiles: {
        Row: {
          id: string;
          org_id: string;
          employee_id: string;
          name: string;
          name_ar: string;
          email: string | null;
          phone: string;
          role: 'employee' | 'manager' | 'admin';
          department_id: string | null;
          avatar_url: string | null;
          join_date: string;
          work_days: number[] | null;
          work_start_time: string | null;
          work_end_time: string | null;
        };
        Insert: {
          id: string;
          org_id?: string;
          employee_id: string;
          name: string;
          name_ar: string;
          email?: string | null;
          phone?: string;
          role?: 'employee' | 'manager' | 'admin';
          department_id?: string | null;
          avatar_url?: string | null;
          join_date?: string;
          work_days?: number[] | null;
          work_start_time?: string | null;
          work_end_time?: string | null;
        };
        Update: {
          id?: string;
          org_id?: string;
          employee_id?: string;
          name?: string;
          name_ar?: string;
          email?: string | null;
          phone?: string;
          role?: 'employee' | 'manager' | 'admin';
          department_id?: string | null;
          avatar_url?: string | null;
          join_date?: string;
          work_days?: number[] | null;
          work_start_time?: string | null;
          work_end_time?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'profiles_org_id_fkey';
            columns: ['org_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'profiles_department_id_fkey';
            columns: ['department_id'];
            isOneToOne: false;
            referencedRelation: 'departments';
            referencedColumns: ['id'];
          },
        ];
      };

      departments: {
        Row: {
          id: string;
          org_id: string;
          name: string | null;
          name_ar: string;
          color: string;
          manager_uid: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id?: string;
          name?: string | null;
          name_ar: string;
          color?: string;
          manager_uid?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          name?: string | null;
          name_ar?: string;
          color?: string;
          manager_uid?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'departments_org_id_fkey';
            columns: ['org_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'departments_manager_uid_fkey';
            columns: ['manager_uid'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };

      attendance_logs: {
        Row: {
          id: string;
          org_id: string;
          user_id: string;
          date: string;
          check_in_time: string | null;
          check_out_time: string | null;
          check_in_lat: number | null;
          check_in_lng: number | null;
          check_out_lat: number | null;
          check_out_lng: number | null;
          status: 'present' | 'late' | 'absent' | 'on_leave';
          is_dev: boolean;
          auto_punch_out: boolean;
        };
        Insert: {
          id?: string;
          org_id?: string;
          user_id: string;
          date: string;
          check_in_time?: string | null;
          check_out_time?: string | null;
          check_in_lat?: number | null;
          check_in_lng?: number | null;
          check_out_lat?: number | null;
          check_out_lng?: number | null;
          status?: 'present' | 'late' | 'absent' | 'on_leave';
          is_dev?: boolean;
          auto_punch_out?: boolean;
        };
        Update: {
          id?: string;
          org_id?: string;
          user_id?: string;
          date?: string;
          check_in_time?: string | null;
          check_out_time?: string | null;
          check_in_lat?: number | null;
          check_in_lng?: number | null;
          check_out_lat?: number | null;
          check_out_lng?: number | null;
          status?: 'present' | 'late' | 'absent' | 'on_leave';
          is_dev?: boolean;
          auto_punch_out?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: 'attendance_logs_org_id_fkey';
            columns: ['org_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'attendance_logs_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };

      attendance_sessions: {
        Row: {
          id: string;
          org_id: string;
          user_id: string;
          date: string;
          check_in_time: string;
          check_out_time: string | null;
          status: 'present' | 'late';
          is_overtime: boolean;
          is_auto_punch_out: boolean;
          is_early_departure: boolean;
          needs_review: boolean;
          duration_minutes: number;
          last_action_at: string;
          is_dev: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id?: string;
          user_id: string;
          date: string;
          check_in_time: string;
          check_out_time?: string | null;
          status?: 'present' | 'late';
          is_overtime?: boolean;
          is_auto_punch_out?: boolean;
          is_early_departure?: boolean;
          needs_review?: boolean;
          duration_minutes?: number;
          last_action_at?: string;
          is_dev?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          user_id?: string;
          date?: string;
          check_in_time?: string;
          check_out_time?: string | null;
          status?: 'present' | 'late';
          is_overtime?: boolean;
          is_auto_punch_out?: boolean;
          is_early_departure?: boolean;
          needs_review?: boolean;
          duration_minutes?: number;
          last_action_at?: string;
          is_dev?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'attendance_sessions_org_id_fkey';
            columns: ['org_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'attendance_sessions_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };

      attendance_daily_summary: {
        Row: {
          id: string;
          org_id: string;
          user_id: string;
          date: string;
          first_check_in: string | null;
          last_check_out: string | null;
          total_work_minutes: number;
          total_overtime_minutes: number;
          effective_status: 'present' | 'late' | 'overtime_only' | 'absent' | 'on_leave' | null;
          is_short_day: boolean;
          session_count: number;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id?: string;
          user_id: string;
          date: string;
          first_check_in?: string | null;
          last_check_out?: string | null;
          total_work_minutes?: number;
          total_overtime_minutes?: number;
          effective_status?: 'present' | 'late' | 'overtime_only' | 'absent' | 'on_leave' | null;
          is_short_day?: boolean;
          session_count?: number;
          updated_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          user_id?: string;
          date?: string;
          first_check_in?: string | null;
          last_check_out?: string | null;
          total_work_minutes?: number;
          total_overtime_minutes?: number;
          effective_status?: 'present' | 'late' | 'overtime_only' | 'absent' | 'on_leave' | null;
          is_short_day?: boolean;
          session_count?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'attendance_daily_summary_org_id_fkey';
            columns: ['org_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'attendance_daily_summary_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };

      overtime_requests: {
        Row: {
          id: string;
          org_id: string;
          user_id: string;
          session_id: string;
          status: 'pending' | 'approved' | 'rejected';
          reviewed_by: string | null;
          note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id?: string;
          user_id: string;
          session_id: string;
          status?: 'pending' | 'approved' | 'rejected';
          reviewed_by?: string | null;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          user_id?: string;
          session_id?: string;
          status?: 'pending' | 'approved' | 'rejected';
          reviewed_by?: string | null;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'overtime_requests_org_id_fkey';
            columns: ['org_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'overtime_requests_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'overtime_requests_session_id_fkey';
            columns: ['session_id'];
            isOneToOne: true;
            referencedRelation: 'attendance_sessions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'overtime_requests_reviewed_by_fkey';
            columns: ['reviewed_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };

      attendance_audit_log: {
        Row: {
          id: string;
          org_id: string;
          session_id: string | null;
          employee_id: string;
          action: 'check_in' | 'check_out' | 'auto_punch_out' | 'correction_approved' | 'manual_edit' | 'session_deleted';
          performed_by: string | null;
          old_values: Json | null;
          new_values: Json | null;
          reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id?: string;
          session_id?: string | null;
          employee_id: string;
          action: 'check_in' | 'check_out' | 'auto_punch_out' | 'correction_approved' | 'manual_edit' | 'session_deleted';
          performed_by?: string | null;
          old_values?: Json | null;
          new_values?: Json | null;
          reason?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          session_id?: string | null;
          employee_id?: string;
          action?: 'check_in' | 'check_out' | 'auto_punch_out' | 'correction_approved' | 'manual_edit' | 'session_deleted';
          performed_by?: string | null;
          old_values?: Json | null;
          new_values?: Json | null;
          reason?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'attendance_audit_log_org_id_fkey';
            columns: ['org_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'attendance_audit_log_session_id_fkey';
            columns: ['session_id'];
            isOneToOne: false;
            referencedRelation: 'attendance_sessions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'attendance_audit_log_employee_id_fkey';
            columns: ['employee_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'attendance_audit_log_performed_by_fkey';
            columns: ['performed_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };

      attendance_correction_requests: {
        Row: {
          id: string;
          org_id: string;
          employee_id: string;
          session_id: string | null;
          date: string;
          proposed_check_in_time: string | null;
          proposed_check_out_time: string | null;
          reason: string;
          status: 'pending' | 'approved' | 'rejected';
          requested_by: string;
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id?: string;
          employee_id: string;
          session_id?: string | null;
          date: string;
          proposed_check_in_time?: string | null;
          proposed_check_out_time?: string | null;
          reason?: string;
          status?: 'pending' | 'approved' | 'rejected';
          requested_by: string;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          employee_id?: string;
          session_id?: string | null;
          date?: string;
          proposed_check_in_time?: string | null;
          proposed_check_out_time?: string | null;
          reason?: string;
          status?: 'pending' | 'approved' | 'rejected';
          requested_by?: string;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'attendance_correction_requests_org_id_fkey';
            columns: ['org_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'attendance_correction_requests_employee_id_fkey';
            columns: ['employee_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'attendance_correction_requests_session_id_fkey';
            columns: ['session_id'];
            isOneToOne: false;
            referencedRelation: 'attendance_sessions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'attendance_correction_requests_requested_by_fkey';
            columns: ['requested_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'attendance_correction_requests_reviewed_by_fkey';
            columns: ['reviewed_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };

      leave_requests: {
        Row: {
          id: string;
          org_id: string;
          user_id: string;
          type: 'annual_leave' | 'sick_leave' | 'hourly_permission' | 'time_adjustment' | 'overtime';
          from_date_time: string;
          to_date_time: string;
          note: string;
          status: 'pending' | 'approved' | 'rejected';
          approver_id: string | null;
          decision_note: string | null;
          attachment_url: string | null;
          created_at: string;
          decided_at: string | null;
        };
        Insert: {
          id?: string;
          org_id?: string;
          user_id: string;
          type: 'annual_leave' | 'sick_leave' | 'hourly_permission' | 'time_adjustment' | 'overtime';
          from_date_time: string;
          to_date_time: string;
          note: string;
          status?: 'pending' | 'approved' | 'rejected';
          approver_id?: string | null;
          decision_note?: string | null;
          attachment_url?: string | null;
          created_at?: string;
          decided_at?: string | null;
        };
        Update: {
          id?: string;
          org_id?: string;
          user_id?: string;
          type?: 'annual_leave' | 'sick_leave' | 'hourly_permission' | 'time_adjustment' | 'overtime';
          from_date_time?: string;
          to_date_time?: string;
          note?: string;
          status?: 'pending' | 'approved' | 'rejected';
          approver_id?: string | null;
          decision_note?: string | null;
          attachment_url?: string | null;
          created_at?: string;
          decided_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'leave_requests_org_id_fkey';
            columns: ['org_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'leave_requests_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'leave_requests_approver_id_fkey';
            columns: ['approver_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };

      approval_logs: {
        Row: {
          id: string;
          org_id: string;
          request_id: string;
          actor_id: string;
          action: 'approved' | 'rejected';
          comment: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          request_id: string;
          actor_id: string;
          action: 'approved' | 'rejected';
          comment?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          request_id?: string;
          actor_id?: string;
          action?: 'approved' | 'rejected';
          comment?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'approval_logs_org_id_fkey';
            columns: ['org_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'approval_logs_request_id_fkey';
            columns: ['request_id'];
            isOneToOne: false;
            referencedRelation: 'leave_requests';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'approval_logs_actor_id_fkey';
            columns: ['actor_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };

      leave_balances: {
        Row: {
          id: string;
          org_id: string;
          user_id: string;
          total_annual: number;
          used_annual: number;
          remaining_annual: number;
          total_sick: number;
          used_sick: number;
          remaining_sick: number;
        };
        Insert: {
          id?: string;
          org_id?: string;
          user_id: string;
          total_annual?: number;
          used_annual?: number;
          remaining_annual?: number;
          total_sick?: number;
          used_sick?: number;
          remaining_sick?: number;
        };
        Update: {
          id?: string;
          org_id?: string;
          user_id?: string;
          total_annual?: number;
          used_annual?: number;
          remaining_annual?: number;
          total_sick?: number;
          used_sick?: number;
          remaining_sick?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'leave_balances_org_id_fkey';
            columns: ['org_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'leave_balances_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };

      notifications: {
        Row: {
          id: string;
          org_id: string;
          user_id: string;
          title: string;
          title_ar: string;
          message: string;
          message_ar: string;
          read_status: boolean;
          type: 'request_update' | 'attendance' | 'system' | 'approval';
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id?: string;
          user_id: string;
          title: string;
          title_ar: string;
          message: string;
          message_ar: string;
          read_status?: boolean;
          type: 'request_update' | 'attendance' | 'system' | 'approval';
          created_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          user_id?: string;
          title?: string;
          title_ar?: string;
          message?: string;
          message_ar?: string;
          read_status?: boolean;
          type?: 'request_update' | 'attendance' | 'system' | 'approval';
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'notifications_org_id_fkey';
            columns: ['org_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notifications_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };

      audit_logs: {
        Row: {
          id: string;
          org_id: string;
          actor_id: string;
          action: string;
          action_ar: string;
          target_id: string;
          target_type: string;
          details: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id?: string;
          actor_id: string;
          action: string;
          action_ar: string;
          target_id: string;
          target_type: string;
          details?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          actor_id?: string;
          action?: string;
          action_ar?: string;
          target_id?: string;
          target_type?: string;
          details?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'audit_logs_org_id_fkey';
            columns: ['org_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'audit_logs_actor_id_fkey';
            columns: ['actor_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };

      attendance_policy: {
        Row: {
          id: string;
          org_id: string;
          work_start_time: string;
          work_end_time: string;
          grace_period_minutes: number;
          weekly_off_days: number[];
          max_late_days_before_warning: number;
          absent_cutoff_time: string;
          annual_leave_per_year: number;
          sick_leave_per_year: number;
          auto_punch_out_buffer_minutes: number;
          early_login_minutes: number;
          minimum_required_minutes: number | null;
        };
        Insert: {
          id?: string;
          org_id?: string;
          work_start_time?: string;
          work_end_time?: string;
          grace_period_minutes?: number;
          weekly_off_days?: number[];
          max_late_days_before_warning?: number;
          absent_cutoff_time?: string;
          annual_leave_per_year?: number;
          sick_leave_per_year?: number;
          auto_punch_out_buffer_minutes?: number;
          early_login_minutes?: number;
          minimum_required_minutes?: number | null;
        };
        Update: {
          id?: string;
          org_id?: string;
          work_start_time?: string;
          work_end_time?: string;
          grace_period_minutes?: number;
          weekly_off_days?: number[];
          max_late_days_before_warning?: number;
          absent_cutoff_time?: string;
          annual_leave_per_year?: number;
          sick_leave_per_year?: number;
          auto_punch_out_buffer_minutes?: number;
          early_login_minutes?: number;
          minimum_required_minutes?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'attendance_policy_org_id_fkey';
            columns: ['org_id'];
            isOneToOne: true;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };
    };

    Views: {
      [_ in never]: never;
    };

    Functions: {
      get_redacted_department_availability: {
        Args: {
          p_department_id?: string | null;
        };
        Returns: {
          user_id: string;
          name_ar: string;
          employee_id: string;
          role: string;
          avatar_url: string | null;
          department_id: string | null;
          department_name_ar: string | null;
          availability_state: string;
          team_live_state: string;
          has_overtime: boolean;
        }[];
      };
      get_redacted_team_attendance_day: {
        Args: {
          p_date: string;
          p_department_id?: string | null;
        };
        Returns: {
          user_id: string;
          name_ar: string;
          employee_id: string;
          role: string;
          avatar_url: string | null;
          department_id: string | null;
          department_name_ar: string | null;
          date: string;
          attendance_state: string;
          team_date_state: string;
          has_overtime: boolean;
        }[];
      };
      get_team_attendance_day: {
        Args: {
          p_date: string;
          p_department_id?: string | null;
          p_include_all_profiles?: boolean;
        };
        Returns: {
          user_id: string;
          name_ar: string;
          employee_id: string;
          role: string;
          avatar_url: string | null;
          department_id: string | null;
          department_name_ar: string | null;
          date: string;
          effective_status: string | null;
          display_status: string | null;
          team_live_state: string;
          team_date_state: string;
          first_check_in: string | null;
          last_check_out: string | null;
          total_work_minutes: number;
          total_overtime_minutes: number;
          has_overtime: boolean;
          session_count: number;
          is_checked_in_now: boolean;
          has_auto_punch_out: boolean;
          needs_review: boolean;
          is_short_day: boolean;
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
}

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type InsertTables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];
export type UpdateTables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];
