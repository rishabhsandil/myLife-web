---
name: add-page-module
description: 'Add a new feature page (top-level tab) to the app. Use when the user asks to add a new module like "habits", "budget", "journal" etc. Covers routing in App.tsx, ModuleType, settings toggle, page folder structure, hooks, styles, and tab bar entry.'
---

# Add Page Module

Use this skill when adding a new top-level feature page (e.g., a new tab alongside Todos, Shopping, Workout).

## Pattern reference

Use [src/pages/workout/](../../../src/pages/workout/) as the reference: a top-level `WorkoutPage.tsx` plus a sibling folder with sub-components, helpers, and modals. Page files must stay ≤ 300 LOC.

## Steps

### 1. Register the module type

Edit [src/types/index.ts](../../../src/types/index.ts) and add the new key to the `ModuleType` union:

```ts
export type ModuleType = 'todos' | 'shopping' | 'workout' | 'notes' | 'recipes' | 'habits';
```

### 2. Create the page folder

```
src/pages/
  HabitsPage.tsx
  HabitsPage.css
  habits/
    HabitItem.tsx
    LogHabitModal.tsx
    helpers.ts
```

- `HabitsPage.tsx` is the route component. Keep it thin — orchestration only.
- Sub-components in `habits/` handle individual concerns.
- One `.css` file per component, co-located.

### 3. Wire routing in App.tsx

Open [src/App.tsx](../../../src/App.tsx) and:

- Import the new page.
- Add the tab entry in `allTabs` with active/inactive icons from `react-icons/io5`.
- Add a `<Route>` guarded by `enabledModules.includes('habits')`.
- Add the new module to `getDefaultRoute()` fallback chain.

### 4. Settings toggle

Open [src/pages/SettingsPage.tsx](../../../src/pages/SettingsPage.tsx). The module list is rendered from a config array — add the new module there with its label and icon. The user must be able to toggle it on/off (with the existing "at least one module" guard).

### 5. Data layer

- Add server endpoints via the **add-api-endpoint** skill.
- Add client wrappers in [src/utils/api.ts](../../../src/utils/api.ts).
- If the module needs offline cache, mirror it in [src/utils/storage.ts](../../../src/utils/storage.ts) and document the strategy in JSDoc.

### 6. Page implementation rules

- Use `useList` for the collection state. Don't roll your own `useState<Item[]>`.
- Use `useModal` for any add/edit/delete modal.
- Wrap data loads in `useEffect` with `AbortController`.
- Optimistic updates for toggle/reorder/delete. Revert on error and surface to toast.
- Reuse `<Modal>`, `<FAB>`, `<EmptyState>`, and `FormControls` from [src/components](../../../src/components/).
- Use theme variables from [src/utils/theme.ts](../../../src/utils/theme.ts) — no new color literals.
- Touch targets ≥ 44×44 px. Icon-only buttons need `aria-label`.

### 7. Validate

- `npm run build` must pass.
- Manually verify: tab appears when module is enabled, hides when disabled, default route logic works after login.

## Anti-patterns to avoid

- ❌ Inline `fetch` calls in the page
- ❌ Page file > 300 LOC (split into `habits/` sub-components)
- ❌ Duplicating swipe/sortable boilerplate (extract or reuse — see refactor backlog)
- ❌ New colors / spacings outside theme variables
- ❌ Missing settings toggle (every module is opt-in/out)
