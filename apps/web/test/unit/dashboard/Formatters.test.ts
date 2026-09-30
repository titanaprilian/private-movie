import { describe, expect, it } from 'vitest';
import {
  formatCountdown,
  formatCountdownMinutes,
  formatGb,
  formatRelativeTime,
  formatSchedulerStatusText,
  formatSeriesFooter,
  formatStorageValue,
  isStorageTracked,
  schedulerStatusLabel,
} from '@/modules/dashboard';

describe('dashboard formatters', () => {
  it('formats GB values', () => {
    expect(formatGb(10737418240)).toBe('10.0 GB of 10.0 GB'.split(' of ')[0]);
    expect(formatGb(0)).toBe('0.0 GB');
  });

  it('formats relative time', () => {
    expect(formatRelativeTime(new Date(Date.now() - 30_000).toISOString())).toBe('just now');
    expect(formatRelativeTime(new Date(Date.now() - 5 * 60000).toISOString())).toBe('5m ago');
    expect(formatRelativeTime('not-a-date')).toBe('recently');
  });

  it('formats countdown', () => {
    expect(formatCountdown(null)).toBe('Not scheduled');
    expect(formatCountdown('invalid')).toBe('Not scheduled');
    expect(formatCountdown(new Date(Date.now() - 1000).toISOString())).toBe('Due now');
    expect(formatCountdown(new Date(Date.now() + 5 * 60000).toISOString())).toBe('in 5m');
  });

  it('resolves countdown minutes', () => {
    expect(formatCountdownMinutes(null)).toBeNull();
    expect(formatCountdownMinutes(new Date(Date.now() + 30 * 60000).toISOString())).toBe(30);
  });

  it('labels scheduler status', () => {
    expect(schedulerStatusLabel({ isEnabled: true, isExecuting: true })).toBe('Scraping');
    expect(schedulerStatusLabel({ isEnabled: true, isExecuting: false })).toBe('Active');
    expect(schedulerStatusLabel({ isEnabled: false, isExecuting: false })).toBe('Idle');
  });

  it('detects untracked storage', () => {
    expect(isStorageTracked(undefined)).toBe(false);
    expect(isStorageTracked(null)).toBe(false);
    expect(
      isStorageTracked({ totalUsedBytes: 0, totalLimitBytes: 100, percentUsed: 0 })
    ).toBe(false);
    expect(
      isStorageTracked({ totalUsedBytes: 10, totalLimitBytes: 100, percentUsed: 10 })
    ).toBe(true);
  });

  it('falls back to Not tracked for storage display', () => {
    expect(formatStorageValue(undefined)).toBe('Not tracked');
    expect(formatStorageValue({ totalUsedBytes: 0, totalLimitBytes: 50, percentUsed: 0 })).toBe(
      'Not tracked'
    );
    expect(
      formatStorageValue({ totalUsedBytes: 10737418240, totalLimitBytes: 107374182400, percentUsed: 10 })
    ).toBe('10.0 GB');
  });

  it('formats scheduler status text', () => {
    expect(
      formatSchedulerStatusText({ isEnabled: false, isExecuting: false, nextRunAt: null })
    ).toBe('Auto-scraper is off');
    expect(
      formatSchedulerStatusText({ isEnabled: true, isExecuting: true, nextRunAt: null })
    ).toContain('scraping now');
    expect(
      formatSchedulerStatusText({
        isEnabled: true,
        isExecuting: false,
        nextRunAt: new Date(Date.now() + 25 * 60000).toISOString(),
      })
    ).toBe('Auto-scraper is on · next run in 25 min');
  });

  it('formats the series footer', () => {
    expect(formatSeriesFooter(3, 4)).toBe('3 ongoing · 4 featured');
  });
});
