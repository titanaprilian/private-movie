import { renderWithProviders, screen, userEvent } from '../../utils';
import { describe, expect, it, vi } from 'vitest';
import { SourceAddForm } from '@/modules/videos/internal/sources/components/table/SourceAddForm';

describe('SourceAddForm Component', () => {
  it('renders form inputs correctly', () => {
    renderWithProviders(
      <SourceAddForm isPending={false} onCancel={vi.fn()} onSave={vi.fn()} />
    );

    expect(screen.getByText('New Video Source')).toBeInTheDocument();
    expect(screen.getByLabelText(/type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/label/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/url \/ embed \/ key/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/quality/i)).toBeInTheDocument();
  });

  it('auto-selects 720p quality and suggests a clean label when pasting a direct video URL', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <SourceAddForm isPending={false} onCancel={vi.fn()} onSave={vi.fn()} />
    );

    const urlInput = screen.getByLabelText(/url \/ embed \/ key/i);
    const labelInput = screen.getByLabelText(/label/i);
    const qualityInput = screen.getByLabelText(/quality/i);

    await user.type(
      urlInput,
      'https://cdn.odcloud.net/anime/Otakudesu.io_TINC--06_720p.mp4'
    );

    expect(qualityInput).toHaveValue('720p');
    expect(labelInput).toHaveValue('Otakudesu.io_TINC--06_720p');
  });

  it('auto-detects 1080p quality and clean label for archive.org URLs with query params', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <SourceAddForm isPending={false} onCancel={vi.fn()} onSave={vi.fn()} />
    );

    const urlInput = screen.getByLabelText(/url \/ embed \/ key/i);
    const labelInput = screen.getByLabelText(/label/i);
    const qualityInput = screen.getByLabelText(/quality/i);

    await user.type(
      urlInput,
      'https://archive.org/download/anime_collection/Episode_01_1080p.mp4?token=xyz123&expires=9999'
    );

    expect(qualityInput).toHaveValue('1080p');
    expect(labelInput).toHaveValue('Episode_01_1080p');
  });

  it('preserves manual edits to label when URL is subsequently entered or focused', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <SourceAddForm isPending={false} onCancel={vi.fn()} onSave={vi.fn()} />
    );

    const urlInput = screen.getByLabelText(/url \/ embed \/ key/i);
    const labelInput = screen.getByLabelText(/label/i);
    const qualityInput = screen.getByLabelText(/quality/i);

    // User manually types a label first
    await user.type(labelInput, 'Custom Server Label');

    // User pastes URL with quality and filename
    await user.type(
      urlInput,
      'https://cdn.odcloud.net/anime/Otakudesu.io_TINC--06_720p.mp4'
    );

    // Subsequent focus and blur events on all fields
    await user.click(urlInput);
    await user.click(labelInput);
    await user.click(qualityInput);
    await user.tab();

    // Manual label is preserved, while quality is auto-selected
    expect(labelInput).toHaveValue('Custom Server Label');
    expect(qualityInput).toHaveValue('720p');
  });

  it('preserves manual edits to quality when URL is entered or subsequent focus events occur', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <SourceAddForm isPending={false} onCancel={vi.fn()} onSave={vi.fn()} />
    );

    const urlInput = screen.getByLabelText(/url \/ embed \/ key/i);
    const labelInput = screen.getByLabelText(/label/i);
    const qualityInput = screen.getByLabelText(/quality/i);

    // User manually types quality first
    await user.type(qualityInput, '1080p');

    // User enters a URL containing 720p
    await user.type(
      urlInput,
      'https://cdn.odcloud.net/anime/Otakudesu.io_TINC--06_720p.mp4'
    );

    // Trigger focus events
    await user.click(urlInput);
    await user.click(labelInput);
    await user.click(qualityInput);

    // Manual quality is preserved and label is auto-suggested
    expect(qualityInput).toHaveValue('1080p');
    expect(labelInput).toHaveValue('Otakudesu.io_TINC--06_720p');
  });

  it('auto-suggests a clean label when label field is cleared and URL changes', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <SourceAddForm isPending={false} onCancel={vi.fn()} onSave={vi.fn()} />
    );

    const urlInput = screen.getByLabelText(/url \/ embed \/ key/i);
    const labelInput = screen.getByLabelText(/label/i);

    // User types custom label
    await user.type(labelInput, 'Temporary Label');
    expect(labelInput).toHaveValue('Temporary Label');

    // User clears label field
    await user.clear(labelInput);
    expect(labelInput).toHaveValue('');

    // User enters URL
    await user.type(
      urlInput,
      'https://cdn.odcloud.net/anime/Otakudesu.io_TINC--06_720p.mp4'
    );

    // Clean label is auto-suggested because label field was empty
    expect(labelInput).toHaveValue('Otakudesu.io_TINC--06_720p');
  });

  it('submits form with auto-detected label and quality', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    renderWithProviders(
      <SourceAddForm isPending={false} onCancel={vi.fn()} onSave={onSave} />
    );

    const urlInput = screen.getByLabelText(/url \/ embed \/ key/i);

    await user.type(
      urlInput,
      'https://cdn.odcloud.net/anime/Otakudesu.io_TINC--06_720p.mp4'
    );

    const submitBtn = screen.getByRole('button', { name: /^add source$/i });
    await user.click(submitBtn);

    expect(onSave).toHaveBeenCalledWith({
      label: 'Otakudesu.io_TINC--06_720p',
      url: 'https://cdn.odcloud.net/anime/Otakudesu.io_TINC--06_720p.mp4',
      type: 'direct',
      quality: '720p',
    });
  });
});
