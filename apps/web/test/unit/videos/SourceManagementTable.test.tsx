import { renderWithProviders, screen, userEvent, waitFor } from '../../utils';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { SourceManagementTable } from '@/modules/videos/internal/SourceManagementTable';
import type { Episode, VideoSource } from '@/modules/videos/internal/api';

const mockSources: VideoSource[] = [
  {
    id: 'src-1',
    type: 'direct',
    url: 'https://stream.example.com/working.mp4',
    label: 'Server 1 Fast',
    quality: '1080p',
  },
  {
    id: 'src-2',
    type: 'embed',
    url: 'https://videobello.net/embed/broken404',
    label: 'Videobello Backup',
    quality: '720p',
  },
];

const mockEpisode: Episode = {
  id: 'ep-test-1',
  title: 'Test Episode Title',
  order: 1,
  videoSources: mockSources,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('SourceManagementTable Component', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : (input as Request).url;
      const method = init?.method?.toUpperCase() ?? 'GET';

      // Health check probe mock
      if (url.includes('/api/media/sources/check') && method === 'POST') {
        const body = init?.body ? JSON.parse(init.body as string) : {};
        if (body.url?.includes('working')) {
          return new Response(
            JSON.stringify({
              data: {
                status: 'working',
                statusCode: 200,
                latencyMs: 85,
                error: null,
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        } else {
          return new Response(
            JSON.stringify({
              data: {
                status: 'broken',
                statusCode: 404,
                latencyMs: 110,
                error: 'HTTP 404 Not Found',
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
      }

      // Add source mock
      if (url.includes('/api/episodes/ep-test-1/sources') && method === 'POST') {
        return new Response(
          JSON.stringify({
            data: {
              ...mockEpisode,
              videoSources: [
                ...mockEpisode.videoSources,
                {
                  id: 'src-new',
                  type: 'direct',
                  url: 'https://stream.example.com/new.mp4',
                  label: 'Brand New Source',
                  quality: '4K',
                },
              ],
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Update source mock
      if (url.includes('/api/episodes/ep-test-1/sources/src-1') && method === 'PATCH') {
        return new Response(
          JSON.stringify({
            data: {
              ...mockEpisode,
              videoSources: mockEpisode.videoSources.map((s) =>
                s.id === 'src-1' ? { ...s, label: 'Server 1 Renamed' } : s
              ),
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Delete source mock
      if (url.includes('/api/episodes/ep-test-1/sources/src-1') && method === 'DELETE') {
        return new Response(
          JSON.stringify({
            data: {
              ...mockEpisode,
              videoSources: mockEpisode.videoSources.filter((s) => s.id !== 'src-1'),
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(JSON.stringify({ error: { code: 'NOT_FOUND' } }), {
        status: 404,
      });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders source rows with type pill, quality, label, truncated url, and copy button', () => {
    renderWithProviders(<SourceManagementTable episode={mockEpisode} />);

    expect(screen.getByText('Video Sources')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument(); // count pill

    expect(screen.getByText('Server 1 Fast')).toBeInTheDocument();
    expect(screen.getByText('Videobello Backup')).toBeInTheDocument();
    expect(screen.getByText('1080p')).toBeInTheDocument();
    expect(screen.getByText('720p')).toBeInTheDocument();
    expect(screen.getByText('https://stream.example.com/working.mp4')).toBeInTheDocument();
    expect(screen.getByText('https://videobello.net/embed/broken404')).toBeInTheDocument();

    expect(screen.getByLabelText('Copy URL for Server 1 Fast')).toBeInTheDocument();
  });

  it('probes health check automatically and renders semantic Working / Broken badges', async () => {
    renderWithProviders(<SourceManagementTable episode={mockEpisode} />);

    // Working badge for src-1
    await waitFor(() => {
      expect(screen.getByText('Working')).toBeInTheDocument();
    });

    // Broken badge for src-2
    await waitFor(() => {
      expect(screen.getByText('Broken')).toBeInTheDocument();
    });
  });

  it('triggers on-demand health test probe when Test button is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SourceManagementTable episode={mockEpisode} />);

    // Wait until both initial probes finish and both buttons display "Test"
    await waitFor(() => {
      const testButtons = screen.getAllByRole('button', { name: /^test$/i });
      expect(testButtons.length).toBe(2);
    });

    const testButtons = screen.getAllByRole('button', { name: /^test$/i });
    await user.click(testButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Working')).toBeInTheDocument();
    });
  });

  it('copies URL to clipboard and gives feedback when copy button is clicked', async () => {
    const user = userEvent.setup();
    const writeTextSpy = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(navigator.clipboard, 'writeText').mockImplementation(writeTextSpy);

    renderWithProviders(<SourceManagementTable episode={mockEpisode} />);

    const copyBtn = screen.getByLabelText('Copy URL for Server 1 Fast');
    await user.click(copyBtn);

    expect(writeTextSpy).toHaveBeenCalledWith('https://stream.example.com/working.mp4');
    expect(screen.getByLabelText('Copied')).toBeInTheDocument();
  });

  it('allows adding a new source via inline form', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SourceManagementTable episode={mockEpisode} />);

    const addBtn = screen.getByRole('button', { name: /add source/i });
    await user.click(addBtn);

    expect(screen.getByText('New Video Source')).toBeInTheDocument();

    const labelInput = screen.getByPlaceholderText(/server 1 or 1080p stream/i);
    const urlInput = screen.getByPlaceholderText(/https:\/\/... or s3 key/i);
    const qualityInput = screen.getByPlaceholderText(/1080p, 720p/i);

    await user.type(labelInput, 'Brand New Source');
    await user.type(urlInput, 'https://stream.example.com/new.mp4');
    await user.type(qualityInput, '4K');

    const submitBtn = screen.getByRole('button', { name: /^add source$/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(screen.queryByText('New Video Source')).not.toBeInTheDocument();
    });
  });

  it('allows editing an existing source inline', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SourceManagementTable episode={mockEpisode} />);

    const editBtn = screen.getByLabelText('Edit Server 1 Fast');
    await user.click(editBtn);

    expect(screen.getByText('Edit Source')).toBeInTheDocument();
    const labelInput = screen.getByDisplayValue('Server 1 Fast');
    await user.clear(labelInput);
    await user.type(labelInput, 'Server 1 Renamed');

    const saveBtn = screen.getByRole('button', { name: /^save$/i });
    await user.click(saveBtn);

    await waitFor(() => {
      expect(screen.queryByText('Edit Source')).not.toBeInTheDocument();
    });
  });

  it('supports deleting an existing source with confirmation', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SourceManagementTable episode={mockEpisode} />);

    const deleteBtn = screen.getByLabelText('Delete Server 1 Fast');
    await user.click(deleteBtn);

    expect(screen.getByText('Remove "Server 1 Fast"?')).toBeInTheDocument();

    const confirmDeleteBtn = screen.getByRole('button', { name: /^delete$/i });
    await user.click(confirmDeleteBtn);

    await waitFor(() => {
      expect(screen.queryByText('Remove "Server 1 Fast"?')).not.toBeInTheDocument();
    });
  });

  it('opens VideoPreviewModal when clicking Preview on a source row', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SourceManagementTable episode={mockEpisode} />);

    const previewButtons = screen.getAllByRole('button', { name: /^preview$/i });
    await user.click(previewButtons[0]);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getAllByText(/Server 1 Fast/).length).toBeGreaterThan(0);
  });

  it('renders ingest and upload action buttons and triggers callbacks when provided', async () => {
    const user = userEvent.setup();
    const onOpenAdvancedIngest = vi.fn();

    renderWithProviders(
      <SourceManagementTable
        episode={mockEpisode}
        onOpenAdvancedIngest={onOpenAdvancedIngest}
      />
    );

    const ingestBtn = screen.getByRole('button', { name: /^ingest$/i });
    const uploadBtn = screen.getByRole('button', { name: /^upload$/i });

    await user.click(ingestBtn);
    expect(onOpenAdvancedIngest).toHaveBeenCalledWith('remote-ingest');

    await user.click(uploadBtn);
    expect(onOpenAdvancedIngest).toHaveBeenCalledWith('upload-s3');
  });
});
