import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { ReadinessDto } from '../../infrastructure/api/generated';
import { requestJson } from '../auth/authContext';

export interface AssistanceHealth {
  readonly conversations: { readonly supportActive: number; readonly waitingSupport: number };
  readonly notifications: { readonly deadLetter: number; readonly pending: number; readonly retryableFailed: number };
}

export function usePlatformReadiness() {
  return useQuery({
    queryKey: ['operations', 'readiness'],
    queryFn: () => requestJson<ReadinessDto>('/health/ready'),
    retry: false,
  });
}

export function useAssistanceHealth(enabled = true) {
  return useQuery({
    enabled,
    queryKey: ['operations', 'assistance-health'],
    queryFn: () => requestJson<AssistanceHealth>('/operations/health/assistance'),
    retry: false,
  });
}

export interface BlockchainReconciliation {
  readonly health: {
    readonly active_without_finality: number;
    readonly pending_events: number;
    readonly reorged_events: number;
    readonly unknown_commands: number;
  };
  readonly indexedEvents: number;
  readonly processed: boolean;
  readonly projection: { readonly commandRepairs: number; readonly licenseRepairs: number; readonly remainingMismatches: number };
  readonly reconciledCommandIds: readonly string[];
}

export function useBlockchainReconciliation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => requestJson<BlockchainReconciliation>('/operations/blockchain/reconcile', { method: 'POST' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['licenses'] });
      void queryClient.invalidateQueries({ queryKey: ['operations'] });
    },
  });
}
