# Project Panels Navigation (Concise Hierarchy)

## Project Brief
`alssaa-hr` is a role-based HR attendance web app for attendance tracking, requests, team monitoring, and admin operations (users, departments, reports).  
This file documents the **Admin**, **Manager**, and **Employee** panels as parent-child navigation trees.

## Admin Navigation Tree (with reach path)

- **Bottom Navbar (top level)**
  - **`الرئيسية` (`/`)**  
    Reach: tap `الرئيسية` in bottom navbar.
    - **Tab: `نظرة عامة`**
      - Today summary cards (present/late/absent/on leave), pending requests preview, top employee status list.
    - **Tab: `التحليلات`**
      - Attendance charts (distribution, trend, department comparison).

  - **`المستخدمون` (`/users`)**  
    Reach: tap `المستخدمون` in bottom navbar.
    - Main content: user search, role filters, role counters, paginated list, add-user modal, quick edit.
    - **`تفاصيل الموظف` (`/user-details/:userId`)**  
      Reach: from `المستخدمون`, tap any user card.
      - Extra admin actions on this page: edit profile, audit log modal, delete user (when allowed).
      - **Tab: `نظرة عامة`**
        - Profile snapshot, today status, all-time summary cards, leave balance snapshot.
      - **Tab: `الحضور`**
        - Work schedule, attendance history, all-time/range switch, status filters, export.
      - **Tab: `الإجازات`**
        - Annual/sick leave balances and leave history, plus admin leave-balance editing.
      - **Tab: `الطلبات`**
        - Full request history with status filter.

  - **`الموافقات` (`/approvals`)**  
    Reach: tap `الموافقات` in bottom navbar.
    - Unified queue for leave + overtime requests across the org.
    - Filter set 1: status (`pending`, `approved`, `rejected`, `all`).
    - Filter set 2: type (`all`, leave-related, overtime).
    - Approve/reject modal with optional decision note.

  - **`حضور الفريق` (`/team-attendance`)**  
    Reach: tap `حضور الفريق` in bottom navbar.
    - Department selector (single department or all).
    - Detailed daily attendance view for admin (date controls, summary cards, status filters, user rows).
    - **`تفاصيل اليوم` sheet**
      Reach: from `حضور الفريق`, tap a user row.
      - Shows deeper per-day attendance details for that user.

  - **`المزيد` (`/more`)**  
    Reach: tap `المزيد` in bottom navbar.
    - Main content: profile card, account/support/system/report shortcuts, logout.
    - **`التقارير` (`/reports`)**  
      Reach: from `المزيد` -> section `التقارير` -> `تقارير الحضور`.
      - Department attendance-rate chart, monthly employee report table, Excel/PDF export.
    - **`الأقسام` (`/departments`)**  
      Reach: from `المزيد` -> section `إدارة النظام` -> `إدارة الأقسام`.
      - Department list with search/filter/pagination.
      - Create/edit/delete department and attach/detach members.
      - Expand department card to view members inline.
      - **`تفاصيل القسم` (`/departments/:deptId`)**  
        Reach: from `الأقسام`, tap a department name.
        - Department metadata (name/manager/member count), member list, edit/remove/delete actions.
    - **`تغيير المدير العام` (`/transfer-general-manager`)**  
      Reach: from `المزيد` -> section `إدارة النظام` -> `تغيير المدير العام`.
      - Shows current GM and allows selecting + confirming a new GM.
    - **`تسجيل الحضور` (`/attendance`)**  
      Reach: from `المزيد` -> section `إدارة النظام` -> `تسجيل الحضور`.
      - Monthly calendar + attendance sessions list with status/date filtering.

## Manager Navigation Tree (with reach path)

- **Bottom Navbar (top level)**
  - **`الرئيسية` (`/`)**  
    Reach: tap `الرئيسية` in bottom navbar.
    - Main content: manager dashboard header + quick punch card.
    - **Tab: `نظرة عامة`**
      - Team daily summary cards, pending requests preview, top team employee list.
    - **Tab: `التحليلات`**
      - Team attendance charts (no cross-org admin-level scope).

  - **`الحضور` (`/attendance`)**  
    Reach: tap `الحضور` in bottom navbar.
    - Monthly attendance calendar + sessions list for the manager account.
    - Status filters and date-level drill-down.

  - **`الموافقات` (`/approvals`)**  
    Reach: tap `الموافقات` in bottom navbar.
    - Same page structure as admin, but scoped to the manager's department.
    - Filter set 1: status (`pending`, `approved`, `rejected`, `all`).
    - Filter set 2: type (`all`, leave-related, overtime).
    - Approve/reject modal with optional decision note.
    - **`تفاصيل الموظف` (`/user-details/:userId`)**  
      Reach: from `الموافقات`, tap a request's employee.
      - Manager sees employee details tabs (profile, attendance, leaves, requests).

  - **`حضور الفريق` (`/team-attendance`)**  
    Reach: tap `حضور الفريق` in bottom navbar.
    - Department selector.
    - If selected department is manager's own department: detailed attendance mode.
    - If selected department is another department: availability-only mode (no detailed punch times).
    - **`تفاصيل اليوم` sheet**
      Reach: from detailed mode, tap a user row.
      - Shows deeper per-day attendance details for that user.

  - **`المزيد` (`/more`)**  
    Reach: tap `المزيد` in bottom navbar.
    - Main content: profile card, account/support/management/report shortcuts, logout.
    - **`الملف الشخصي` (`/user-details/:currentUserId`)**  
      Reach: from `المزيد` -> section `الحساب` -> `الملف الشخصي`.
      - Personal details page with the same tabbed structure.
    - **`طلباتي` (`/requests`)**  
      Reach: from `المزيد` -> section `الحساب` -> `طلباتي` (also shown in management section).
      - Manager's own requests list and statuses.
    - **`الأقسام` (`/departments`)**  
      Reach: from `المزيد` -> section `الإدارة` -> `إدارة الأقسام`.
      - Departments list and details browsing.
      - Manager permissions are limited compared to admin.
      - **`تفاصيل القسم` (`/departments/:deptId`)**  
        Reach: from `الأقسام`, tap a department name.
        - Department metadata and members list view.
    - **`التقارير` (`/reports`)**  
      Reach: from `المزيد` -> section `التقارير` -> `تقارير الحضور`.
      - Reports page scoped to manager context (department-level data).

## Employee Navigation Tree (with reach path)

- **Bottom Navbar (top level)**
  - **`الرئيسية` (`/`)**  
    Reach: tap `الرئيسية` in bottom navbar.
    - Main content: personal dashboard (today status, quick punch, monthly stats, leave balance).
    - Request snapshots: pending requests and upcoming approved leaves.
    - **`تفاصيل الموظف` (`/user-details/:currentUserId`)**  
      Reach: from `الرئيسية`, tap profile avatar/header.
      - Personal details page with the same tabbed structure (overview, attendance, leaves, requests).

  - **`الحضور` (`/attendance`)**  
    Reach: tap `الحضور` in bottom navbar.
    - Monthly attendance calendar + sessions list.
    - Status filters and date-level drill-down.

  - **`الطلبات` (`/requests`)**  
    Reach: tap `الطلبات` in bottom navbar.
    - Requests list (leave + overtime) with status filters and pagination.
    - **`طلب جديد` modal**
      Reach: from `الطلبات`, tap floating `طلب جديد` button.
      - Create request form (type/date/time/note/attachment).

  - **`حضور الفريق` (`/team-attendance`)**  
    Reach: tap `حضور الفريق` in bottom navbar.
    - Availability-only team view for privacy (no detailed punch times).
    - Department selector + availability status cards/list.

  - **`المزيد` (`/more`)**  
    Reach: tap `المزيد` in bottom navbar.
    - Main content: profile card, account/support shortcuts, logout.
    - **`الملف الشخصي` (`/user-details/:currentUserId`)**  
      Reach: from `المزيد` -> section `الحساب` -> `الملف الشخصي`.
      - Personal details/tabs page.
    - **`الأمان والخصوصية` (`/security-privacy`)**  
      Reach: from `المزيد` -> section `الحساب` -> `الأمان والخصوصية`.
      - Change password form + privacy information.
    - **`سياسة الحضور` (`/attendance-policy`)**  
      Reach: from `المزيد` -> section `الدعم` -> `سياسة الحضور`.
      - Organization attendance policy details and classification rules.
    - **`الشروط والأحكام` (`/terms-conditions`)**  
      Reach: from `المزيد` -> section `الدعم` -> `الشروط والأحكام`.
      - Terms and conditions reference page.
