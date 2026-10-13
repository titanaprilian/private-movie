import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { checkVideoSource, type CheckVideoSourceResult } from '../../api';
import type {
  UseSourceHealthProbeOptions,
  UseSourceHealthProbeReturn,
} from '../types';

export function useSourceHealthProbe({
  source,
}: UseSourceHealthProbeOptions): UseSourceHealthProbeReturn {
  const queryClient = useQueryClient();
  const [isManualTesting, setIsManualTesting] = useState(false);

  const queryKey = ['source-health', source.url, source.type];
  const {
    data: healthResult,
    isLoading,
    refetch,
  } = useQuery<CheckVideoSourceResult>({
    queryKey,
    queryFn: () => checkVideoSource({ url: source.url, type: source.type }),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const handleTestProbe = async () => {
    setIsManualTesting(true);
    try {
      await queryClient.invalidateQueries({ queryKey });
      await refetch();
      toast.info(`Health check finished for "${source.label}"`);
    } catch {
      toast.error('Health probe request failed');
    } finally {
      setIsManualTesting(false);
    }
  };

  const isTesting = isLoading || isManualTesting;
  const healthStatus = isTesting
    ? 'testing'
    : healthResult?.status === 'working'
      ? 'working'
      : healthResult?.status === 'broken'
        ? 'broken'
        : 'unknown';

  return { healthResult, isTesting, healthStatus, handleTestProbe };
}
