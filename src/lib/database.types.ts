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
      profiles: {
        Row: {
          id: string;
          employee_id: string;
          name: string;
          name_ar: string;
          phone: string;
          role: 'employee' | 'manager' | 'admin';
          department_id: string | null;
          status: 'active' | 'inactive';
          avatar_url: string | null;
          join_date: string;
        };
        Insert: {
          id: string;
          employee_id: string;
          name: string;
          name_ar: string;
          phone?: string;
          role?: 'employee' | 'manager' | 'admin';
          department_id?: string | null;
          status?: 'active' | 'inactive';
          avatar_url?: string | null;
          join_date?: string;
        };
        Update: {
          id?: string;
          employee_id?: string;
          name?: string;
          name_ar?: string;
          phone?: string;
          role?: 'employee' | 'manager' | 'admin';
          department_id?: string | null;
          status?: 'active' | 'inactive';
          avatar_url?: string | null;
          join_date?: string;
        };
        Relationships: [
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
          name: string;
          name_ar: string;
          manager_uid: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          name_ar: string;
          manager_uid?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          name_ar?: string;
          manager_uid?: string | null;
          created_at?: string;
        };
        Relationships: [
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
          user_id: string;
          date: string;
          check_in_time: string | null;
          check_out_time: string | null;
          check_in_lat: number | null;
          check_in_lng: number | null;
          check_out_lat: number | null;
          check_out_lng: number | null;
          status: 'present' | 'late' | 'absent' | 'on_leave';
        };
        Insert: {
          id?: string;
          user_id: string;
          date: string;
          check_in_time?: string | null;
          check_out_time?: string | null;
          check_in_lat?: number | null;
          check_in_lng?: number | null;
          check_out_lat?: number | null;
          check_out_lng?: number | null;
          status?: 'present' | 'late' | 'absent' | 'on_leave';
        };
        Update: {
          id?: string;
          user_id?: string;
          date?: string;
          check_in_time?: string | null;
          check_out_time?: string | null;
          check_in_lat?: number | null;
          check_in_lng?: number | null;
          check_out_lat?: number | null;
          check_out_lng?: number | null;
          status?: 'present' | 'late' | 'absent' | 'on_leave';
        };
        Relationships: [
          {
            foreignKeyName: 'attendance_logs_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };

      leave_requests: {
        Row: {
          id: string;
          user_id: string;
          type: 'annual_leave' | 'sick_leave' | 'hourly_permission' | 'time_adjustment';
          from_date_time: string;
          to_date_time: string;
          note: string;
          status: 'pending' | 'approved' | 'rejected';
          approver_id: string | null;
          decision_note: string | null;
          attachment_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: 'annual_leave' | 'sick_leave' | 'hourly_permission' | 'time_adjustment';
          from_date_time: string;
          to_date_time: string;
          note: string;
          status?: 'pending' | 'approved' | 'rejected';
          approver_id?: string | null;
          decision_note?: string | null;
          attachment_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: 'annual_leave' | 'sick_leave' | 'hourly_permission' | 'time_adjustment';
          from_date_time?: string;
          to_date_time?: string;
          note?: string;
          status?: 'pending' | 'approved' | 'rejected';
          approver_id?: string | null;
          decision_note?: string | null;
          attachment_url?: string | null;
          created_at?: string;
        };
        Relationships: [
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

      leave_balances: {
        Row: {
          id: string;
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
          work_start_time: string;
          work_end_time: string;
          grace_period_minutes: number;
          weekly_off_days: number[];
          max_late_days_before_warning: number;
          absent_cutoff_time: string;
          annual_leave_per_year: number;
          sick_leave_per_year: number;
        };
        Insert: {
          id?: string;
          work_start_time: string;
          work_end_time: string;
          grace_period_minutes?: number;
          weekly_off_days?: number[];
          max_late_days_before_warning?: number;
          absent_cutoff_time?: string;
          annual_leave_per_year?: number;
          sick_leave_per_year?: number;
        };
        Update: {
          id?: string;
          work_start_time?: string;
          work_end_time?: string;
          grace_period_minutes?: number;
          weekly_off_days?: number[];
          max_late_days_before_warning?: number;
          absent_cutoff_time?: string;
          annual_leave_per_year?: number;
          sick_leave_per_year?: number;
        };
        Relationships: [];
      };
    };

    Views: {
      [_ in never]: never;
    };

    Functions: {
      [_ in never]: never;
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
