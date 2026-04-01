import { z } from 'zod';

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
  password: strongPassword,
});
export type SignUpFormData = z.infer<typeof signUpSchema>;

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
  password: strongPassword,
  department_id: z.string().optional(),
});
export type AddUserFormData = z.infer<typeof addUserSchema>;

const workDay = z.number().int().min(0).max(6);

const timeRegex = /^([01]?\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;

export const updateProfileSchema = z
  .object({
    name_ar: z.string().min(2, 'الاسم يجب أن يكون حرفين على الأقل'),
    email: z
      .string()
      .optional()
      .refine(
        (value) => !value || z.string().email().safeParse(value).success,
        'البريد الإلكتروني غير صالح'
      ),
    role: z.enum(['employee', 'manager', 'admin'], { required_error: 'الدور مطلوب' }),
    department_id: z.string().min(1, 'القسم مطلوب'),
    work_days: z.array(workDay).optional(),
    work_start_time: z.string().optional(),
    work_end_time: z.string().optional(),
  })
  .refine(
    (data) => {
      const hasDays = data.work_days && data.work_days.length > 0;
      if (!hasDays) return true;

      const hasStart = data.work_start_time && timeRegex.test(data.work_start_time);
      const hasEnd = data.work_end_time && timeRegex.test(data.work_end_time);
      if (!hasStart || !hasEnd) return false;

      const [sh, sm] = data.work_start_time!.split(':').map(Number);
      const [eh, em] = data.work_end_time!.split(':').map(Number);
      return sh * 60 + sm < eh * 60 + em;
    },
    { message: 'يجب تحديد وقت البداية والنهاية وأن يكون وقت النهاية بعد البداية', path: ['work_end_time'] }
  );
export type UpdateProfileFormData = z.infer<typeof updateProfileSchema>;

const departmentNameAr = z
  .string()
  .min(1, 'اسم القسم بالعربية مطلوب')
  .max(100, 'اسم القسم طويل جداً')
  .transform((s) => s.trim());
const departmentNameEn = z
  .string()
  .min(1, 'اسم القسم بالإنجليزية مطلوب')
  .max(100, 'اسم القسم طويل جداً')
  .transform((s) => s.trim());
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
