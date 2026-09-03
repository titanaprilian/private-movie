Reviewed and verified for ticket #279.

Evidence checked:
- The watcher/detail flow perfectly implements the source picker handling using `decideEpisodePlayback`.
- `AppNavigation` safely shuttles the URL and source type as arguments to `PlayerScreen`.
- `PlayerScreen` retrieves and maps the handoff context efficiently with clear failure rendering when target sources are missing.
- Backend integration properly tested using `tv-mvp-flow.test.ts`. All MVP flow aspects against real backend passed.
- Local Android tests via `./gradlew clean testDebugUnitTest` passed correctly.

Acceptance criteria verified:
- Viewers can complete full MVP flow (home to direct source play / embed).
- Source picker handoff logic works seamlessly.
- Error states explicitly mapped.
- E2E testing covers this primary public journey.
