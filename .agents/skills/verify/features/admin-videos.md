# Admin Videos

Admin Videos provides series and video asset management, allowing administrators to browse catalog entries, view seasons and episodes, and update metadata.

## Sub-features

- `admin-videos-list`: list all registered series in the admin management table.
- `admin-videos-detail`: inspect seasons and episodes associated with a specific series (`/admin/videos/$seriesId`).
- `admin-videos-sources`: view streaming video source URLs and resolution tags linked to an episode.

## How to get to it (user POV)

- Log in as admin at `/admin/login`.
- Click on "Videos" in the admin sidebar navigation or navigate to `/admin/videos`.
- Click on any series row to view `/admin/videos/$seriesId`.

## Driving it with control.sh

Preconditions:

- Logged in with valid admin credentials (`test@example.com` / `password123`).
- E2E database seeded with `series-e2e-1`, `season-e2e-1`, and `episode-e2e-1`.

- **Navigate to video management.** Go to `/admin/videos`.
- **Verify series entry.** Locate table row for "Akashic Records of Bastard Magic Instructor".
- **Inspect series details.** Click the series row or navigate to `/admin/videos/series-e2e-1`.
- **Verify season & episodes.** Confirm "Season 1" is listed with "Episode 1: The Disillusioned Bastard".
- **Capture proof.** Capture screenshot to `artifacts/verify/admin-videos/series-list.png`.

## Gotchas

- Unauthenticated users will be redirected to `/admin/login` immediately.
- Series metadata syncs with TMDB in background; verify that sync state badges ("SYNCED", "PENDING") render correctly without blocking UI responsiveness.
