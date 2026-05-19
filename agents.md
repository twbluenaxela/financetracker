# agents.md — Household Members & Settings

Supplementary reference for AI agents working on the household members section of financetracker. Read alongside `CLAUDE.md`.

---

## Schema: `HouseholdMember`

```prisma
model HouseholdMember {
  householdId Int      @map("household_id")
  firebaseUid String   @map("firebase_uid") @db.VarChar(128)
  role        String   @default("member") @db.VarChar(10)    // "owner" | "member"
  canEdit     Boolean  @default(false) @map("can_edit")
  displayName String?  @map("display_name") @db.VarChar(50)  // nullable; null = show truncated UID
  photoUrl    String?  @map("photo_url")                     // TEXT; base64 data URL or remote URL
  joinedAt    DateTime @default(now()) @map("joined_at") @db.Timestamptz(6)

  @@id([householdId, firebaseUid])
  @@map("household_members")
}
```

Composite PK is `(householdId, firebaseUid)`. All queries must scope by `householdId`.

---

## `SessionUser` fields added by this feature

`lib/household.ts` → `getOrCreateHousehold` selects `displayName` and `photoUrl` and returns them as part of `HouseholdMembership`.

`lib/auth.ts` → `getSessionUser` builds `SessionUser` with:
- `displayName` — from DB `HouseholdMember.displayName`
- `photoURL` — `membership.photoUrl ?? decoded.picture ?? null` (DB custom photo wins over Firebase/Google photo)

Both `lib/auth.ts` and `components/app-shell.tsx` export a `SessionUser` type — they must stay in sync.

---

## Sidebar

`components/sidebar.tsx` resolves the display name in priority order:
1. `user.displayName` (DB custom name)
2. `user.name` (Firebase Auth display name, e.g. from Google sign-in)
3. Email handle (everything before `@`)

The `Avatar` component renders `<img src={user.photoURL}>` (with `objectFit: cover`) when a photo is set, otherwise a letter-initial `<div>`. The `.avatar` CSS class handles size (30×30px), border-radius, and border for both elements.

---

## API: `PATCH /api/household/members/[uid]`

**Auth:** session cookie required.

**Body** (at least one field required):
```ts
{
  canEdit?: boolean;
  displayName?: string | null;  // empty string coerced to null; max 50 chars
  photoUrl?: string | null;     // base64 data URL or remote URL; empty string coerced to null
}
```

**Permission matrix:**

| Field | Own record | Other member's record |
|-------|------------|----------------------|
| `displayName` | ✅ any role | ✅ owner only |
| `photoUrl` | ✅ any role | ✅ owner only |
| `canEdit` | ❌ `cannot_modify_self` | ✅ owner only |

Non-owners targeting another member's `uid` → 403 `forbidden`.

**Response:** `{ ok: true }`

### `DELETE /api/household/members/[uid]`

Owner-only. Cannot remove self → 400 `cannot_remove_self`.

---

## Settings Page

**Server component:** `app/(protected)/settings/page.tsx`
- Fetches household + members; maps `displayName` and `photoUrl` into the props array.

**Client component:** `app/settings/settings-view.tsx`

`MemberRow` renders one row per member:

| Column | Content |
|--------|---------|
| Avatar (leftmost) | 32×32 circle; shows `photoUrl` image or letter initial. Hovering reveals a camera-icon overlay. Clicking opens a hidden `<input type="file">`. |
| Name | `displayName` (bold) or truncated UID. "我" chip for current user. "改名" inline edit button (visible to owner or self). |
| Role | 擁有者 / 可編輯 / 僅檢視 chip. |
| Joined | Formatted date. |
| Actions | 改為僅檢視 / 允許編輯 + 移除 buttons — owner only, never on own row. |

**Photo upload flow (client-side):**
1. User selects a file via the hidden `<input type="file">`.
2. `resizeToDataUrl(file)` draws the image onto a 64×64 canvas (centre-crop) and returns a JPEG data URL at 0.85 quality (~3–5 KB).
3. `PATCH /api/household/members/[uid]` is called with `{ photoUrl: dataUrl }`.
4. On success, local state is updated — sidebar reflects the change on next navigation (full page reload or re-login).

> The sidebar reads `photoURL` from the server-rendered `SessionUser`. It won't update mid-session without a page reload after saving. This is acceptable — the settings page itself shows the new photo immediately via local state.

---

## UI Behaviour Summary

| Condition | Name display | Photo display | Edit controls |
|-----------|-------------|---------------|---------------|
| `displayName` set | Bold custom name | Photo or initial | "改名" (owner or self) |
| `displayName` null | Truncated UID | Photo or initial | "改名" (owner or self) |
| Current user's row | + "我" chip | Camera overlay on hover | Always shown |
| Non-owner, other member | Read-only | Read-only | — |

---

## Adding Future Member Fields

1. Add nullable column to `HouseholdMember` in `prisma/schema.prisma`
2. `npx dotenv-cli -e .env.local -- npx prisma db push` to sync Neon
3. Add field to `HouseholdMembership` in `lib/household.ts` and select it
4. Add field to `SessionUser` in both `lib/auth.ts` and `components/app-shell.tsx`
5. Extend the Zod schema in the PATCH route
6. Pass the new field from the server page → `SettingsView` → `MemberRow`
