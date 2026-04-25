# Architecture notes

Imported into Claude Code memory via `@.claude/memory/architecture.md` from `CLAUDE.md` when needed.

## Data flow

```
React page
  └── src/utils/api.ts (fetch + JWT header + AbortSignal)
        └── api/index.ts (single Vercel handler, dispatches by req.url)
              └── api/db.ts (sql tag → Neon Postgres)
```

Pages must not call `fetch` directly. `storage.ts` is for offline cache only.

## Auth flow

1. `AuthPage` → POST `/api/login` or `/api/signup`.
2. Server returns `{ token, user }`. Token is a 30-day JWT signed with `JWT_SECRET`.
3. Client stores token in `localStorage` (known limitation — see CLAUDE.md §4.6).
4. `AuthContext` hydrates `user` from token on mount.
5. `apiFetch` attaches `Authorization: Bearer <token>` to every request.
6. Each protected handler verifies JWT and re-derives `userId` from claims.

## Routing & module visibility

- Tabs are filtered by the user's `enabledModules` setting (loaded from `/api/settings`).
- Routes are conditionally registered in `App.tsx` based on the same array.
- Default route after login = first enabled module (in `getDefaultRoute()` order).
- Logout clears token and navigates to `/`.

## Critical invariants

- `enabledModules` must always contain at least one module (Settings UI enforces this).
- JWT verification happens **before** any DB query in protected handlers.
- All multi-row writes (update + audit) must be transactional.
- Optimistic UI mutations must have a revert path on error.
