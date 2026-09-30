import { RefreshCw } from 'lucide-react';
import { ChunkyButton } from '@/components/ui/chunky-button';
import {
  ChunkySelect,
  ChunkySelectContent,
  ChunkySelectItem,
  ChunkySelectTrigger,
  ChunkySelectValue,
} from '@/components/ui/chunky-select';
import { SCHEDULER_INTERVAL_PRESETS, type AdminDashboardSchedulerTelemetry } from './api';
import { formatSchedulerStatusText } from './formatters';

interface SchedulerPanelProps {
  scheduler?: AdminDashboardSchedulerTelemetry | null;
  ongoingFailureCount?: number;
  isScrapeAllRunning: boolean;
  configPending: boolean;
  onScrapeAll: () => void;
  onIntervalChange: (minutes: number) => void;
  onToggle: () => void;
}

export function SchedulerPanel({
  scheduler,
  ongoingFailureCount = 0,
  isScrapeAllRunning,
  configPending,
  onScrapeAll,
  onIntervalChange,
  onToggle,
}: SchedulerPanelProps) {
  const isEnabled = scheduler?.isEnabled === true;
  const schedulerFailures = scheduler?.lastRunResult?.failureCount ?? 0;
  const failureCount = Math.max(schedulerFailures, ongoingFailureCount);
  const successCount = scheduler?.lastRunResult?.successCount ?? null;

  return (
    <section aria-labelledby="scheduler-panel-heading" data-testid="scheduler-controls-section">
      <h2
        id="scheduler-panel-heading"
        className="font-display text-xl font-extrabold tracking-tight text-[var(--ink)]"
      >
        Scheduler
      </h2>
      <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between min-w-0">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex items-center gap-2">
              <span
                aria-hidden="true"
                data-testid="scheduler-status-dot"
                className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                  isEnabled ? 'animate-pulse bg-[var(--green)]' : 'bg-[var(--muted)]'
                }`}
              />
              <p
                data-testid="scheduler-status-text"
                className="font-sans text-sm font-bold text-[var(--ink)]"
              >
                {scheduler
                  ? formatSchedulerStatusText(scheduler)
                  : 'Auto-scraper status unavailable'}
              </p>
            </div>
            <span data-testid="scheduler-next-run" className="sr-only">
              Next run: {scheduler?.nextRunAt ?? 'not scheduled'}
            </span>
            <span data-testid="scheduler-last-run-summary" className="sr-only">
              {scheduler?.lastRunResult
                ? `Last run: ${scheduler.lastRunResult.totalProcessed} processed, ${scheduler.lastRunResult.successCount} succeeded, ${scheduler.lastRunResult.failureCount} failed`
                : 'Last run: no runs recorded yet'}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <span
                data-testid="scheduler-interval-chip"
                className="rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 py-1 font-sans text-xs font-bold text-[var(--muted)]"
              >
                Every {scheduler?.intervalMinutes ?? '—'} min
              </span>
              {successCount !== null && (
                <span
                  data-testid="scheduler-success-chip"
                  className="rounded-xl border border-emerald-300 bg-[var(--green-soft)] px-2.5 py-1 font-sans text-xs font-bold text-[var(--green)] dark:border-emerald-800 dark:bg-emerald-950/40"
                >
                  {successCount} succeeded
                </span>
              )}
              {failureCount > 0 && (
                <span
                  data-testid="scheduler-failure-chip"
                  className="rounded-xl border border-red-300 bg-red-100 px-2.5 py-1 font-sans text-xs font-bold text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400"
                >
                  {failureCount} failed
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 min-w-0 shrink-0">
            <label
              htmlFor="scheduler-interval"
              className="font-sans text-xs font-bold text-[var(--muted)]"
            >
              Interval
            </label>
            <ChunkySelect
              value={scheduler ? String(scheduler.intervalMinutes) : undefined}
              onValueChange={(val) => onIntervalChange(Number(val))}
              disabled={configPending}
            >
              <ChunkySelectTrigger
                id="scheduler-interval"
                aria-label="Auto-scraper interval"
                data-testid="scheduler-interval"
                className="w-32"
              >
                <ChunkySelectValue placeholder="Interval" />
              </ChunkySelectTrigger>
              <ChunkySelectContent>
                {SCHEDULER_INTERVAL_PRESETS.map((preset) => (
                  <ChunkySelectItem key={preset.minutes} value={String(preset.minutes)}>
                    {preset.label}
                  </ChunkySelectItem>
                ))}
              </ChunkySelectContent>
            </ChunkySelect>
            <button
              type="button"
              role="switch"
              aria-checked={isEnabled}
              aria-label="Auto-scrape toggle"
              data-testid="scheduler-toggle"
              disabled={configPending}
              onClick={onToggle}
              className="inline-flex h-8 w-14 cursor-pointer items-center rounded-full border-2 border-[var(--border)] bg-[var(--surface-raised)] px-1 transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-[var(--blue)]"
            >
              <span
                aria-hidden="true"
                className={`grid h-5 w-5 place-items-center rounded-full border-2 border-[var(--border)] bg-[var(--surface)] font-sans text-[10px] font-extrabold text-[var(--ink)] transition-transform ${
                  isEnabled ? 'translate-x-6' : 'translate-x-0'
                }`}
              >
                {isEnabled ? '✓' : '○'}
              </span>
            </button>
            <span
              data-testid="scheduler-toggle-label"
              className="font-sans text-xs font-bold text-[var(--muted)]"
            >
              {isEnabled ? 'On' : 'Off'}
            </span>
            <ChunkyButton
              variant="primary"
              onClick={onScrapeAll}
              disabled={isScrapeAllRunning}
              aria-label="Scrape all ongoing series now"
              data-testid="scheduler-scrape-all"
            >
              <RefreshCw aria-hidden="true" className={isScrapeAllRunning ? 'animate-spin' : ''} />
              {isScrapeAllRunning ? 'Scraping…' : 'Scrape all ongoing'}
            </ChunkyButton>
          </div>
        </div>
      </div>
    </section>
  );
}
