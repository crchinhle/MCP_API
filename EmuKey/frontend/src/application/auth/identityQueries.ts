import { useQuery } from '@tanstack/react-query';

import type { ProviderInvitationDto } from '../../infrastructure/api/generated';
import { requestJson, type AuthUser } from './authContext';

export function useSystemUsers(query = '', enabled = true) {
  return useQuery({
    queryKey: ['identity', 'users', query],
    queryFn: () => requestJson<AuthUser[]>(`/auth/users${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ''}`),
    enabled,
  });
}

export function useProviderInvitations() {
  return useQuery({
    queryKey: ['identity', 'provider-invitations'],
    queryFn: () => requestJson<ProviderInvitationDto[]>('/auth/provider-invitations'),
  });
}
