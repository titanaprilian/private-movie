# DESIGN.md

Design system specification for the Private Movie streaming application. This document is the single source of truth for UI styling, component tokens, and interactions. All agent code generation must strictly conform to these rules.

---

## 1. Stack & Architecture

- **Framework**: TanStack React, Vite / modern bundler.
- **Styling**: Tailwind CSS (utility classes) + CSS Custom Properties for theme tokens.
- **Components**: shadcn/ui headless pattern (Radix primitives with local component source in `@/components/ui`).
- **Typography**:
  - **Headings & Brand**: `Baloo 2` (weights 600, 700, 800)
  - **Body, UI & Meta**: `Nunito` (weights 400, 600, 700, 800)
- **Icons**: Inline Lucide/SVG, 2px stroke, `currentColor`.

---

## 2. Design Direction: "Playful Streaming / Duolingo-Inspired"

The application rejects rigid, flat console aesthetics in favor of a punchy, tactile, gamified streaming visual language:

- **Tactile 3D Buttons**: Thick bottom borders/shadows (`box-shadow: 0 4px/5px 0 var(--border-shade)`) with a physical `:active` depression (`translate-y-[4px]` and reduced shadow).
- **Chunky Geometries**: Generous corner radiuses (`rounded-2xl` 16px, `rounded-[20px]`, `rounded-full` 9999px). Sharp `rounded-sm` or `rounded-none` are prohibited.
- **Bold Border Definition**: High-contrast, tactile 2px borders (`border-2`) across cards, inputs, and search dialogs.
- **Vibrant Gamified Accents**: Feather Green, Sky Blue, Canary Yellow, Vivid Purple, and Coral Red on a dark or clean light canvas.

---

## 3. Color Tokens & CSS Variables

Tokens are declared on `:root` and overridden under `.dark`. Current UI runs primarily dark-first, with built-in light-mode pairings ready for future toggling.

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

  /* Duolingo Brand Palette & Depressed Shadows */
  --green: #58cc02;
  --green-dark: #46a302;
  --blue: #1cb0f6;
  --blue-dark: #1899d6;
  --purple: #ce82ff;
  --purple-dark: #a568cc;
  --yellow: #ffc800;
  --yellow-dark: #e6a800;
  --red: #ff4b4b;
  --red-dark: #e63e3e;

  /* shadcn Semantic Mappings */
  --background: var(--bg);
  --foreground: var(--ink);
  --card: var(--surface);
  --card-foreground: var(--ink);
  --popover: var(--surface);
  --popover-foreground: var(--ink);
  --primary: var(--green);
  --primary-foreground: #ffffff;
  --secondary: var(--surface-raised);
  --secondary-foreground: var(--ink);
  --muted-foreground: var(--muted);
  --accent: var(--blue);
  --accent-foreground: #ffffff;
  --destructive: var(--red);
  --destructive-foreground: #ffffff;
}

.dark {
  /* Canvas & Surfaces */
  --bg: #131417;
  --surface: #1e2024;
  --surface-raised: #282a2f;
  --ink: #f2f2ef;
  --muted: #9a9a93;
  --border: #2c2e33;
  --border-strong: #3f4249;

  /* Duolingo Brand Palette */
  --green: #58cc02;
  --green-dark: #46a302;
  --blue: #1cb0f6;
  --blue-dark: #1899d6;
  --purple: #ce82ff;
  --purple-dark: #a568cc;
  --yellow: #ffc800;
  --yellow-dark: #e6a800;
  --red: #ff4b4b;
  --red-dark: #e63e3e;

  /* shadcn Semantic Mappings */
  --background: var(--bg);
  --foreground: var(--ink);
  --card: var(--surface);
  --card-foreground: var(--ink);
  --popover: var(--surface);
  --popover-foreground: var(--ink);
  --primary: var(--green);
  --primary-foreground: #ffffff;
  --secondary: var(--surface-raised);
  --secondary-foreground: var(--ink);
  --muted-foreground: var(--muted);
  --accent: var(--blue);
  --accent-foreground: #ffffff;
  --destructive: var(--red);
  --destructive-foreground: #ffffff;
}
```

---

## 4. Typography

**Display & Headings**: `font-display` / `font-baloo` -> `'Baloo 2', cursive, sans-serif`. Use on hero titles, section titles, modal headers, and the wordmark.

**Body & Controls**: `font-sans` / `font-nunito` -> `'Nunito', sans-serif`. Use on descriptions, nav items, button labels, badge chips, and episode metadata.

**Scale**:

- Hero Title: `text-4xl md:text-6xl font-extrabold tracking-tight font-display`
- Section Title: `text-xl md:text-2xl font-bold font-display`
- Card Title / Episode: `text-sm font-bold font-sans`
- Badges & Meta: `text-xs font-extrabold tracking-wide uppercase font-sans`

---

## 5. Components & Interaction Rules

### 5.1 Buttons (`@/components/ui/button.tsx`)

Buttons feature Duolingo-style 3D bottom bevels and depress downward on click.

```typescript
// Core button mechanics:
// Default / Green: bg-[var(--green)] text-white shadow-[0_5px_0_var(--green-dark)] active:translate-y-1 active:shadow-[0_1px_0_var(--green-dark)]
// Secondary / Translucent: bg-white/20 text-white backdrop-blur-sm shadow-[0_5px_0_rgba(0,0,0,0.2)] active:translate-y-1 active:shadow-[0_1px_0_rgba(0,0,0,0.2)]
// Outline / Card Action: bg-[var(--bg)] border-2 border-[var(--border)] shadow-[0_5px_0_var(--border)] active:translate-y-1 active:shadow-[0_1px_0_var(--border)]
// Added / Success State: Trigger bounce animation + green fill
```

### 5.2 Cards & Horizontal Carousels

**Poster Card**: `flex-shrink-0 w-44 rounded-[20px] border-2 border-[var(--border)] overflow-hidden bg-[var(--bg)] transition-transform duration-150 hover:-translate-y-1 hover:border-[var(--blue)] cursor-pointer`.

**Episode Card**: `flex-shrink-0 w-72 rounded-[20px] border-2 border-[var(--border)] bg-[var(--bg)] hover:-translate-y-1 hover:border-[var(--blue)]`.

**Badges**:

- Type badge: `rounded-full px-2.5 py-1 text-xs font-extrabold bg-black/50 text-white`.
- Season/Status: `rounded-full px-2.5 py-1 text-xs font-extrabold bg-[var(--purple)] text-white`.
- Star rating: `rounded-full px-2.5 py-1 text-xs font-extrabold bg-[var(--yellow)] text-amber-950 flex items-center gap-1`.
- Episode tag: `rounded-full px-2.5 py-1 text-xs font-extrabold bg-[var(--green)] text-white`.

### 5.3 Navigation & Search

- Sticky top bar: `h-[76px] border-b-2 border-[var(--border)] bg-[var(--bg)]`.
- Wordmark: `font-display text-2xl font-extrabold text-[var(--ink)]`, secondary word colored `text-[var(--green)]`.
- Nav links: rounded pill tabs (`rounded-full px-4 py-2 text-sm font-extrabold`). Active state: `bg-[#1cb0f6]/15 text-[var(--blue)]`.
- Search Button & Popover: Circular icon button (`rounded-full border-2 border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--yellow)] hover:border-[var(--yellow-dark)]`). Popover panel: `rounded-2xl border-2 border-[var(--border)] p-4 shadow-2xl`.

### 5.4 Hero Banner

- Height: `h-[65vh] min-h-[420px] rounded-b-[32px] overflow-hidden relative`.
- Multi-stop gradient overlay from left/bottom to maintain legible text over movie backdrops.
- Indicator Dots: Pill-shaped dots (`w-6 h-2 rounded-full bg-white/40 [&.active]:bg-white transition-all`).

### 5.5 Detail Modal / Sheet

- Uses `@/components/ui/dialog` or `@/components/ui/sheet` styled as a fullscreen/high-elevation overlay.
- Circular close button with 3D drop-action (`shadow-[0_4px_0_rgba(0,0,0,0.15)] active:translate-y-[3px] active:shadow-[0_1px_0_rgba(0,0,0,0.15)]`).
- List CTA toggle: Bounces on toggle (`@keyframes bounce { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.1); } }`).

---

## 6. What NOT to Do

- Do NOT use muted zinc/slate gray palettes or thin 1px subtle borders.
- Do NOT use flat buttons without physical active-click press states (`active:translate-y-*` with box-shadows).
- Do NOT use square or sharp corners (`rounded-none`, `rounded-sm`, `rounded-md`). Keep radii between 16px and 9999px.
- Do NOT introduce arbitrary fonts; strictly use Baloo 2 for headings/branding and Nunito for UI elements.
