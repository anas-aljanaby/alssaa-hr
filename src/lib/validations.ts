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

export const leaveRequestSchema = z
  .object({
    type: z.enum(['annual_leave', 'sick_leave', 'hourly_permission', 'time_adjustment'], {
      required_error: 'نوع الطلب مطلوب',
    }),
    fromDate: z.string().min(1, 'تاريخ البداية مطلوب'),
    fromTime: z.string().optional(),
    toDate: z.string().optional(),
    toTime: z.string().optional(),
    note: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const fullDay = data.type === 'annual_leave' || data.type === 'sick_leave';
    const timeAdjustment = data.type === 'time_adjustment';
    const hourly = data.type === 'hourly_permission';

    if (fullDay) {
      if (!data.toDate?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'تاريخ النهاية مطلوب', path: ['toDate'] });
        return;
      }
      const from = new Date(data.fromDate);
      const to = new Date(data.toDate);
      if (to < from) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'تاريخ النهاية يجب أن يكون بعد تاريخ البداية',
          path: ['toDate'],
        });
      }
      return;
    }

    if (timeAdjustment) {
      if (!data.fromTime?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'وقت البداية مطلوب', path: ['fromTime'] });
      }
      if (!data.toTime?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'وقت النهاية مطلوب', path: ['toTime'] });
      }
      if (data.fromDate && data.fromTime && data.toTime) {
        const from = new Date(`${data.fromDate}T${data.fromTime}`);
        const to = new Date(`${data.fromDate}T${data.toTime}`);
        if (to <= from) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'وقت النهاية يجب أن يكون بعد وقت البداية',
            path: ['toTime'],
          });
        }
      }
      return;
    }

    if (hourly) {
      if (!data.fromTime?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'وقت البداية مطلوب', path: ['fromTime'] });
      }
      if (!data.toDate?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'تاريخ النهاية مطلوب', path: ['toDate'] });
      }
      if (!data.toTime?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'وقت النهاية مطلوب', path: ['toTime'] });
      }
      if (data.fromDate && data.fromTime && data.toDate && data.toTime) {
        const from = new Date(`${data.fromDate}T${data.fromTime}`);
        const to = new Date(`${data.toDate}T${data.toTime}`);
        if (to <= from) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'تاريخ ونهاية الوقت يجب أن يكونا بعد البداية',
            path: ['toDate'],
          });
        }
      }
    }
  });
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
