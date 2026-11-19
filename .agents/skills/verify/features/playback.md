# Playback

Playback allows users to browse catalog items, view series details, choose an episode, and mount the streaming video player for media playback.

## Sub-features

- `playback-navigate`: navigate from home catalog or series detail to watch route `/watch/$seriesId`.
- `playback-mount`: mount the video player container (`[data-testid="watch-player-container"]`) and the embed/hls player frame (`[data-testid="watch-player"]`).
- `playback-adblock-dialog`: handle or dismiss optional adblock advisory overlay before entering video player.

## How to get to it (user POV)

- Click on the hero play button (`[data-testid="hero-play"]`) from the home catalog page.
- Navigate directly to `/watch/series-e2e-1`.
- Click on any episode card from the series detail page.

## Driving it with control.sh

Preconditions:

- E2E database seeded with `series-e2e-1` and `episode-e2e-1` (`.agents/skills/verify/scripts/control.sh seed`).
- Doctor check passes (`.agents/skills/verify/scripts/control.sh doctor`).

- **Visit catalog.** Navigate to `/`. The hero slider is visible with test series "Akashic Records of Bastard Magic Instructor".
- **Initiate watch.** Click `[data-testid="hero-play"]`. The route transitions to `/watch/series-e2e-1`.
- **Dismiss advisory if present.** If adblock advisory dialog appears, click button with text "Continue Anyway".
- **Launch player.** Click `[data-testid="hero-play"]` on the series watch view.
- **Verify player mounted.** Assert `[data-testid="watch-player-container"]` and `[data-testid="watch-player"]` are visible within 15 seconds.
- **Capture proof.** Capture screenshot to `artifacts/verify/playback/player-mounted.png`.
- **Automated execution:** Run `.agents/skills/verify/scripts/control.sh drive test/e2e/web/playback.spec.ts`.

## Gotchas

- An adblock advisory dialog can overlay the page asynchronously; test runs should set localStorage `adblock_warning_dismissed="true"` on init or handle the dismiss button gracefully.
- Video playback embeds external/third-party streams that may fail to decode in headless browser sandboxes; the proof asserts that the player container and frame mounted properly with a valid stream source URL.
- Always retain `artifacts/verify/playback/player-mounted.png` after execution.
