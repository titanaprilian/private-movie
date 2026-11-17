# AGENTS.md (apps/web)

Vite + React + TanStack Router + Zustand. Extends the root `AGENTS.md`; on conflict, this file wins within `apps/web`.

## Internal module organization

The public seam (`index.ts`) and `internal/` privacy are fixed by the root rules. Inside `internal/`, scale structure with size:

- **Flat (≤5 files):** everything directly in `internal/`, no subdirectories.
- **Role-based (6–12 files):** group by technical role — `internal/components/`, `internal/hooks/`.
- **Sub-feature clusters (≥15 files):** group by domain sub-feature — `internal/sources/`, `internal/catalog/`. A cluster that itself grows past ~10–12 files gets role-based grouping inside it, with an optional cluster-local `index.ts` barrel (internal plumbing only, never imported from outside the module).
- **Colocation:** a hook or helper used by one sub-feature lives in that sub-feature's folder, never a shared top-level folder. Between tiers (13–14 files), pick either; don't churn layout over one file.

## State (Zustand)

- Feature stores live in the module's `internal/` and are never exported raw. Expose components or scoped hooks via `index.ts` instead.
- Truly global state (theme, routing) is rare and lives in `src/lib/` or `src/store/`, decoupled from feature modules.

## Routes

Files in `src/routes/` are thin composition roots: path definitions, loaders, and wiring of module `index.ts` exports. No business logic, complex local state, or styling beyond layout scaffolding.

## Design system

Read `apps/web/DESIGN.md` ("Structured Console") before touching UI. Tailwind utilities + CSS custom properties from `src/index.css`; headless shadcn/ui-pattern components in `src/components/ui/`.

- **Selects:** always Radix UI Select (`@/components/ui/select`), never native `<select>`. Use explicit non-empty sentinel values (`"all"`, `"none"`) and `SelectValue` placeholder for optional states.
- **Row/contextual actions:** always portaled Popovers (`@/components/ui/popover`). No inline `absolute` positioning or manual `fixed inset-0` dismissal overlays.
