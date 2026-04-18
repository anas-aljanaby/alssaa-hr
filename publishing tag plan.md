**Implement the Publishing Tag Feature**

Add a "publishing tag" feature to the HR app. This is a claimable slot — one user holds it at a time, they self-claim it, and the whole org can see who holds it. Follow the existing codebase conventions throughout.

---

**Database (Supabase)**

Create a table `publishing_tag_holders`:
- `id` (uuid, pk)
- `org_id` (uuid, FK → organizations)
- `user_id` (uuid, FK → profiles, nullable — null means unclaimed)
- `claimed_at` (timestamptz, nullable)
- `released_at` (timestamptz, nullable)
- `force_released_by` (uuid, FK → profiles, nullable — set when admin force-releases)
- `force_released_at` (timestamptz, nullable)

Only one row per org should be active at a time. Add a unique partial index on `org_id` where `user_id IS NOT NULL`.

---

**Service Layer**

Create `src/lib/services/publishing-tag.service.ts` following the pattern of `requests.service.ts`. Export these functions:

```ts
getPublishingTagHolder(orgId: string): Promise<PublishingTagHolder | null>
claimPublishingTag(orgId: string, userId: string): Promise<void>
releasePublishingTag(orgId: string, userId: string): Promise<void>
forceReleasePublishingTag(orgId: string, adminId: string): Promise<void>  // logs who did it
```

Export types `PublishingTagHolder` and `PublishingTagClaimStatus`.

Log `forceReleasePublishingTag` calls to the existing `audit.service.ts`.

---

**UI — Arabic labels**

| Key | Arabic |
|---|---|
| Feature name | وسم الناشر |
| Claim action button | أخذ وسم الناشر |
| Release action button | التنازل عن الوسم |
| Current holder label |  الناشر الحالي |
| Unclaimed state | لا يوجد ناشر معين حالياً |
| Admin force-release button | إلغاء الوسم |

---

**Employee side**

In `EmployeeDashboard.tsx`, add a card that shows:
- Who currently holds the tag (name + avatar)
- If unclaimed, show "لا يوجد ناشر حالياً"
- If the current user doesn't hold it → show **أخذ وسم الناشر** button (disabled if someone else holds it)
- If the current user holds it → show **التنازل عن الوسم** button

---

**Admin side**

In `UsersPage.tsx` (or a dedicated section in `AdminDashboard.tsx`), add a read-only panel showing the current tag holder across the org. Add a **إلغاء الوسم** button visible only to admins, which calls `forceReleasePublishingTag()`. Confirm before executing. Show the `force_released_by` info in the audit trail on `UserDetailsPage.tsx`.

---

**Routing**

No new page is needed — surface it as a card/section on existing pages as described above.

---

**Conventions to follow**
- Use the existing `useAuth` context for `orgId` and `userId`
- Use `toast` (sonner) for success/error feedback
- Follow the `*.service.ts` pattern for all DB calls
- All user-facing strings in Arabic