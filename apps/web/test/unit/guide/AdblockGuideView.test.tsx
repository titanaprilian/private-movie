import { describe, expect, it } from 'vitest';
import { renderWithProviders, screen } from '../../utils';
import { AdblockGuideView } from '@/modules/guide';

describe('AdblockGuideView', () => {
  it('renders the header and platform section headings', () => {
    renderWithProviders(<AdblockGuideView />);

    expect(screen.getByRole('heading', { level: 1, name: /adblock setup guide/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /^Desktop$/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /^Android$/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /^iOS & iPadOS$/i })).toBeInTheDocument();
  });

  it('renders instructions for Desktop, Android, and iOS', () => {
    renderWithProviders(<AdblockGuideView />);

    // Desktop mentions uBlock Origin, Brave Browser, etc.
    expect(screen.getByRole('heading', { level: 3, name: /^uBlock Origin \(Recommended\)$/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: /^Brave Browser$/i })).toBeInTheDocument();
    expect(screen.getByText(/Chrome Web Store/i)).toBeInTheDocument();

    // Android mentions AdGuard DNS and Brave Browser for Android
    expect(screen.getByRole('heading', { level: 3, name: /^AdGuard Private DNS \(System-wide\)$/i })).toBeInTheDocument();
    expect(screen.getByText(/dns\.adguard-dns\.com/i)).toBeInTheDocument();

    // iOS mentions Safari Content Blockers
    expect(screen.getByRole('heading', { level: 3, name: /^Safari Content Blockers \(AdGuard \/ 1Blocker\)$/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: /^Brave Browser for iOS$/i })).toBeInTheDocument();
  });

  it('allows expanding and collapsing platform sections on click', async () => {
    const { user } = renderWithProviders(<AdblockGuideView />);

    const desktopHeader = screen.getByRole('button', { name: /desktop/i });
    expect(screen.getByRole('heading', { level: 3, name: /^uBlock Origin \(Recommended\)$/i })).toBeVisible();

    // Click desktop header to collapse
    await user.click(desktopHeader);
    expect(screen.queryByRole('heading', { level: 3, name: /^uBlock Origin \(Recommended\)$/i })).not.toBeInTheDocument();

    // Click desktop header again to expand
    await user.click(desktopHeader);
    expect(screen.getByRole('heading', { level: 3, name: /^uBlock Origin \(Recommended\)$/i })).toBeVisible();
  });
});
