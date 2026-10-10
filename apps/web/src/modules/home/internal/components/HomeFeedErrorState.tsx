import { ErrorState } from '@/components/ui/error-state';

export function HomeFeedErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      data-testid="home-feed-error"
      className="min-h-screen bg-[var(--bg)] text-[var(--ink)] flex items-center justify-center p-6"
    >
      <ErrorState
        title="Unable to Load Home Feed"
        description="We encountered an issue connecting to the backend server. Please check your network connection or try again."
        onRetry={onRetry}
        retryLabel="Retry Connection"
      />
    </div>
  );
}
