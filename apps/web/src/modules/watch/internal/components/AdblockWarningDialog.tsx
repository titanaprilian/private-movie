import { Link } from '@tanstack/react-router';
import { ExternalLink, ShieldAlert } from 'lucide-react';
import { ChunkyButton } from '@/components/ui/chunky-button';
import {
  ChunkyDialog,
  ChunkyDialogContent,
  ChunkyDialogDescription,
  ChunkyDialogFooter,
  ChunkyDialogHeader,
  ChunkyDialogTitle,
} from '@/components/ui/chunky-dialog';
import type { AdblockWarningDialogProps } from '../types';

export function AdblockWarningDialog({
  open,
  onDismiss,
}: AdblockWarningDialogProps) {
  return (
    <ChunkyDialog open={open} onOpenChange={(o) => !o && onDismiss()}>
      <ChunkyDialogContent className="sm:max-w-md">
        <ChunkyDialogHeader>
          <div className="flex items-center gap-2 text-amber-500">
            <ShieldAlert className="h-5 w-5 shrink-0" />
            <ChunkyDialogTitle className="text-base">
              Ad Blocker Recommended
            </ChunkyDialogTitle>
          </div>
          <ChunkyDialogDescription className="text-xs leading-relaxed space-y-2 pt-1">
            <span>
              Third-party video mirrors may serve popups and unexpected
              redirects during playback. We strongly recommend using an ad
              blocker (such as uBlock Origin or Brave Shields) for an
              uninterrupted experience.
            </span>
          </ChunkyDialogDescription>
        </ChunkyDialogHeader>

        <ChunkyDialogFooter className="mt-0 flex-col-reverse sm:flex-row">
          <ChunkyButton variant="outline" size="sm" onClick={onDismiss}>
            Continue anyway
          </ChunkyButton>
          <ChunkyButton size="sm" asChild>
            <Link
              to="/guide/adblock"
              target="_blank"
              rel="noreferrer noopener"
              className="gap-1.5"
            >
              <span>View Adblock Guide</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </ChunkyButton>
        </ChunkyDialogFooter>
      </ChunkyDialogContent>
    </ChunkyDialog>
  );
}
