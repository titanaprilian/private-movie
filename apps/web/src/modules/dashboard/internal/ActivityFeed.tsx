import { Link } from '@tanstack/react-router';
import type { AdminDashboardOngoingSeason, AdminDashboardRecentSeries } from './api';
import { deriveActivityEvents, formatRelativeTime } from './formatters';

interface ActivityFeedProps {
  ongoingSeasons: AdminDashboardOngoingSeason[];
  recentSeries: AdminDashboardRecentSeries[];
}

function Tag({ kind }: { kind: 'failed' | 'updated' }) {
  if (kind === 'failed') {
    return (
      <span className="shrink-0 rounded-lg border border-red-300 bg-red-100 px-1.5 py-0.5 font-sans text-[11px] font-extrabold text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400">
        Failed
      </span>
    );
  }
  return (
    <span className="shrink-0 rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-1.5 py-0.5 font-sans text-[11px] font-extrabold text-[var(--muted)]">
      Updated
    </span>
  );
}

export function ActivityFeed({ ongoingSeasons, recentSeries }: ActivityFeedProps) {
  const events = deriveActivityEvents(ongoingSeasons, recentSeries);
  if (events.length === 0) {
    return (
      <div
        data-testid="recent-series-empty"
        className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 font-sans text-sm font-semibold text-[var(--muted)]"
      >
        No recent series activity yet.
      </div>
    );
  }
  return (
    <ul
      data-testid="activity-feed"
      className="mt-4 divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] bg-[var(--surface)]"
    >
      {events.map((event) =>
        event.kind === 'failed' ? (
          <li
            key={event.key}
            data-testid={`activity-row-${event.key}`}
            className="flex items-center gap-3 px-4 py-3"
          >
            <span data-testid={`activity-tag-${event.key}`} className="contents">
              <Tag kind="failed" />
            </span>
            <Link
              to="/admin/videos/$seriesId"
              params={{ seriesId: event.seriesId }}
              aria-label={`Manage ${event.title}`}
              className="min-w-0 flex-1 truncate font-sans text-sm font-bold text-[var(--ink)] hover:underline focus-visible:outline-2 focus-visible:outline-[var(--blue)]"
            >
              {event.title}
              <span className="ml-2 font-semibold text-[var(--muted)]">{event.detail}</span>
            </Link>
            <span className="shrink-0 font-sans text-xs font-semibold text-[var(--muted)]">
              {event.timeIso ? formatRelativeTime(event.timeIso) : 'never synced'}
            </span>
          </li>
        ) : (
          <li key={event.key} data-testid={`activity-row-${event.key}`}>
            <Link
              to="/admin/videos/$seriesId"
              params={{ seriesId: event.seriesId }}
              data-testid={`recent-series-card-${event.seriesId}`}
              aria-label={`Manage ${event.title}`}
              className="flex items-center gap-3 px-4 py-3 focus-visible:outline-2 focus-visible:outline-[var(--blue)]"
            >
              <span data-testid={`activity-tag-${event.key}`} className="contents">
                <Tag kind="updated" />
              </span>
              <span className="min-w-0 flex-1 truncate font-sans text-sm font-bold text-[var(--ink)]">
                {event.title}
                <span
                  data-testid={`recent-series-episodes-${event.seriesId}`}
                  className="ml-2 font-semibold text-[var(--muted)]"
                >
                  {event.detail}
                </span>
              </span>
              <span
                data-testid={`recent-series-updated-${event.seriesId}`}
                className="shrink-0 font-sans text-xs font-semibold text-[var(--muted)]"
              >
                {event.timeIso ? formatRelativeTime(event.timeIso) : 'recently'}
              </span>
            </Link>
          </li>
        )
      )}
    </ul>
  );
}
