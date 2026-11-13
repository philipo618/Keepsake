# Security Specification — Keepsake Digital Greeting Cards Platform

## 1. Data Invariants
1. Every document ID must pass `isValidId(id)` (`^[a-zA-Z0-9_\-]+$`, max 128 chars).
2. Admin privileges are strictly verified via `/admins/{uid}` existence or verified bootstrapped email `philipodickson96@gmail.com` with `request.auth.token.email_verified == true`.
3. User PII (`email`) is isolated in `/users/{userId}/private/info` and never exposed in public profiles or `greetings` documents.
4. Greeting documents (`greetings/{greetingId}`) enforce `creatorId == request.auth.uid` on creation and immutability of `creatorId` and `createdAt` on updates.
5. `greetings` list queries are strictly constrained to `isAdmin() || (isSignedIn() && resource.data.creatorId == request.auth.uid)` so no unauthenticated scraping of drafts or private links is possible.
6. Published greetings (`resource.data.status == 'published'`) are readable via `get` by direct unique ID only; drafts and unpublished greetings are readable only by their `creatorId` or an admin.
7. Verification answers (`greetings/{greetingId}/secrets/{secretId}`) are NEVER publicly readable; only the parent greeting's `creatorId` or an admin can read/write them, and recipients validate answers via the protected backend verification API.
8. Categories, templates, mediaLibrary, and platformSettings are admin-write only.
9. All `createdAt` and `updatedAt` timestamps must match `request.time`.

## 2. "Dirty Dozen" Adversarial Payloads
1. **Admin Spoof via Unverified Email**: User signs in with `email: "philipodickson96@gmail.com"`, `email_verified: false` and attempts to write `/platformSettings/global` -> MUST FAIL (`PERMISSION_DENIED`).
2. **Self-Admin Escalation**: Authenticated regular user attempts `setDoc(/admins/{myUid}, { role: "super_admin" })` -> MUST FAIL (`PERMISSION_DENIED`).
3. **Cross-User Draft Read/List**: User B attempts `list` on `/greetings` without filtering by `creatorId == userB.uid` -> MUST FAIL (`PERMISSION_DENIED`).
4. **Draft Hijacking**: User B attempts `get` or `update` on User A's draft `/greetings/g1` -> MUST FAIL (`PERMISSION_DENIED`).
5. **Published Greeting Tampering**: Anonymous or User B attempts `update` on User A's published `/greetings/g1` -> MUST FAIL (`PERMISSION_DENIED`).
6. **Secret Answer Extraction**: Recipient (unauthenticated or User B) attempts `get` on `/greetings/g1/secrets/verification` -> MUST FAIL (`PERMISSION_DENIED`).
7. **Shadow Field Injection**: Creator attempts to create `/greetings/g1` with extra ghost field `isAdminApproved: true` -> MUST FAIL (`PERMISSION_DENIED`).
8. **CreatorId Immutability Bypass**: Creator attempts `update` changing `creatorId` to another UID -> MUST FAIL (`PERMISSION_DENIED`).
9. **Timestamp Forgery**: Creator attempts `create` on `/greetings/g1` with backdated `createdAt` != `request.time` -> MUST FAIL (`PERMISSION_DENIED`).
10. **ID Poisoning / Resource Exhaustion**: Attacker attempts `create` on `/greetings/invalid$id..123` or 10KB `title` -> MUST FAIL (`PERMISSION_DENIED`).
11. **PII Leak**: User B attempts `get` on `/users/userA/private/info` -> MUST FAIL (`PERMISSION_DENIED`).
12. **Audit Log Tampering**: Regular user or creator attempts `delete` or `update` on `/activityLogs/log1` -> MUST FAIL (`PERMISSION_DENIED`).
