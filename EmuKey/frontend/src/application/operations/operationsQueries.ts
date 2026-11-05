import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { requestJson } from '../auth/authContext';
import type { DeadLetterRecoveryDto, OperationsHealthDto, Phase6CommandDto } from '../../infrastructure/api/generated';
import type {ProviderIntegrationViewDto,ProviderDeliveryViewDto,SaveProviderIntegrationDto} from '../../infrastructure/api/generated';

export function useProviderIntegration() {
  return useQuery({queryKey:['operations','provider-integration'],queryFn:()=>requestJson<ProviderIntegrationViewDto|null>('/provider/integration'),retry:false});
}
export function useUpdateProviderIntegration() {
  const client=useQueryClient();
  return useMutation({mutationFn:({action,input}:{action:'save'|'test'|'ENABLE'|'DISABLE';input?:SaveProviderIntegrationDto|{configVersion:number}})=>
    requestJson<ProviderIntegrationViewDto>(action==='save'?'/provider/integration':action==='test'?'/provider/integration/test':'/provider/integration/state',{
      method:action==='save'?'PUT':'POST',body:JSON.stringify(action==='ENABLE'||action==='DISABLE'?{...input,action}:input ?? {})}),
    onSuccess:(data)=>{client.setQueryData(['operations','provider-integration'],data);void client.invalidateQueries({queryKey:['operations','provider-deliveries']});}});
}
export function useProviderDeliveries(scope:'provider'|'operations',status:string,page:number) {
  return useQuery({queryKey:['operations','provider-deliveries',scope,status,page],
    queryFn:()=>requestJson<ProviderDeliveryViewDto[]>(`/${scope}/license-deliveries?status=${encodeURIComponent(status)}&page=${page}`),retry:false,refetchInterval:10000});
}
export function useRetryProviderDelivery(scope:'provider'|'operations') {
  const client=useQueryClient();
  return useMutation({mutationFn:({id,reason}:{id:string;reason:string})=>requestJson(`/${scope}/license-deliveries/${encodeURIComponent(id)}/retry`,{method:'POST',body:JSON.stringify({reason})}),
    onSuccess:()=>{void client.invalidateQueries({queryKey:['operations','provider-deliveries']});}});
}

export type AssistanceHealth = OperationsHealthDto;

export function useAssistanceHealth(enabled = true) {
  return useQuery({
    enabled,
    queryKey: ['operations', 'assistance-health'],
    queryFn: () => requestJson<AssistanceHealth>('/operations/health/assistance'),
    retry: false,
    refetchInterval: 15_000,
  });
}

export function useDeadLetterRecovery() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ commandId, input }: { commandId: string; input: DeadLetterRecoveryDto }) =>
      requestJson<Phase6CommandDto>(`/operations/blockchain/dead-letters/${encodeURIComponent(commandId)}/recover`, { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['phase6-command'] });
      void queryClient.invalidateQueries({ queryKey: ['operations'] });
    },
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
