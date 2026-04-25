---
name: add-api-endpoint
description: 'Add a new endpoint to the Vercel serverless backend in api/index.ts. Use when the user asks to add a new route, CRUD operation, or backend handler. Covers routing, JWT auth, input validation, parameterized SQL, error envelope, and the matching client function in src/utils/api.ts.'
---

# Add API Endpoint

Use this skill when adding a new backend route to `api/index.ts` and its client wrapper in `src/utils/api.ts`.

## Why this exists

The Vercel Hobby plan caps function count, so all routes live in a single `api/index.ts` handler that dispatches by `req.url`. This skill keeps new endpoints consistent with that pattern until the file is split (see `CLAUDE.md §6`).

## Steps

### 1. Locate the dispatcher

Open [api/index.ts](../../../api/index.ts). Find the `switch` / `if` chain that routes by `req.url`. Add your new route in the same style as existing ones.

### 2. Write the handler

Each handler must:

- **Verify JWT first.** Reuse the existing `verifyAuth(req)` helper (or whatever the file already calls it). Re-derive `userId` from the token — never trust `req.body.userId`.
- **Validate input.** Reuse `validateEmail` / `validatePassword` if present. For new validators, add them near the existing ones. Reject early with `res.status(400).json({ error: '...' })`.
- **Use parameterized SQL.** Always use the `sql` tagged template from [api/db.ts](../../../api/db.ts). Never string-concatenate user input.
- **Wrap multi-statement writes** (update + audit) in a transaction. Don't fire-and-forget audit inserts.
- **Return a stable envelope:** `{ data }` on success, `{ error: string }` on failure.

### 3. Handler skeleton

```ts
async function handleThing(req: VercelRequest, res: VercelResponse) {
  const auth = verifyAuth(req);
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });

  if (req.method === 'GET') {
    const rows = await sql`SELECT * FROM things WHERE user_id = ${auth.userId} ORDER BY created_at DESC`;
    return res.status(200).json({ data: rows });
  }

  if (req.method === 'POST') {
    const { name } = req.body ?? {};
    if (typeof name !== 'string' || name.length === 0 || name.length > 200) {
      return res.status(400).json({ error: 'Invalid name' });
    }
    const [row] = await sql`
      INSERT INTO things (user_id, name) VALUES (${auth.userId}, ${name}) RETURNING *
    `;
    return res.status(201).json({ data: row });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
```

### 4. Add the client wrapper

Open [src/utils/api.ts](../../../src/utils/api.ts) and add a function alongside existing ones:

```ts
export async function getThings(signal?: AbortSignal): Promise<Thing[]> {
  const res = await apiFetch('/api/things', { method: 'GET', signal });
  if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to load things');
  return (await res.json()).data;
}
```

- Pass `signal` through to `fetch` so callers can cancel.
- Throw on non-2xx so the page can `try/catch` and surface a toast.
- Add the response type to [src/types/index.ts](../../../src/types/index.ts) if shared.

### 5. Update the page

Page must:

- Use `AbortController` in the `useEffect` and abort on cleanup.
- Show user-visible error state (no bare `console.error`).
- Optimistically update local state for mutations; revert on throw.

### 6. Validate

Run `npm run build`. Fix any `tsc` errors. Manually hit the route via the dev server to confirm 200/400/401 paths.

## Anti-patterns to avoid

- ❌ `userId` from `req.body`
- ❌ String-concatenated SQL
- ❌ Seeding default rows on every GET (do it on signup)
- ❌ `.catch(() => {})` on writes
- ❌ Calling `fetch` directly from a page component
