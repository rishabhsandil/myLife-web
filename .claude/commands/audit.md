---
description: Run a focused code-smell audit on the changed files (or a specified path).
argument-hint: '[optional path or glob]'
---

# /audit

Audit the target ($ARGUMENTS, defaulting to `git diff --name-only main...HEAD`) against the conventions in [CLAUDE.md](../../CLAUDE.md).

For each file, check:

1. **TypeScript** — no `any`, no `!` non-null on network/storage data, types live in the right place.
2. **React** — page files ≤ 300 LOC, async effects use `AbortController`, no array mutation on state/props, no `useRef` masking derived state.
3. **State** — uses `useList` / `useModal` where applicable; mutations are optimistic with revert-on-error.
4. **Data layer** — pages don't call `fetch` directly; errors surface to the user (no silent `console.error`).
5. **Backend (`api/`)** — input validated, parameterized SQL only, JWT verified per request, no fire-and-forget audit writes.
6. **Security** — no secret/token logging, sanitized HTML for user content, OWASP Top 10 sanity check.
7. **Styling/a11y** — uses theme variables, ≥44px touch targets, icon-only buttons have `aria-label`.
8. **Bundle** — no whole-pack icon imports, heavy deps lazy-loaded.

Output a prioritized list (High / Medium / Low) with file + approximate line range and a concrete fix. Do **not** modify code unless explicitly asked.
