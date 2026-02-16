import { z } from 'zod';

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'البريد الإلكتروني مطلوب')
    .email('البريد الإلكتروني غير صالح'),
  password: z
    .string()
    .min(1, 'كلمة المرور مطلوبة'),
});
export type LoginFormData = z.infer<typeof loginSchema>;

export const signUpSchema = z.object({
  name: z
    .string()
    .min(2, 'الاسم يجب أن يكون حرفين على الأقل')
    .max(100, 'الاسم طويل جداً'),
  email: z
    .string()
    .min(1, 'البريد الإلكتروني مطلوب')
    .email('البريد الإلكتروني غير صالح'),
  password: z
    .string()
    .min(6, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'),
});
export type SignUpFormData = z.infer<typeof signUpSchema>;

export const leaveRequestSchema = z.object({
  type: z.enum(['annual_leave', 'sick_leave', 'hourly_permission', 'time_adjustment'], {
    required_error: 'نوع الطلب مطلوب',
  }),
  fromDate: z.string().min(1, 'تاريخ البداية مطلوب'),
  fromTime: z.string().min(1, 'وقت البداية مطلوب'),
  toDate: z.string().min(1, 'تاريخ النهاية مطلوب'),
  toTime: z.string().min(1, 'وقت النهاية مطلوب'),
  note: z.string().optional(),
}).refine(
  (data) => {
    if (!data.fromDate || !data.toDate) return true;
    const from = new Date(`${data.fromDate}T${data.fromTime}`);
    const to = new Date(`${data.toDate}T${data.toTime}`);
    return to > from;
  },
  { message: 'تاريخ النهاية يجب أن يكون بعد تاريخ البداية', path: ['toDate'] }
);
export type LeaveRequestFormData = z.infer<typeof leaveRequestSchema>;

export const approvalSchema = z.object({
  comment: z.string().optional(),
});
export type ApprovalFormData = z.infer<typeof approvalSchema>;

export const addUserSchema = z.object({
  name: z.string().min(2, 'الاسم يجب أن يكون حرفين على الأقل'),
  email: z.string().min(1, 'البريد الإلكتروني مطلوب').email('البريد الإلكتروني غير صالح'),
  phone: z.string().optional(),
  role: z.enum(['employee', 'manager', 'admin'], { required_error: 'الدور مطلوب' }),
  department_id: z.string().min(1, 'القسم مطلوب'),
});
export type AddUserFormData = z.infer<typeof addUserSchema>;
