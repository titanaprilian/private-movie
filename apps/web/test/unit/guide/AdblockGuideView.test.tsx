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

  it('keeps platform sections collapsed by default and reveals instructions on click', async () => {
    const { user } = renderWithProviders(<AdblockGuideView />);

    // Initially collapsed
    expect(screen.queryByRole('heading', { level: 3, name: /^uBlock Origin \(Recommended\)$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 3, name: /^AdGuard Private DNS \(System-wide\)$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 3, name: /^Safari Content Blockers \(AdGuard \/ 1Blocker\)$/i })).not.toBeInTheDocument();

    // Expand desktop
    const desktopHeader = screen.getByRole('button', { name: /desktop/i });
    await user.click(desktopHeader);

    expect(screen.getByRole('heading', { level: 3, name: /^uBlock Origin \(Recommended\)$/i })).toBeVisible();
    expect(screen.getByRole('heading', { level: 3, name: /^Brave Browser$/i })).toBeVisible();
    expect(screen.getByText(/Chrome Web Store/i)).toBeInTheDocument();

    // Collapse desktop again
    await user.click(desktopHeader);
    expect(screen.queryByRole('heading', { level: 3, name: /^uBlock Origin \(Recommended\)$/i })).not.toBeInTheDocument();
  });

  it('allows expanding Android and iOS sections to view instructions', async () => {
    const { user } = renderWithProviders(<AdblockGuideView />);

    // Expand Android
    const androidHeader = screen.getByRole('button', { name: /android/i });
    await user.click(androidHeader);
    expect(screen.getByRole('heading', { level: 3, name: /^AdGuard Private DNS \(System-wide\)$/i })).toBeVisible();
    expect(screen.getByText(/dns\.adguard-dns\.com/i)).toBeInTheDocument();

    // Expand iOS
    const iosHeader = screen.getByRole('button', { name: /ios/i });
    await user.click(iosHeader);
    expect(screen.getByRole('heading', { level: 3, name: /^Safari Content Blockers \(AdGuard \/ 1Blocker\)$/i })).toBeVisible();
    expect(screen.getByRole('heading', { level: 3, name: /^Brave Browser for iOS$/i })).toBeVisible();
  });
});
