# DESIGN.md — Chunky UI Design System

Design system specification for the Private Movie streaming application. This document is the **single source of truth** for all UI styling, component tokens, and interactions. All agent code generation must strictly conform to these rules.

---

## 1. Core Rule for All UI Work

> **Mandatory Chunky UI Policy:**
> 1. **Always use the Chunky UI primitives** (`@/components/ui/chunky-*`) for any new feature, page, modal, or refactored view.
> 2. **Never introduce legacy flat / raw shadcn components** (`button.tsx`, `dialog.tsx`, `input.tsx`, `checkbox.tsx`, `select.tsx`, raw `<input>`, raw `<textarea>`).
> 3. **If a needed component does not yet exist in chunky style**: You **must build the chunky component first** in `apps/web/src/components/ui/` (following the 3D border geometry, theme tokens, and accessible headless Radix pattern) before consuming it in features.

---

## 2. Stack & Architecture

- **Framework**: TanStack React, Vite bundler.
- **Styling**: Tailwind CSS utility classes + CSS Custom Properties for theme tokens.
- **Component Pattern**: Headless Radix UI primitives wrapped in tactile, chunky components in `@/components/ui/`.
- **Typography**:
  - **Headings & Display**: `font-display` / `font-baloo` -> `'Baloo 2', cursive, sans-serif` (weights 600, 700, 800).
  - **Body, UI & Meta**: `font-sans` / `font-nunito` -> `'Nunito', sans-serif` (weights 400, 600, 700, 800).
  - **Code & Identifiers**: `mono` -> `'JetBrains Mono', monospace`.
- **Icons**: Lucide icons (`lucide-react`), 2px stroke, `currentColor`.

---

## 3. Design Language: "Duolingo-Inspired Chunky UI"

The interface rejects flat, sterile dashboards in favor of a punchy, tactile, gamified visual language:

- **Tactile 3D Buttons & Controls**: Thick 3D bottom bevels (`border-2 border-b-4`) that physically depress on click (`active:translate-y-[2px] active:border-b-2`).
- **Generous Corner Radii**: Curving geometry (`rounded-2xl` 16px, `rounded-[20px]`, `rounded-[24px]`, `rounded-full` 9999px). Sharp `rounded-none`, `rounded-sm`, or `rounded-md` are prohibited.
- **High-Contrast Border Definition**: Crisp 2px borders (`border-2`) using `var(--border)` and `var(--border-strong)`.
- **Vibrant Gamified Accents**: Duolingo brand palette (Feather Green `#58cc02`, Sky Blue `#1cb0f6`, Canary Yellow/Gold `#ffc800`, Vivid Purple `#ce82ff`, Coral Red `#ff4b4b`).

---

## 4. Color Tokens & CSS Variables

Tokens are declared on `:root` and overridden under `.dark`.

```css
:root {
  /* Canvas & Surfaces */
  --bg: #f7f9fa;
  --surface: #ffffff;
  --surface-raised: #f0f2f5;
  --ink: #131417;
  --muted: #6b7280;
  --border: #e5e7eb;
  --border-strong: #d1d5db;

  /* Duolingo Brand Palette */
  --green: #58cc02;
  --green-dark: #46a302;
  --green-soft: rgba(88, 204, 2, 0.15);
  --blue: #1cb0f6;
  --blue-dark: #1899d6;
  --blue-soft: rgba(28, 176, 246, 0.15);
  --purple: #ce82ff;
  --purple-dark: #a568cc;
  --yellow: #ffc800;
  --yellow-dark: #e6a800;
  --red: #ff4b4b;
  --red-dark: #e63e3e;
  --gold: #ffc800;
  --gold-dark: #e5a600;
  --gold-tint: #2b2a14;
  --gold-tint-hover: #363415;
}

.dark {
  /* Canvas & Surfaces (Duolingo slate-teal) */
  --bg: #131f24;
  --surface: #202f36;
  --surface-raised: #2b3d46;
  --ink: #f2f2ef;
  --muted: #9a9a93;
  --border: #37464f;
  --border-strong: #4e616c;

  /* Duolingo Brand Palette */
  --green: #58cc02;
  --green-dark: #46a302;
  --green-soft: #1b2f1a;
  --blue: #1cb0f6;
  --blue-dark: #1899d6;
  --blue-soft: rgba(28, 176, 246, 0.15);
  --purple: #ce82ff;
  --purple-dark: #a568cc;
  --yellow: #ffc800;
  --yellow-dark: #e6a800;
  --red: #ff4b4b;
  --red-dark: #e63e3e;
  --gold: #ffc800;
  --gold-dark: #e5a600;
  --gold-tint: #2b2a14;
  --gold-tint-hover: #363415;
}
```

---

## 5. Official Chunky Component Catalog

All components reside in `apps/web/src/components/ui/`.

### 5.1 Buttons & Interactive Chips

- **`ChunkyButton` (`chunky-button.tsx`)**:
  - 3D bottom bevel with depression: `border-2 border-b-4 active:translate-y-[2px] active:border-b-2 font-extrabold uppercase tracking-[0.8px] text-[13px] rounded-2xl`.
  - Variants: `primary` (green), `blue`, `danger` (red), `gold`, `outline`, `translucent`.
  - Sizes: `default` (h-11), `sm` (h-9), `lg` (h-14), `icon` (w-11 h-11 circular).
- **`ChunkyChip` (`chunky-chip.tsx`)**:
  - Tactile filter & toggle chips (`h-11 min-h-11 px-3.5 rounded-[14px] border-2 border-b-4 font-extrabold text-[13px] uppercase tracking-[0.7px]`).
  - Variants: `default`, `active` (green), `blue`, `gold`, `danger`. Includes `pressed={boolean}` for ARIA state.
- **`BackButton` (`back-button.tsx`)**:
  - Standard chunky return button with chevron, green pill border, and `hover:bg-[var(--surface-raised)]`.

### 5.2 Form Controls

- **`ChunkyInput` (`chunky-input.tsx`)**:
  - Text/number input: `h-11 w-full rounded-2xl border-2 border-b-4 border-[var(--border)] bg-[var(--surface)] px-4 py-2 font-sans text-sm font-bold text-[var(--ink)]`.
  - Focus: `focus-visible:border-[var(--blue)] focus-visible:ring-2 focus-visible:ring-[var(--blue)]/40 outline-none`.
- **`ChunkyTextarea` (`chunky-textarea.tsx`)**:
  - Multiline text input: `min-h-[96px] w-full rounded-2xl border-2 border-b-4 border-[var(--border)] bg-[var(--surface)] px-4 py-2 font-sans text-sm font-bold text-[var(--ink)]`.
- **`ChunkySelect` (`chunky-select.tsx`)**:
  - Radix Select wrapper with `ChunkySelectTrigger` (`border-2 border-b-4 rounded-2xl h-11 font-bold text-sm`), `ChunkySelectContent` (`rounded-2xl border-2 shadow-2xl p-1.5`), and `ChunkySelectItem` (`rounded-xl py-2.5 pl-8`).
- **`ChunkyCheckbox` (`chunky-checkbox.tsx`)**:
  - Custom 24x24 checkbox: `h-6 w-6 rounded-[8px] border-2 border-b-4 active:translate-y-[2px] active:border-b-2`. Checked state uses `bg-[var(--green)] border-[var(--green-dark)] text-white`.

### 5.3 Modals, Drawers & Overlays

- **`ChunkyDialog` (`chunky-dialog.tsx`)**:
  - Centered modal dialog: `rounded-[24px] border-2 border-b-4 border-[var(--border)] bg-[var(--surface)] shadow-2xl overflow-hidden`.
  - Subcomponents: `ChunkyDialogHeader` (with 3D circular close button), `ChunkyDialogTitle` (font-display 20px bold), `ChunkyDialogDescription`, `ChunkyDialogBody` (scrollable flex-1), `ChunkyDialogFooter` (docked with border-t-2).
- **`ChunkyConfirmDialog` (`chunky-confirm-dialog.tsx`)**:
  - Standard confirmation modal with 3D danger badge (`TriangleAlert`), customizable title/description/labels, and pending loading spinner state.
- **`ChunkyDrawer` (`chunky-drawer.tsx`)**:
  - Right-aligned slide-out sheet: `w-full max-w-md md:max-w-xl rounded-l-[20px] border-l-2 border-y-2 border-[var(--border)] bg-[var(--surface)] shadow-2xl`.
  - Subcomponents: `ChunkyDrawerHeader`, `ChunkyDrawerTitle`, `ChunkyDrawerDescription`, `ChunkyDrawerBody`, `ChunkyDrawerFooter`.
- **`ChunkyTooltip` (`chunky-tooltip.tsx`)**:
  - Branded floating tooltip: `bg-[var(--surface-raised)] border-2 border-[var(--border)] text-[var(--ink)] font-sans font-bold text-xs rounded-xl shadow-lg px-2.5 py-1.5`.
  - Dual API: Convenient shorthand `<ChunkyTooltip content="...">...</ChunkyTooltip>` or composable primitives.

### 5.4 Cards, Menus & Navigation

- **`ChunkyCard` (`chunky-card.tsx`)**:
  - Tactile content panel: `rounded-2xl border-2 border-b-4 border-[var(--border)] bg-[var(--surface)]`.
  - Optional `interactive` hover lift (`hover:-translate-y-[2px] hover:shadow-lg`) and `selected` green tint state.
- **`ChunkyTabs` (`chunky-tabs.tsx`)**:
  - 3D segmented control: `ChunkyTabsList` (`rounded-2xl border-2 border-[var(--border)] bg-[var(--surface-raised)] p-1`) and `ChunkyTabsTrigger` (`rounded-xl font-extrabold text-[13px] data-[state=active]:bg-[var(--surface)] data-[state=active]:shadow-md data-[state=active]:border-2 data-[state=active]:border-[var(--border)]`).
- **`ChunkyActionMenu` (`chunky-action-menu.tsx`)**:
  - Portaled kebab / 3-dot dropdown menu: 40x40 3D trigger with rounded-2xl chunky popover sheet.
- **`ChunkySkeleton` (`chunky-skeleton.tsx`)**:
  - Tactile pulse placeholder: `rounded-2xl border-2 border-[var(--border)] bg-[var(--surface-raised)] animate-pulse`.


### 5.5 Chunky Tables & Data Grids (Card-Row Pattern)

When implementing a tabular dataset (as seen in `@apps/web/src/modules/videos/internal/EpisodeTable.tsx`), **do NOT use flat unstyled HTML `<table>` elements**. Instead, follow the **Chunky Card-Row Grid pattern**:

1. **Header Row**:
   - CSS Grid layout aligned with body row columns (`grid gap-3.5 items-center px-4 pb-2`).
   - Column labels: `text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]`.
   - Select-all control: `ChunkyCheckbox` centered in the first column with `indeterminate` support.
   - Sortable columns: `<button type="button" className="flex items-center gap-1 font-extrabold uppercase hover:text-[var(--ink)] cursor-pointer">` with direction indicators (`↑`, `↓`, `↕`).
2. **List Container (`ChunkyCardList`)**:
   - Vertical flex stack: `flex flex-col gap-3` (`apps/web/src/components/ui/chunky-card.tsx`).
3. **Data Row Cards (`ChunkyCard`)**:
   - Tactile card item: `rounded-2xl border-2 border-b-4 border-[var(--border)] bg-[var(--surface)] p-3 items-center`.
   - Interactive hover lift: `interactive` prop or `hover:-translate-y-[2px] transition-all hover:border-[var(--border-strong)] cursor-pointer`.
   - Selected state: `selected` prop or `border-[var(--green)] bg-[var(--green-soft)]` with checked `ChunkyCheckbox`.
   - Order / Index badge: 40x40 3D box (`rounded-xl border-2 border-b-4 border-[var(--border)] bg-[var(--surface)] font-extrabold text-[var(--blue)] text-[15px] flex items-center justify-center`).
   - Primary text: `font-extrabold text-[15px] text-[var(--ink)] leading-snug`.
   - Secondary subtext: `font-semibold text-[13px] text-[var(--muted)] truncate`.
   - Row Actions: `ChunkyActionMenu` (40x40 3D kebab trigger with portaled popover items) in the trailing column.
4. **Empty State**:
   - 3D tactile empty container: `p-8 text-center rounded-2xl border-2 border-b-4 border-[var(--border)] bg-[var(--surface)]` with bold title and muted explanation text.
---

## 6. What NOT to Do

- **NEVER** use flat buttons without physical 3D active-click depression (`active:translate-y-[2px] active:border-b-2`).
- **NEVER** use native browser tooltips (`title="..."`) on interactive buttons. Always wrap with `<ChunkyTooltip>`.
- **NEVER** import or introduce legacy shadcn components (`button.tsx`, `dialog.tsx`, `input.tsx`, `checkbox.tsx`, `select.tsx`).
- **NEVER** use thin 1px subtle borders or sharp corners (`rounded-none`, `rounded-sm`, `rounded-md`). Minimum corner radius is 14px–16px (`rounded-2xl`).
- **NEVER** use flat unstyled `<table>` elements or generic gray HTML tables. Always adopt the Chunky Card-Row Grid pattern for tabular datasets.
- **NEVER** introduce arbitrary font families. Strictly use `Baloo 2` (`font-display`) for headings/branding and `Nunito` (`font-sans`) for body/controls.
