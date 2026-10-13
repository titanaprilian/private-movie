import { cn } from '@/lib/utils';

import { StarToggleButton } from './StarToggleButton';
import type { FeaturedStarProps } from '../../types';
export type { FeaturedStarProps } from '../../types';

export function FeaturedStar({
  featured,
  title,
  onToggle,
  className,
  ...props
}: FeaturedStarProps) {
  return (
    <StarToggleButton
      active={featured}
      onToggle={onToggle}
      activeTooltip="Remove from featured"
      inactiveTooltip="Mark as featured"
      activeLabel={`Remove ${title ?? 'series'} from featured`}
      inactiveLabel={`Mark ${title ?? 'series'} as featured`}
      data-featured={featured ? 'true' : 'false'}
      className={cn('featured-star', className)}
      {...props}
    />
  );
}
