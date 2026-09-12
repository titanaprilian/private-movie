import { createFileRoute } from '@tanstack/react-router';
import { AdblockGuideView } from '@/modules/guide';

export const Route = createFileRoute('/guide/adblock')({
  component: AdblockGuidePage,
});

export function AdblockGuidePage() {
  return <AdblockGuideView />;
}
