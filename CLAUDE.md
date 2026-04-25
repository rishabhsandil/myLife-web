# CLAUDE.md

Guidance for AI coding assistants (Claude Code, Copilot, etc.) working in this repository. Human contributors should also follow these practices.

---

## 1. Project Snapshot

**Almost Adult** — a mobile-first PWA for personal productivity (todos, shopping, workouts, notes, recipes, period tracking).

| Layer | Stack |
|-------|-------|
| Frontend | React 18 + TypeScript, Vite 7, React Router v6, react-icons, date-fns, @dnd-kit, Tiptap, react-swipeable |
| Backend | Vercel serverless functions (`/api`), Neon Postgres (`@neondatabase/serverless`) |
| Auth | JWT access token (15 min, in-memory) + refresh token (30 d, httpOnly cookie); bcrypt |
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
- `api.ts` and [src/utils/storage.ts](src/utils/storage.ts) overlap by design today: `api.ts` is the network primary; `storage.ts` is the **offline cache fallback** that the CRUD factory falls back to when the network fails. New endpoints should put network logic in `api.ts` and only mirror to `storage.ts` if the page must work offline. Document the strategy in the function's JSDoc.
- Every fetch path in `api.ts` is timeout-bounded via `AbortSignal.timeout` (default 15 s, AI calls 30 s). Pass an `AbortSignal` from the calling effect to also cancel on unmount.
- Always handle the failure path: surface to a user-visible toast via `useToast()` (see [src/components/Toast.tsx](src/components/Toast.tsx)). `catch { /* ignore */ }` and bare `console.error` are not acceptable in new code.

### 4.5 Backend (`api/`)

- Vercel Hobby caps the function count, so the single-handler pattern is intentional — but new endpoints should be added as **separate handler functions** in dedicated files (e.g., `api/handlers/todos.ts`) and dispatched from `api/index.ts` by route. Do not keep growing `api/index.ts` inline.
- Validate every input. Reuse [api/validators.ts](api/validators.ts) (`validateEmail`, `validatePassword`, `validateName`); the policies are mirrored on the client in [src/utils/validation.ts](src/utils/validation.ts). Keep the two in sync.
- Use parameterized SQL via the `sql` tag. **Never** interpolate user input into SQL strings.
- Default rows are seeded in `seedDefaultsForUser` at signup. Don't add new seed-on-GET handlers.
- Sequence multi-statement writes carefully (read-old → write → audit). Don't fire-and-forget audit inserts (`.catch(() => {})`).
- Always return JSON with a stable shape: `{ data }` or `{ success: true, ... }` on success, `{ error: string }` on failure, with appropriate HTTP status codes.

### 4.6 Authentication & Security

- Access token is a short-lived JWT (~15 min) held only in memory in [src/utils/authToken.ts](src/utils/authToken.ts). The long-lived refresh token lives in an httpOnly cookie scoped to `/api`. On boot and on any 401, the client calls `POST /api/auth/refresh` to mint a new access token; concurrent calls share a single in-flight refresh. Never reintroduce `localStorage`-backed auth tokens.
- Hash passwords with bcrypt at ≥10 rounds (current setting). Never log passwords or tokens.
- Verify the JWT on every protected endpoint and re-derive `userId` from the token, not from the request body.
- Sanitize HTML before rendering anything sourced from the user (notes/recipes via Tiptap). Inline base64 images are capped at `MAX_INLINE_IMAGE_BYTES`; prefer hosted URLs.
- Follow OWASP Top 10: input validation, parameterized queries, auth checks on every endpoint, rate limit auth routes when possible.

### 4.7 Styling & Mobile UX

- Mobile-first. Maintain iOS/Android safe-area handling already in `App.css`.
- Touch targets ≥44×44 px. Use existing CSS variables in [src/styles/global.css](src/styles/global.css) and [src/utils/theme.ts](src/utils/theme.ts) — do not introduce new color literals.
- Co-locate component CSS (`Foo.tsx` + `Foo.css`). Use BEM-ish class names; avoid inline styles except for dynamic values.
- Magic numbers (swipe thresholds, timeouts, breakpoints) live in [src/utils/constants.ts](src/utils/constants.ts). Add new ones there — do not hardcode them inline.

### 4.8 Accessibility

- Every interactive element must be a `<button>`, `<a>`, or have `role` + keyboard handlers.
- Provide `aria-label` for icon-only buttons.
- Modals must trap focus and close on `Esc` (verify when editing [src/components/Modal.tsx](src/components/Modal.tsx)).

### 4.9 Performance & Bundle

- Don't import whole icon packs. Import named icons from `react-icons/io5` and consider extracting a shared `icons.ts` registry once a page exceeds ~10 icon imports.
- Use `React.lazy` + `Suspense` for routes/modals that pull in heavy deps (Tiptap, AI helpers).
- Avoid re-fetching on every render — gate inside `useEffect` with stable deps.

### 4.10 Error Handling

- The routed app is wrapped in [`<ErrorBoundary>`](src/components/ErrorBoundary.tsx) at [src/main.tsx](src/main.tsx). Never let a render error blank the screen — if you add another root, wrap it.
- Surface API errors to the user via `useToast()` from [src/components/Toast.tsx](src/components/Toast.tsx). It is mounted globally inside `<ToastProvider>` and accessible from any component.
- Reserve `console.error` for genuinely unexpected logic errors. User-recoverable failures must show a toast.

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

The initial code-smell audit had 22 findings. The list below tracks what's done and what remains. When you touch one of these areas, prefer landing the refactor as a small, isolated step rather than expanding the smell.

### Done

- ✅ Magic numbers extracted → [src/utils/constants.ts](src/utils/constants.ts).
- ✅ Backend validators centralized → [api/validators.ts](api/validators.ts); client mirror in [src/utils/validation.ts](src/utils/validation.ts). Login/signup now use them.
- ✅ Client password policy now matches server (8+ chars, upper/lower/number).
- ✅ AI extract calls have a 30 s `AbortSignal.timeout`; default API calls 15 s.
- ✅ Tiptap inline base64 capped at `MAX_INLINE_IMAGE_BYTES` (≈2 MB); over-limit shows a toast.
- ✅ `<ErrorBoundary>` wraps the app; `<ToastProvider>` + `useToast()` available globally.
- ✅ `useAuthTransition` hook replaces fragile `useRef` user-id tracking in `App.tsx`.
- ✅ Default rows now seeded once at signup (`seedDefaultsForUser`); GET handlers no longer re-seed.
- ✅ Shopping audit insert is now properly awaited (no fire-and-forget `.catch(() => {})`).
- ✅ `api.ts` `createCrudApi.getAll(signal)` accepts an `AbortSignal`; `NotesPage.loadData` is the canonical pattern — propagate to other pages when you next touch them.
- ✅ `parseRecurrenceLabel(todo)` helper extracted in [src/pages/TodoPage.tsx](src/pages/TodoPage.tsx); inline title expression replaced.
- ✅ RecipePage's four sibling `useModal<Recipe>()` calls now bundled in [src/pages/recipe/useRecipeModals.ts](src/pages/recipe/useRecipeModals.ts) (`{ add, view, del, share }`).
- ✅ Shared icon registry at [src/utils/icons.ts](src/utils/icons.ts); `App.tsx`, `TodoPage`, `NotesPage`, `RecipePage`, `ShoppingPage`, `SettingsPage` now import icons from it. New icons go in the registry — do not add fresh `react-icons/io5` imports in pages over the ~10-icon threshold.
- ✅ `NotesPage` is `React.lazy`-loaded in [src/App.tsx](src/App.tsx) with a `<Suspense fallback={<LoadingScreen />}>`; Tiptap (~390 KB) is now in its own chunk and out of the initial bundle. The OpenAI client is server-side only (`api/index.ts`) and never reaches the browser.
- ✅ `ShoppingPage` mutations (save / toggle / delete / clear completed / reorder / store CRUD / unshare) are fully optimistic with revert-on-error + toast; the `isMutating` and `lastSyncTime` refs are gone and the polling loop no longer pauses on writes.
- ✅ Optimistic mutations rolled out to `TodoPage`, `NotesPage`, `RecipePage`, `WorkoutPage`, and `SettingsPage`; CRUD helpers in [src/utils/api.ts](src/utils/api.ts) now re-throw errors instead of swallowing them with `console.error` so callers can revert local state and surface a toast via `useToast()`.
- ✅ Auth tokens migrated off `localStorage`: short-lived access token in memory ([src/utils/authToken.ts](src/utils/authToken.ts)) + httpOnly refresh cookie issued by `/api/auth/login`, `/api/auth/signup`, and rotated by `/api/auth/refresh`; cleared by `/api/auth/logout`. `api.ts` retries any 401 once after a single-flight refresh.
- ✅ WorkoutPage session lifecycle consolidated into a `useReducer` state machine in [src/pages/workout/sessionReducer.ts](src/pages/workout/sessionReducer.ts) (`idle | active | summary`); replaces the scattered `activeSession`, `showingPlanDuringSession`, and post-finish `summaryModal` state.
- ✅ Initial-mount `loadData` in `TodoPage`, `RecipePage`, `ShoppingPage`, `WorkoutPage`, and `SettingsPage` now use the Notes `AbortController` pattern — effects abort on unmount, errors surface via `useToast()`, and `AbortError` is silently ignored. Non-CRUD getters in [src/utils/api.ts](src/utils/api.ts) (`getShoppingShareStatus`, `getShoppingAudit`, `getWorkoutSessions`, `getUserSettings`, `getConnections`, `getSharedRecipes`) accept an optional `AbortSignal` and propagate `AbortError`.
- ✅ Duplicated swipeable + sortable item pattern extracted into [`<SortableSwipeItem>`](src/components/SortableSwipeItem.tsx) (render-prop `children` exposes `dragHandleProps` + `isDragging`); `TodoPage`, `ShoppingPage`, `NotesPage`, `RecipePage`, `WorkoutHistory`, and `workout/SortableExerciseItem` now use it. Pass `id` to enable `@dnd-kit` sorting; omit it for swipe-only rows.

### Remaining (do as you go)

- `api/index.ts` (~1.3k LOC) → split into `api/handlers/<feature>.ts` and dispatch from `index.ts` by route.
- Page files (`TodoPage` 1.6k, `RecipePage` 1.2k, `ShoppingPage` 900, `WorkoutPage` 670, `NotesPage` 515) → extract sub-components per the `pages/workout/` pattern.
- `TodoItem` mega-interface (~20 optional fields) → split into `BasicTodo | RecurringTodo | AssignedTodo` discriminated union.
