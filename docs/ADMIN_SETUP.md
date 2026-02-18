# ALSSAA HR — Admin Setup Guide

Step-by-step instructions for setting up the ALSSAA HR system from scratch, creating the first admin user, and optionally populating demo data for testing.

---

## Prerequisites

| Requirement          | Details                                             |
| -------------------- | --------------------------------------------------- |
| Supabase project     | Free tier at [supabase.com](https://supabase.com)   |
| Node.js ≥ 18         | Required to build the frontend                      |
| pnpm                 | Package manager (`npm i -g pnpm`)                   |
| Supabase CLI (optional) | For local development (`npx supabase start`)     |

---

## 1. Supabase Project Setup

### 1.1 Create a project

1. Go to [app.supabase.com](https://app.supabase.com) and create a new project.
2. Note your **Project URL** and **anon (public) key** from Settings → API.

### 1.2 Configure environment variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 1.3 Run the database migration

Open the **SQL Editor** in the Supabase Dashboard and paste the contents of:

```
supabase/migrations/001_initial_schema.sql
```

This creates all tables, indexes, RLS policies, helper functions, and triggers.

### 1.4 Run the seed data

Next, paste the contents of:

```
supabase/seed.sql
```

This inserts:
- The default **attendance policy** (08:00–16:00, 15 min grace, Fri/Sat off)
- Five **departments**: News, Technical, Marketing, Finance, HR
- A **default admin user** (see section 2 below)

> **Supabase CLI alternative:** If using `supabase start` locally, the migration runs from `supabase/migrations/` and the seed from `supabase/seed.sql` automatically with `supabase db reset`.

---

## 2. First Admin User

### Default admin (created by seed)

Running `supabase/seed.sql` **creates the first admin user automatically**:

| Field    | Value                        |
| -------- | ---------------------------- |
| Email    | `admin@alssaa.tv`            |
| Password | `ChangeMe-InProduction-123!`  |
| Name     | Ahmed Hassan (أحمد حسن)       |
| Role     | admin                        |
| Department | HR (assigned by seed)       |

**Important:** Change the password after first login in production. The seed script skips creating this user if one with the same email already exists.

### Method A: Create a different admin via Dashboard

1. Go to **Authentication → Users → Add user → Create new user**
2. Fill in the fields:
   - **Email:** `admin@alssaa.tv` (or your preferred email)
   - **Password:** a strong password (min 8 characters)
   - **Auto Confirm User?** Toggle **ON**
3. In the **User Metadata** JSON field, paste:

```json
{
  "name": "Ahmed Hassan",
  "name_ar": "أحمد حسن",
  "role": "admin",
  "employee_id": "EMP-001",
  "phone": "+964 770 123 4567"
}
```

4. Click **Create user**.

### Method B: Create another admin via SQL Editor

If you need an additional admin (or did not run the full seed), you can create one by inserting into `auth.users` and `auth.identities` with a hashed password. The seed script in `supabase/seed.sql` shows the full pattern; for a quick second admin, use the Dashboard (Method A) instead.

### What happens when an admin is created

The `handle_new_user` trigger fires on `auth.users` insert and creates:

| Table            | Row created                                               |
| ---------------- | --------------------------------------------------------- |
| `profiles`       | `role = 'admin'`, `employee_id = 'EMP-001'`, etc.        |
| `leave_balances` | `total_annual = 21`, `total_sick = 10` (from policy)     |

The seed script also assigns the default admin to the HR department. For any other admin you create via the Dashboard, assign a department with:

```sql
UPDATE public.profiles
SET department_id = (SELECT id FROM public.departments WHERE name = 'HR Department')
WHERE employee_id = 'EMP-001';
```

---

## 3. Verify the Setup

Run these queries in the SQL Editor to confirm everything is correct:

```sql
-- Check attendance policy
SELECT * FROM public.attendance_policy;

-- Check departments
SELECT id, name, name_ar FROM public.departments ORDER BY name;

-- Check the admin profile was created
SELECT id, employee_id, name, name_ar, role, status
FROM public.profiles;

-- Check leave balance was initialized
SELECT lb.*, p.name
FROM public.leave_balances lb
JOIN public.profiles p ON p.id = lb.user_id;
```

---

## 4. Create Demo Users (Optional)

For testing all three roles (admin, manager, employee), create the following users using **Method A** or **Method B** from above.

### 4.1 Managers

Create each user with the metadata below, then run the SQL to assign their department.

#### Sara Ali — News Department Manager

**Metadata:**

```json
{
  "name": "Sara Ali",
  "name_ar": "سارة علي",
  "role": "manager",
  "employee_id": "EMP-002",
  "phone": "+964 770 234 5678"
}
```

**Post-creation SQL:**

```sql
UPDATE public.profiles
SET department_id = (SELECT id FROM public.departments WHERE name = 'News Department')
WHERE employee_id = 'EMP-002';

UPDATE public.departments
SET manager_uid = (SELECT id FROM public.profiles WHERE employee_id = 'EMP-002')
WHERE name = 'News Department';
```

#### Ali Mahmoud — Technical Department Manager

**Metadata:**

```json
{
  "name": "Ali Mahmoud",
  "name_ar": "علي محمود",
  "role": "manager",
  "employee_id": "EMP-005",
  "phone": "+964 770 567 8901"
}
```

**Post-creation SQL:**

```sql
UPDATE public.profiles
SET department_id = (SELECT id FROM public.departments WHERE name = 'Technical Department')
WHERE employee_id = 'EMP-005';

UPDATE public.departments
SET manager_uid = (SELECT id FROM public.profiles WHERE employee_id = 'EMP-005')
WHERE name = 'Technical Department';
```

#### Nour Saleh — Marketing Department Manager

**Metadata:**

```json
{
  "name": "Nour Saleh",
  "name_ar": "نور صالح",
  "role": "manager",
  "employee_id": "EMP-006",
  "phone": "+964 770 678 9012"
}
```

**Post-creation SQL:**

```sql
UPDATE public.profiles
SET department_id = (SELECT id FROM public.departments WHERE name = 'Marketing Department')
WHERE employee_id = 'EMP-006';

UPDATE public.departments
SET manager_uid = (SELECT id FROM public.profiles WHERE employee_id = 'EMP-006')
WHERE name = 'Marketing Department';
```

#### Hassan Jabbar — Finance Department Manager

**Metadata:**

```json
{
  "name": "Hassan Jabbar",
  "name_ar": "حسن جبار",
  "role": "manager",
  "employee_id": "EMP-007",
  "phone": "+964 770 789 0123"
}
```

**Post-creation SQL:**

```sql
UPDATE public.profiles
SET department_id = (SELECT id FROM public.departments WHERE name = 'Finance Department')
WHERE employee_id = 'EMP-007';

UPDATE public.departments
SET manager_uid = (SELECT id FROM public.profiles WHERE employee_id = 'EMP-007')
WHERE name = 'Finance Department';
```

#### Zainab Ridha — HR Department Manager

**Metadata:**

```json
{
  "name": "Zainab Ridha",
  "name_ar": "زينب رضا",
  "role": "manager",
  "employee_id": "EMP-008",
  "phone": "+964 770 890 1234"
}
```

**Post-creation SQL:**

```sql
UPDATE public.profiles
SET department_id = (SELECT id FROM public.departments WHERE name = 'HR Department')
WHERE employee_id = 'EMP-008';

UPDATE public.departments
SET manager_uid = (SELECT id FROM public.profiles WHERE employee_id = 'EMP-008')
WHERE name = 'HR Department';
```

### 4.2 Employees

Create each user with the metadata below, then assign their department.

#### Mohammed Karim — News Department

**Metadata:**

```json
{
  "name": "Mohammed Karim",
  "name_ar": "محمد كريم",
  "role": "employee",
  "employee_id": "EMP-003",
  "phone": "+964 770 345 6789"
}
```

**Post-creation SQL:**

```sql
UPDATE public.profiles
SET department_id = (SELECT id FROM public.departments WHERE name = 'News Department')
WHERE employee_id = 'EMP-003';
```

#### Fatima Nouri — News Department

**Metadata:**

```json
{
  "name": "Fatima Nouri",
  "name_ar": "فاطمة نوري",
  "role": "employee",
  "employee_id": "EMP-004",
  "phone": "+964 770 456 7890"
}
```

**Post-creation SQL:**

```sql
UPDATE public.profiles
SET department_id = (SELECT id FROM public.departments WHERE name = 'News Department')
WHERE employee_id = 'EMP-004';
```

#### Omar Faisal — Technical Department

**Metadata:**

```json
{
  "name": "Omar Faisal",
  "name_ar": "عمر فيصل",
  "role": "employee",
  "employee_id": "EMP-009",
  "phone": "+964 770 901 2345"
}
```

**Post-creation SQL:**

```sql
UPDATE public.profiles
SET department_id = (SELECT id FROM public.departments WHERE name = 'Technical Department')
WHERE employee_id = 'EMP-009';
```

#### Layla Ibrahim — Marketing Department

**Metadata:**

```json
{
  "name": "Layla Ibrahim",
  "name_ar": "ليلى إبراهيم",
  "role": "employee",
  "employee_id": "EMP-010",
  "phone": "+964 770 012 3456"
}
```

**Post-creation SQL:**

```sql
UPDATE public.profiles
SET department_id = (SELECT id FROM public.departments WHERE name = 'Marketing Department')
WHERE employee_id = 'EMP-010';
```

#### Yusuf Tariq — Technical Department

**Metadata:**

```json
{
  "name": "Yusuf Tariq",
  "name_ar": "يوسف طارق",
  "role": "employee",
  "employee_id": "EMP-011",
  "phone": "+964 770 111 2222"
}
```

**Post-creation SQL:**

```sql
UPDATE public.profiles
SET department_id = (SELECT id FROM public.departments WHERE name = 'Technical Department')
WHERE employee_id = 'EMP-011';
```

#### Maryam Qasim — Finance Department

**Metadata:**

```json
{
  "name": "Maryam Qasim",
  "name_ar": "مريم قاسم",
  "role": "employee",
  "employee_id": "EMP-012",
  "phone": "+964 770 333 4444"
}
```

**Post-creation SQL:**

```sql
UPDATE public.profiles
SET department_id = (SELECT id FROM public.departments WHERE name = 'Finance Department')
WHERE employee_id = 'EMP-012';
```

### 4.3 Batch department assignment (all users at once)

If you created all demo users, you can run this single script to assign departments and managers in one go:

```sql
-- Assign departments to all profiles
UPDATE public.profiles SET department_id = (SELECT id FROM public.departments WHERE name = 'HR Department')        WHERE employee_id = 'EMP-001';
UPDATE public.profiles SET department_id = (SELECT id FROM public.departments WHERE name = 'News Department')      WHERE employee_id IN ('EMP-002', 'EMP-003', 'EMP-004');
UPDATE public.profiles SET department_id = (SELECT id FROM public.departments WHERE name = 'Technical Department') WHERE employee_id IN ('EMP-005', 'EMP-009', 'EMP-011');
UPDATE public.profiles SET department_id = (SELECT id FROM public.departments WHERE name = 'Marketing Department') WHERE employee_id IN ('EMP-006', 'EMP-010');
UPDATE public.profiles SET department_id = (SELECT id FROM public.departments WHERE name = 'Finance Department')   WHERE employee_id IN ('EMP-007', 'EMP-012');
UPDATE public.profiles SET department_id = (SELECT id FROM public.departments WHERE name = 'HR Department')        WHERE employee_id = 'EMP-008';

-- Assign department managers
UPDATE public.departments SET manager_uid = (SELECT id FROM public.profiles WHERE employee_id = 'EMP-002') WHERE name = 'News Department';
UPDATE public.departments SET manager_uid = (SELECT id FROM public.profiles WHERE employee_id = 'EMP-005') WHERE name = 'Technical Department';
UPDATE public.departments SET manager_uid = (SELECT id FROM public.profiles WHERE employee_id = 'EMP-006') WHERE name = 'Marketing Department';
UPDATE public.departments SET manager_uid = (SELECT id FROM public.profiles WHERE employee_id = 'EMP-007') WHERE name = 'Finance Department';
UPDATE public.departments SET manager_uid = (SELECT id FROM public.profiles WHERE employee_id = 'EMP-008') WHERE name = 'HR Department';
```

---

## 5. Test Credentials Summary

| Employee ID | Name            | Name (AR)       | Role     | Department | Email (suggested)     |
| ----------- | --------------- | --------------- | -------- | ---------- | --------------------- |
| EMP-001     | Ahmed Hassan    | أحمد حسن        | admin    | HR         | admin@alssaa.tv       |
| EMP-002     | Sara Ali        | سارة علي        | manager  | News       | sara@alssaa.tv        |
| EMP-003     | Mohammed Karim  | محمد كريم       | employee | News       | mohammed@alssaa.tv    |
| EMP-004     | Fatima Nouri    | فاطمة نوري      | employee | News       | fatima@alssaa.tv      |
| EMP-005     | Ali Mahmoud     | علي محمود       | manager  | Technical  | ali@alssaa.tv         |
| EMP-006     | Nour Saleh      | نور صالح        | manager  | Marketing  | nour@alssaa.tv        |
| EMP-007     | Hassan Jabbar   | حسن جبار        | manager  | Finance    | hassan.j@alssaa.tv    |
| EMP-008     | Zainab Ridha    | زينب رضا        | manager  | HR         | zainab@alssaa.tv      |
| EMP-009     | Omar Faisal     | عمر فيصل        | employee | Technical  | omar@alssaa.tv        |
| EMP-010     | Layla Ibrahim   | ليلى إبراهيم    | employee | Marketing  | layla@alssaa.tv       |
| EMP-011     | Yusuf Tariq     | يوسف طارق       | employee | Technical  | yusuf@alssaa.tv       |
| EMP-012     | Maryam Qasim    | مريم قاسم       | employee | Finance    | maryam@alssaa.tv      |

---

## 6. Supabase Auth Settings

Recommended settings in **Authentication → Settings**:

| Setting                          | Value                  |
| -------------------------------- | ---------------------- |
| Enable email confirmations       | ON for production      |
| Minimum password length          | 8                      |
| Site URL                         | Your deployed app URL  |
| Redirect URLs                    | Your app URL + `/*`    |

For **development/testing**, you may want to disable email confirmations so new users can sign in immediately, or use the "Auto Confirm User?" toggle when creating users via the dashboard.

For the **confirmation email template**, see [docs/SUPABASE_EMAIL.md](./SUPABASE_EMAIL.md).

---

## 7. Troubleshooting

### "Profile not created after adding user"

The `handle_new_user` trigger may have failed. Check:

```sql
-- Verify the trigger exists
SELECT tgname, tgrelid::regclass
FROM pg_trigger
WHERE tgname = 'on_auth_user_created';
```

If the trigger exists but the profile is missing, the attendance_policy table may be empty (the trigger reads it for leave balance defaults). Run the seed data first, then try again.

### "Permission denied" errors

RLS policies restrict access based on the user's role stored in `profiles.role`. Verify:

```sql
SELECT id, employee_id, role FROM public.profiles;
```

If the role is wrong, an admin can fix it:

```sql
UPDATE public.profiles SET role = 'admin' WHERE employee_id = 'EMP-001';
```

### "User can log in but sees no data"

The profile likely has no `department_id` assigned. Run the department assignment SQL from section 4.3.
