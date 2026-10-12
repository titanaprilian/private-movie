import { describe, expect, it } from 'vitest';
import { render, screen } from '../../utils';
import {
  CountBadge,
  FieldBadge,
  MetaBadge,
  PillBadge,
  ProviderBadge,
  StatusBadge,
  WarningBadge,
} from '@/modules/videos/internal/ingestion/components/IngestionBadges';
import { StorageProviderSelect } from '@/modules/videos/internal/ingestion/components/StorageProviderSelect';
import { IngestionProgressBar } from '@/modules/videos/internal/ingestion/components/IngestionProgressBar';

describe('IngestionBadges', () => {
  it.each([
    ['completed'],
    ['success'],
  ])('renders green tone for %s status', (status) => {
    const { container } = render(<StatusBadge status={status} />);
    expect(screen.getByText(status)).toBeInTheDocument();
    expect(container.firstChild).toHaveClass('text-[var(--green)]');
  });

  it.each([
    ['ingesting'],
    ['uploading'],
    ['processing'],
  ])('renders pulsing gold tone for %s status', (status) => {
    const { container } = render(<StatusBadge status={status} />);
    expect(screen.getByText(status)).toBeInTheDocument();
    expect(container.firstChild).toHaveClass('animate-pulse');
    expect(container.firstChild).toHaveClass('text-[var(--gold)]');
  });

  it.each([
    ['failed'],
    ['error'],
  ])('renders red tone for %s status', (status) => {
    const { container } = render(<StatusBadge status={status} />);
    expect(screen.getByText(status)).toBeInTheDocument();
    expect(container.firstChild).toHaveClass('text-[var(--red)]');
  });

  it('renders muted tone for pending status', () => {
    const { container } = render(<StatusBadge status="pending" />);
    expect(screen.getByText('pending')).toBeInTheDocument();
    expect(container.firstChild).toHaveClass('text-[var(--muted)]');
  });

  it('renders pill, warning and provider badges', () => {
    render(
      <>
        <PillBadge>Detected Ep #3</PillBadge>
        <WarningBadge>Needs Review</WarningBadge>
        <ProviderBadge>Target: Main</ProviderBadge>
        <MetaBadge>S1</MetaBadge>
        <CountBadge tone="green">+2 new episodes</CountBadge>
        <FieldBadge>Title</FieldBadge>
      </>,
    );
    expect(screen.getByText('Detected Ep #3')).toBeInTheDocument();
    expect(screen.getByText('Needs Review')).toBeInTheDocument();
    expect(screen.getByText('Target: Main')).toBeInTheDocument();
    expect(screen.getByText('S1')).toBeInTheDocument();
    expect(screen.getByText('+2 new episodes')).toBeInTheDocument();
    expect(screen.getByText('Title')).toBeInTheDocument();
  });
});

describe('StorageProviderSelect', () => {
  const providers = [
    { id: 'p1', name: 'Main B2', isDefault: true },
    { id: 'p2', name: 'Backup S3', isDefault: false },
  ];

  it('renders expected test id and accessibility label', () => {
    render(
      <StorageProviderSelect
        storageProviders={providers}
        selectedStorageProviderId="p1"
        setSelectedStorageProviderId={() => {}}
      />,
    );
    const trigger = screen.getByTestId('bulk-ingest-storage-provider-select');
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-label', 'Target S3 Storage Provider');
  });

  it('renders nothing when no providers exist', () => {
    const { container } = render(
      <StorageProviderSelect
        storageProviders={[]}
        selectedStorageProviderId=""
        setSelectedStorageProviderId={() => {}}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe('IngestionProgressBar', () => {
  it('renders determinate progress with accessibility labels', () => {
    render(<IngestionProgressBar value={42} ariaLabel="Upload progress" />);
    const bar = screen.getByRole('progressbar', { name: /upload progress/i });
    expect(bar).toBeInTheDocument();
    expect(bar).toHaveAttribute('aria-valuenow', '42');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
  });

  it('renders indeterminate progress without a value', () => {
    render(<IngestionProgressBar value={null} ariaLabel="Extract progress" />);
    expect(
      screen.getByRole('progressbar', { name: /extract progress/i }),
    ).toBeInTheDocument();
  });
});
