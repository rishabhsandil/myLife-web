# CLAUDE.md

Guidance for AI coding assistants (Claude Code, Copilot, etc.) working in this repository. Human contributors should also follow these practices.

---

## 1. Project Snapshot

**Almost Adult** — a mobile-first PWA for personal productivity (todos, shopping, workouts, notes, recipes, period tracking).

| Layer | Stack |
|-------|-------|
| Frontend | React 18 + TypeScript, Vite 7, React Router v6, react-icons, date-fns, @dnd-kit, Tiptap, react-swipeable |
| Backend | Vercel serverless functions (`/api`), Neon Postgres (`@neondatabase/serverless`) |
| Auth | JWT (30-day) + bcrypt; token in `localStorage` |
| State | React hooks + a single `AuthContext`; per-page local state |
| PWA | `vite-plugin-pwa`, `public/sw.js`, `public/manifest.json` |

Entry points: [src/main.tsx](src/main.tsx), [src/App.tsx](src/App.tsx), [api/index.ts](api/index.ts).

---

## 2. Commands

```bash
npm run dev      # Vite dev server
npm run build    # tsc && vite build (must pass before commit)
npm run preview  # serve production build
```

There is **no test runner, linter, or formatter configured**. Treat `tsc` (run via `npm run build`) as the only automated quality gate. When in doubt, run a build.

---

## 3. Repository Layout

```
api/                # Vercel serverless functions (single-handler pattern)
  index.ts          # Currently a monolith — see audit; route by req.url
  db.ts             # sql tag from @neondatabase/serverless
src/
  App.tsx           # Routing, splash, post-login redirect logic
  components/       # Shared UI: Modal, FAB, FormControls, EmptyState
  contexts/         # AuthContext only
  hooks/            # useList, useModal (prefer reusing before adding new)
  pages/            # One folder/file per feature module
    workout/        # Workout sub-components (good pattern to replicate)
  utils/            # api.ts (server calls), storage.ts (localStorage), theme.ts
  types/index.ts    # Shared TypeScript types
  styles/global.css # Variables, resets
public/             # Static assets, sw.js, manifest.json
```

**When adding a feature module**, follow the `pages/workout/` pattern: a top-level page file plus a sibling folder for sub-components and helpers.

---

## 4. Coding Practices

### 4.1 TypeScript

- `strict` is on — never disable. Don't use `any`; prefer `unknown` + narrowing, or define a type in [src/types/index.ts](src/types/index.ts).
- Treat data crossing the network/`localStorage` boundary as `unknown` and validate before use. For complex shapes, prefer **discriminated unions** over a single interface with many optional fields (e.g., `TodoItem` should evolve toward `BasicTodo | RecurringTodo | AssignedTodo`).
- Don't use non-null assertions (`!`) for values that come from the network or storage.
- Export types alongside code that owns them; share via `src/types/index.ts` only when reused across pages.

### 4.2 React

- Function components + hooks only. No class components.
- Keep components focused. **Page files should not exceed ~300 LOC** — extract sub-components into a sibling folder (see `pages/workout/`).
- Hooks rules: stable dependency arrays; do **not** silence the exhaustive-deps lint without a comment explaining why.
- Avoid `useRef` for derived state. If you need to react to a value change, use `useEffect` with the value in deps.
- Memoize expensive computations with `useMemo`; memoize callbacks passed to memoized children with `useCallback`. Don't memoize prematurely.
- Async work in effects must be cancellable:
  ```ts
  useEffect(() => {
    const ac = new AbortController();
    void load(ac.signal);
    return () => ac.abort();
  }, [deps]);
  ```
- When local state mirrors props/server data that arrives later, add a **sync `useEffect`** so the local copy stays in step. Compare sorted copies — never mutate arrays from state/props with `.sort()`, `.reverse()`, `.splice()`.

### 4.3 State Management

- Prefer existing hooks: `useList` for collection state, `useModal` for open/close + payload. Extend them rather than reinventing per page.
- Optimistic updates are the default for user-driven mutations (toggle, reorder, delete): update local state first, revert on error, surface the error.
- Avoid prop drilling beyond 2 levels — promote to a hook or a context. Keep contexts narrow (auth-only is intentional).

### 4.4 Data Layer & API Calls

- All server calls go through [src/utils/api.ts](src/utils/api.ts). Pages must not call `fetch` directly.
- `api.ts` and [src/utils/storage.ts](src/utils/storage.ts) overlap — when adding new endpoints, put network logic in `api.ts` and only fall back to `storage.ts` for offline cache. Document the strategy in the function's JSDoc.
- Always handle the failure path: pass the error to a user-visible surface (toast / inline message). `catch { /* ignore */ }` and bare `console.error` are not acceptable in new code.
- Use `AbortController` and pass `signal` through to `fetch`. Add a sensible client-side timeout (10–15 s) for AI/long calls.

### 4.5 Backend (`api/`)

- Vercel Hobby caps the function count, so the single-handler pattern is intentional — but new endpoints should be added as **separate handler functions** in dedicated files (e.g., `api/handlers/todos.ts`) and dispatched from `api/index.ts` by route. Do not keep growing `api/index.ts` inline.
- Validate every input (`email`, `password`, IDs, body shape). Centralize reusable validators (e.g., `validateEmail`, `validatePassword`) — keep client and server policies in sync.
- Use parameterized SQL via the `sql` tag. **Never** interpolate user input into SQL strings.
- Don't seed defaults on every GET. Seed once on signup or via an explicit init endpoint.
- Wrap multi-statement writes (update + audit log) in a transaction; do not fire-and-forget audit inserts.
- Always return JSON with a stable shape: `{ data }` on success, `{ error: string }` on failure, with appropriate HTTP status codes.

### 4.6 Authentication & Security

- JWT lives in `localStorage` today; treat it as a known limitation. When touching auth, prefer moving toward **short-lived access token in memory + refresh token in httpOnly cookie**.
- Hash passwords with bcrypt at ≥10 rounds (current setting). Never log passwords or tokens.
- Verify the JWT on every protected endpoint and re-derive `userId` from the token, not from the request body.
- Sanitize HTML before rendering anything sourced from the user (notes/recipes via Tiptap). Limit/disable base64 images inline; prefer hosted URLs.
- Follow OWASP Top 10: input validation, parameterized queries, auth checks on every endpoint, rate limit auth routes when possible.

### 4.7 Styling & Mobile UX

- Mobile-first. Maintain iOS/Android safe-area handling already in `App.css`.
- Touch targets ≥44×44 px. Use existing CSS variables in [src/styles/global.css](src/styles/global.css) and [src/utils/theme.ts](src/utils/theme.ts) — do not introduce new color literals.
- Co-locate component CSS (`Foo.tsx` + `Foo.css`). Use BEM-ish class names; avoid inline styles except for dynamic values.
- Magic numbers (swipe thresholds, timeouts, breakpoints) belong in a shared constants file, not inline.

### 4.8 Accessibility

- Every interactive element must be a `<button>`, `<a>`, or have `role` + keyboard handlers.
- Provide `aria-label` for icon-only buttons.
- Modals must trap focus and close on `Esc` (verify when editing [src/components/Modal.tsx](src/components/Modal.tsx)).

### 4.9 Performance & Bundle

- Don't import whole icon packs. Import named icons from `react-icons/io5` and consider extracting a shared `icons.ts` registry once a page exceeds ~10 icon imports.
- Use `React.lazy` + `Suspense` for routes/modals that pull in heavy deps (Tiptap, AI helpers).
- Avoid re-fetching on every render — gate inside `useEffect` with stable deps.

### 4.10 Error Handling

- Wrap the routed app in an error boundary; never let a render error blank the screen.
- Surface API errors to the user via a single toast/notification mechanism. Add this once and reuse — don't roll per page.

### 4.11 Git / PR Hygiene

- Conventional-style commit messages (`feat:`, `fix:`, `refactor:`, `chore:`).
- One concern per PR. If a refactor is mixed with a feature, split it.
- Always run `npm run build` before committing. Fix all `tsc` errors, do not suppress with `// @ts-ignore`.
- Do not commit `.env`, secrets, or generated `dist/`.

---

## 5. Doing Things Right (Workflow for AI Agents)

1. **Read before writing.** Open the file you're editing and at least one neighboring file in the same module to match conventions.
2. **Reuse first.** Before adding a hook, component, or util, search `src/hooks`, `src/components`, `src/utils`.
3. **Match existing patterns.** Modals → `useModal` + `<Modal>`. Lists → `useList`. API calls → `utils/api.ts`. CSS → sibling `.css` file using global variables.
4. **Stay in scope.** Only change what the task requires. Don't reformat, don't rename, don't "improve" unrelated code. Note unrelated smells in the PR description instead.
5. **Validate.** Run `npm run build`. If you touched `api/`, manually verify the route still parses inputs correctly.
6. **Document non-obvious decisions** with a short comment — especially around React effect timing, optimistic updates, and auth.

---

## 6. Known Smells / Refactor Backlog

The audit in [docs or PR description] tracks larger refactors. Highlights:

- `api/index.ts` (~1.4k LOC) → split by feature.
- Page files (`TodoPage`, `ShoppingPage`, `RecipePage`, `WorkoutPage`) > 600 LOC each → extract sub-components and modals.
- Duplicated swipeable + sortable item pattern across pages → extract `<SortableSwipeItem>`.
- Inconsistent error handling → centralize via toast/error boundary.
- `api.ts` vs `storage.ts` overlap → define an explicit offline-first contract.
- Auth token in `localStorage` → migrate to refresh-token pattern.
- `TodoItem` mega-interface → discriminated unions.

When you touch one of these areas, prefer landing the refactor as a small, isolated step rather than expanding the smell.
