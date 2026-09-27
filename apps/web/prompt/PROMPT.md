# Task: Restyle the video player screen to match the Duolingo-style mockup

## Context

The app already uses a Duolingo-style design system elsewhere (rounded, chunky,
playful, high-contrast). The video player screen (native `<video controls>`,
server selector row, and episode/metadata card) does not match this style yet.
A static HTML/CSS mockup of the target design has been provided:
`index.html` + `style.css`.

## Goal

Reproduce the mockup's visual design in our real components, without changing
any existing data-fetching, routing, or player logic. This is a **styling and
markup pass**, not a rebuild of functionality.

## Files to reference

- `index.html` — structure/markup for every section (back button, video
  shell + custom control bar, prev/next + server selector + reload/open tab
  row, metadata card, episode list).
- `style.css` — all styling: CSS custom properties (colors, radii), typography,
  button states, badges, cards.

## Requirements

1. **Design tokens**
   - Port the `:root` CSS variables (`--bg`, `--panel`, `--border`, `--green`,
     `--blue`, `--yellow`, `--radius-lg`, `--radius-md`, `--radius-full`, etc.)
     into our existing theme/tokens file. If we already have equivalent
     tokens (e.g. from the rest of the Duolingo-style redesign), map to those
     instead of introducing duplicates — don't create a second color system.
   - Fonts: `Baloo 2` for headings/labels, `Nunito` for body text. Use
     whatever font-loading mechanism the rest of the app already uses (don't
     add a raw Google Fonts `<link>` if we already bundle fonts).

2. **Video controls**
   - Replace the native `<video controls>` UI with a custom control bar
     component, matching the mockup's floating rounded pill bar: play/pause
     as a circular button with a "pressed" bottom-shadow that collapses on
     press, a thick rounded progress track with colored fill + scrubber dot,
     time labels, and secondary controls (volume, fullscreen, more menu)
     grouped to the right with a vertical divider.
   - Preserve all existing playback behavior (play/pause, seek, volume,
     fullscreen, the "more" menu) — only the presentation changes. Wire the
     new buttons to the existing handlers/state.

3. **Prev / Next / Server selector / Reload / Open Tab row**
   - Prev/Next become a segmented pill group (`seg-group` / `seg-btn` in the
     mockup).
   - The server dropdown becomes a rounded chip with a status dot, server
     name, an "N available" count badge, and a circular chevron button that
     opens the existing server list/dropdown logic.
   - Reload and Open Tab become pill buttons; Open Tab is the primary
     (filled/colored) action, Reload is secondary (outlined).

4. **Metadata card**
   - Wrap episode metadata in a rounded card (`meta-card`).
   - The arc/subgroup title (e.g. "You and I Are Polar Opposites") becomes a
     tinted pill badge, not plain colored text.
   - "Season X" and duration become separate rounded chip badges (duration
     chip uses the yellow accent, season uses the neutral chip style).
   - Keep the description text and its truncation/line-length as-is
     structurally, just restyle per the mockup's `meta-desc`.

5. **Episode list**
   - Each episode becomes a rounded card row (`ep-row`): index number,
     thumbnail (use real thumbnail images if we have them, otherwise keep a
     placeholder icon matching the mockup), title, one-line truncated
     description, and a green checkmark badge for the current/watched
     episode (`ep-row.active`).
   - Add hover (slight lift) and active/press (slight scale down) feedback
     consistent with the rest of the app's interactive elements.

6. **Responsiveness & accessibility**
   - Keep everything usable down to mobile widths — see the mockup's
     `@media (max-width: 600px)` block for the minimum breakpoint behavior.
   - All interactive elements must remain real, focusable, keyboard-operable
     controls (`<button>`, not `<div onClick>`), with visible focus states.
   - Don't regress any existing ARIA labels/roles on the player — carry them
     over onto the new markup.

## Non-goals

- Do not change player logic, data fetching, routing, or the underlying
  video element's behavior.
- Do not introduce a second/parallel design-token system — reuse or extend
  existing tokens if they already cover part of this (colors, radii, fonts).
- Do not add the episode thumbnails/images asset pipeline as part of this
  task if it doesn't already exist — placeholders are fine until that's a
  separate task.

## Acceptance criteria

- Visual result matches `index.html`/`style.css` (rounded pill controls,
  chunky pressed-button shadows, badge-style metadata, card-style episode
  rows) using the app's existing color/typography tokens where they overlap.
- All existing player functionality (play, pause, seek, volume, fullscreen,
  server switching, reload, open tab, prev/next, episode selection) works
  exactly as before.
- No console errors/warnings introduced; passes existing lint/type checks.
