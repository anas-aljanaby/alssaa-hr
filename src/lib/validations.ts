import { z } from 'zod';
import {
  WORK_TIME_REGEX,
  getWorkScheduleValidationIssues,
} from '@/shared/attendance/workSchedule';

// Shared password rules: 8–128 chars, at least one uppercase, one lowercase, one digit
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 128;
const passwordStrengthRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).*$/;

const strongPassword = z
  .string()
  .min(PASSWORD_MIN, `كلمة المرور يجب أن تكون ${PASSWORD_MIN} أحرف على الأقل`)
  .max(PASSWORD_MAX, `كلمة المرور يجب ألا تتجاوز ${PASSWORD_MAX} حرفاً`)
  .regex(
    passwordStrengthRegex,
    'كلمة المرور يجب أن تحتوي على حرف كبير وحرف صغير ورقم واحد على الأقل'
  );

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'البريد الإلكتروني مطلوب')
    .email('البريد الإلكتروني غير صالح'),
  password: z.string().min(1, 'كلمة المرور مطلوبة'),
  rememberMe: z.boolean().default(true),
});
export type LoginFormData = z.infer<typeof loginSchema>;

export const setPasswordSchema = z
  .object({
    password: strongPassword,
    confirmPassword: z.string().min(1, 'تأكيد كلمة المرور مطلوب'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'كلمة المرور وتأكيدها غير متطابقتين',
    path: ['confirmPassword'],
  });
export type SetPasswordFormData = z.infer<typeof setPasswordSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'كلمة المرور الحالية مطلوبة'),
    newPassword: strongPassword,
    confirmPassword: z.string().min(1, 'تأكيد كلمة المرور مطلوب'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'كلمة المرور وتأكيدها غير متطابقتين',
    path: ['confirmPassword'],
  });
export type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;

export const leaveRequestSchema = z
  .object({
    type: z.enum(['annual_leave', 'hourly_permission', 'time_adjustment'], {
      required_error: 'نوع الطلب مطلوب',
    }),
    fromDate: z.string().min(1, 'تاريخ البداية مطلوب'),
    fromTime: z.string().optional(),
    toDate: z.string().optional(),
    toTime: z.string().optional(),
    note: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const fullDay = data.type === 'annual_leave';
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
      return;
    }

    if (hourly) {
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
  password: strongPassword,
  department_id: z.string().optional(),
});
export type AddUserFormData = z.infer<typeof addUserSchema>;

const daySchedule = z.object({
  start: z.string().regex(WORK_TIME_REGEX, 'وقت البداية غير صالح'),
  end: z.string().regex(WORK_TIME_REGEX, 'وقت النهاية غير صالح'),
});

export const workScheduleSchema = z.partialRecord(
  z.enum(['0', '1', '2', '3', '4', '5', '6']),
  daySchedule
)
  .superRefine((value, ctx) => {
    for (const issue of getWorkScheduleValidationIssues(value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: issue.message,
        path: [issue.dayKey, issue.field],
      });
    }
  })
  .default({});
export type WorkScheduleFormData = z.infer<typeof workScheduleSchema>;

export const updateProfileSchema = z.object({
  name_ar: z.string().min(2, 'الاسم يجب أن يكون حرفين على الأقل'),
  email: z
    .string()
    .optional()
    .refine(
      (value) => !value || z.string().email().safeParse(value).success,
      'البريد الإلكتروني غير صالح'
    ),
  role: z.enum(['employee', 'manager', 'admin'], { required_error: 'الدور مطلوب' }),
  department_id: z.string(),
  work_schedule: workScheduleSchema,
});
export type UpdateProfileFormData = z.infer<typeof updateProfileSchema>;

const departmentNameAr = z
  .string()
  .min(1, 'اسم القسم بالعربية مطلوب')
  .max(100, 'اسم القسم طويل جداً')
  .transform((s) => s.trim());
const departmentNameEn = z
  .string()
  .max(100, 'اسم القسم طويل جداً')
  .transform((s) => {
    const t = s.trim();
    return t.length > 0 ? t : null;
  });
const departmentManagerId = z.string().optional().transform((s) => s || undefined);

export const createDepartmentSchema = z.object({
  nameAr: departmentNameAr,
  nameEn: departmentNameEn,
  managerId: departmentManagerId,
});
export type CreateDepartmentFormData = z.infer<typeof createDepartmentSchema>;

export const updateDepartmentSchema = z.object({
  nameAr: departmentNameAr,
  nameEn: departmentNameEn,
  managerId: departmentManagerId,
});
export type UpdateDepartmentFormData = z.infer<typeof updateDepartmentSchema>;
