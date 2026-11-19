# Catalog

Catalog covers browsing available series, featured series display in the hero slider, and genre filtering ribbons across the web client.

## Sub-features

- `catalog-hero`: render the featured hero slider with series backdrop, title, and action buttons.
- `catalog-feed`: display the categorized home feed sections (continue watching, recent releases, genres).
- `catalog-genre`: filter and display series matching a selected genre slug (`/genres/$slug`).

## How to get to it (user POV)

- Navigate to `/` (home page).
- Click on any genre badge or navigate to `/genres/action`.
- Scroll through the catalog sections on the home page.

## Driving it with control.sh

Preconditions:

- E2E database seeded with series `series-e2e-1` tagged with genre `action`.
- Backend and web frontend responding.

- **Load home page.** Navigate to `http://localhost:5173/`.
- **Verify hero slider.** Assert `[data-testid="hero-slider"]` is visible and contains series title "Akashic Records of Bastard Magic Instructor".
- **Verify genre ribbon.** Check that genre "Action" is visible in the genre navigation bar.
- **Navigate to genre view.** Click on genre "Action" or navigate to `/genres/action`. Verify series card is rendered in the genre list.
- **Capture proof.** Capture screenshot to `artifacts/verify/catalog/home-feed.png`.

## Gotchas

- If no series has `is_featured = true`, the hero slider may render a fallback placeholder; the seed script ensures `series-e2e-1` has `is_featured: true`.
- TMDB image URLs may fail to load when offline; verify that the UI renders graceful fallback image containers without throwing unhandled exceptions.
