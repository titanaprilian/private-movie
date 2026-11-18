-- E2E Deterministic Seed Data
DELETE FROM video_sources;
DELETE FROM episodes;
DELETE FROM seasons;
DELETE FROM series_to_genres;
DELETE FROM series;
DELETE FROM genres;
DELETE FROM refresh_tokens;
DELETE FROM users;
DELETE FROM system;

-- Test User: test@example.com / password123
INSERT INTO users (id, name, email, password_hash, created_at, failed_attempts)
VALUES ('user-e2e-1', 'Test Admin', 'test@example.com', '$2b$10$/W0WAoqhJkNoV5..MEq/JujDUTCAusr5xBksbG6JLv84XMq2H4bay', '2026-01-01 00:00:00+00', 0);

-- System Settings
INSERT INTO system (id, key, value, created_at)
VALUES ('sys-e2e-1', 'environment', 'test', '2026-01-01 00:00:00+00');

-- Genre: Action
INSERT INTO genres (id, name, slug, is_big_genre, display_order, created_at, updated_at)
VALUES ('genre-e2e-1', 'Action', 'action', true, 1, '2026-01-01 00:00:00+00', '2026-01-01 00:00:00+00');

-- Series: Akashic Records
INSERT INTO series (id, title, description, type, poster_url, backdrop_url, logo_url, rating, tmdb_id, tmdb_sync_status, is_featured, is_ongoing_highlighted, created_at, updated_at)
VALUES (
  'series-e2e-1',
  'Akashic Records of Bastard Magic Instructor',
  'Glenn Radars is a new instructor at the Alzano Imperial Magic Academy.',
  'tv',
  'https://image.tmdb.org/t/p/w500/bbHXV8b6RS40dI5lvDjpIhARbZz.png',
  'https://image.tmdb.org/t/p/original/fgO75CVntyrDD0BnfQZat0Q2uiU.jpg',
  'https://image.tmdb.org/t/p/w500/bbHXV8b6RS40dI5lvDjpIhARbZz.png',
  '8.3',
  70637,
  'SYNCED',
  true,
  false,
  '2026-01-01 00:00:00+00',
  '2026-01-01 00:00:00+00'
);

-- Series Genre Mapping
INSERT INTO series_to_genres (series_id, genre_id)
VALUES ('series-e2e-1', 'genre-e2e-1');

-- Season 1
INSERT INTO seasons (id, series_id, title, description, poster_url, season_number, status, tmdb_sync_status, created_at, updated_at)
VALUES (
  'season-e2e-1',
  'series-e2e-1',
  'Season 1',
  'Season 1 of Akashic Records',
  'https://image.tmdb.org/t/p/w500/bbHXV8b6RS40dI5lvDjpIhARbZz.png',
  1,
  'completed',
  'SYNCED',
  '2026-01-01 00:00:00+00',
  '2026-01-01 00:00:00+00'
);

-- Episode 1
INSERT INTO episodes (id, title, "order", description, duration, season_id, thumbnail_url, rating, tmdb_season_number, tmdb_episode_number, is_unassigned, created_at, updated_at)
VALUES (
  'episode-e2e-1',
  'Episode 1: The Disillusioned Bastard',
  1,
  'Glenn Radars begins his lessons.',
  1440,
  'season-e2e-1',
  'https://image.tmdb.org/t/p/w500/bbHXV8b6RS40dI5lvDjpIhARbZz.png',
  '8.0',
  1,
  1,
  false,
  '2026-01-01 00:00:00+00',
  '2026-01-01 00:00:00+00'
);

-- Video Source
INSERT INTO video_sources (id, episode_id, type, url, label, quality, created_at, updated_at)
VALUES (
  'source-e2e-1',
  'episode-e2e-1',
  'embed',
  'https://desustream.me/dstream/desudesu/new/hd/index.php?id=test',
  'desudesuhd',
  '1080p',
  '2026-01-01 00:00:00+00',
  '2026-01-01 00:00:00+00'
);
